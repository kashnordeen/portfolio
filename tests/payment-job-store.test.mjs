import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { reconciliationDelay } from '../server/payments/store.ts';
import { createJobStore } from '../server/payments/job-store.ts';
const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const migration = await read('../database/payment-jobs.sql');

test('durable payment job transitions execute in local PostgreSQL', async t => {
  const db = new PGlite();
  const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
  await db.exec(await read('../database/payment-orders.sql'));
  await db.exec(await read('../database/payment-backend.sql'));
  await db.exec(migration);
  const reserve = async () => {
    const { id } = await one(`INSERT INTO private_payments.orders(id,idempotency_key,merchant_order_id,purpose,customer_name,
      customer_email,project_reference,amount_paise,environment,session_token_hash)
      VALUES(gen_random_uuid(),gen_random_uuid(),gen_random_uuid()::text,'project','Fixture','fixture@example.test','TEST',20000,'production',repeat('a',64)) RETURNING id`);
    const { job } = await one('SELECT private_payments.new_payment_job($1,now()) AS job', [id]);
    return { id, job };
  };
  const accept = job => db.query(`UPDATE private_payments.reconciliation_jobs SET published_at=now(),message_id='fixture-receipt' WHERE id=$1`, [job]);
  const initiate = async row => { await accept(row.job); return one('SELECT private_payments.claim_payment_checkout($1,$2) AS claimed', [row.id, row.job]); };
  const due = id => db.query(`UPDATE private_payments.orders SET checkout_attempted_at=now()-interval '30 seconds',next_reconcile_at=now()-interval '1 second' WHERE id=$1`, [id]);
  const claim = async job => (await one("SELECT private_payments.claim_payment_job($1,'production') AS result", [job])).result;
  const finish = async (job, lease, state = 'COMPLETED', amount = 20000, provider = 'OMO_FIXTURE') =>
    (await one('SELECT private_payments.finish_payment_job($1,$2,$3,$4,$5) AS applied', [job, lease, state, amount, provider])).applied;
  // Adapt tagged parameters to the embedded engine: execute production queries, not a fake job store.
  let savepoint = 0;
  const sql = async (strings, ...values) => {
    const query = strings.reduce((text, part, index) => text + part + (index < values.length ? `$${index+1}` : ''), '');
    return (await db.query(query, values)).rows;
  };
  sql.begin = async run => {
    const name = `job_test_${++savepoint}`;
    await db.exec(`SAVEPOINT ${name}`);
    try { const result = await run(sql); await db.exec(`RELEASE ${name}`); return result; }
    catch (error) { await db.exec(`ROLLBACK TO ${name}`); throw error; }
  };
  const store = createJobStore(sql, { environment: 'production' });
  const scenario = async (name, run) => t.test(name, async () => {
    await db.exec('BEGIN'); try { await run(); } finally { await db.exec('ROLLBACK'); }
  });
  try {
    await scenario('unique order generation and immutable job binding', async () => {
      const row = await reserve();
      const { generation } = await one('SELECT generation FROM private_payments.reconciliation_jobs WHERE id=$1', [row.job]);
      assert.equal(Number(generation), 1);
      await db.exec('SAVEPOINT bad');
      await assert.rejects(db.query('UPDATE private_payments.reconciliation_jobs SET due_at=now()+interval \'1 second\' WHERE id=$1', [row.job]));
      await db.exec('ROLLBACK TO bad');
      await assert.rejects(db.query(`INSERT INTO private_payments.reconciliation_jobs(id,order_id,environment,generation,due_at)
        VALUES(gen_random_uuid(),$1,'production',1,now())`, [row.id]));
    });
    await scenario('checkout requires accepted scheduling and permits only one claim', async () => {
      const row = await reserve();
      assert.equal((await one('SELECT private_payments.claim_payment_checkout($1,$2) AS claimed', [row.id,row.job])).claimed, false);
      assert.equal((await initiate(row)).claimed, true);
      assert.equal((await initiate(row)).claimed, false);
    });
    await scenario('production store queries publish one intent, claim it and hydrate a real job', async () => {
      const row = await reserve();
      const jobs = await store.pendingJobs(row.id,3); assert.equal(jobs.length,1); assert.equal(jobs[0].id,row.job);
      assert.equal((await store.pendingJobs(row.id,3)).length,0);
      await store.published(row.job,'fixture-receipt');
      const order = await store.claimCheckout(row.id,row.job); assert.equal(order.id,row.id);
      assert.equal(await store.claimCheckout(row.id,row.job),null);
      await due(row.id); const result = await store.claimJob(row.job); assert.equal(result.kind,'READY');
      assert.ok(result.order.created_at instanceof Date); assert.ok(result.job.dueAt instanceof Date);
      await store.finishJob(row.job,result.leaseId,{state:'COMPLETED',amount:20000,orderId:'OMO_FIXTURE'});
      assert.equal((await one('SELECT state FROM private_payments.orders WHERE id=$1',[row.id])).state,'COMPLETED');
    });
    await scenario('reservation and its single initial intent disappear together on rollback', async () => {
      await db.exec('SAVEPOINT reservation'); const row = await reserve();
      assert.equal(Number((await one('SELECT count(*) AS n FROM private_payments.reconciliation_jobs WHERE order_id=$1',[row.id])).n),1);
      await db.exec('ROLLBACK TO reservation');
      assert.equal(Number((await one('SELECT count(*) AS n FROM private_payments.orders WHERE id=$1',[row.id])).n),0);
      assert.equal(Number((await one('SELECT count(*) AS n FROM private_payments.reconciliation_jobs WHERE order_id=$1',[row.id])).n),0);
    });
    await scenario('never-attempted job retires atomically and cannot authorize later checkout', async () => {
      const row = await reserve(); await accept(row.job);
      assert.equal((await claim(row.job)).kind, 'UNATTEMPTED');
      assert.equal((await initiate(row)).claimed, false);
    });
    await scenario('early and leased deliveries cannot claim provider verification twice', async () => {
      const row = await reserve(); await initiate(row);
      assert.equal((await claim(row.job)).kind, 'EARLY');
      const current = await one('SELECT id FROM private_payments.reconciliation_jobs WHERE order_id=$1 AND state=\'PENDING\'', [row.id]);
      await due(row.id);
      const result = await claim(current.id); assert.equal(result.kind, 'READY');
      assert.equal((await claim(current.id)).kind, 'LEASED');
      assert.equal((await claim(row.job)).kind, 'STALE');
    });
    await scenario('old lease cannot finish and a verified success has one fulfilment', async () => {
      const row = await reserve(); await initiate(row); await due(row.id);
      const result = await claim(row.job);
      assert.equal(await finish(row.job, crypto.randomUUID()), false);
      assert.equal(await finish(row.job, result.leaseId), true);
      assert.equal(await finish(row.job, result.leaseId), false);
      assert.equal((await one('SELECT state FROM private_payments.orders WHERE id=$1', [row.id])).state, 'COMPLETED');
      assert.equal(Number((await one('SELECT count(*) AS n FROM private_payments.fulfilments WHERE order_id=$1', [row.id])).n), 1);
    });
    await scenario('an unclaimed null lease can never apply a provider status', async () => {
      const row = await reserve();
      assert.equal(await finish(row.job, null), false);
      assert.equal((await one('SELECT state FROM private_payments.orders WHERE id=$1', [row.id])).state, 'CREATED');
    });
    await scenario('pending status and successor intent commit or roll back together', async () => {
      const row = await reserve(); await initiate(row); await due(row.id);
      const result = await claim(row.job);
      await db.exec('SAVEPOINT result');
      await finish(row.job, result.leaseId, 'PENDING');
      assert.equal(Number((await one('SELECT count(*) AS n FROM private_payments.reconciliation_jobs WHERE order_id=$1', [row.id])).n), 2);
      await db.exec('ROLLBACK TO result');
      assert.equal(Number((await one('SELECT count(*) AS n FROM private_payments.reconciliation_jobs WHERE order_id=$1', [row.id])).n), 1);
      assert.equal((await one('SELECT reconcile_lease_id FROM private_payments.orders WHERE id=$1', [row.id])).reconcile_lease_id, result.leaseId);
    });
    await scenario('mismatch and uncertain expiry require review, never assumed failure', async () => {
      const row = await reserve(); await initiate(row); await due(row.id);
      const result = await claim(row.job); await finish(row.job, result.leaseId, 'COMPLETED', 20100);
      assert.equal((await one('SELECT state FROM private_payments.orders WHERE id=$1', [row.id])).state, 'REVIEW');
      const expired = await reserve(); await initiate(expired); await due(expired.id);
      await db.query('UPDATE private_payments.orders SET expires_at=now()-interval \'1 second\' WHERE id=$1', [expired.id]);
      assert.equal((await claim(expired.job)).kind, 'TERMINAL');
      assert.equal((await one('SELECT state FROM private_payments.orders WHERE id=$1', [expired.id])).state, 'REVIEW');
    });
    await scenario('browser roles cannot read jobs or invoke state transitions', async () => {
      for (const role of ['anon','authenticated','service_role']) {
        const rights = await one(`SELECT has_table_privilege($1,'private_payments.reconciliation_jobs','SELECT') AS reads,
          has_function_privilege($1,'private_payments.new_payment_job(uuid,timestamp with time zone)','EXECUTE') AS calls`, [role]);
        assert.deepEqual(rights, { reads: false, calls: false });
      }
    });
    await scenario('accepted but overdue delivery recovers under a fresh generation', async () => {
      const row = await reserve(); await initiate(row); await due(row.id);
      await db.query('UPDATE private_payments.orders SET next_reconcile_at=now()-interval \'4 minutes\' WHERE id=$1',[row.id]);
      await db.query('UPDATE private_payments.reconciliation_jobs SET published_at=now()-interval \'4 minutes\' WHERE id=$1',[row.job]);
      assert.equal(Number((await one("SELECT private_payments.recover_payment_jobs('production',3) AS n")).n), 1);
      assert.equal((await claim(row.job)).kind, 'STALE');
      assert.equal(Number((await one('SELECT job_generation FROM private_payments.orders WHERE id=$1',[row.id])).job_generation), 2);
    });
    await scenario('SQL schedule phases match the existing tested reconciliation algorithm', async () => {
      const epoch = new Date('2026-10-15T00:00:00Z');
      for (const age of [54,55,114,115,174,175,234,235]) {
        const now = new Date(epoch.getTime()+age*1000);
        const result = await one('SELECT private_payments.payment_job_delay($1,$2) AS seconds',[epoch.toISOString(), now.toISOString()]);
        assert.equal(result.seconds, reconciliationDelay(epoch,now.getTime()));
      }
    });
  } finally { await db.close(); }
});
