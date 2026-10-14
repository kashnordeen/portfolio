import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import type { PaymentConfig } from './config.ts';
import { PaymentError, equalSecret, sha256 } from './security.ts';
import type { ProviderStatus } from './phonepe.ts';
import { createJobStore, paymentJob, type JobRow } from './job-store.ts';

export type Order = {
  id: string; idempotency_key: string; merchant_order_id: string; purpose: string;
  customer_name: string; customer_email: string; project_reference: string | null;
  amount_paise: number; environment: string; session_token_hash: string;
  state: string; phonepe_order_id: string | null; checkout_url: string | null;
  checkout_attempted_at: Date | null; expires_at: Date | null; paid_at: Date | null;
  created_at: Date; reconcile_attempts: number; reconcile_lease_id: string | null;
};
export type Customer = { purpose: string; name: string; email: string; reference: string | null; amount: number };
export function sameTerms(order: Order, input: Customer, session: string, environment: string) {
  return equalSecret(order.session_token_hash, session) && order.environment === environment &&
    order.purpose === input.purpose && order.amount_paise === input.amount && order.customer_name === input.name &&
    order.customer_email === input.email && order.project_reference === input.reference;
}

export function verifiedState(order: Order, status: ProviderStatus) {
  // The authenticated status lookup is bound to this merchant order and merchant OAuth token.
  if (status.amount !== order.amount_paise || (order.phonepe_order_id && status.orderId !== order.phonepe_order_id)) return 'REVIEW';
  return status.state;
}

export function reconciliationDelay(created: Date, now = Date.now()) {
  const age = (now - created.getTime()) / 1000;
  if (age < 25) return 25 - Math.floor(age);
  if (age < 55) return 3;
  if (age < 115) return 6;
  if (age < 175) return 10;
  if (age < 235) return 30;
  return 60;
}

export function createStore(config: PaymentConfig) {
  let url: URL;
  try { url = new URL(config.databaseUrl); } catch { throw new PaymentError(503, 'Payment database is not configured.'); }
  const username = decodeURIComponent(url.username);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !/^portfolio_payments_api(?:\.[a-z0-9]+)?$/.test(username)) {
    throw new PaymentError(503, 'A restricted payment database account is required.');
  }
  // URL-level ssl options must not override certificate verification.
  for (const name of ['sslmode', 'ssl', 'sslrootcert', 'sslcert', 'sslkey']) {
    if (url.searchParams.has(name)) throw new PaymentError(503, 'Configure payment database TLS separately from its URL.');
  }
  const sql = postgres(url.href, { ssl: { rejectUnauthorized: true, ...(config.databaseCa ? { ca: config.databaseCa } : {}) },
    max: 2, prepare: false, idle_timeout: 20, connect_timeout: 5,
    connection: { statement_timeout: 3000, application_name: 'portfolio-payments' } });
  const jobs = createJobStore(sql, config);
  const finishManaged = async (order: Order, status: ProviderStatus | null) => {
    if (!order.reconcile_lease_id) return;
    const [job] = await sql`SELECT j.id FROM private_payments.reconciliation_jobs j JOIN private_payments.orders o ON o.id=j.order_id
      WHERE o.id=${order.id} AND o.environment=${config.environment} AND j.generation=o.job_generation AND j.state='PENDING'`;
    if (job) await jobs.finishJob(job.id,order.reconcile_lease_id,status);
  };
  return {
    ...jobs,
    async rate(bucket: string, limit: number, seconds: number) {
      const start = Math.floor(Date.now() / (seconds * 1000)) * seconds;
      const [row] = await sql`INSERT INTO private_payments.rate_limits(bucket_hash, window_start, requests)
        VALUES (${sha256(bucket)}, ${start}, 1) ON CONFLICT (bucket_hash, window_start)
        DO UPDATE SET requests = private_payments.rate_limits.requests + 1 RETURNING requests`;
      if (row.requests > limit) throw new PaymentError(429, 'Too many payment requests. Please wait before retrying.');
    },
    async reserve(input: Customer, idempotency: string, session: string) {
      return sql.begin(async tx => {
        const id = randomUUID();
        const inserted = await tx<Order[]>`INSERT INTO private_payments.orders
          (id, idempotency_key, merchant_order_id, purpose, customer_name, customer_email, project_reference, amount_paise, environment, session_token_hash, next_reconcile_at)
          VALUES (${id}, ${idempotency}, ${`KK_${id}`}, ${input.purpose}, ${input.name}, ${input.email}, ${input.reference}, ${input.amount}, ${config.environment}, ${session}, now() + interval '25 seconds')
          ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`;
        const [order] = inserted.length ? inserted : await tx<Order[]>`SELECT * FROM private_payments.orders WHERE idempotency_key = ${idempotency} FOR UPDATE`;
        if (!order || !sameTerms(order, input, session, config.environment)) throw new PaymentError(409, 'This request is already bound to another payment.');
        // A durable claim prevents simultaneous submissions and ambiguous provider failures being retried.
        if (config.jobsEnabled) {
          if (inserted.length) await tx`SELECT private_payments.new_payment_job(${id},now()+interval '25 seconds')`;
          const [job] = await tx<JobRow[]>`SELECT * FROM private_payments.reconciliation_jobs
            WHERE order_id=${order.id} AND state='PENDING' ORDER BY generation DESC LIMIT 1`;
          return { order, initiate: Boolean(inserted.length), job: job ? paymentJob(job) : null };
        }
        if (!inserted.length) return { order, initiate: false, job: null };
        const [claimed] = await tx<Order[]>`UPDATE private_payments.orders SET checkout_attempted_at = now() WHERE id = ${id} RETURNING *`;
        return { order: claimed, initiate: true, job: null };
      });
    },
    async checkout(id: string, result: { orderId: string; expires: Date; url: string }) {
      return sql.begin(async tx => {
        const [order] = await tx<Order[]>`SELECT * FROM private_payments.orders WHERE id = ${id} FOR UPDATE`;
        if (!order) throw new PaymentError(404, 'Payment was not found.');
        if (order.phonepe_order_id && order.phonepe_order_id !== result.orderId) throw new PaymentError(502, 'Payment requires review.');
        await tx`UPDATE private_payments.orders SET phonepe_order_id = ${result.orderId}, checkout_url = ${result.url}, expires_at = ${result.expires},
          state = CASE WHEN state = 'CREATED' THEN 'PENDING' ELSE state END WHERE id = ${id}`;
      });
    },
    async owned(id: string, session: string) {
      const [order] = await sql<Order[]>`SELECT * FROM private_payments.orders WHERE id = ${id} AND session_token_hash = ${session} AND environment = ${config.environment}`;
      if (!order) throw new PaymentError(404, 'Payment was not found in this browser session.');
      return order;
    },
    async recordEvent(merchantOrderId: string, event: string, digest: string) {
      return sql.begin(async tx => {
        const [order] = await tx<Order[]>`SELECT * FROM private_payments.orders WHERE merchant_order_id = ${merchantOrderId} AND environment = ${config.environment} FOR UPDATE`;
        if (!order) throw new PaymentError(404, 'Payment was not found.');
        const inserted = await tx`INSERT INTO private_payments.events(id, order_id, deduplication_hash, event_name)
          VALUES (${randomUUID()}, ${order.id}, ${digest}, ${event}) ON CONFLICT (deduplication_hash) DO NOTHING RETURNING id`;
        if (inserted.length && order.state !== 'COMPLETED' && order.state !== 'REVIEW') {
          if (config.jobsEnabled) await tx`SELECT private_payments.new_payment_job(${order.id},now())`;
          else await tx`UPDATE private_payments.orders SET next_reconcile_at = now() WHERE id = ${order.id}`;
        }
        return order.id;
      });
    },
    async claimDue() {
      // Small batches keep function execution bounded. Lease IDs reject stale concurrent workers.
      const lease = randomUUID();
      return sql<Order[]>`UPDATE private_payments.orders SET reconcile_lease_id = ${lease}, reconcile_lease_until = now() + interval '90 seconds'
        WHERE id IN (SELECT id FROM private_payments.orders WHERE environment = ${config.environment} AND next_reconcile_at <= now()
          AND state NOT IN ('COMPLETED', 'REVIEW') AND (reconcile_lease_until IS NULL OR reconcile_lease_until < now())
          ORDER BY next_reconcile_at FOR UPDATE SKIP LOCKED LIMIT 3) RETURNING *`;
    },
    async applyStatus(order: Order, status: ProviderStatus) {
      if (config.jobsEnabled) return finishManaged(order,status);
      await sql.begin(async tx => {
        const [current] = await tx<Order[]>`SELECT * FROM private_payments.orders WHERE id = ${order.id} FOR UPDATE`;
        if (!current || current.state === 'COMPLETED' || current.state === 'REVIEW' || current.reconcile_lease_id !== order.reconcile_lease_id) return;
        const state = verifiedState(current, status);
        const delay = reconciliationDelay(current.checkout_attempted_at ?? current.created_at);
        await tx`UPDATE private_payments.orders SET state = ${state},
          phonepe_order_id = COALESCE(phonepe_order_id, ${status.orderId}),
          paid_at = CASE WHEN ${state} = 'COMPLETED' THEN COALESCE(paid_at, now()) ELSE paid_at END,
          next_reconcile_at = CASE WHEN ${state} = 'PENDING' THEN now() + (${delay} * interval '1 second') ELSE NULL END,
          reconcile_attempts = reconcile_attempts + 1, reconcile_lease_id = NULL, reconcile_lease_until = NULL WHERE id = ${order.id}`;
        if (state === 'COMPLETED') {
          await tx`INSERT INTO private_payments.fulfilments(order_id) VALUES (${order.id}) ON CONFLICT (order_id) DO NOTHING`;
        }
        await tx`UPDATE private_payments.events SET processed_at = now() WHERE order_id = ${order.id} AND processed_at IS NULL`;
        if (config.jobsEnabled && state === 'PENDING') await tx`SELECT private_payments.new_payment_job(${order.id},now()+(${delay} * interval '1 second'))`;
      });
    },
    async retryLater(order: Order) {
      if (config.jobsEnabled) return finishManaged(order,null);
      // Expiry or API failure is never treated as payment failure. Escalate unresolved orders for manual review.
      const review = Date.now() - order.created_at.getTime() > 86400000;
      const delay = reconciliationDelay(order.created_at);
      await sql`UPDATE private_payments.orders SET state = CASE WHEN ${review} THEN 'REVIEW' ELSE state END,
        next_reconcile_at = CASE WHEN ${review} THEN NULL ELSE now() + (${delay} * interval '1 second') END,
        reconcile_attempts = reconcile_attempts + 1, reconcile_lease_until = NULL, reconcile_lease_id = NULL
        WHERE id = ${order.id} AND reconcile_lease_id = ${order.reconcile_lease_id} AND state NOT IN ('COMPLETED', 'REVIEW')`;
    },
    async cleanupRates() {
      await sql`DELETE FROM private_payments.rate_limits WHERE window_start < extract(epoch FROM now() - interval '1 day')`;
    },
  };
}
