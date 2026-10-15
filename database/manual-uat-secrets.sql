-- HUMAN-RUN ONLY in portfolio-payments / ghseaquzqlnpmiltsyqy SQL Editor.
-- Never execute through an agent tool or show the result in chat/screenshots.
-- Run ONCE, save ALL five returned values in your password manager, then copy
-- them to the separate portfolio-payments-uat Vercel project as Secrets.
-- Does not touch the production login or any production credential.
CREATE OR REPLACE FUNCTION pg_temp.prepare_portfolio_uat_secrets()
RETURNS TABLE(setting_name text, setting_value text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $setup$
DECLARE flags record; generated_password text;
BEGIN
  IF current_user <> 'postgres' OR current_database() <> 'postgres' THEN
    RAISE EXCEPTION 'Use the approved project SQL Editor';
  END IF;
  SELECT * INTO flags FROM pg_roles WHERE rolname='portfolio_payments_uat';
  IF NOT FOUND OR flags.rolcanlogin OR flags.rolinherit OR flags.rolsuper OR flags.rolcreatedb
    OR flags.rolcreaterole OR flags.rolreplication OR flags.rolbypassrls
    OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=flags.oid)
    OR has_schema_privilege('portfolio_payments_uat','private_payments','USAGE') THEN
    RAISE EXCEPTION 'Expected an isolated, unprovisioned UAT role; do not rerun or rotate';
  END IF;
  PERFORM set_config('password_encryption','scram-sha-256',true);
  generated_password := encode(extensions.gen_random_bytes(32),'hex');
  BEGIN
    EXECUTE format('ALTER ROLE portfolio_payments_uat LOGIN PASSWORD %L',generated_password);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Private UAT setup failed; no credentials returned';
  END;
  RETURN QUERY VALUES
    ('DATABASE_URL'::text,format('postgresql://portfolio_payments_uat.ghseaquzqlnpmiltsyqy:%s@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',generated_password)),
    ('PAYMENT_SESSION_SECRET',encode(extensions.gen_random_bytes(32),'hex')),
    ('PAYMENT_RECONCILIATION_SECRET',encode(extensions.gen_random_bytes(32),'hex')),
    ('PHONEPE_WEBHOOK_USERNAME','uat_'||encode(extensions.gen_random_bytes(16),'hex')),
    ('PHONEPE_WEBHOOK_PASSWORD',encode(extensions.gen_random_bytes(32),'hex'));
END;
$setup$;
REVOKE ALL ON FUNCTION pg_temp.prepare_portfolio_uat_secrets() FROM PUBLIC;
SELECT * FROM pg_temp.prepare_portfolio_uat_secrets();
