-- Versioned payment-store migration. See docs/phonepe-integration.md for deployment status.
-- Keep this schema outside browser-accessible APIs. Use a restricted backend role.
BEGIN;

CREATE SCHEMA IF NOT EXISTS private_payments;
REVOKE ALL ON SCHEMA private_payments FROM PUBLIC;

CREATE TABLE IF NOT EXISTS private_payments.orders (
  id uuid PRIMARY KEY,
  idempotency_key uuid NOT NULL UNIQUE,
  merchant_order_id text NOT NULL UNIQUE CHECK (char_length(merchant_order_id) BETWEEN 1 AND 63),
  purpose text NOT NULL CHECK (purpose IN ('community', 'project')),
  customer_name text NOT NULL CHECK (char_length(customer_name) BETWEEN 1 AND 100),
  customer_email text NOT NULL CHECK (char_length(customer_email) BETWEEN 3 AND 254),
  project_reference text CHECK (char_length(project_reference) BETWEEN 1 AND 120),
  amount_paise integer NOT NULL CHECK (amount_paise >= 100),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  environment text NOT NULL CHECK (environment IN ('sandbox', 'production')),
  state text NOT NULL DEFAULT 'CREATED' CHECK (state IN ('CREATED', 'PENDING', 'COMPLETED', 'FAILED', 'REVIEW')),
  session_token_hash text NOT NULL CHECK (session_token_hash ~ '^[a-f0-9]{64}$'),
  phonepe_order_id text UNIQUE,
  paid_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (purpose != 'community' OR amount_paise = 69900),
  CHECK (purpose != 'project' OR project_reference IS NOT NULL),
  CHECK (state != 'COMPLETED' OR paid_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS private_payments.events (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES private_payments.orders(id),
  deduplication_hash text NOT NULL UNIQUE CHECK (deduplication_hash ~ '^[a-f0-9]{64}$'),
  event_name text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE TABLE IF NOT EXISTS private_payments.fulfilments (
  order_id uuid PRIMARY KEY REFERENCES private_payments.orders(id),
  state text NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING', 'DELIVERED', 'REVIEW')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (state != 'DELIVERED' OR delivered_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS payment_pending_orders_idx
  ON private_payments.orders (created_at) WHERE state IN ('CREATED', 'PENDING');

CREATE OR REPLACE FUNCTION private_payments.enforce_order_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF ROW(NEW.id, NEW.idempotency_key, NEW.merchant_order_id, NEW.purpose,
         NEW.customer_name, NEW.customer_email, NEW.project_reference,
         NEW.amount_paise, NEW.currency, NEW.environment, NEW.session_token_hash)
     IS DISTINCT FROM
     ROW(OLD.id, OLD.idempotency_key, OLD.merchant_order_id, OLD.purpose,
         OLD.customer_name, OLD.customer_email, OLD.project_reference,
         OLD.amount_paise, OLD.currency, OLD.environment, OLD.session_token_hash) THEN
    RAISE EXCEPTION 'Order identity and payment terms are immutable';
  END IF;
  IF OLD.state = 'COMPLETED' AND NEW.state IS DISTINCT FROM OLD.state THEN
    RAISE EXCEPTION 'A completed payment cannot be downgraded';
  END IF;
  IF OLD.phonepe_order_id IS NOT NULL AND NEW.phonepe_order_id IS DISTINCT FROM OLD.phonepe_order_id THEN
    RAISE EXCEPTION 'The provider order reference cannot be replaced';
  END IF;
  IF OLD.paid_at IS NOT NULL AND NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
    RAISE EXCEPTION 'The confirmed payment timestamp cannot be replaced';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_order_integrity
BEFORE UPDATE ON private_payments.orders
FOR EACH ROW EXECUTE FUNCTION private_payments.enforce_order_integrity();

ALTER TABLE private_payments.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_payments.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_payments.fulfilments ENABLE ROW LEVEL SECURITY;

-- No browser-facing policies or grants are provided. Provision backend access separately.
REVOKE ALL ON ALL TABLES IN SCHEMA private_payments FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private_payments FROM PUBLIC;

COMMIT;
