-- Run only against the new payment database after applying payment-orders.sql.
-- Synthetic test data is rolled back; this script does not call a payment provider.
BEGIN;
DO $$
DECLARE
  test_order uuid := gen_random_uuid();
  request_key uuid := gen_random_uuid();
  blocked boolean;
BEGIN
  IF has_schema_privilege('anon', 'private_payments', 'USAGE')
     OR has_schema_privilege('authenticated', 'private_payments', 'USAGE') THEN
    RAISE EXCEPTION 'Browser roles can access the private schema';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'private_payments' AND c.relkind = 'r' AND NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'A payment table is missing row-level security';
  END IF;

  INSERT INTO private_payments.orders (
    id, idempotency_key, merchant_order_id, purpose, customer_name,
    customer_email, amount_paise, environment, session_token_hash
  ) VALUES (
    test_order, request_key, test_order::text, 'community', 'Security test',
    'security-test@example.invalid', 69900, 'sandbox', repeat('a', 64)
  );

  blocked := false;
  BEGIN
    INSERT INTO private_payments.orders (
      id, idempotency_key, merchant_order_id, purpose, customer_name,
      customer_email, amount_paise, environment, session_token_hash
    ) VALUES (
      gen_random_uuid(), gen_random_uuid(), gen_random_uuid()::text,
      'community', 'Security test', 'security-test@example.invalid',
      100, 'sandbox', repeat('b', 64)
    );
  EXCEPTION WHEN check_violation THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Incorrect registration amount was accepted'; END IF;

  blocked := false;
  BEGIN
    INSERT INTO private_payments.orders (
      id, idempotency_key, merchant_order_id, purpose, customer_name,
      customer_email, amount_paise, environment, session_token_hash
    ) VALUES (
      gen_random_uuid(), request_key, gen_random_uuid()::text,
      'community', 'Security test', 'security-test@example.invalid',
      69900, 'sandbox', repeat('b', 64)
    );
  EXCEPTION WHEN unique_violation THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Duplicate request key was accepted'; END IF;

  blocked := false;
  BEGIN
    UPDATE private_payments.orders SET amount_paise = 100 WHERE id = test_order;
  EXCEPTION WHEN raise_exception THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Order amount could be changed'; END IF;

  UPDATE private_payments.orders
    SET state = 'COMPLETED', paid_at = now(), phonepe_order_id = test_order::text
    WHERE id = test_order;

  blocked := false;
  BEGIN
    UPDATE private_payments.orders SET state = 'PENDING' WHERE id = test_order;
  EXCEPTION WHEN raise_exception THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Completed payment could be downgraded'; END IF;

  blocked := false;
  BEGIN
    UPDATE private_payments.orders SET phonepe_order_id = 'replacement' WHERE id = test_order;
  EXCEPTION WHEN raise_exception THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Provider reference could be replaced'; END IF;

  INSERT INTO private_payments.events (id, order_id, deduplication_hash, event_name)
    VALUES (gen_random_uuid(), test_order, repeat('c', 64), 'security.test');
  blocked := false;
  BEGIN
    INSERT INTO private_payments.events (id, order_id, deduplication_hash, event_name)
      VALUES (gen_random_uuid(), test_order, repeat('c', 64), 'security.test');
  EXCEPTION WHEN unique_violation THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Duplicate event was accepted'; END IF;
END;
$$;
ROLLBACK;
