// Executes real PostgreSQL/PLpgSQL locally; Cron, HTTP and Vault are test-only mocks.
// PGlite is single-connection: this does NOT validate cross-session concurrency,
// provider TLS/authentication, real scheduler timing, Vault encryption or network delivery.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const read = file => readFile(new URL(file, import.meta.url), 'utf8');
const [worker, verification, fixture, orders, backend] = await Promise.all([
  read('../database/payment-worker.sql'), read('../database/verify-payment-worker.sql'),
  read('./fixtures/worker-extension-mocks.sql'), read('../database/payment-orders.sql'), read('../database/payment-backend.sql'),
]);

test('payment worker executes in isolated PostgreSQL with mocked extension interfaces', async t => {
  const db = new PGlite();
  const one = async (sql, params) => (await db.query(sql, params)).rows[0];
  const dispatch = async () => (await one('SELECT private_payments.dispatch_payment_reconciliation() AS result')).result;
  const state = () => one('SELECT * FROM private_payments.worker_dispatch');
  const queueSize = async () => Number((await one('SELECT count(*) AS size FROM net.http_request_queue')).size);
  const enable = () => db.exec('UPDATE private_payments.worker_dispatch SET enabled = true');
  const due = async (environment = 'production', state = 'PENDING', delay = -1, leased = false) => {
    await db.query(`INSERT INTO private_payments.orders
      (id, idempotency_key, merchant_order_id, purpose, customer_name, customer_email, project_reference,
       amount_paise, environment, session_token_hash, state, paid_at, next_reconcile_at, reconcile_lease_until)
      VALUES (gen_random_uuid(), gen_random_uuid(), gen_random_uuid()::text, 'project', 'Synthetic', 'test@example.test',
       'TEST', 20000, $1, repeat('a', 64), $2, CASE WHEN $2 = 'COMPLETED' THEN now() END,
       now() + ($3 * interval '1 second'), CASE WHEN $4 THEN now() + interval '90 seconds' END)`,
    [environment, state, delay, leased]);
  };
  const fakeSecret = () => db.query('INSERT INTO vault.fake_secrets VALUES ($1, $2)', ['portfolio_payment_reconciliation', 'a'.repeat(64)]);
  const response = async (status = 200, content = '{"checked":1,"deferred":0}', type = 'application/json', timedOut = false) => {
    const control = await state();
    await db.query(`INSERT INTO net._http_response(id, status_code, content_type, content, timed_out)
      VALUES ($1, $2, $3, $4, $5)`, [control.request_id, status, type, content, timedOut]);
    await db.query('DELETE FROM net.http_request_queue WHERE id = $1', [control.request_id]);
  };
  const isolated = async (name, run) => t.test(name, async () => {
    await db.exec('BEGIN');
    try { await run(); } finally { await db.exec('ROLLBACK'); }
  });
  try {
    const identity = await one('SELECT current_user AS role, current_database() AS database');
    assert.deepEqual(identity, { role: 'postgres', database: 'postgres' });
    const version = await one("SELECT current_setting('server_version') AS version");
    t.diagnostic(`Embedded PostgreSQL ${version.version}; extensions and networking are mocked.`);
    await db.exec(fixture);
    await db.exec(orders);
    await db.exec(backend);
    await t.test('actual extension preflight rejects missing pg_cron/pg_net', async () => {
      await assert.rejects(db.exec(worker), /Reviewed Cron, pg_net and Vault installations are required/);
      await db.exec('ROLLBACK');
    });
    // Only the extension-presence guard is bypassed to install against explicit mocks.
    // No pg_extension catalog entries are forged; all worker functions/job SQL are unchanged.
    const preflight = worker.match(/^DO \$preflight\$[\s\S]+?^\$preflight\$;$/m);
    assert.ok(preflight, 'Expected one isolated extension preflight block');
    await db.exec(worker.replace(preflight[0], '-- Extension preflight separately tested above.'));
    await t.test('installation and verification keep both gates off and queue nothing', async () => {
      assert.equal((await state()).enabled, false);
      assert.equal((await one('SELECT active FROM cron.job')).active, false);
      assert.equal(await dispatch(), 'DISABLED');
      await db.exec(verification);
      assert.equal(await queueSize(), 0);
    });
    await isolated('browser and application roles cannot execute or change the worker', async () => {
      for (const role of ['anon', 'authenticated', 'service_role', 'portfolio_payments_api']) {
        const grants = await one(`SELECT has_function_privilege($1, 'private_payments.dispatch_payment_reconciliation()', 'EXECUTE') AS execute,
          has_table_privilege($1, 'private_payments.worker_dispatch', 'SELECT,INSERT,UPDATE,DELETE') AS access`, [role]);
        assert.deepEqual(grants, { execute: false, access: false });
      }
      for (const statement of ['SELECT private_payments.dispatch_payment_reconciliation()',
        'UPDATE private_payments.worker_dispatch SET enabled = true']) {
        await db.exec('SAVEPOINT forbidden_access; SET LOCAL ROLE portfolio_payments_api');
        await assert.rejects(db.query(statement), /permission denied/);
        await db.exec('ROLLBACK TO SAVEPOINT forbidden_access; RELEASE SAVEPOINT forbidden_access');
      }
    });
    await isolated('idle, sandbox, future, completed, review and leased orders do not dispatch', async () => {
      await enable();
      await due('sandbox'); await due('production', 'PENDING', 60);
      await due('production', 'COMPLETED'); await due('production', 'REVIEW');
      await due('production', 'PENDING', -1, true);
      assert.equal(await dispatch(), 'IDLE');
      assert.equal(await queueSize(), 0);
    });
    await isolated('missing, malformed or duplicate Vault fixtures fail closed', async () => {
      await due();
      for (const value of [null, 'bad', 'duplicate']) {
        await db.exec('DELETE FROM vault.fake_secrets');
        if (value === 'bad') await db.exec("INSERT INTO vault.fake_secrets VALUES ('portfolio_payment_reconciliation', 'bad')");
        if (value === 'duplicate') { await fakeSecret(); await fakeSecret(); }
        await enable();
        assert.equal(await dispatch(), 'PAUSED');
        assert.equal((await state()).last_issue, 'MISSING_SECRET');
        assert.equal((await state()).enabled, false);
      }
      assert.equal(await queueSize(), 0);
    });
    await isolated('due production order queues one bounded request; second tick waits', async () => {
      await due(); await fakeSecret(); await enable();
      assert.equal(await dispatch(), 'QUEUED');
      const request = await one(`SELECT method, url, timeout_milliseconds, convert_from(body, 'UTF8')::jsonb AS body,
        headers->>'Authorization' = $1 AS fixture_auth_matches FROM net.http_request_queue`, ['Bearer ' + 'a'.repeat(64)]);
      assert.deepEqual(request, { method: 'POST', url: 'https://kkarn.vercel.app/api/payments/reconcile',
        timeout_milliseconds: 45000, body: {}, fixture_auth_matches: true });
      assert.equal(await dispatch(), 'IN_FLIGHT');
      assert.equal(await queueSize(), 1);
    });
    await isolated('healthy response records dispatch health, never marks the payment paid', async () => {
      await due(); await fakeSecret(); await enable(); await dispatch(); await response();
      await db.exec("UPDATE private_payments.orders SET next_reconcile_at = now() + interval '1 minute'");
      assert.equal(await dispatch(), 'IDLE');
      const control = await state();
      assert.equal(control.request_id, null); assert.equal(control.last_status, 200);
      assert.ok(control.last_success_at); assert.equal(control.consecutive_failures, 0);
      assert.equal((await one('SELECT state FROM private_payments.orders')).state, 'PENDING');
      assert.equal(await queueSize(), 0);
    });
    await isolated('HTML, malformed JSON, wrong counters and timed-out responses fail safely', async () => {
      await due(); await fakeSecret();
      for (const [body, type, timedOut] of [
        ['<html>fallback</html>', 'text/html', false], ['invalid', 'application/json', false],
        ['{}', 'application/json', false], ['{"checked":3,"deferred":3}', 'application/json', false],
        ['{"checked":"1","deferred":0}', 'application/json', false], ['{"checked":1,"deferred":0}', 'application/json', true],
      ]) {
        await db.exec('UPDATE private_payments.worker_dispatch SET enabled = true, consecutive_failures = 0, not_before = now()');
        assert.equal(await dispatch(), 'QUEUED'); await response(200, body, type, timedOut);
        assert.equal(await dispatch(), 'HTTP_FAILED'); assert.equal((await state()).last_issue, 'HTTP_FAILED');
      }
      assert.equal(await queueSize(), 0);
    });
    await isolated('authentication failure immediately disables further dispatch', async () => {
      await due(); await fakeSecret(); await enable(); await dispatch(); await response(401);
      assert.equal(await dispatch(), 'HTTP_FAILED'); assert.equal((await state()).enabled, false);
      assert.equal((await state()).last_issue, 'AUTH_FAILED'); assert.equal(await dispatch(), 'DISABLED');
    });
    await isolated('transient HTTP failures back off and pause after five attempts', async () => {
      await due(); await fakeSecret(); await enable();
      for (let attempt = 1; attempt <= 5; attempt++) {
        await db.exec('UPDATE private_payments.worker_dispatch SET not_before = now()');
        assert.equal(await dispatch(), 'QUEUED'); await response(503);
        assert.equal(await dispatch(), 'HTTP_FAILED'); assert.equal((await state()).consecutive_failures, attempt);
        assert.equal(await dispatch(), attempt < 5 ? 'BACKOFF' : 'DISABLED');
      }
      assert.equal((await state()).enabled, false);
    });
    await isolated('stuck request pauses without dropping its ID or requeuing', async () => {
      await due(); await fakeSecret(); await enable(); await dispatch();
      const id = (await state()).request_id;
      await db.exec("UPDATE private_payments.worker_dispatch SET sent_at = now() - interval '181 seconds'");
      assert.equal(await dispatch(), 'PAUSED');
      assert.equal((await state()).request_id, id); assert.equal((await state()).last_issue, 'REQUEST_STUCK');
      assert.equal(await dispatch(), 'DISABLED'); assert.equal(await queueSize(), 1);
    });
    await isolated('column-level queue alteration and Vault read grants are detected', async () => {
      await due(); await fakeSecret(); await enable();
      await db.exec('GRANT UPDATE(url) ON net.http_request_queue TO authenticated');
      assert.equal(await dispatch(), 'PAUSED'); assert.equal((await state()).last_issue, 'ACCESS_REVIEW');
      await db.exec('REVOKE UPDATE(url) ON net.http_request_queue FROM authenticated'); await enable();
      await db.exec('GRANT SELECT(decrypted_secret) ON vault.decrypted_secrets TO portfolio_payments_api');
      assert.equal(await dispatch(), 'PAUSED'); assert.equal(await queueSize(), 0);
    });
    await isolated('HTTP enqueue exception rolls back and exposes only a generic paused state', async () => {
      await due(); await fakeSecret(); await enable();
      await db.exec(`CREATE OR REPLACE FUNCTION net.http_post(
          url text, body jsonb DEFAULT '{}'::jsonb, params jsonb DEFAULT '{}'::jsonb,
          headers jsonb DEFAULT '{"Content-Type":"application/json"}'::jsonb,
          timeout_milliseconds integer DEFAULT 2000
        ) RETURNS bigint LANGUAGE plpgsql AS $$ BEGIN
          INSERT INTO net.http_request_queue(method, url, headers, timeout_milliseconds)
            VALUES ('POST', $1, $4, $5);
          RAISE EXCEPTION 'synthetic provider detail';
        END; $$;`);
      assert.equal(await dispatch(), 'PAUSED'); assert.equal((await state()).last_issue, 'DISPATCH_FAILED');
      assert.equal((await state()).enabled, false); assert.equal(await queueSize(), 0);
    });
  } finally { await db.close(); }
});
