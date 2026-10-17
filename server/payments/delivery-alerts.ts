import { Receiver } from '@upstash/qstash';
import { loadJobConfig } from './job-config.ts';
import { readJobBody } from './job-queue.ts';
import { sandboxTarget, productionTarget } from './targets.ts';
import { productionAlertSender } from './alert-settings.ts';
import { sendGmailAlert } from './gmail-alerts.ts';
import { uuidPattern } from './security.ts';

// No HTTP-controlled recipients, senders, callback destinations or email templates.
export function loadDeliveryAlertConfig(env: Record<string, string | undefined>, expectedEnvironment?: 'sandbox' | 'production') {
  const job = loadJobConfig(env);
  const sandbox = job.environment === 'sandbox';
  const target = sandbox ? sandboxTarget : productionTarget;
  return { ready: Boolean(job.failureCallbackUrl) && (!expectedEnvironment || job.environment === expectedEnvironment),
    provider: env.PAYMENT_ALERT_PROVIDER ?? 'resend',
    job, apiKey: env.RESEND_API_KEY ?? '', url: `${target.origin}/api/payments/alerts`,
    label: sandbox ? 'UAT' : 'LIVE', keyPrefix: sandbox ? 'uat-payment-alert' : 'live-payment-alert',
    scheduleId: sandbox ? 'portfolio-payments-uat-recovery-v1' : 'portfolio-payments-production-recovery-v1',
    from: sandbox ? 'Portfolio UAT <onboarding@resend.dev>' : `Portfolio Payments <${productionAlertSender(env)}>`,
  };
}

function categoryFor(value: unknown, job: ReturnType<typeof loadJobConfig>, scheduleId: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid failure');
  const data = value as Record<string, unknown>;
  if (!Number.isInteger(data.status) || !(data.status === 0 || Number(data.status) >= 400 && Number(data.status) <= 599) ||
    data.maxRetries !== 3 || data.retried !== 3 || data.method !== 'POST' ||
    typeof data.sourceBody !== 'string' || data.sourceBody.length > 512 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(data.sourceBody)) throw new Error('invalid failure');
  const decoded = Buffer.from(data.sourceBody, 'base64');
  if (decoded.toString('base64') !== data.sourceBody) throw new Error('invalid failure');
  const original = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decoded));
  if (!original || typeof original !== 'object' || Array.isArray(original)) throw new Error('invalid failure');
  if (data.url === job.jobUrl && Object.keys(original).join(',') === 'jobId' &&
    typeof original.jobId === 'string' && uuidPattern.test(original.jobId)) return 'VERIFICATION_DELIVERY_EXHAUSTED';
  if (data.url === job.recoveryUrl && Object.keys(original).length === 0 &&
    data.scheduleId === scheduleId) return 'RECOVERY_DELIVERY_EXHAUSTED';
  throw new Error('invalid failure');
}

export type AlertOptions = { env?: Record<string, string | undefined>; send?: typeof fetch; now?: () => Date };
export async function handleDeliveryAlert(request: Request, {
  env = process.env, send = fetch, now = () => new Date(), expectedEnvironment,
}: AlertOptions & { expectedEnvironment?: 'sandbox' | 'production' } = {}) {
  const reply = (status: number, error?: string) => Response.json(error ? { error } : { received: true }, { status, headers: {
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
    'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",'Strict-Transport-Security':'max-age=31536000',
    ...(status === 405 ? { Allow:'POST' } : {}), ...(status === 503 ? { 'Retry-After':'60' } : {}),
  } });
  if (request.method !== 'POST') return reply(405, 'Method is not allowed.');
  const config = loadDeliveryAlertConfig(env, expectedEnvironment);
  if (!config.ready) return reply(503, 'Payment alerting is not enabled.');
  let raw: string;
  try {
    const signature = request.headers.get('upstash-signature') ?? '';
    if (request.url !== config.url || !signature || signature.length > 4096 ||
      !/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '') ||
      Number(request.headers.get('content-length') ?? '0') > 65536) throw new Error('invalid signature');
    raw = await readJobBody(request.body, 65536);
    const receiver = new Receiver({ currentSigningKey:config.job.currentSigningKey, nextSigningKey:config.job.nextSigningKey });
    if (!await receiver.verify({ signature, body:raw, url:config.url, clockTolerance:0 })) throw new Error('invalid signature');
  } catch { return reply(401, 'Invalid alert authentication.'); }
  let category: string;
  try { category = categoryFor(JSON.parse(raw), config.job, config.scheduleId); }
  catch { return reply(400, 'Invalid failure notification.'); }
  try {
    // No database dependency, so database outages can still produce an alert.
    const hour = new Date(Math.floor(now().getTime() / 3600000) * 3600000).toISOString();
    if (config.provider === 'gmail') {
      await sendGmailAlert(env, category, hour, send);
      return reply(200);
    }
    // Resend-enforced idempotency coalesces each category into one email per UTC hour.
    const response = await send('https://api.resend.com/emails', {
      method:'POST', redirect:'error', credentials:'omit', signal:AbortSignal.timeout(8000),
      headers:{ Authorization:`Bearer ${config.apiKey}`, 'Content-Type':'application/json',
        'Idempotency-Key':`${config.keyPrefix}/${category}/${hour}` },
      body:JSON.stringify({ from:config.from, to:['kash.nordeen@gmail.com'],
        subject:`[Portfolio ${config.label}] Payment verification delivery needs attention`,
        text:`Category: ${category}\nUTC alert window: ${hour}\nAt least one delivery exhausted its retries. Check the ${config.label} QStash logs and dead-letter queue. Repeated failures in this category are coalesced within this hour. This is not a payment confirmation.` }),
    });
    if (!response.ok || response.redirected || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
      void response.body?.cancel().catch(() => {});
      throw new Error('email rejected');
    }
    const receipt = JSON.parse(await readJobBody(response.body, 4096));
    if (!receipt || typeof receipt.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(receipt.id)) {
      throw new Error('invalid email receipt');
    }
    return reply(200);
  } catch {
    console.warn(config.job.environment === 'sandbox' ? 'PAYMENT_UAT_ALERT_DELIVERY_RETRY_REQUIRED' : 'PAYMENT_ALERT_DELIVERY_RETRY_REQUIRED');
    return reply(503, 'Payment alert delivery is temporarily unavailable.');
  }
}
