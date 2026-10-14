import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, createHash, randomUUID } from 'node:crypto';
import { loadJobConfig } from '../server/payments/job-config.ts';
import { createJobQueue } from '../server/payments/job-queue.ts';

const key = 'fixture-signing-key-not-a-real-secret';
const env = { PAYMENT_JOBS_ENABLED: 'true', VERCEL_ENV: 'production', PHONEPE_ENV: 'production',
  PAYMENT_SITE_ORIGIN: 'https://kkarn.vercel.app', QSTASH_TOKEN: 'fixture-token',
  QSTASH_CURRENT_SIGNING_KEY: key, QSTASH_NEXT_SIGNING_KEY: `${key}-next` };
const config = loadJobConfig(env);
const job = { id: randomUUID(), orderId: randomUUID(), environment: 'production', generation: 1, dueAt: new Date(Date.now() + 25000) };
function signature(body, { secret = key, url = config.jobUrl, expires = Math.floor(Date.now() / 1000) + 60, notBefore = 0 } = {}) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: 'Upstash', sub: url, exp: expires, nbf: notBefore,
    body: createHash('sha256').update(body).digest('base64url') })).toString('base64url');
  return `${header}.${payload}.${createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')}`;
}
const request = (body, token = signature(body), url = config.jobUrl) => new Request(url, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'Upstash-Signature': token }, body,
});

test('queue config defaults off and rejects preview, sandbox, foreign origin and missing secrets', () => {
  assert.equal(loadJobConfig({}).ready, false);
  for (const change of [{ PAYMENT_JOBS_ENABLED: 'false' }, { VERCEL_ENV: 'preview' }, { PHONEPE_ENV: 'sandbox' },
    { PAYMENT_SITE_ORIGIN: 'https://evil.test' }, { QSTASH_TOKEN: '' }, { QSTASH_CURRENT_SIGNING_KEY: '' }]) {
    assert.equal(loadJobConfig({ ...env, ...change }).ready, false);
  }
});

test('disabled queue never publishes or verifies', async () => {
  let calls = 0;
  const queue = createJobQueue(loadJobConfig({}), { send: async () => { calls++; throw new Error('unexpected'); } });
  await assert.rejects(queue.publish(job));
  await assert.rejects(queue.verify(request('{}'), 'job'));
  assert.equal(calls, 0);
});

test('publication carries only opaque identity and stable deduplication with fixed destination', async () => {
  const calls = [];
  const queue = createJobQueue(config, { send: async (url, options) => {
    calls.push({ url, options }); return Response.json({ messageId: 'fixture-message-id' });
  } });
  await queue.publish(job); await queue.publish(job);
  assert.equal(calls.length, 2);
  for (const { url, options } of calls) {
    assert.equal(url, `https://qstash.upstash.io/v2/publish/${config.jobUrl}`);
    assert.deepEqual(JSON.parse(options.body), { jobId: job.id });
    const headers = new Headers(options.headers);
    assert.equal(headers.get('Upstash-Deduplication-Id'), job.id);
    assert.equal(headers.get('Upstash-Not-Before'), String(Math.ceil(job.dueAt.getTime() / 1000)));
    assert.equal(headers.get('Upstash-Forward-Authorization'), null);
    assert.equal(options.redirect, 'error'); assert.ok(options.signal instanceof AbortSignal);
  }
});

test('SDK verifies original raw body and fixed URL using current or next signing key', async () => {
  const queue = createJobQueue(config);
  const raw = '{ "jobId" : "fixture" }';
  assert.equal(await queue.verify(request(raw), 'job'), raw);
  assert.equal(await queue.verify(request(raw, signature(raw, { secret: env.QSTASH_NEXT_SIGNING_KEY })), 'job'), raw);
});

test('tampered expired wrong URL future and oversized signatures fail before storage', async () => {
  const queue = createJobQueue(config);
  const raw = '{}';
  for (const req of [request('{"tampered":true}', signature(raw)), request(raw, signature(raw, { expires: 1 })),
    request(raw, signature(raw, { notBefore: Math.floor(Date.now() / 1000) + 600 })),
    request(raw, signature(raw, { url: 'https://evil.test' })), request(raw, 'invalid'),
    request(raw, signature(raw), `${config.jobUrl}?unexpected=1`), request('x'.repeat(1025))]) {
    await assert.rejects(queue.verify(req, 'job'));
  }
});

test('publisher rejects foreign-environment jobs, redirects and malformed receipts without leaking errors', async () => {
  for (const send of [async () => new Response(null, { status: 302 }), async () => Response.json({ messageId: '' }),
    async () => { throw new Error(env.QSTASH_TOKEN); }]) {
    const queue = createJobQueue(config, { send });
    await assert.rejects(queue.publish(job), error => !String(error).includes(env.QSTASH_TOKEN));
  }
  let calls = 0;
  const queue = createJobQueue(config, { send: async () => { calls++; return Response.json({ messageId: 'id' }); } });
  await assert.rejects(queue.publish({ ...job, environment: 'sandbox' })); assert.equal(calls, 0);
});
