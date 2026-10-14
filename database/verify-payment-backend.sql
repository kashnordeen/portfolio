-- Provisioning checks before login is enabled. Synthetic data is always rolled back.
BEGIN;
-- Supabase's postgres administrator has ADMIN but not SET on newly created roles.
-- Allow only this transaction to assume the LESS-privileged role; ROLLBACK restores the grant.
GRANT portfolio_payments_api TO postgres WITH INHERIT FALSE, SET TRUE;
SET LOCAL ROLE portfolio_payments_api;
DO $$
DECLARE
  payment_id uuid := gen_random_uuid();
  request_key uuid := gen_random_uuid();
  event_id uuid := gen_random_uuid();
  lease_id uuid := gen_random_uuid();
  blocked boolean;
  affected integer;
  flags record;
BEGIN
  SELECT rolcanlogin, rolinherit, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb INTO flags
  FROM pg_roles WHERE rolname = current_user;
  IF current_user <> 'portfolio_payments_api' OR flags.rolcanlogin OR flags.rolinherit OR flags.rolsuper
     OR flags.rolbypassrls OR flags.rolcreaterole OR flags.rolcreatedb THEN
    RAISE EXCEPTION 'Backend role is not restricted as expected';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_auth_members WHERE member = (SELECT oid FROM pg_roles WHERE rolname = current_user)) THEN
    RAISE EXCEPTION 'Backend role unexpectedly inherits another role';
  END IF;

  INSERT INTO private_payments.orders
    (id, idempotency_key, merchant_order_id, purpose, customer_name, customer_email, project_reference,
     amount_paise, environment, session_token_hash, next_reconcile_at)
  VALUES (payment_id, request_key, 'test_' || payment_id, 'project', 'Database Test', 'test@example.invalid',
    'SYNTHETIC_TEST', 1250050, 'sandbox', repeat('a',64), now());
  -- Reserve a repeated request: its unique key must prevent a second order.
  INSERT INTO private_payments.orders
    (id, idempotency_key, merchant_order_id, purpose, customer_name, customer_email, project_reference,
     amount_paise, environment, session_token_hash)
  VALUES (gen_random_uuid(), request_key, 'duplicate_' || payment_id, 'project', 'Database Test', 'test@example.invalid',
    'SYNTHETIC_TEST', 1250050, 'sandbox', repeat('a',64))
  ON CONFLICT (idempotency_key) DO NOTHING;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Duplicate reservation was not rejected'; END IF;

  UPDATE private_payments.orders SET checkout_attempted_at = now(), state = 'PENDING',
    phonepe_order_id = 'test_provider_' || payment_id, expires_at = now() + interval '20 minutes',
    checkout_url = 'https://mercury-uat.phonepe.com/transact?token=synthetic'
  WHERE id = payment_id;

  -- Actual worker-claim shape: lock due rows and issue a durable lease.
  UPDATE private_payments.orders SET reconcile_lease_id = lease_id, reconcile_lease_until = now() + interval '90 seconds'
  WHERE id IN (SELECT id FROM private_payments.orders WHERE id = payment_id AND environment = 'sandbox'
    AND next_reconcile_at <= now() AND state NOT IN ('COMPLETED', 'REVIEW')
    AND (reconcile_lease_until IS NULL OR reconcile_lease_until < now())
    ORDER BY next_reconcile_at FOR UPDATE SKIP LOCKED LIMIT 3);
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Worker lease was not acquired'; END IF;
  UPDATE private_payments.orders SET reconcile_lease_until = now() + interval '90 seconds'
  WHERE id = payment_id AND reconcile_lease_id = gen_random_uuid();
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Stale worker lease was accepted'; END IF;

  INSERT INTO private_payments.events(id, order_id, deduplication_hash, event_name)
  VALUES(event_id, payment_id, encode(sha256(payment_id::text::bytea),'hex'), 'checkout.order.completed');
  INSERT INTO private_payments.events(id, order_id, deduplication_hash, event_name)
  VALUES(gen_random_uuid(), payment_id, encode(sha256(payment_id::text::bytea),'hex'), 'checkout.order.completed')
  ON CONFLICT (deduplication_hash) DO NOTHING;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Duplicate event was not rejected'; END IF;

  blocked := false;
  BEGIN
    UPDATE private_payments.orders SET amount_paise = 100 WHERE id = payment_id;
  EXCEPTION WHEN raise_exception THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Amount integrity trigger did not fire'; END IF;

  UPDATE private_payments.orders SET state = 'COMPLETED', paid_at = now(), next_reconcile_at = NULL,
    reconcile_lease_id = NULL, reconcile_lease_until = NULL WHERE id = payment_id;
  INSERT INTO private_payments.fulfilments(order_id) VALUES(payment_id) ON CONFLICT (order_id) DO NOTHING;
  INSERT INTO private_payments.fulfilments(order_id) VALUES(payment_id) ON CONFLICT (order_id) DO NOTHING;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Duplicate fulfilment was not rejected'; END IF;
  UPDATE private_payments.events SET processed_at = now() WHERE id = event_id;

  blocked := false;
  BEGIN
    UPDATE private_payments.orders SET state = 'PENDING' WHERE id = payment_id;
  EXCEPTION WHEN raise_exception THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Paid order was downgraded'; END IF;
  blocked := false;
  BEGIN
    DELETE FROM private_payments.orders WHERE id = payment_id;
  EXCEPTION WHEN insufficient_privilege THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Backend unexpectedly has order deletion privileges'; END IF;

  INSERT INTO private_payments.rate_limits(bucket_hash, window_start, requests) VALUES(repeat('b',64), -1, 1)
  ON CONFLICT (bucket_hash, window_start) DO UPDATE SET requests = private_payments.rate_limits.requests + 1;
  DELETE FROM private_payments.rate_limits WHERE bucket_hash = repeat('b',64) AND window_start = -1;
END $$;
ROLLBACK;
SELECT true AS backend_checks_passed;
