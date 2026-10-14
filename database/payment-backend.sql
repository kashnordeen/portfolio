-- Local migration only: not applied to Supabase yet.
BEGIN;
ALTER TABLE private_payments.orders
  ADD COLUMN IF NOT EXISTS checkout_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS checkout_url text,
  ADD COLUMN IF NOT EXISTS next_reconcile_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconcile_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reconcile_lease_until timestamptz,
  ADD COLUMN IF NOT EXISTS reconcile_lease_id uuid;

CREATE INDEX IF NOT EXISTS payment_reconciliation_idx
  ON private_payments.orders(next_reconcile_at) WHERE next_reconcile_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS private_payments.rate_limits (
  bucket_hash text NOT NULL CHECK (bucket_hash ~ '^[a-f0-9]{64}$'),
  window_start bigint NOT NULL,
  requests integer NOT NULL CHECK (requests > 0),
  PRIMARY KEY (bucket_hash, window_start)
);
ALTER TABLE private_payments.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private_payments.rate_limits FROM PUBLIC;

-- Provision credentials separately. This role cannot log in until deliberately enabled.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portfolio_payments_api') THEN
    CREATE ROLE portfolio_payments_api NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA private_payments TO portfolio_payments_api;
GRANT SELECT, INSERT, UPDATE ON private_payments.orders, private_payments.events,
  private_payments.fulfilments, private_payments.rate_limits TO portfolio_payments_api;
GRANT DELETE ON private_payments.rate_limits TO portfolio_payments_api;

CREATE POLICY backend_orders ON private_payments.orders TO portfolio_payments_api USING (true) WITH CHECK (true);
CREATE POLICY backend_events ON private_payments.events TO portfolio_payments_api USING (true) WITH CHECK (true);
CREATE POLICY backend_fulfilments ON private_payments.fulfilments TO portfolio_payments_api USING (true) WITH CHECK (true);
CREATE POLICY backend_rate_limits ON private_payments.rate_limits TO portfolio_payments_api USING (true) WITH CHECK (true);
COMMIT;
