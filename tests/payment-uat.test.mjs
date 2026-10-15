import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { loadJobConfig } from '../server/payments/job-config.ts';
import { createJobQueue } from '../server/payments/job-queue.ts';
import { createPaymentStore, createStore } from '../server/payments/store.ts';
import { productionTarget, sandboxTarget } from '../server/payments/targets.ts';
import { renderUatSchema } from '../scripts/payment-uat-schema.mjs';
import { pgliteSql } from './support/pglite-sql.mjs';

const env = { PAYMENT_JOBS_ENABLED:'true', VERCEL_ENV:'production', PHONEPE_ENV:'sandbox',
  VERCEL_PROJECT_ID:sandboxTarget.projectId, PAYMENT_SITE_ORIGIN:sandboxTarget.origin,
  QSTASH_TOKEN:'fixture', QSTASH_CURRENT_SIGNING_KEY:'fixture-current', QSTASH_NEXT_SIGNING_KEY:'fixture-next' };

test('sandbox queue is bound to its exact project, origin and environment', () => {
  const config=loadJobConfig(env);
  assert.equal(config.ready,true); assert.equal(config.environment,'sandbox');
  assert.equal(config.jobUrl,`${sandboxTarget.origin}/api/payments/jobs`);
  for(const change of [{VERCEL_PROJECT_ID:undefined},{VERCEL_PROJECT_ID:productionTarget.projectId},
    {PHONEPE_ENV:'production'},{VERCEL_ENV:'preview'},{PAYMENT_SITE_ORIGIN:productionTarget.origin},
    {PAYMENT_SITE_ORIGIN:`${sandboxTarget.origin}.evil.test`},{NODE_TLS_REJECT_UNAUTHORIZED:'0'}]) {
    assert.equal(loadJobConfig({...env,...change}).ready,false);
  }
  assert.equal(loadJobConfig({...env,PAYMENT_JOBS_ENABLED:'false'}).ready,false);
});

test('UAT publisher cannot deliver a production job or choose a caller destination', async () => {
  const calls=[];
  const queue=createJobQueue(loadJobConfig(env), {send:async(url,options)=>{
    calls.push({url,options}); return Response.json({messageId:'fixture-receipt'});
  }});
  const job={id:crypto.randomUUID(),orderId:crypto.randomUUID(),environment:'sandbox',generation:1,dueAt:new Date()};
  await assert.rejects(queue.publish({...job,environment:'production'})); assert.equal(calls.length,0);
  await queue.publish(job);
  assert.equal(calls[0].url,`https://qstash.upstash.io/v2/publish/${sandboxTarget.origin}/api/payments/jobs`);
  assert.deepEqual(JSON.parse(calls[0].options.body),{jobId:job.id});
});

test('sandbox and production database credentials cannot be swapped', () => {
  for(const [environment,role] of [['sandbox',productionTarget.role],['production',sandboxTarget.role]]) {
    assert.throws(()=>createStore({environment,databaseUrl:`postgresql://${role}:fixture@localhost/postgres`}),/restricted/);
  }
});

test('UAT schema isolates sandbox store queries and has no production privileges', async () => {
  const db=new PGlite();
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
    for(const file of ['payment-orders.sql','payment-backend.sql','payment-jobs.sql']) {
      await db.exec(await readFile(new URL(`../database/${file}`,import.meta.url),'utf8'));
    }
    const migration=await renderUatSchema();
    assert.doesNotMatch(migration,/\bprivate_payments\./);
    await db.exec(migration);
    await assert.rejects(db.exec(migration),/already exists/); await db.exec('ROLLBACK');
    const [access]=(await db.query(`SELECT has_schema_privilege('portfolio_payments_uat','private_payments','USAGE') AS live,
      has_schema_privilege('portfolio_payments_api','private_payments_uat','USAGE') AS uat,
      (SELECT rolcanlogin FROM pg_roles WHERE rolname='portfolio_payments_uat') AS login`)).rows;
    assert.deepEqual(access,{live:false,uat:false,login:false});
    await db.exec('SET ROLE portfolio_payments_uat; BEGIN;');
    let savepoint=0;
    const sql=pgliteSql(db);
    sql.begin=async run=>{
      const name=`uat_${++savepoint}`; await db.exec(`SAVEPOINT ${name}`);
      try {const result=await run(sql);await db.exec(`RELEASE ${name}`);return result;}
      catch(error){await db.exec(`ROLLBACK TO ${name}`);throw error;}
    };
    const store=createPaymentStore(sql,{environment:'sandbox',jobsEnabled:true});
    await store.rate('sandbox-fixture',5,60);
    const reservation=await store.reserve({purpose:'project',name:'Fixture',email:'fixture@example.test',reference:'UAT',amount:20000},
      crypto.randomUUID(),'a'.repeat(64));
    assert.equal(reservation.order.environment,'sandbox');assert.ok(reservation.job);
    assert.equal((await store.pendingJobs(reservation.order.id,3)).length,1);
    await store.published(reservation.job.id,'fixture-receipt');
    assert.equal((await store.claimCheckout(reservation.order.id,reservation.job.id)).id,reservation.order.id);
    const id=reservation.order.id;
    await store.checkout(id,{orderId:'OMO_UAT',expires:new Date(Date.now()+1200000),url:'https://mercury-uat.phonepe.com/transact?fixture'});
    assert.equal((await store.owned(id,'a'.repeat(64))).phonepe_order_id,'OMO_UAT');
    await assert.rejects(store.owned(id,'b'.repeat(64)),/session/);
    await store.recordEvent(reservation.order.merchant_order_id,'checkout.order.completed','b'.repeat(64));
    await db.query(`UPDATE private_payments_uat.orders SET next_reconcile_at=now()-interval '1 second' WHERE id=$1`,[id]);
    const [next]=await store.pendingJobs(id,3); assert.ok(next); assert.notEqual(next.id,reservation.job.id);
    await store.published(next.id,'fixture-successor');
    const claim=await store.claimJob(next.id); assert.equal(claim.kind,'READY');
    await store.applyStatus(claim.order,{state:'COMPLETED',amount:20000,orderId:'OMO_UAT'});
    assert.equal((await store.owned(id,'a'.repeat(64))).state,'COMPLETED');
    assert.equal((await store.pendingJobs(null,3)).length,0);
    await store.cleanupRates();
    await db.exec('ROLLBACK; RESET ROLE;');
    assert.equal(Number((await db.query('SELECT count(*) AS n FROM private_payments.orders')).rows[0].n),0);
    await db.exec('SET ROLE portfolio_payments_uat;');
    await assert.rejects(db.query('SELECT * FROM private_payments.orders'),/permission denied/);
    await assert.rejects(db.exec(`INSERT INTO private_payments_uat.orders(id,idempotency_key,merchant_order_id,purpose,
      customer_name,customer_email,project_reference,amount_paise,environment,session_token_hash)
      VALUES(gen_random_uuid(),gen_random_uuid(),'FORBIDDEN','project','Fixture','fixture@example.test','UAT',20000,'production',repeat('a',64))`),/uat_orders_sandbox_only/);
  } finally {await db.close();}
});

test('private UAT credential recipe cannot rotate production or expose a public endpoint', async () => {
  const recipe=await readFile(new URL('../database/manual-uat-secrets.sql',import.meta.url),'utf8');
  assert.match(recipe,/HUMAN-RUN ONLY/); assert.match(recipe,/pg_temp\.prepare_portfolio_uat_secrets/);
  assert.match(recipe,/SECURITY INVOKER/); assert.doesNotMatch(recipe,/SECURITY DEFINER/);
  assert.match(recipe,/flags\.rolcanlogin/); assert.match(recipe,/do not rerun or rotate/);
  assert.match(recipe,/ALTER ROLE portfolio_payments_uat LOGIN PASSWORD %L/);
  assert.doesNotMatch(recipe,/ALTER ROLE (?:postgres|portfolio_payments_api) /);
  assert.equal((recipe.match(/extensions\.gen_random_bytes\(32\)/g)??[]).length,4);
});
