-- LOCAL PREPARATION ONLY: not applied, not an activation script.
-- Requires reviewed pg_cron, pg_net and Vault installations in portfolio-payments.
-- Does not enable extensions, create credentials, or activate a job.
BEGIN;
DO $preflight$
BEGIN
  IF current_user <> 'postgres' OR current_database() <> 'postgres' THEN
    RAISE EXCEPTION 'Use the project administrator for worker installation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
    OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net')
    OR to_regclass('vault.decrypted_secrets') IS NULL THEN
    RAISE EXCEPTION 'Reviewed Cron, pg_net and Vault installations are required';
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'portfolio-payment-reconcile') THEN
    RAISE EXCEPTION 'Worker job already exists; review its state instead of reinstalling';
  END IF;
END;
$preflight$;

CREATE TABLE private_payments.worker_dispatch (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  request_id bigint,
  sent_at timestamptz,
  not_before timestamptz NOT NULL DEFAULT now(),
  consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures BETWEEN 0 AND 5),
  last_status integer,
  last_issue text CHECK (last_issue IN ('ACCESS_REVIEW', 'MISSING_SECRET', 'AUTH_FAILED',
    'HTTP_FAILED', 'REQUEST_STUCK', 'DISPATCH_FAILED')),
  last_success_at timestamptz,
  CHECK ((request_id IS NULL) = (sent_at IS NULL))
);
ALTER TABLE private_payments.worker_dispatch ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private_payments.worker_dispatch FROM PUBLIC, anon, authenticated, service_role, portfolio_payments_api;
INSERT INTO private_payments.worker_dispatch(singleton) VALUES (true);

-- Inspect privileges only; never print a Vault value or queued Authorization header.
CREATE FUNCTION private_payments.worker_access_ready()
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog
AS $access$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role', 'portfolio_payments_api'] LOOP
    IF has_table_privilege(role_name, 'vault.decrypted_secrets', 'SELECT')
      OR has_any_column_privilege(role_name, 'vault.decrypted_secrets', 'SELECT')
      OR has_table_privilege(role_name, 'net.http_request_queue', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')
      OR has_any_column_privilege(role_name, 'net.http_request_queue', 'SELECT,INSERT,UPDATE')
      OR has_table_privilege(role_name, 'net._http_response', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')
      OR has_any_column_privilege(role_name, 'net._http_response', 'SELECT,INSERT,UPDATE')
      OR has_table_privilege(role_name, 'private_payments.worker_dispatch', 'SELECT,INSERT,UPDATE,DELETE')
      OR has_any_column_privilege(role_name, 'private_payments.worker_dispatch', 'SELECT,INSERT,UPDATE') THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$access$;
REVOKE ALL ON FUNCTION private_payments.worker_access_ready() FROM PUBLIC, anon, authenticated, service_role, portfolio_payments_api;

CREATE FUNCTION private_payments.dispatch_payment_reconciliation()
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog
AS $dispatch$
DECLARE
  control private_payments.worker_dispatch%ROWTYPE;
  response record;
  payload jsonb;
  healthy boolean;
  worker_secret text;
  secret_count integer;
  queued_id bigint;
  failures integer;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Administrator-only worker'; END IF;
  SELECT * INTO control FROM private_payments.worker_dispatch WHERE singleton FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN 'BUSY'; END IF;
  IF NOT control.enabled THEN RETURN 'DISABLED'; END IF;
  IF NOT private_payments.worker_access_ready() THEN
    UPDATE private_payments.worker_dispatch SET enabled = false, last_issue = 'ACCESS_REVIEW' WHERE singleton;
    RETURN 'PAUSED';
  END IF;

  -- Do not enqueue another HTTP request until the previous request has completed.
  IF control.request_id IS NOT NULL THEN
    SELECT status_code, timed_out, error_msg IS NOT NULL AS has_error, content_type, content
      INTO response FROM net._http_response WHERE id = control.request_id ORDER BY created DESC LIMIT 1;
    IF NOT FOUND THEN
      IF control.sent_at < now() - interval '180 seconds' THEN
        -- Preserve the request ID: an operator must resolve the stuck request before resuming.
        UPDATE private_payments.worker_dispatch SET enabled = false, last_issue = 'REQUEST_STUCK' WHERE singleton;
        RETURN 'PAUSED';
      END IF;
      RETURN 'IN_FLIGHT';
    END IF;
    healthy := response.status_code = 200 AND NOT coalesce(response.timed_out, false)
      AND NOT response.has_error AND coalesce(response.content_type, '') LIKE 'application/json%';
    IF healthy THEN
      BEGIN
        payload := response.content::jsonb;
        healthy := jsonb_typeof(payload) = 'object'
          AND jsonb_typeof(payload->'checked') = 'number' AND jsonb_typeof(payload->'deferred') = 'number'
          AND (payload->>'checked') ~ '^[0-3]$' AND (payload->>'deferred') ~ '^[0-3]$';
        IF healthy THEN healthy := (payload->>'checked')::integer + (payload->>'deferred')::integer <= 3; END IF;
      EXCEPTION WHEN OTHERS THEN healthy := false;
      END;
    END IF;
    IF NOT coalesce(healthy, false) THEN
      failures := least(control.consecutive_failures + 1, 5);
      UPDATE private_payments.worker_dispatch SET request_id = NULL, sent_at = NULL,
        consecutive_failures = failures, last_status = response.status_code,
        last_issue = CASE WHEN response.status_code IN (401, 403) THEN 'AUTH_FAILED' ELSE 'HTTP_FAILED' END,
        enabled = failures < 5 AND coalesce(response.status_code NOT IN (401, 403), true),
        not_before = now() + (least(60, power(2, failures)::integer) * interval '1 second') WHERE singleton;
      RETURN 'HTTP_FAILED';
    END IF;
    UPDATE private_payments.worker_dispatch SET request_id = NULL, sent_at = NULL,
      consecutive_failures = 0, last_status = 200, last_issue = NULL, last_success_at = now() WHERE singleton;
  END IF;
  IF control.not_before > now() THEN RETURN 'BACKOFF'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private_payments.orders
    WHERE environment = 'production' AND next_reconcile_at <= now()
      AND state NOT IN ('COMPLETED', 'REVIEW')
      AND (reconcile_lease_until IS NULL OR reconcile_lease_until < now())) THEN RETURN 'IDLE'; END IF;

  SELECT count(*), min(decrypted_secret) INTO secret_count, worker_secret
    FROM vault.decrypted_secrets WHERE name = 'portfolio_payment_reconciliation';
  IF secret_count <> 1 OR worker_secret IS NULL OR worker_secret !~ '^[a-f0-9]{64}$' THEN
    UPDATE private_payments.worker_dispatch SET enabled = false, last_issue = 'MISSING_SECRET' WHERE singleton;
    RETURN 'PAUSED';
  END IF;
  queued_id := net.http_post(
    url := 'https://kkarn.vercel.app/api/payments/reconcile', body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || worker_secret),
    timeout_milliseconds := 45000
  );
  IF queued_id IS NULL THEN RAISE EXCEPTION 'Request was not queued'; END IF;
  UPDATE private_payments.worker_dispatch SET request_id = queued_id, sent_at = now() WHERE singleton;
  RETURN 'QUEUED';
EXCEPTION WHEN OTHERS THEN
  -- The exception block rolls back this invocation's queue insertion and updates.
  -- Never log/return SQLERRM, provider bodies, or request headers (they may contain secrets).
  UPDATE private_payments.worker_dispatch SET enabled = false, last_issue = 'DISPATCH_FAILED' WHERE singleton;
  RETURN 'PAUSED';
END;
$dispatch$;
REVOKE ALL ON FUNCTION private_payments.dispatch_payment_reconciliation() FROM PUBLIC, anon, authenticated, service_role, portfolio_payments_api;

-- New job is deactivated in the same transaction before it can become visible to Cron.
DO $job$
DECLARE created_job bigint;
BEGIN
  created_job := cron.schedule('portfolio-payment-reconcile', '1 second',
    'SELECT private_payments.dispatch_payment_reconciliation();');
  PERFORM cron.alter_job(job_id := created_job, active := false);
END;
$job$;
COMMIT;
