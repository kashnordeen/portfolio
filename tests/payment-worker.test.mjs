// Static SQL contract checks only. These do not execute PostgreSQL, Cron, Vault or HTTP.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const worker = await readFile(new URL('../database/payment-worker.sql', import.meta.url), 'utf8');
const recipe = await readFile(new URL('../database/manual-worker-secret.sql', import.meta.url), 'utf8');

test('blocked extension preparation keeps HTTP and Cron privilege guards fail-closed', async () => {
  const extensions = await readFile(new URL('../database/payment-worker-extensions.sql', import.meta.url), 'utf8');
  assert.match(extensions, /BLOCKED preparation/);
  assert.match(extensions, /e\.extname='http' OR \(e\.extname='pg_cron'/);
  assert.match(extensions, /'schedule','schedule_in_database','alter_job','unschedule'/);
  assert.match(extensions, /REVOKE ALL ON FUNCTION/);
  assert.match(extensions, /has_function_privilege\(role_name,function_id,'EXECUTE'\)/);
  assert.match(extensions, /RAISE EXCEPTION 'Extension access restriction failed/);
  assert.doesNotMatch(extensions, /CREATE EXTENSION pg_net|cron\.schedule\(|vault\.create_secret|GRANT /);
});

test('worker preparation cannot enable extensions, credentials or active schedules', () => {
  assert.match(worker, /enabled boolean NOT NULL DEFAULT false/);
  assert.match(worker, /cron\.alter_job\(job_id := created_job, active := false\)/);
  assert.match(worker, /cron\.schedule\('portfolio-payment-reconcile', '1 second'/);
  assert.doesNotMatch(worker, /CREATE EXTENSION|active := true|enabled = true|vault\.create_secret|ALTER ROLE/);
  assert.match(worker, /Worker job already exists/);
});
test('worker is administrator-only with no browser or backend access to dispatch controls', () => {
  assert.match(worker, /SECURITY INVOKER SET search_path = pg_catalog/g);
  assert.doesNotMatch(worker, /SECURITY DEFINER|GRANT /);
  assert.match(worker, /current_user <> 'postgres'/);
  for (const object of ['worker_dispatch', 'worker_access_ready\(\)', 'dispatch_payment_reconciliation\(\)']) {
    assert.match(worker, new RegExp(`REVOKE ALL ON (?:FUNCTION|private_payments\\.)[^;]*${object}[^;]*FROM PUBLIC, anon, authenticated, service_role, portfolio_payments_api`));
  }
});
test('dispatch guards queue access, concurrency, due-order filtering and production scope', () => {
  for (const relation of ['vault.decrypted_secrets', 'net.http_request_queue', 'net._http_response']) assert.ok(worker.includes(relation));
  // An UPDATE grant could redirect a queued bearer token without first reading it.
  assert.match(worker, /has_table_privilege\(role_name, 'net.http_request_queue', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER'\)/);
  assert.match(worker, /has_any_column_privilege\(role_name, 'net.http_request_queue', 'SELECT,INSERT,UPDATE'\)/);
  assert.match(worker, /FOR UPDATE SKIP LOCKED/);
  assert.match(worker, /IF NOT control.enabled THEN RETURN 'DISABLED'/);
  assert.match(worker, /IF control.request_id IS NOT NULL THEN/);
  assert.match(worker, /environment = 'production' AND next_reconcile_at <= now\(\)/);
  assert.match(worker, /reconcile_lease_until < now\(\)/);
  assert.ok(worker.indexOf("RETURN 'IDLE'") < worker.indexOf('min(decrypted_secret)'));
  assert.ok(worker.indexOf("RETURN 'IN_FLIGHT'") < worker.indexOf('queued_id := net.http_post'));
});
test('post-install verification requires both gates off and never reads credentials', async () => {
  const verification = await readFile(new URL('../database/verify-payment-worker.sql', import.meta.url), 'utf8');
  assert.match(verification, /control.enabled OR control.request_id IS NOT NULL/);
  assert.match(verification, /NOT active AND username = 'postgres'/);
  assert.match(verification, /outcome <> 'DISABLED'/);
  assert.match(verification, /has_function_privilege\(role_name, function_name, 'EXECUTE'\)/);
  assert.match(verification, /ROLLBACK;/);
  assert.doesNotMatch(verification, /decrypted_secret|net\.http_post|vault\.create_secret|enabled = true|active := true/);
});
test('worker only posts to fixed HTTPS endpoint with a Vault bearer and no customer payload', () => {
  assert.match(worker, /url := 'https:\/\/kkarn.vercel.app\/api\/payments\/reconcile', body := '\{\}'::jsonb/);
  assert.match(worker, /'Authorization', 'Bearer ' \|\| worker_secret/);
  assert.match(worker, /timeout_milliseconds := 45000/);
  assert.doesNotMatch(worker, /UPDATE private_payments.orders|INSERT INTO private_payments.orders|customer_email|customer_name/);
  const statements = worker.split('\n').filter(line => !line.trim().startsWith('--')).join('\n');
  assert.doesNotMatch(statements, /RAISE (?:NOTICE|LOG)|SQLERRM/);
});
test('worker validates response shape and pauses on authentication, stuck or repeated failures', () => {
  assert.match(worker, /response.status_code = 200/);
  assert.match(worker, /LIKE 'application\/json%'/);
  assert.match(worker, /jsonb_typeof\(payload->'checked'\) = 'number'/);
  assert.match(worker, /jsonb_typeof\(payload->'deferred'\) = 'number'/);
  assert.match(worker, /\+ \(payload->>'deferred'\)::integer <= 3/);
  assert.match(worker, /interval '180 seconds'/);
  assert.match(worker, /last_issue = 'REQUEST_STUCK'/);
  assert.match(worker, /enabled = failures < 5 AND coalesce\(response.status_code NOT IN \(401, 403\), true\)/);
  assert.match(worker, /least\(60, power\(2, failures\)::integer\)/);
});
test('one-time human recipe rotates only worker secret, never database or session credentials', () => {
  assert.match(recipe, /HUMAN-RUN ONLY/);
  assert.match(recipe, /FUNCTION pg_temp\./);
  assert.match(recipe, /SECURITY INVOKER SET search_path = pg_catalog/);
  assert.match(recipe, /extensions\.gen_random_bytes\(32\)/);
  assert.match(recipe, /vault\.create_secret\(generated_secret, 'portfolio_payment_reconciliation'/);
  assert.match(recipe, /WHERE singleton AND NOT enabled AND request_id IS NULL FOR UPDATE/);
  assert.match(recipe, /A worker secret already exists/);
  assert.match(recipe, /REVOKE ALL ON FUNCTION pg_temp\.[^;]+ FROM PUBLIC/);
  assert.doesNotMatch(recipe, /ALTER ROLE|DATABASE_URL|PAYMENT_SESSION_SECRET|PHONEPE_WEBHOOK_PASSWORD|RAISE NOTICE/);
});
