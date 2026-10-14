-- LOCAL VERSIONED DRAFT. Requires separate approval before application to Supabase.
-- No extensions, credentials, schedules, external requests or elevated roles.
BEGIN;
ALTER TABLE private_payments.orders ADD COLUMN job_generation bigint NOT NULL DEFAULT 0 CHECK (job_generation >= 0);
ALTER TABLE private_payments.orders ADD CONSTRAINT payment_order_environment_unique UNIQUE(id, environment);
CREATE TABLE private_payments.reconciliation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  environment text NOT NULL CHECK(environment IN ('production','sandbox')),
  generation bigint NOT NULL CHECK(generation > 0),
  due_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','DONE')),
  published_at timestamptz,
  message_id text CHECK(message_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  publish_after timestamptz NOT NULL DEFAULT now(),
  publish_attempts integer NOT NULL DEFAULT 0 CHECK(publish_attempts >= 0),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(order_id,environment) REFERENCES private_payments.orders(id,environment),
  UNIQUE(order_id,generation),
  CHECK ((state='DONE') = (processed_at IS NOT NULL))
);
CREATE INDEX payment_job_pending_idx ON private_payments.reconciliation_jobs(publish_after,due_at) WHERE state='PENDING';
ALTER TABLE private_payments.reconciliation_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private_payments.reconciliation_jobs FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON private_payments.reconciliation_jobs TO portfolio_payments_api;
CREATE POLICY backend_jobs ON private_payments.reconciliation_jobs TO portfolio_payments_api USING(true) WITH CHECK(true);

CREATE FUNCTION private_payments.enforce_job_integrity() RETURNS trigger LANGUAGE plpgsql
SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
  IF ROW(NEW.id,NEW.order_id,NEW.environment,NEW.generation,NEW.due_at,NEW.created_at)
     IS DISTINCT FROM ROW(OLD.id,OLD.order_id,OLD.environment,OLD.generation,OLD.due_at,OLD.created_at)
     OR (OLD.state='DONE' AND NEW.state<>'DONE') THEN
    RAISE EXCEPTION 'Job identity and completed processing are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER enforce_job_integrity BEFORE UPDATE ON private_payments.reconciliation_jobs
FOR EACH ROW EXECUTE FUNCTION private_payments.enforce_job_integrity();

CREATE FUNCTION private_payments.payment_job_delay(started timestamptz, at_time timestamptz DEFAULT now())
RETURNS integer LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
  SELECT CASE WHEN extract(epoch FROM (at_time-started))<25 THEN 25-floor(extract(epoch FROM (at_time-started)))::integer
    WHEN extract(epoch FROM (at_time-started))<55 THEN 3 WHEN extract(epoch FROM (at_time-started))<115 THEN 6
    WHEN extract(epoch FROM (at_time-started))<175 THEN 10 WHEN extract(epoch FROM (at_time-started))<235 THEN 30 ELSE 60 END;
$$;

CREATE FUNCTION private_payments.new_payment_job(order_key uuid, due_time timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE payment private_payments.orders%ROWTYPE; job_key uuid := gen_random_uuid();
BEGIN
  SELECT * INTO payment FROM private_payments.orders WHERE id=order_key FOR UPDATE;
  IF NOT FOUND OR payment.state IN ('COMPLETED','REVIEW') THEN RETURN NULL; END IF;
  UPDATE private_payments.reconciliation_jobs SET state='DONE',processed_at=now() WHERE order_id=order_key AND state='PENDING';
  UPDATE private_payments.orders SET job_generation=job_generation+1,next_reconcile_at=due_time,
    reconcile_lease_id=NULL,reconcile_lease_until=NULL WHERE id=order_key RETURNING * INTO payment;
  INSERT INTO private_payments.reconciliation_jobs(id,order_id,environment,generation,due_at)
    VALUES(job_key,order_key,payment.environment,payment.job_generation,due_time);
  RETURN job_key;
END $$;

CREATE FUNCTION private_payments.claim_payment_checkout(order_key uuid, job_key uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE payment private_payments.orders%ROWTYPE;
BEGIN
  SELECT * INTO payment FROM private_payments.orders WHERE id=order_key FOR UPDATE;
  IF NOT FOUND OR payment.state<>'CREATED' OR payment.checkout_attempted_at IS NOT NULL OR NOT EXISTS
    (SELECT 1 FROM private_payments.reconciliation_jobs WHERE id=job_key AND order_id=order_key
      AND generation=payment.job_generation AND state='PENDING' AND published_at IS NOT NULL) THEN RETURN false; END IF;
  UPDATE private_payments.orders SET checkout_attempted_at=now(),next_reconcile_at=now()+interval '25 seconds',
    expires_at=now()+interval '1200 seconds' WHERE id=order_key;
  RETURN true;
END $$;

CREATE FUNCTION private_payments.claim_payment_job(job_key uuid, target_environment text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE job private_payments.reconciliation_jobs%ROWTYPE; payment private_payments.orders%ROWTYPE; token uuid;
BEGIN
  SELECT * INTO job FROM private_payments.reconciliation_jobs WHERE id=job_key AND environment=target_environment;
  IF NOT FOUND THEN RETURN jsonb_build_object('kind','STALE','orderId',NULL); END IF;
  SELECT * INTO payment FROM private_payments.orders WHERE id=job.order_id AND environment=target_environment FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('kind','STALE','orderId',NULL); END IF;
  IF payment.job_generation<>job.generation OR job.state='DONE' THEN
    RETURN jsonb_build_object('kind','STALE','orderId',payment.id); END IF;
  IF payment.state IN ('COMPLETED','REVIEW') THEN
    RETURN jsonb_build_object('kind','TERMINAL','orderId',payment.id); END IF;
  IF payment.checkout_attempted_at IS NULL THEN
    UPDATE private_payments.reconciliation_jobs SET state='DONE',processed_at=now() WHERE id=job_key;
    UPDATE private_payments.orders SET next_reconcile_at=NULL WHERE id=payment.id;
    RETURN jsonb_build_object('kind','UNATTEMPTED','orderId',payment.id);
  END IF;
  IF payment.reconcile_lease_until>now() THEN RETURN jsonb_build_object('kind','LEASED','orderId',payment.id); END IF;
  IF payment.expires_at<=now() THEN
    UPDATE private_payments.orders SET state='REVIEW',next_reconcile_at=NULL,reconcile_lease_id=NULL,reconcile_lease_until=NULL WHERE id=payment.id;
    UPDATE private_payments.reconciliation_jobs SET state='DONE',processed_at=now() WHERE id=job_key;
    RETURN jsonb_build_object('kind','TERMINAL','orderId',payment.id);
  END IF;
  IF payment.next_reconcile_at>now() THEN
    PERFORM private_payments.new_payment_job(payment.id,payment.next_reconcile_at);
    RETURN jsonb_build_object('kind','EARLY','orderId',payment.id);
  END IF;
  token := gen_random_uuid();
  UPDATE private_payments.orders SET reconcile_lease_id=token,reconcile_lease_until=now()+interval '90 seconds'
    WHERE id=payment.id RETURNING * INTO payment;
  RETURN jsonb_build_object('kind','READY','leaseId',token,'order',to_jsonb(payment),'job',
    jsonb_build_object('id',job.id,'orderId',job.order_id,'environment',job.environment,'generation',job.generation,'dueAt',job.due_at));
END $$;

CREATE FUNCTION private_payments.finish_payment_job(job_key uuid, lease_key uuid, provider_state text, provider_amount integer, provider_order text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE job private_payments.reconciliation_jobs%ROWTYPE; payment private_payments.orders%ROWTYPE; next_state text; due_time timestamptz;
BEGIN
  SELECT * INTO job FROM private_payments.reconciliation_jobs WHERE id=job_key;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO payment FROM private_payments.orders WHERE id=job.order_id FOR UPDATE;
  IF lease_key IS NULL OR payment.reconcile_lease_id IS NULL OR payment.reconcile_lease_until IS NULL
    OR payment.checkout_attempted_at IS NULL OR payment.job_generation<>job.generation OR job.state<>'PENDING' OR payment.state IN ('COMPLETED','REVIEW')
    OR payment.reconcile_lease_id IS DISTINCT FROM lease_key OR payment.reconcile_lease_until<=now() THEN RETURN false; END IF;
  IF provider_state IS NOT NULL AND (provider_state NOT IN ('PENDING','COMPLETED','FAILED') OR provider_amount IS NULL OR provider_amount<100
    OR provider_order IS NULL OR provider_order !~ '^[A-Za-z0-9_-]{1,128}$') THEN RAISE EXCEPTION 'Invalid provider state'; END IF;
  next_state := COALESCE(provider_state,'PENDING');
  IF provider_state IS NOT NULL AND (provider_amount<>payment.amount_paise OR
    (payment.phonepe_order_id IS NOT NULL AND provider_order<>payment.phonepe_order_id)) THEN next_state := 'REVIEW'; END IF;
  IF next_state='PENDING' AND payment.expires_at<=now() THEN next_state := 'REVIEW'; END IF;
  due_time := CASE WHEN next_state='PENDING' THEN now()+make_interval(secs=>private_payments.payment_job_delay(payment.checkout_attempted_at)) ELSE NULL END;
  UPDATE private_payments.orders SET state=next_state,
    phonepe_order_id=CASE WHEN next_state='REVIEW' THEN phonepe_order_id ELSE COALESCE(phonepe_order_id,provider_order) END,
    paid_at=CASE WHEN next_state='COMPLETED' THEN COALESCE(paid_at,now()) ELSE paid_at END,
    next_reconcile_at=due_time,reconcile_attempts=reconcile_attempts+1,reconcile_lease_id=NULL,reconcile_lease_until=NULL WHERE id=payment.id;
  UPDATE private_payments.reconciliation_jobs SET state='DONE',processed_at=now() WHERE id=job_key;
  IF next_state='COMPLETED' THEN INSERT INTO private_payments.fulfilments(order_id) VALUES(payment.id) ON CONFLICT(order_id) DO NOTHING; END IF;
  UPDATE private_payments.events SET processed_at=now() WHERE order_id=payment.id AND processed_at IS NULL;
  IF next_state='PENDING' THEN PERFORM private_payments.new_payment_job(payment.id,due_time); END IF;
  RETURN true;
END $$;

CREATE FUNCTION private_payments.recover_payment_jobs(target_environment text, batch_size integer)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE payment private_payments.orders%ROWTYPE; recovered integer := 0;
BEGIN
  FOR payment IN SELECT o.* FROM private_payments.orders o JOIN private_payments.reconciliation_jobs j
    ON j.order_id=o.id AND j.generation=o.job_generation WHERE o.environment=target_environment
      AND o.checkout_attempted_at IS NOT NULL AND o.state NOT IN ('COMPLETED','REVIEW') AND j.state='PENDING'
      AND j.published_at<now()-interval '90 seconds' AND o.next_reconcile_at<now()-interval '90 seconds'
      AND (o.reconcile_lease_until IS NULL OR o.reconcile_lease_until<=now())
    ORDER BY o.next_reconcile_at LIMIT greatest(0,least(batch_size,3)) FOR UPDATE OF o SKIP LOCKED LOOP
      PERFORM private_payments.new_payment_job(payment.id,now()); recovered := recovered+1;
  END LOOP;
  RETURN recovered;
END $$;

REVOKE ALL ON FUNCTION private_payments.enforce_job_integrity(),private_payments.payment_job_delay(timestamptz,timestamptz),
  private_payments.new_payment_job(uuid,timestamptz),private_payments.claim_payment_checkout(uuid,uuid),
  private_payments.claim_payment_job(uuid,text),private_payments.finish_payment_job(uuid,uuid,text,integer,text),
  private_payments.recover_payment_jobs(text,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private_payments.payment_job_delay(timestamptz,timestamptz),private_payments.new_payment_job(uuid,timestamptz),
  private_payments.claim_payment_checkout(uuid,uuid),private_payments.claim_payment_job(uuid,text),
  private_payments.finish_payment_job(uuid,uuid,text,integer,text),private_payments.recover_payment_jobs(text,integer) TO portfolio_payments_api;
COMMIT;
