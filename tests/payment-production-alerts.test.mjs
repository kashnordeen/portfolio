import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { loadJobConfig } from '../server/payments/job-config.ts';
import { createJobQueue } from '../server/payments/job-queue.ts';
import { productionTarget, sandboxTarget } from '../server/payments/targets.ts';
import { handleDeliveryAlert, loadDeliveryAlertConfig } from '../server/payments/delivery-alerts.ts';
import { handleUatAlert, loadUatAlertConfig } from '../server/payments/uat-alerts.ts';
import { loadConfig } from '../server/payments/config.ts';

const env = {
  PHONEPE_ENV: 'production', VERCEL_ENV: 'production',
  VERCEL_PROJECT_ID: productionTarget.projectId, PAYMENT_SITE_ORIGIN: productionTarget.origin,
  PAYMENTS_ENABLED: 'false', PAYMENT_RELEASE_APPROVED: 'false', COMMUNITY_PAYMENTS_ENABLED: 'false',
  PAYMENT_JOBS_ENABLED: 'true', PAYMENT_PRODUCTION_ALERTS_ENABLED: 'true',
  PAYMENT_ALERT_FROM: 'alerts@merchant.example.org', RESEND_API_KEY: 're_fixture_not_a_real_api_key',
  QSTASH_TOKEN: 'fixture', QSTASH_CURRENT_SIGNING_KEY: 'fixture-production-signing-key',
  QSTASH_NEXT_SIGNING_KEY: 'fixture-production-signing-key-next',
  VERCEL_AUTOMATION_BYPASS_SECRET: 'PRIVATE_UAT_BYPASS_MUST_NOT_BE_FORWARDED',
  PAYMENT_SESSION_SECRET: 'fixture-session'.padEnd(40, 's'), PAYMENT_RECONCILIATION_SECRET: 'fixture-worker'.padEnd(40, 'w'),
  DATABASE_URL: 'postgres://fixture:fixture@localhost/fixture',
  PHONEPE_CLIENT_ID: 'fixture', PHONEPE_CLIENT_SECRET: 'fixture', PHONEPE_CLIENT_VERSION: '1',
  PHONEPE_MERCHANT_ID: 'fixture', PHONEPE_WEBHOOK_USERNAME: 'fixture', PHONEPE_WEBHOOK_PASSWORD: 'fixture',
  PROJECT_MIN_PAISE: '20000', PROJECT_MAX_PAISE: '5000000',
};
const url = productionTarget.origin + '/api/payments/alerts';

test('production alerts require a distinct opt-in, exact identity and non-testing sender; checkout stays off', () => {
  assert.equal(loadJobConfig(env).failureCallbackUrl, url);
  for (const change of [
    { PAYMENT_PRODUCTION_ALERTS_ENABLED: undefined }, { PAYMENT_PRODUCTION_ALERTS_ENABLED: 'false' },
    { PAYMENT_ALERT_FROM: undefined }, { PAYMENT_ALERT_FROM: 'onboarding@resend.dev' },
    { PAYMENT_ALERT_FROM: 'alerts@sub.resend.dev' }, { PAYMENT_ALERT_FROM: 'alerts@evil.test\r\nBcc:x@y.test' },
    { PAYMENT_ALERT_FROM: 'a@RESEND.DEV' }, { PAYMENT_ALERT_FROM: 'Name <a@merchant.example.org>' },
    { VERCEL_PROJECT_ID: undefined }, { VERCEL_PROJECT_ID: sandboxTarget.projectId },
    { VERCEL_ENV: 'preview' }, { PAYMENT_SITE_ORIGIN: sandboxTarget.origin },
    { RESEND_API_KEY: '' }, { NODE_TLS_REJECT_UNAUTHORIZED: '0' }, { PAYMENT_JOBS_ENABLED: 'false' },
  ]) assert.equal(loadJobConfig({ ...env, ...change }).failureCallbackUrl, '', JSON.stringify(Object.keys(change)));
  assert.equal(loadConfig(env).projectEnabled, false);
  assert.equal(loadConfig(env).communityEnabled, false);
});

test('production publication forwards only the fixed callback, never any UAT bypass credential', async () => {
  let sent;
  const config = loadJobConfig(env);
  await createJobQueue(config, { send: async (target, options) => {
    sent = { target, options }; return Response.json({ messageId: 'fixture' });
  } }).publish({ id: randomUUID(), orderId: randomUUID(), environment: 'production', generation: 1, dueAt: new Date() });
  assert.equal(sent.options.headers['Upstash-Failure-Callback'], url);
  assert.equal(sent.options.headers['Upstash-Failure-Callback-Forward-Content-Type'], 'application/json');
  assert.equal(sent.options.headers['Upstash-Failure-Callback-Forward-x-vercel-protection-bypass'], undefined);
  assert.equal(sent.options.headers['Upstash-Forward-x-vercel-protection-bypass'], undefined);
  assert.equal(JSON.stringify(sent).includes(env.VERCEL_AUTOMATION_BYPASS_SECRET), false);
  assert.ok(sent.target.startsWith(productionTarget.queueOrigin + '/v2/publish/'));
});

const now = () => new Date('2026-10-17T04:23:00.000Z');
const failure = {
  status: 503, retried: 3, maxRetries: 3, method: 'POST', url: productionTarget.origin + '/api/payments/jobs',
  sourceBody: Buffer.from(JSON.stringify({ jobId: randomUUID() })).toString('base64'),
  sourceMessageId: 'PRIVATE_MESSAGE', callerIP: 'PRIVATE_IP', body: 'PRIVATE_RESPONSE',
  sourceHeader: { secret: 'PRIVATE_HEADER' }, recipient: 'attacker@evil.test',
};
function signed(body, { secret = env.QSTASH_CURRENT_SIGNING_KEY, sub = url, exp = Math.floor(Date.now() / 1000) + 60 } = {}) {
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: 'Upstash', sub, exp, nbf: 0,
    body: createHash('sha256').update(body).digest('base64url') })).toString('base64url');
  return `${head}.${payload}.${createHmac('sha256', secret).update(`${head}.${payload}`).digest('base64url')}`;
}
const request = (value = failure, options = {}) => {
  const raw = JSON.stringify(value);
  return new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Upstash-Signature': signed(raw, options) }, body: raw });
};
const run = (req, send, settings = env) => handleDeliveryAlert(req, { env: settings, send, now });

test('production handler authenticates before email and enforces exact callback URL, raw body and expiry', async () => {
  let calls = 0; const send = async () => { calls++; return Response.json({ id: 'fixture' }); };
  const raw = JSON.stringify(failure);
  for (const req of [
    new Request(url, { method: 'POST', body: raw }), request(failure, { exp: 1 }),
    request(failure, { secret: 'wrong-signing-key' }), request(failure, { sub: sandboxTarget.origin + '/api/payments/alerts' }),
    new Request(url + '?bypass=private', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Upstash-Signature': signed(raw) }, body: raw }),
    new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Upstash-Signature': signed(raw) }, body: raw + ' ' }),
    new Request(url, { method: 'POST', headers: { 'Content-Type': 'text/plain', 'Upstash-Signature': signed(raw) }, body: raw }),
    new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Upstash-Signature': signed(raw) }, body: 'x'.repeat(65537) }),
  ]) assert.equal((await run(req, send)).status, 401);
  assert.equal((await run(new Request(url), send)).status, 405);
  assert.equal(calls, 0);
});

test('production alerts contain only fixed category and UTC hour, with environment-separated coalescing', async () => {
  const sent = []; const send = async (target, options) => { sent.push({ target, options }); return Response.json({ id: 'fixture' }); };
  assert.equal((await run(request(), send)).status, 200);
  assert.equal((await run(request({ ...failure, sourceMessageId: 'PRIVATE_OTHER_MESSAGE' }), send)).status, 200);
  const email = JSON.parse(sent[0].options.body);
  assert.equal(sent[0].target, 'https://api.resend.com/emails');
  assert.equal(sent[0].options.redirect, 'error');
  assert.equal(sent[0].options.credentials, 'omit');
  assert.equal(sent[0].options.headers['Idempotency-Key'], sent[1].options.headers['Idempotency-Key']);
  assert.match(sent[0].options.headers['Idempotency-Key'], /^live-payment-alert\//);
  assert.equal(email.from, 'Portfolio Payments <alerts@merchant.example.org>');
  assert.equal(email.subject, '[Portfolio LIVE] Payment verification delivery needs attention');
  assert.deepEqual(email.to, ['kash.nordeen@gmail.com']);
  assert.match(email.text, /VERIFICATION_DELIVERY_EXHAUSTED/);
  assert.match(email.text, /2026-10-17T04:00:00.000Z/);
  for (const value of ['PRIVATE', 'attacker@evil.test', failure.url, env.QSTASH_TOKEN, env.RESEND_API_KEY]) {
    assert.equal(sent[0].options.body.includes(value), false);
  }
});

test('production recovery alerts accept only the fixed production schedule and empty original body', async () => {
  const sent = []; const send = async (_target, options) => { sent.push(options); return Response.json({ id: 'fixture' }); };
  const recovery = { ...failure, url: productionTarget.origin + '/api/payments/recover',
    scheduleId: 'portfolio-payments-production-recovery-v1', sourceBody: Buffer.from('{}').toString('base64') };
  assert.equal((await run(request(recovery), send)).status, 200);
  assert.match(JSON.parse(sent[0].body).text, /RECOVERY_DELIVERY_EXHAUSTED/);
  for (const value of [
    { ...recovery, scheduleId: 'portfolio-payments-uat-recovery-v1' },
    { ...recovery, sourceBody: Buffer.from('{"unsafe":true}').toString('base64') },
    { ...failure, url: sandboxTarget.origin + '/api/payments/jobs' },
    { ...failure, url: failure.url + '?unsafe=private' }, { ...failure, retried: 2 },
    { ...failure, status: 200 }, { ...failure, maxRetries: 9 },
    { ...failure, sourceBody: Buffer.from('{"jobId":"not-a-uuid"}').toString('base64') },
  ]) assert.equal((await run(request(value), send)).status, 400);
  assert.equal(sent.length, 1);
});

test('production opt-in cannot activate the UAT-only interface or bypass sender and deployment guards', async () => {
  let calls = 0; const send = async () => { calls++; return Response.json({ id: 'fixture' }); };
  assert.equal(loadDeliveryAlertConfig(env).ready, true);
  assert.equal(loadUatAlertConfig({ ...env, PAYMENT_UAT_ALERTS_ENABLED: 'true' }).ready, false);
  assert.equal((await handleUatAlert(request(), { env, send, now })).status, 503);
  for (const change of [{ PAYMENT_PRODUCTION_ALERTS_ENABLED: 'false' }, { PAYMENT_ALERT_FROM: '' },
    { PAYMENT_ALERT_FROM: 'onboarding@resend.dev' }, { VERCEL_PROJECT_ID: sandboxTarget.projectId }]) {
    assert.equal((await run(request(), send, { ...env, ...change })).status, 503);
  }
  assert.equal(calls, 0);
});

test('production provider errors are generic, retryable and never log secrets or raw failure bodies', async () => {
  const original = console.warn; const logs = []; console.warn = (...values) => logs.push(values);
  try {
    for (const send of [async () => new Response('PRIVATE_PROVIDER', { status: 429 }),
      async () => new Response(null, { status: 302 }), async () => { throw new Error(env.RESEND_API_KEY); }]) {
      const response = await run(request(), send);
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('Retry-After'), '60');
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.doesNotMatch(await response.text(), /PRIVATE|re_fixture/);
    }
  } finally { console.warn = original; }
  assert.deepEqual(logs, Array.from({ length: 3 }, () => ['PAYMENT_ALERT_DELIVERY_RETRY_REQUIRED']));
});

test('a malformed 2xx email response is not accepted as proof of alert submission', async () => {
  for (const send of [async () => new Response('PRIVATE_HTML', { status: 200 }),
    async () => Response.json({ error: 'PRIVATE_ERROR' }), async () => Response.json({ id: '' }),
    async () => Response.json({ id: 'PRIVATE_' + 'x'.repeat(5000) })]) {
    const response = await run(request(), send);
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /PRIVATE/);
  }
});
