-- BLOCKED preparation, not an approved runnable installation.
-- Platform-owned grants prevented the restrictions below; previous attempts rolled back.
-- Do not remove these checks or apply until the ownership/permission design is resolved.
-- Does not schedule or send any HTTP requests.
BEGIN;
DO $preflight$
BEGIN
  IF current_user <> 'postgres' OR current_database() <> 'postgres' THEN RAISE EXCEPTION 'Use project administrator'; END IF;
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname IN ('http','pg_cron','pg_net')) THEN
    RAISE EXCEPTION 'Review existing extensions before installation';
  END IF;
END;
$preflight$;
CREATE EXTENSION http WITH SCHEMA extensions;
CREATE EXTENSION pg_cron;
-- Do not install pg_net: its shared queue grants cannot protect queued credentials here.
DO $restrict$
DECLARE function_id regprocedure; role_name text;
BEGIN
  FOR function_id IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_depend d ON d.objid=p.oid
    AND d.classid='pg_proc'::regclass JOIN pg_extension e ON e.oid=d.refobjid
    WHERE d.refclassid='pg_extension'::regclass AND d.deptype='e'
      AND (e.extname='http' OR (e.extname='pg_cron'
        AND p.proname IN ('schedule','schedule_in_database','alter_job','unschedule'))) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role, portfolio_payments_api', function_id);
    FOREACH role_name IN ARRAY ARRAY['public','anon','authenticated','service_role','portfolio_payments_api'] LOOP
      IF has_function_privilege(role_name,function_id,'EXECUTE') THEN
        RAISE EXCEPTION 'Extension access restriction failed for %, role %', function_id, role_name;
      END IF;
    END LOOP;
  END LOOP;
END;
$restrict$;
COMMIT;
