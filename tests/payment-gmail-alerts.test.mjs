import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { loadJobConfig } from '../server/payments/job-config.ts';
import { handleDeliveryAlert } from '../server/payments/delivery-alerts.ts';
import { productionTarget, sandboxTarget } from '../server/payments/targets.ts';

const scope = 'https://www.googleapis.com/auth/gmail.send';
const owner = 'kash.nordeen@gmail.com';
const env = {
  PHONEPE_ENV: 'production', VERCEL_ENV: 'production', VERCEL_PROJECT_ID: productionTarget.projectId,
  PAYMENT_SITE_ORIGIN: productionTarget.origin, PAYMENT_JOBS_ENABLED: 'true',
  PAYMENT_PRODUCTION_ALERTS_ENABLED: 'true', PAYMENT_ALERT_PROVIDER: 'gmail',
  GMAIL_CLIENT_ID: '123456789012-fixtureclientidentifier.apps.googleusercontent.com',
  GMAIL_CLIENT_SECRET: 'fixture-not-a-real-google-secret', GMAIL_REFRESH_TOKEN: 'fixture-not-a-real-refresh-token',
  QSTASH_TOKEN: 'fixture', QSTASH_CURRENT_SIGNING_KEY: 'fixture-production-signing-key',
  QSTASH_NEXT_SIGNING_KEY: 'fixture-next-signing-key',
};
const url = productionTarget.origin + '/api/payments/alerts';
const failure = {
  status: 503, retried: 3, maxRetries: 3, method: 'POST', url: productionTarget.origin + '/api/payments/jobs',
  sourceBody: Buffer.from(JSON.stringify({ jobId: randomUUID() })).toString('base64'),
  recipient: 'attacker@evil.test', body: 'PRIVATE_RESPONSE', sourceHeader: { secret: 'PRIVATE_HEADER' },
};
function request(value = failure, signatureKey = env.QSTASH_CURRENT_SIGNING_KEY) {
  const body = JSON.stringify(value);
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: 'Upstash', sub: url, nbf: 0,
    exp: Math.floor(Date.now() / 1000) + 60, body: createHash('sha256').update(body).digest('base64url') })).toString('base64url');
  const signature = `${head}.${payload}.${createHmac('sha256', signatureKey).update(`${head}.${payload}`).digest('base64url')}`;
  return new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Upstash-Signature': signature }, body });
}
const token = () => Response.json({ access_token: 'fixture-not-a-real-access-token', token_type: 'Bearer', expires_in: 3600, scope });
const now = () => new Date('2026-10-17T04:23:00.000Z');
const run = (req, send, settings = env) => handleDeliveryAlert(req, { env: settings, send, now });

test('Gmail readiness needs explicit production opt-in, exact identity and all credentials; no Resend key needed', () => {
  assert.equal(loadJobConfig(env).failureCallbackUrl, url);
  for (const change of [
    { PAYMENT_ALERT_PROVIDER: 'other' }, { PAYMENT_ALERT_PROVIDER: undefined },
    { PAYMENT_PRODUCTION_ALERTS_ENABLED: 'false' }, { PAYMENT_JOBS_ENABLED: 'false' },
    { VERCEL_ENV: 'preview' }, { VERCEL_PROJECT_ID: sandboxTarget.projectId }, { VERCEL_PROJECT_ID: undefined },
    { PAYMENT_SITE_ORIGIN: sandboxTarget.origin }, { NODE_TLS_REJECT_UNAUTHORIZED: '0' },
    { GMAIL_CLIENT_ID: '' }, { GMAIL_CLIENT_ID: 'https://evil.test' },
    { GMAIL_CLIENT_SECRET: '' }, { GMAIL_CLIENT_SECRET: 'unsafe\r\nsecret' }, { GMAIL_REFRESH_TOKEN: '' },
  ]) assert.equal(loadJobConfig({ ...env, ...change }).failureCallbackUrl, '', JSON.stringify(Object.keys(change)));
  assert.equal(loadJobConfig({ ...env, PHONEPE_ENV: 'sandbox', VERCEL_PROJECT_ID: sandboxTarget.projectId,
    PAYMENT_SITE_ORIGIN: sandboxTarget.origin, PAYMENT_UAT_ALERTS_ENABLED: 'true',
    VERCEL_AUTOMATION_BYPASS_SECRET: 'fixture-bypass'.padEnd(40, 'x'), RESEND_API_KEY: 're_fixture_not_a_real_key' }).failureCallbackUrl, '');
});

test('signed Gmail alert refreshes only at Google and sends a fixed private-data-free message to the owner', async () => {
  const sent = [];
  const send = async (target, options) => { sent.push({ target, options }); return sent.length === 1 ? token() : Response.json({ id: 'fixture-email' }); };
  assert.equal((await run(request(), send)).status, 200);
  assert.equal(sent.length, 2);
  assert.equal(sent[0].target, 'https://oauth2.googleapis.com/token');
  assert.equal(sent[0].options.headers['Content-Type'], 'application/x-www-form-urlencoded');
  const grant = new URLSearchParams(sent[0].options.body);
  assert.equal(grant.get('grant_type'), 'refresh_token');
  assert.equal(grant.get('refresh_token'), env.GMAIL_REFRESH_TOKEN);
  assert.equal(grant.get('client_id'), env.GMAIL_CLIENT_ID);
  assert.equal(grant.get('client_secret'), env.GMAIL_CLIENT_SECRET);
  assert.equal(sent[1].target, `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(owner)}/messages/send`);
  assert.equal(sent[1].options.headers.Authorization, 'Bearer fixture-not-a-real-access-token');
  for (const { options } of sent) {
    assert.equal(options.redirect, 'error'); assert.equal(options.credentials, 'omit');
    assert.ok(options.signal instanceof AbortSignal);
  }
  const mail = Buffer.from(JSON.parse(sent[1].options.body).raw, 'base64url').toString('utf8');
  assert.match(mail, /To: kash\.nordeen@gmail\.com\r\n/);
  assert.match(mail, /From: Portfolio Payments <kash\.nordeen@gmail\.com>\r\n/);
  assert.match(mail, /Date: Sat, 17 Oct 2026 04:00:00 GMT\r\n/);
  assert.match(mail, /VERIFICATION_DELIVERY_EXHAUSTED/);
  assert.match(mail, /2026-10-17T04:00:00.000Z/);
  for (const privateValue of ['PRIVATE', 'attacker@evil.test', failure.url, env.GMAIL_REFRESH_TOKEN, env.GMAIL_CLIENT_SECRET]) {
    assert.equal(mail.includes(privateValue), false);
  }
});

test('Gmail never refreshes a token for unauthenticated, invalid-category or disabled callbacks', async () => {
  let calls = 0; const send = async () => { calls++; return token(); };
  assert.equal((await run(request(failure, 'wrong-key'), send)).status, 401);
  assert.equal((await run(request({ ...failure, retried: 2 }), send)).status, 400);
  assert.equal((await run(request(), send, { ...env, PAYMENT_PRODUCTION_ALERTS_ENABLED: 'false' })).status, 503);
  assert.equal(calls, 0);
});

test('Gmail recovery alerts preserve the fixed production schedule and exclude financial/customer records', async () => {
  const recovery = { ...failure, url: productionTarget.origin + '/api/payments/recover',
    scheduleId: 'portfolio-payments-production-recovery-v1', sourceBody: Buffer.from('{}').toString('base64') };
  const sent = [];
  const send = async (target, options) => { sent.push({ target, options }); return sent.length === 1 ? token() : Response.json({ id: 'fixture' }); };
  assert.equal((await run(request(recovery), send)).status, 200);
  const mail = Buffer.from(JSON.parse(sent[1].options.body).raw, 'base64url').toString('utf8');
  assert.match(mail, /RECOVERY_DELIVERY_EXHAUSTED/);
  assert.doesNotMatch(mail, /PRIVATE|jobId|sourceBody|sourceHeader|https:\/\//);
  assert.equal((await run(request({ ...recovery, scheduleId: 'portfolio-payments-uat-recovery-v1' }), send)).status, 400);
  assert.equal(sent.length, 2);
});

test('missing, broad, malformed or revoked OAuth tokens stop before Gmail; errors never reveal credentials', async () => {
  const logs = []; const original = console.warn; console.warn = (...args) => logs.push(args);
  try {
    const valid = { access_token: 'fixture-not-a-real-access-token', token_type: 'Bearer', expires_in: 3600, scope };
    for (const response of [
      Response.json({ error: 'invalid_grant', error_description: env.GMAIL_REFRESH_TOKEN }, { status: 400 }),
      Response.json({ ...valid, scope: scope + ' https://www.googleapis.com/auth/gmail.readonly' }),
      Response.json({ ...valid, scope: undefined }), Response.json({ ...valid, access_token: 'unsafe\r\nheader' }),
      Response.json({ ...valid, expires_in: 0 }), Response.json({ ...valid, token_type: 'Other' }),
      new Response('PRIVATE_HTML'), Response.json({ ...valid, access_token: 'x'.repeat(9000) }),
    ]) {
      let calls = 0;
      const result = await run(request(), async () => { calls++; return response; });
      assert.equal(result.status, 503); assert.equal(calls, 1);
      assert.doesNotMatch(await result.text(), /PRIVATE|fixture|invalid_grant/);
    }
  } finally { console.warn = original; }
  assert.ok(logs.every(entry => JSON.stringify(entry) === '["PAYMENT_ALERT_DELIVERY_RETRY_REQUIRED"]'));
});

test('Gmail submission failures are retryable, not silently switched to another provider or retried in-process', async () => {
  const original = console.warn; console.warn = () => {};
  try {
    for (const bad of [new Response('PRIVATE_ERROR', { status: 429 }), new Response(null, { status: 302 }),
      new Response('PRIVATE_HTML'), Response.json({ id: '' }), Response.json([])]) {
      let calls = 0;
      const result = await run(request(), async () => ++calls === 1 ? token() : bad);
      assert.equal(result.status, 503); assert.equal(result.headers.get('Retry-After'), '60');
      assert.equal(calls, 2); assert.doesNotMatch(await result.text(), /PRIVATE|fixture/);
    }
    let calls = 0;
    const result = await run(request(), async () => { calls++; if (calls === 1) return token(); throw new Error(env.GMAIL_REFRESH_TOKEN); });
    assert.equal(result.status, 503); assert.equal(calls, 2);
    assert.doesNotMatch(await result.text(), /fixture/);
  } finally { console.warn = original; }
});
