-- Additive migration for the owner-approved optional project reference.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='10s';
DO $$
DECLARE definition text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO definition FROM pg_constraint
    WHERE conrelid='private_payments.orders'::regclass AND conname='orders_check1';
  IF definition IS NOT NULL THEN
    IF definition <> 'CHECK (((purpose <> ''project''::text) OR (project_reference IS NOT NULL)))' THEN
      RAISE EXCEPTION 'Unexpected reference constraint; migration refused';
    END IF;
    ALTER TABLE private_payments.orders DROP CONSTRAINT orders_check1;
  END IF;
END;
$$;
-- Keep the 1–120 character bound on supplied references, RLS, immutable terms,
-- payment amount/currency checks and verified completion safeguards unchanged.
COMMIT;
