-- Rollback-only local/approved-target checks. Never enables a scheduler or reads secrets.
BEGIN;
DO $$
DECLARE role_name text;
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='private_payments.reconciliation_jobs'::regclass) THEN
    RAISE EXCEPTION 'Job RLS is not enabled'; END IF;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF has_table_privilege(role_name,'private_payments.reconciliation_jobs','SELECT,INSERT,UPDATE,DELETE') OR
      has_function_privilege(role_name,'private_payments.claim_payment_job(uuid,text)','EXECUTE') THEN
      RAISE EXCEPTION 'Unexpected job access'; END IF;
  END LOOP;
END $$;
ROLLBACK;
