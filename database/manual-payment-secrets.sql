-- HUMAN-RUN ONLY in the portfolio-payments Supabase SQL Editor.
-- Do not run through an agent tool, migration pipeline, or application backend.
-- Run ONCE: this changes the restricted role's password and returns private values.
-- Copy the returned values directly to Vercel Production as Secret variables.
-- Never share the results in chat, screenshots, Git, or a downloaded CSV.
-- Rerunning rotates the database password and generates different application secrets.

CREATE OR REPLACE FUNCTION pg_temp.prepare_portfolio_payment_secrets()
RETURNS TABLE(setting_name text, setting_value text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $setup$
DECLARE
  flags record;
  generated_password text;
BEGIN
  IF current_user <> 'postgres' OR current_database() <> 'postgres' THEN
    RAISE EXCEPTION 'Run this private setup using the project administrator';
  END IF;
  SELECT rolcanlogin, rolinherit, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication
  INTO flags FROM pg_roles WHERE rolname = 'portfolio_payments_api';
  IF NOT FOUND OR NOT flags.rolcanlogin OR flags.rolinherit OR flags.rolsuper OR flags.rolbypassrls
    OR flags.rolcreatedb OR flags.rolcreaterole OR flags.rolreplication THEN
    RAISE EXCEPTION 'The payment role must have login enabled and all elevated capabilities disabled';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_auth_members WHERE member = (SELECT oid FROM pg_roles WHERE rolname = 'portfolio_payments_api')) THEN
    RAISE EXCEPTION 'The payment role must not inherit another role';
  END IF;
  PERFORM set_config('password_encryption', 'scram-sha-256', true);
  generated_password := encode(extensions.gen_random_bytes(32), 'hex');
  BEGIN
    EXECUTE format('ALTER ROLE portfolio_payments_api PASSWORD %L', generated_password);
  EXCEPTION WHEN OTHERS THEN
    -- Do not return the underlying dynamic statement/error, which might include a credential.
    RAISE EXCEPTION 'Private role setup failed; no password was returned';
  END;
  RETURN QUERY VALUES
    ('DATABASE_URL'::text, format('postgresql://portfolio_payments_api.ghseaquzqlnpmiltsyqy:%s@aws-0-ap-south-1.pooler.supabase.com:6543/postgres', generated_password)),
    ('PAYMENT_SESSION_SECRET', encode(extensions.gen_random_bytes(32), 'hex')),
    ('PAYMENT_RECONCILIATION_SECRET', encode(extensions.gen_random_bytes(32), 'hex')),
    ('PHONEPE_WEBHOOK_USERNAME', 'portfolio_' || encode(extensions.gen_random_bytes(16), 'hex')),
    ('PHONEPE_WEBHOOK_PASSWORD', encode(extensions.gen_random_bytes(32), 'hex'));
END;
$setup$;
REVOKE ALL ON FUNCTION pg_temp.prepare_portfolio_payment_secrets() FROM PUBLIC;
SELECT * FROM pg_temp.prepare_portfolio_payment_secrets();
