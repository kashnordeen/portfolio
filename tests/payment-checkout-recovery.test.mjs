import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createPaymentStore } from '../server/payments/store.ts';
import { loadConfig } from '../server/payments/config.ts';
import { handlePayment } from '../server/payments/handler.ts';
import { CheckoutError, startCheckout } from '../src/lib/payment-client.ts';

const config = loadConfig({ PHONEPE_ENV:'production', VERCEL_ENV:'production', PAYMENT_SITE_ORIGIN:'https://kkarn.vercel.app',
  DATABASE_URL:'postgres://portfolio_payments_api:fixture@localhost/test', PHONEPE_CLIENT_ID:'fixture', PHONEPE_CLIENT_SECRET:'fixture',
  PHONEPE_CLIENT_VERSION:'1', PHONEPE_MERCHANT_ID:'MID_FIXTURE', PHONEPE_WEBHOOK_USERNAME:'fixture-user', PHONEPE_WEBHOOK_PASSWORD:'fixture-password',
  PAYMENT_SESSION_SECRET:'s'.repeat(32), PAYMENT_RECONCILIATION_SECRET:'r'.repeat(32), PROJECT_MIN_PAISE:'20000', PROJECT_MAX_PAISE:'5000000',
  PAYMENTS_ENABLED:'true', PAYMENT_RELEASE_APPROVED:'true', PAYMENT_JOBS_ENABLED:'true', QSTASH_TOKEN:'fixture',
  QSTASH_CURRENT_SIGNING_KEY:'fixture-current', QSTASH_NEXT_SIGNING_KEY:'fixture-next' });
const input = { purpose:'project', name:'Fixture', email:'fixture@example.test', reference:'TEST', amount:'200' };

test('same-browser checkout recovery executes the production store under its restricted role', async t => {
  const db = new PGlite();
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
    for (const file of ['payment-orders.sql','payment-backend.sql','payment-jobs.sql']) {
      await db.exec(await readFile(new URL(`../database/${file}`, import.meta.url), 'utf8'));
    }
    await db.exec('SET ROLE portfolio_payments_api;');
    let savepoint = 0;
    const sql = async (strings,...values) => (await db.query(strings.reduce((text,part,i)=>text+part+(i<values.length?`$${i+1}`:''),''), values)).rows;
    sql.begin = async run => {
      const name = `checkout_test_${++savepoint}`;
      await db.exec(`SAVEPOINT ${name}`);
      try { const result = await run(sql); await db.exec(`RELEASE ${name}`); return result; }
      catch (error) { await db.exec(`ROLLBACK TO ${name}`); throw error; }
    };
    const scenario = (name, run) => t.test(name, async st => {
      await db.exec('BEGIN');
      const store = createPaymentStore(sql, config);
      let publicationFails = true, payCalls = 0, cookie = '';
      const keys = [], key = randomUUID();
      const provider = { pay:async()=>{payCalls++;return{url:'https://mercury.phonepe.com/transact?fixture',orderId:'OMO_FIXTURE',expires:new Date(Date.now()+1200000)};} };
      const queue = { publish:async()=>{if(publicationFails) throw new Error('offline');return{messageId:'fixture-receipt'};} };
      const runtime = {config,store,provider,queue};
      st.mock.method(globalThis,'fetch',async(path,init)=>{
        keys.push(init.headers['Idempotency-Key']);
        const request = new Request(`https://kkarn.vercel.app${path}`, {...init, headers:{...init.headers,origin:config.origin,...(cookie?{cookie}:{})}});
        const response = await handlePayment('orders',request,()=>runtime);
        cookie = response.headers.get('set-cookie')?.split(';')[0] ?? cookie;
        return response;
      });
      const retry = () => startCheckout(input,key);
      const row = async () => (await db.query('SELECT * FROM private_payments.orders')).rows[0];
      const outage = async () => {
        await assert.rejects(retry(),error=>error instanceof CheckoutError && !error.editable);
        assert.equal(payCalls,0);
        assert.equal((await row()).checkout_attempted_at,null);
      };
      const resumePublishing = async () => {
        publicationFails=false;
        await db.exec('UPDATE private_payments.reconciliation_jobs SET publish_after=now();');
      };
      try { await run({store,provider,queue,retry,row,outage,resumePublishing,keys,key,payCalls:()=>payCalls}); }
      finally { await db.exec('ROLLBACK'); }
    });
    await scenario('queue refusal then manual retry keeps the same order and charges only once',async f=>{
      await f.outage(); const before=await f.row(); await f.resumePublishing();
      const result=await f.retry(); assert.equal(result.orderId,before.id); assert.ok(result.checkoutUrl);
      assert.equal(f.payCalls(),1); assert.deepEqual(f.keys,[f.key,f.key]);
      assert.equal((await f.retry()).checkoutUrl,result.checkoutUrl); assert.equal(f.payCalls(),1);
    });
    await scenario('lost queue receipt and retired unattempted job can resume through a fresh accepted generation',async f=>{
      await f.outage(); const before=await f.row();
      const old=(await db.query('SELECT id FROM private_payments.reconciliation_jobs')).rows[0].id;
      await f.store.published(old,'recovered-receipt');
      assert.equal((await f.store.claimJob(old)).kind,'UNATTEMPTED');
      assert.equal(await f.store.claimCheckout(before.id,old),null);
      await f.resumePublishing(); const result=await f.retry();
      assert.equal(result.orderId,before.id); assert.ok(result.checkoutUrl); assert.equal(f.payCalls(),1);
      assert.equal((await db.query('SELECT job_generation FROM private_payments.orders')).rows[0].job_generation,2);
      assert.equal(await f.store.claimCheckout(before.id,old),null); assert.equal((await f.store.claimJob(old)).kind,'STALE');
      assert.deepEqual(f.keys,[f.key,f.key]);
    });
    await scenario('retirement between queue acceptance and checkout claim stays retryable, not false verification',async f=>{
      await f.resumePublishing(); const original=f.store.claimCheckout;
      f.store.claimCheckout=async(id,job)=>{await f.store.claimJob(job);return original(id,job);};
      await assert.rejects(f.retry(),error=>error instanceof CheckoutError && !error.editable);
      assert.equal(f.payCalls(),0); assert.equal((await f.row()).checkout_attempted_at,null);
      f.store.claimCheckout=original;
      assert.ok((await f.retry()).checkoutUrl); assert.equal(f.payCalls(),1);
    });
    await scenario('an ambiguous provider attempt is never retried despite a repeated browser key',async f=>{
      await f.resumePublishing(); const original=f.provider.pay;
      f.provider.pay=async()=>{await original();throw new Error('timeout');};
      assert.equal((await f.retry()).state,'PENDING'); assert.equal(f.payCalls(),1);
      assert.ok((await f.row()).checkout_attempted_at);
      const repeated=await f.retry(); assert.equal(repeated.checkoutUrl,undefined); assert.equal(f.payCalls(),1);
      const current=await f.row();
      const terms={purpose:input.purpose,name:input.name,email:input.email,reference:input.reference,amount:20000};
      await assert.rejects(f.store.reserve({...terms,amount:30000},f.key,current.session_token_hash));
      await assert.rejects(f.store.reserve(terms,f.key,'x'.repeat(64)));
    });
  } finally { await db.close(); }
});
