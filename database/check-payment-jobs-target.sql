-- Explicitly approved target only. Synthetic sandbox fixtures, no HTTP/queue/provider calls.
-- Everything written here is rolled back; never change ROLLBACK to COMMIT.
-- Requires a connection permitted to assume the backend role. Supabase MCP intentionally cannot;
-- do not grant it role membership to make this check pass. Test the actual private runtime login separately.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='10s';
DO $$
DECLARE role_name text;
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='private_payments.reconciliation_jobs'::regclass) THEN
    RAISE EXCEPTION 'Job RLS missing'; END IF;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF has_schema_privilege(role_name,'private_payments','USAGE') OR
      has_table_privilege(role_name,'private_payments.reconciliation_jobs','SELECT,INSERT,UPDATE,DELETE') OR
      has_function_privilege(role_name,'private_payments.claim_payment_job(uuid,text)','EXECUTE') THEN
      RAISE EXCEPTION 'Unexpected browser job access'; END IF;
  END LOOP;
END $$;
SET LOCAL ROLE portfolio_payments_api;
DO $$
DECLARE order_key uuid; job_key uuid; next_job uuid; claim jsonb; lease_key uuid; test_case integer;
  applied boolean; repeated boolean;
BEGIN
  FOR test_case IN 1..3 LOOP
    order_key:=gen_random_uuid();
    INSERT INTO private_payments.orders(id,idempotency_key,merchant_order_id,purpose,customer_name,
      customer_email,project_reference,amount_paise,environment,session_token_hash)
    VALUES(order_key,gen_random_uuid(),'VERIFY_'||order_key::text,'project','Synthetic setup check',
      'fixture@example.invalid','ROLLBACK_ONLY',20000,'sandbox',repeat('a',64));
    job_key:=private_payments.new_payment_job(order_key,now());
    IF private_payments.claim_payment_checkout(order_key,job_key) THEN
      RAISE EXCEPTION 'Unaccepted job authorized checkout'; END IF;
    UPDATE private_payments.reconciliation_jobs SET published_at=now(),message_id='synthetic-receipt' WHERE id=job_key;
    IF test_case=3 THEN
      claim:=private_payments.claim_payment_job(job_key,'sandbox');
      IF claim->>'kind'<>'UNATTEMPTED' OR private_payments.claim_payment_checkout(order_key,job_key) THEN
        RAISE EXCEPTION 'Retired job authorized checkout'; END IF;
      next_job:=private_payments.new_payment_job(order_key,now());
      IF next_job=job_key OR private_payments.claim_payment_checkout(order_key,next_job) THEN
        RAISE EXCEPTION 'Fresh generation bypassed scheduling'; END IF;
      UPDATE private_payments.reconciliation_jobs SET published_at=now(),message_id='synthetic-retry' WHERE id=next_job;
      applied:=private_payments.claim_payment_checkout(order_key,next_job);
      repeated:=private_payments.claim_payment_checkout(order_key,next_job);
      IF NOT applied OR repeated THEN RAISE EXCEPTION 'Retry claim was not single-use'; END IF;
      CONTINUE;
    END IF;
    applied:=private_payments.claim_payment_checkout(order_key,job_key);
    repeated:=private_payments.claim_payment_checkout(order_key,job_key);
    IF NOT applied OR repeated THEN RAISE EXCEPTION 'Checkout claim was not single-use'; END IF;
    UPDATE private_payments.orders SET checkout_attempted_at=now()-interval '30 seconds',
      next_reconcile_at=now()-interval '1 second' WHERE id=order_key;
    claim:=private_payments.claim_payment_job(job_key,'production');
    IF claim->>'kind'<>'STALE' OR claim->>'orderId' IS NOT NULL THEN RAISE EXCEPTION 'Cross-environment disclosure'; END IF;
    claim:=private_payments.claim_payment_job(job_key,'sandbox');
    IF claim->>'kind'<>'READY' THEN RAISE EXCEPTION 'Restricted role could not claim a due job'; END IF;
    lease_key:=(claim->>'leaseId')::uuid;
    claim:=private_payments.claim_payment_job(job_key,'sandbox');
    IF claim->>'kind'<>'LEASED' OR
      private_payments.finish_payment_job(job_key,NULL,'COMPLETED',20000,'SYNTHETIC_PROVIDER') OR
      private_payments.finish_payment_job(job_key,gen_random_uuid(),'COMPLETED',20000,'SYNTHETIC_PROVIDER') THEN
      RAISE EXCEPTION 'Lease ownership was not enforced'; END IF;
    IF test_case=2 THEN
      applied:=private_payments.finish_payment_job(job_key,lease_key,'COMPLETED',20100,'SYNTHETIC_PROVIDER');
      IF NOT applied OR
        (SELECT state FROM private_payments.orders WHERE id=order_key)<>'REVIEW' OR
        EXISTS(SELECT 1 FROM private_payments.fulfilments WHERE order_id=order_key) THEN
        RAISE EXCEPTION 'Amount mismatch accepted as paid'; END IF;
      CONTINUE;
    END IF;
    applied:=private_payments.finish_payment_job(job_key,lease_key,'PENDING',20000,'SYNTHETIC_PROVIDER');
    repeated:=private_payments.finish_payment_job(job_key,lease_key,'COMPLETED',20000,'SYNTHETIC_PROVIDER');
    IF NOT applied OR repeated THEN
      RAISE EXCEPTION 'Pending successor or stale result protection failed'; END IF;
    SELECT id INTO next_job FROM private_payments.reconciliation_jobs WHERE order_id=order_key AND state='PENDING';
    IF next_job IS NULL OR next_job=job_key THEN RAISE EXCEPTION 'Successor missing'; END IF;
    UPDATE private_payments.orders SET next_reconcile_at=now()-interval '1 second' WHERE id=order_key;
    claim:=private_payments.claim_payment_job(next_job,'sandbox');
    IF claim->>'kind'<>'READY' THEN RAISE EXCEPTION 'Successor could not be claimed'; END IF;
    lease_key:=(claim->>'leaseId')::uuid;
    -- Mutate first, inspect in a separate statement: SQL subqueries in an IF may be planned before calls.
    applied:=private_payments.finish_payment_job(next_job,lease_key,'COMPLETED',20000,'SYNTHETIC_PROVIDER');
    repeated:=private_payments.finish_payment_job(next_job,lease_key,'COMPLETED',20000,'SYNTHETIC_PROVIDER');
    IF NOT applied OR repeated OR
      (SELECT state FROM private_payments.orders WHERE id=order_key)<>'COMPLETED' OR
      (SELECT count(*) FROM private_payments.fulfilments WHERE order_id=order_key)<>1 THEN
      RAISE EXCEPTION 'Verified completion was not unique'; END IF;
  END LOOP;
END $$;
RESET ROLE;
ROLLBACK;
SELECT jsonb_build_object('rolled_back',true,'orders',(SELECT count(*) FROM private_payments.orders),
  'jobs',(SELECT count(*) FROM private_payments.reconciliation_jobs),
  'events',(SELECT count(*) FROM private_payments.events),
  'fulfilments',(SELECT count(*) FROM private_payments.fulfilments)) AS target_check;
