import { Receiver } from '@upstash/qstash';
import { loadJobConfig } from './job-config.ts';
import { readJobBody } from './job-queue.ts';
import { sandboxTarget } from './targets.ts';
import { uuidPattern } from './security.ts';

// Deliberately UAT-only. No arbitrary recipients, sender, callback destinations or email templates.
export function loadUatAlertConfig(env: Record<string, string | undefined>) {
  const job = loadJobConfig(env);
  return { ready: Boolean(job.failureCallbackUrl), job, apiKey: env.RESEND_API_KEY ?? '',
    url: `${sandboxTarget.origin}/api/payments/alerts` };
}

function categoryFor(value: unknown, job: ReturnType<typeof loadJobConfig>) {
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
    data.scheduleId === 'portfolio-payments-uat-recovery-v1') return 'RECOVERY_DELIVERY_EXHAUSTED';
  throw new Error('invalid failure');
}

type Options = { env?: Record<string, string | undefined>; send?: typeof fetch; now?: () => Date };
export async function handleUatAlert(request: Request, { env = process.env, send = fetch, now = () => new Date() }: Options = {}) {
  const reply = (status: number, error?: string) => Response.json(error ? { error } : { received: true }, { status, headers: {
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
    'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",'Strict-Transport-Security':'max-age=31536000',
    ...(status === 405 ? { Allow:'POST' } : {}), ...(status === 503 ? { 'Retry-After':'60' } : {}),
  } });
  if (request.method !== 'POST') return reply(405, 'Method is not allowed.');
  const config = loadUatAlertConfig(env);
  if (!config.ready) return reply(503, 'UAT alerting is not enabled.');
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
  try { category = categoryFor(JSON.parse(raw), config.job); }
  catch { return reply(400, 'Invalid failure notification.'); }
  try {
    // Provider-enforced idempotency coalesces each category into one email per UTC hour.
    // This needs no database, so database outages can still produce an alert.
    const hour = new Date(Math.floor(now().getTime() / 3600000) * 3600000).toISOString();
    const response = await send('https://api.resend.com/emails', {
      method:'POST', redirect:'error', credentials:'omit', signal:AbortSignal.timeout(8000),
      headers:{ Authorization:`Bearer ${config.apiKey}`, 'Content-Type':'application/json',
        'Idempotency-Key':`uat-payment-alert/${category}/${hour}` },
      body:JSON.stringify({ from:'Portfolio UAT <onboarding@resend.dev>', to:['kash.nordeen@gmail.com'],
        subject:'[Portfolio UAT] Payment verification delivery needs attention',
        text:`Category: ${category}\nUTC alert window: ${hour}\nAt least one delivery exhausted its retries. Check the UAT QStash logs and dead-letter queue. Repeated failures in this category are coalesced within this hour. This is not a payment confirmation.` }),
    });
    void response.body?.cancel().catch(() => {});
    if (!response.ok || response.redirected) throw new Error('email rejected');
    return reply(200);
  } catch {
    console.warn('PAYMENT_UAT_ALERT_DELIVERY_RETRY_REQUIRED');
    return reply(503, 'UAT alert delivery is temporarily unavailable.');
  }
}
