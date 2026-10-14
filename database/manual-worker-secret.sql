-- HUMAN-RUN ONLY, after the disabled worker installation has been reviewed and verified.
-- Not a migration. The agent must not execute this recipe or read its result.
-- Run once to replace ONLY PAYMENT_RECONCILIATION_SECRET and retain its match in Vault.
-- Copy the returned value privately into the existing Vercel Production Secret variable.
-- Do not rerun the database-password recipe, take screenshots, or share this result.
CREATE OR REPLACE FUNCTION pg_temp.prepare_portfolio_worker_secret()
RETURNS TABLE(setting_name text, setting_value text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog
AS $setup$
DECLARE generated_secret text;
BEGIN
  IF current_user <> 'postgres' OR current_database() <> 'postgres' THEN
    RAISE EXCEPTION 'Use the project administrator';
  END IF;
  PERFORM 1 FROM private_payments.worker_dispatch WHERE singleton AND NOT enabled AND request_id IS NULL FOR UPDATE;
  IF NOT FOUND OR EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'portfolio-payment-reconcile' AND active) THEN
    RAISE EXCEPTION 'Verify that the worker is inactive before private setup';
  END IF;
  IF NOT private_payments.worker_access_ready() THEN
    RAISE EXCEPTION 'Review Vault and HTTP queue access first';
  END IF;
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'portfolio_payment_reconciliation') THEN
    RAISE EXCEPTION 'A worker secret already exists; do not rerun this one-time recipe';
  END IF;
  generated_secret := encode(extensions.gen_random_bytes(32), 'hex');
  BEGIN
    PERFORM vault.create_secret(generated_secret, 'portfolio_payment_reconciliation', 'Private payment verification worker');
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Private worker setup failed; no secret was returned';
  END;
  RETURN QUERY SELECT 'PAYMENT_RECONCILIATION_SECRET'::text, generated_secret;
END;
$setup$;
REVOKE ALL ON FUNCTION pg_temp.prepare_portfolio_worker_secret() FROM PUBLIC;
SELECT * FROM pg_temp.prepare_portfolio_worker_secret();
