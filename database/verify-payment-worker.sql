-- POST-INSTALL verification only. Not executed yet.
-- Run as postgres only while both worker gates are off. No secrets/results are read.
BEGIN;
SET LOCAL statement_timeout = '5s';
DO $verify$
DECLARE
  role_name text;
  function_name text;
  job_count integer;
  job_ready boolean;
  control private_payments.worker_dispatch%ROWTYPE;
  outcome text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Use the project administrator'; END IF;
  SELECT * INTO control FROM private_payments.worker_dispatch WHERE singleton FOR UPDATE;
  IF NOT FOUND OR control.enabled OR control.request_id IS NOT NULL THEN
    RAISE EXCEPTION 'Worker must be disabled and have no in-flight request';
  END IF;
  SELECT count(*), bool_and(NOT active AND username = 'postgres' AND schedule = '1 second'
    AND command = 'SELECT private_payments.dispatch_payment_reconciliation();')
    INTO job_count, job_ready FROM cron.job WHERE jobname = 'portfolio-payment-reconcile';
  IF job_count <> 1 OR NOT coalesce(job_ready, false) THEN RAISE EXCEPTION 'Inactive job definition differs'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'private_payments.worker_dispatch'::regclass AND relrowsecurity)
    OR NOT private_payments.worker_access_ready() THEN RAISE EXCEPTION 'Worker storage or queue access requires review'; END IF;
  FOREACH function_name IN ARRAY ARRAY['private_payments.worker_access_ready()', 'private_payments.dispatch_payment_reconciliation()'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = function_name::regprocedure AND NOT prosecdef
      AND pg_get_userbyid(proowner) = 'postgres' AND proconfig @> ARRAY['search_path=pg_catalog']) THEN
      RAISE EXCEPTION 'Worker function owner or execution context differs';
    END IF;
    FOREACH role_name IN ARRAY ARRAY['public', 'anon', 'authenticated', 'service_role', 'portfolio_payments_api'] LOOP
      IF has_function_privilege(role_name, function_name, 'EXECUTE') THEN RAISE EXCEPTION 'Worker function is exposed'; END IF;
    END LOOP;
  END LOOP;
  outcome := private_payments.dispatch_payment_reconciliation();
  IF outcome <> 'DISABLED' OR EXISTS (SELECT 1 FROM private_payments.worker_dispatch WHERE request_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Disabled worker did not remain inactive';
  END IF;
END;
$verify$;
SELECT enabled, request_id IS NOT NULL AS has_inflight_request, consecutive_failures, last_status, last_issue
FROM private_payments.worker_dispatch WHERE singleton;
ROLLBACK;
