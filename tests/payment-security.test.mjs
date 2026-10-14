import assert from 'node:assert/strict';
import test from 'node:test';
import { authenticateWebhook, boundedJson, parsePaise, readSession, sessionHash, sha256, validateCustomer } from '../server/payments/security.ts';
import { loadConfig } from '../server/payments/config.ts';
import { createPhonePe, normalizeStatus, safeCheckoutUrl } from '../server/payments/phonepe.ts';

const env = { PHONEPE_ENV: 'sandbox', PAYMENT_SITE_ORIGIN: 'https://example.test', DATABASE_URL: 'postgres://test',
  PHONEPE_CLIENT_ID: 'test', PHONEPE_CLIENT_SECRET: 'test', PHONEPE_CLIENT_VERSION: '1', PHONEPE_MERCHANT_ID: 'test',
  PHONEPE_WEBHOOK_USERNAME: 'test', PHONEPE_WEBHOOK_PASSWORD: 'test', PAYMENT_SESSION_SECRET: 's'.repeat(32), PAYMENT_RECONCILIATION_SECRET: 'r'.repeat(32) };

test('exact decimal paise conversion rejects negative, exponent, excess decimals and overflow', () => {
  assert.equal(parsePaise('12500.50'), 1250050);
  assert.equal(parsePaise('10.1'), 1010);
  for (const value of [1, '-1', '1e3', '0', '0.99', '1.001', 'Infinity', ' 10', '99999999']) assert.throws(() => parsePaise(value));
});
test('community amount is server-owned; projects require bounded amount and reference', () => {
  const input = { purpose: 'community', name: 'Test', email: 'test@example.test', amount: '1' };
  assert.equal(validateCustomer(input, 100, 999999).amount, 69900);
  assert.throws(() => validateCustomer({ ...input, purpose: 'project', amount: '10' }, 100, 999999));
  assert.throws(() => validateCustomer({ ...input, purpose: 'project', reference: 'INV', amount: '10000' }, 100, 999999));
  assert.throws(() => validateCustomer({ ...input, name: 'Test\nName' }, 100, 999999));
});
test('live credentials and checkout cannot accidentally run in preview', () => {
  assert.throws(() => loadConfig({ ...env, PHONEPE_ENV: 'production', VERCEL_ENV: 'preview' }));
  assert.equal(loadConfig(env).projectEnabled, false);
  assert.equal(loadConfig({ ...env, PAYMENTS_ENABLED: 'true' }).projectEnabled, false);
  assert.equal(loadConfig({ ...env, PAYMENTS_ENABLED: 'true', PAYMENT_RELEASE_APPROVED: 'true', PROJECT_MIN_PAISE: '100', PROJECT_MAX_PAISE: '10000' }).projectEnabled, true);
  assert.equal(loadConfig({ ...env, PAYMENTS_ENABLED: 'true', PAYMENT_RELEASE_APPROVED: 'true' }).communityEnabled, false);
  assert.throws(() => loadConfig({ ...env, PAYMENT_SITE_ORIGIN: 'http://example.test' }));
});
test('hosted checkout URLs require the exact approved HTTPS host', () => {
  assert.equal(safeCheckoutUrl('https://mercury-uat.phonepe.com/transact?token=test', 'mercury-uat.phonepe.com'), 'https://mercury-uat.phonepe.com/transact?token=test');
  for (const url of ['http://mercury-uat.phonepe.com', 'https://mercury-uat.phonepe.com.evil.test', 'https://evil.test', 'https://user@mercury-uat.phonepe.com', 'javascript:alert(1)']) assert.throws(() => safeCheckoutUrl(url, 'mercury-uat.phonepe.com'));
});
test('webhook authentication uses constant-time SHA credential comparison', () => {
  const request = new Request('https://example.test', { headers: { authorization: sha256('test:password') } });
  authenticateWebhook(request, 'test', 'password');
  assert.throws(() => authenticateWebhook(request, 'test', 'wrong'));
  assert.throws(() => authenticateWebhook(new Request('https://example.test'), 'test', 'password'));
});
test('session tokens stay opaque and malformed or duplicate cookies are rejected', () => {
  const token = 'a'.repeat(64);
  assert.equal(readSession(new Request('https://example.test', { headers: { cookie: `__Host-payment-session=${token}` } })), token);
  assert.equal(readSession(new Request('https://example.test', { headers: { cookie: `__Host-payment-session=${token}; __Host-payment-session=${token}` } })), null);
  assert.notEqual(sessionHash(token, 'first'), sessionHash(token, 'second'));
});
test('bounded JSON rejects oversized, non-object and non-JSON bodies', async () => {
  const request = body => new Request('https://example.test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  assert.deepEqual(await boundedJson(request('{"test":1}')), { test: 1 });
  for (const body of ['[]', 'null', 'invalid']) await assert.rejects(boundedJson(request(body)));
  await assert.rejects(boundedJson(request(JSON.stringify({ large: 'x'.repeat(9000) }))));
});
test('status normalization uses root state, accepts numeric strings, ignores attempt states', () => {
  assert.deepEqual(normalizeStatus({ orderId: 'OMO1', state: 'PENDING', amount: '69900', paymentDetails: [{ state: 'COMPLETED' }] }), { orderId: 'OMO1', state: 'PENDING', amount: 69900 });
  assert.throws(() => normalizeStatus({ orderId: 'OMO1', amount: 69900, paymentDetails: [{ state: 'COMPLETED' }] }));
});
test('PhonePe adapter caches OAuth and never leaks customer data or retries checkout on failures', async () => {
  const calls = [];
  const send = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/oauth/token')) return Response.json({ access_token: 'test-token', expires_at: Date.now() / 1000 + 3600 });
    if (url.includes('/status')) return Response.json({ orderId: 'OMO1', state: 'PENDING', amount: 69900 });
    return Response.json({ orderId: 'OMO1', state: 'PENDING', expireAt: Date.now() + 1200000, redirectUrl: 'https://mercury-uat.phonepe.com/transact?token=test' });
  };
  const provider = createPhonePe(loadConfig(env), send);
  await provider.pay({ id: 'test-id', merchant_order_id: 'KK_test', amount_paise: 69900, purpose: 'community' });
  await provider.status('KK_test');
  assert.equal(calls.filter(call => call.url.endsWith('/oauth/token')).length, 1);
  const body = JSON.parse(calls[1].init.body);
  assert.equal(body.amount, 69900);
  assert.equal(body.paymentFlow.merchantUrls.redirectUrl, 'https://example.test/?payment=community&order=test-id');
  assert.equal(body.metaInfo, undefined);
  assert.equal(calls[1].init.redirect, 'error');
  let failures = 0;
  const failing = createPhonePe(loadConfig(env), async url => {
    if (url.endsWith('/oauth/token')) return Response.json({ access_token: 'test-token', expires_at: Date.now() / 1000 + 3600 });
    failures++; throw new Error('private provider error');
  });
  await assert.rejects(failing.pay({ id: 'id', merchant_order_id: 'KK_test', amount_paise: 100, purpose: 'project' }), error => !error.message.includes('private'));
  assert.equal(failures, 1);
});
