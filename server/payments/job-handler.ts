import { randomUUID } from 'node:crypto';
import { loadJobConfig } from './job-config.ts';
import { createJobQueue, publishPending } from './job-queue.ts';
import { paymentRuntime, type Runtime } from './handler.ts';
import type { JobResult } from './job-store.ts';
import { PaymentError, uuidPattern } from './security.ts';

export async function runJob(jobId: string, runtime: Runtime): Promise<JobResult> {
  const { store, provider, queue } = runtime;
  const claim = await store.claimJob(jobId);
  if (claim.kind === 'LEASED') return { state: 'RETRY', published: 0 };
  const orderId = claim.kind === 'READY' ? claim.order.id : claim.orderId;
  if (claim.kind === 'READY') {
    let status = null;
    try { status = await provider.status(claim.order.merchant_order_id); }
    catch { console.warn('PAYMENT_VERIFICATION_PROVIDER_DEFERRED'); }
    if (!await store.finishJob(jobId,claim.leaseId,status)) return { state: 'RETRY', published: 0 };
  }
  if (!orderId) return { state: 'ACK', published: 0 };
  return { state: 'ACK', published: await publishPending(store,queue,orderId,3) };
}

async function handle(request: Request, target: 'job' | 'recovery', getRuntime?: () => Runtime): Promise<Response> {
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: {
    'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",
    'Strict-Transport-Security':'max-age=31536000', ...(status===405?{Allow:'POST'}:{}), ...(status===503?{'Retry-After':'3'}:{}),
  } });
  try {
    if (request.method !== 'POST') return reply({error:'Method is not allowed.'},405);
    // Production verifies signing configuration/body before loading DB or PhonePe credentials/runtime.
    const supplied = getRuntime?.();
    const config = supplied?.config.jobConfig ?? loadJobConfig(process.env);
    if (!config.ready) return reply({error:'Payment verification is not enabled.'},503);
    const queue = supplied?.queue ?? createJobQueue(config);
    let body: unknown;
    try {
      const raw = await queue.verify(request,target);
      try { body=JSON.parse(raw); } catch { return reply({error:'Invalid verification job.'},400); }
    } catch { return reply({error:'Invalid scheduler authentication.'},401); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({error:'Invalid verification job.'},400);
    const fields=body as Record<string,unknown>;
    if (target==='job' ? Object.keys(fields).join(',')!=='jobId' || typeof fields.jobId!=='string' || !uuidPattern.test(fields.jobId)
      : Object.keys(fields).length!==0) return reply({error:'Invalid verification job.'},400);
    const runtime = supplied ?? paymentRuntime();
    await runtime.store.rate(`verification:${target}:${runtime.config.environment}`,target==='job'?120:12,60);
    if (target==='recovery') await runtime.store.cleanupRates();
    const result = target==='job' ? await runJob(fields.jobId as string,runtime)
      : {state:'ACK',published:await publishPending(runtime.store,queue,null,3)};
    if (result.state==='RETRY') return reply({error:'Verification is awaiting another attempt.'},503);
    return reply({received:true,published:result.published});
  } catch (error) {
    console.warn('PAYMENT_VERIFICATION_RETRY_REQUIRED');
    return reply({error:'Payment verification is temporarily unavailable.',requestId:randomUUID()},error instanceof PaymentError?error.status:503);
  }
}
export const handleJob = (request: Request, getRuntime?: () => Runtime) => handle(request,'job',getRuntime);
export const handleRecovery = (request: Request, getRuntime?: () => Runtime) => handle(request,'recovery',getRuntime);
