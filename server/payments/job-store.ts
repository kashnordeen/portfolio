import type { Sql } from 'postgres';
import type { PaymentConfig } from './config.ts';
import type { Order } from './store.ts';
import type { ProviderStatus } from './phonepe.ts';
import type { PaymentJob } from './job-queue.ts';
export type { PaymentJob } from './job-queue.ts';
export type JobClaim = { kind: 'READY'; job: PaymentJob; order: Order; leaseId: string }
  | { kind: 'EARLY' | 'STALE' | 'LEASED' | 'UNATTEMPTED' | 'TERMINAL'; orderId: string | null };
export type JobResult = { state: 'ACK' | 'RETRY'; published: number };
export type JobRow = { id: string; order_id: string; environment: 'production' | 'sandbox'; generation: string | number; due_at: Date | string };
export const paymentJob = (row: JobRow): PaymentJob => ({ id: row.id, orderId: row.order_id,
  environment: row.environment, generation: Number(row.generation), dueAt: new Date(row.due_at) });

export function createJobStore(sql: Sql, config: PaymentConfig) {
  return {
    async hasUnpublished(orderId: string | null): Promise<boolean> {
      const [row] = await sql`SELECT EXISTS(SELECT 1 FROM private_payments.reconciliation_jobs j JOIN private_payments.orders o ON o.id=j.order_id
        WHERE j.environment=${config.environment} AND j.generation=o.job_generation AND j.state='PENDING' AND j.published_at IS NULL
          AND o.state NOT IN ('COMPLETED','REVIEW') AND (${orderId}::uuid IS NULL OR j.order_id=${orderId}::uuid)) AS pending`;
      return row.pending;
    },
    async pendingJobs(orderId: string | null, limit = 3): Promise<PaymentJob[]> {
      const size = Math.max(0, Math.min(Number.isSafeInteger(limit) ? limit : 0, 3));
      if (!size) return [];
      return sql.begin(async tx => {
        if (!orderId) await tx`SELECT private_payments.recover_payment_jobs(${config.environment},${size})`;
        const jobs = await tx<JobRow[]>`UPDATE private_payments.reconciliation_jobs SET
          publish_after=now()+interval '30 seconds',publish_attempts=publish_attempts+1
          WHERE id IN (SELECT j.id FROM private_payments.reconciliation_jobs j JOIN private_payments.orders o ON o.id=j.order_id
            WHERE j.environment=${config.environment} AND j.state='PENDING' AND j.generation=o.job_generation
              AND j.published_at IS NULL AND j.publish_after<=now() AND o.state NOT IN ('COMPLETED','REVIEW')
              AND (${orderId}::uuid IS NULL OR j.order_id=${orderId}::uuid)
            ORDER BY j.publish_after,j.created_at LIMIT ${size} FOR UPDATE OF j SKIP LOCKED)
          RETURNING *`;
        return jobs.map(paymentJob);
      });
    },
    async published(jobId: string, messageId: string): Promise<void> {
      await sql`UPDATE private_payments.reconciliation_jobs SET published_at=COALESCE(published_at,now()),message_id=${messageId}
        WHERE id=${jobId} AND environment=${config.environment} AND state='PENDING'`;
    },
    async publicationFailed(jobId: string): Promise<void> {
      await sql`UPDATE private_payments.reconciliation_jobs SET publish_after=now()+
        (least(60,3*power(2,least(publish_attempts,5))) * interval '1 second')
        WHERE id=${jobId} AND environment=${config.environment} AND state='PENDING' AND published_at IS NULL`;
    },
    async claimCheckout(orderId: string, initialJobId: string): Promise<Order | null> {
      return sql.begin(async tx => {
        const [claim] = await tx`SELECT private_payments.claim_payment_checkout(${orderId},${initialJobId}) AS claimed`;
        if (!claim.claimed) return null;
        const [order] = await tx<Order[]>`SELECT * FROM private_payments.orders WHERE id=${orderId} AND environment=${config.environment}`;
        return order ?? null;
      });
    },
    async claimJob(jobId: string): Promise<JobClaim> {
      const [row] = await sql`SELECT private_payments.claim_payment_job(${jobId},${config.environment}) AS result`;
      const result = row.result as JobClaim;
      if (result.kind !== 'READY') return result;
      const order = { ...result.order };
      for (const key of ['created_at','checkout_attempted_at','expires_at','paid_at'] as const) {
        // JSON from a typed SQL result needs timestamp hydration, not another customer-data parse.
        if (order[key]) (order as Record<string, unknown>)[key] = new Date(order[key]!);
      }
      return { ...result, order, job: { ...result.job, dueAt: new Date(result.job.dueAt) } };
    },
    async finishJob(jobId: string, leaseId: string, status: ProviderStatus | null): Promise<void> {
      await sql`SELECT private_payments.finish_payment_job(${jobId},${leaseId},${status?.state ?? null},${status?.amount ?? null},${status?.orderId ?? null})`;
    },
  };
}
