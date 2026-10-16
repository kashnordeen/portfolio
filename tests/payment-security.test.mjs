import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { authenticateWebhook, boundedJson, parsePaise, readSession, sessionHash, sha256, validateCustomer } from '../server/payments/security.ts';
import { loadConfig } from '../server/payments/config.ts';
import { createPhonePe, normalizeStatus, safeCheckoutUrl } from '../server/payments/phonepe.ts';

const env = { PHONEPE_ENV: 'sandbox', PAYMENT_SITE_ORIGIN: 'https://example.test', DATABASE_URL: 'postgres://test',
  PHONEPE_CLIENT_ID: 'test', PHONEPE_CLIENT_SECRET: 'test', PHONEPE_CLIENT_VERSION: '1', PHONEPE_MERCHANT_ID: 'test',
  PHONEPE_WEBHOOK_USERNAME: 'test', PHONEPE_WEBHOOK_PASSWORD: 'test', PAYMENT_SESSION_SECRET: 's'.repeat(32), PAYMENT_RECONCILIATION_SECRET: 'r'.repeat(32) };
const queueEnv = { PHONEPE_ENV:'production',VERCEL_ENV:'production',PAYMENT_SITE_ORIGIN:'https://kkarn.vercel.app',
  PAYMENT_JOBS_ENABLED:'true',QSTASH_TOKEN:'fixture',QSTASH_CURRENT_SIGNING_KEY:'fixture-current',QSTASH_NEXT_SIGNING_KEY:'fixture-next' };

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
  assert.equal(loadConfig({ ...env, PAYMENTS_ENABLED: 'true', PAYMENT_RELEASE_APPROVED: 'true', PROJECT_MIN_PAISE: '100', PROJECT_MAX_PAISE: '10000' }).projectEnabled, false);
  assert.equal(loadConfig({ ...env, ...queueEnv, PAYMENTS_ENABLED: 'true', PAYMENT_RELEASE_APPROVED: 'true', PROJECT_MIN_PAISE: '100', PROJECT_MAX_PAISE: '10000' }).projectEnabled, true);
  assert.equal(loadConfig({ ...env, PAYMENTS_ENABLED: 'true', PAYMENT_RELEASE_APPROVED: 'true' }).communityEnabled, false);
  assert.throws(() => loadConfig({ ...env, PAYMENT_SITE_ORIGIN: 'http://example.test' }));
});
test('approved INR 200 to 50000 project range is inclusive and rejects amounts outside it', () => {
  const input = { purpose: 'project', name: 'Test', email: 'test@example.test', reference: 'INV', amount: '200' };
  const min = 20000, max = 5000000;
  for (const [amount, paise] of [['200', 20000], ['200.01', 20001], ['49999.99', 4999999], ['50000', 5000000]]) {
    assert.equal(validateCustomer({ ...input, amount }, min, max).amount, paise);
  }
  for (const amount of ['199.99', '50000.01']) {
    assert.throws(() => validateCustomer({ ...input, amount }, min, max));
  }
  assert.equal(validateCustomer({ ...input, purpose: 'community', amount: '50000' }, min, max).amount, 69900);
  const gatedEnv = { ...env, ...queueEnv, PAYMENTS_ENABLED: 'true', PAYMENT_RELEASE_APPROVED: 'true', PROJECT_MIN_PAISE: String(min) };
  assert.equal(loadConfig(gatedEnv).projectEnabled, false);
  assert.equal(loadConfig({ ...gatedEnv, PROJECT_MAX_PAISE: String(max) }).projectEnabled, true);
  for (const maximum of ['', '0', 'unlimited', 'Infinity', '19999']) {
    assert.equal(loadConfig({ ...gatedEnv, PROJECT_MAX_PAISE: maximum }).projectEnabled, false);
  }
});
test('setup template records the approved range without enabling any checkout release gates', () => {
  const template = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
  const settings = Object.fromEntries(template.split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
  assert.equal(settings.PROJECT_MIN_PAISE, '20000');
  assert.equal(settings.PROJECT_MAX_PAISE, '5000000');
  for (const flag of ['PAYMENTS_ENABLED', 'PAYMENT_RELEASE_APPROVED', 'COMMUNITY_PAYMENTS_ENABLED']) {
    assert.equal(settings[flag], 'false');
  }
  const config = loadConfig({ ...env, ...Object.fromEntries(Object.entries(settings).filter(([, value]) => value !== '')) });
  assert.equal(config.projectEnabled, false);
  assert.equal(config.communityEnabled, false);
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

test('sandbox provider failures emit only fixed operation, category and HTTP status, never sensitive values',async()=>{
  const logs=[];
  const order={id:'private-id',merchant_order_id:'private-merchant-order',amount_paise:20000,purpose:'project'};
  const fail=createPhonePe(loadConfig(env),async()=>new Response('private-token-and-error',{status:401}),Date.now,entry=>logs.push(JSON.parse(entry)));
  await assert.rejects(fail.pay(order));
  assert.deepEqual(logs,[{event:'UAT_PROVIDER_FAILURE',operation:'TOKEN',code:'HTTP_REJECTED',status:401}]);
  const invalid=createPhonePe(loadConfig(env),async url=>url.endsWith('/oauth/token')
    ? Response.json({access_token:'private-token',expires_at:Date.now()/1000+3600})
    : Response.json({orderId:'OMO_PRIVATE',state:'PENDING',expireAt:1,redirectUrl:'https://private.invalid/token'}),Date.now,entry=>logs.push(JSON.parse(entry)));
  await assert.rejects(invalid.pay(order));
  assert.deepEqual(logs.at(-1),{event:'UAT_PROVIDER_FAILURE',operation:'PAY',code:'INVALID_CHECKOUT_EXPIRY'});
  const before=logs.length;
  const live=createPhonePe(loadConfig({...env,...queueEnv}),async()=>new Response('private',{status:403}),Date.now,entry=>logs.push(entry));
  await assert.rejects(live.pay(order));
  assert.equal(logs.length,before);
  const brokenLogger=createPhonePe(loadConfig(env),async()=>{throw Error('private');},Date.now,()=>{throw Error('private');});
  await assert.rejects(brokenLogger.pay(order),error=>!error.message.includes('private'));
});

test('checkout expiry is capped to requested 20 minutes without accepting stale or malformed timestamps',async()=>{
  const now=()=>1_800_000_000_000;
  const order={id:'fixture',merchant_order_id:'KK_FIXTURE',amount_paise:20000,purpose:'project'};
  const adapter=expiry=>createPhonePe(loadConfig(env),async url=>url.endsWith('/oauth/token')
    ? Response.json({access_token:'fixture',expires_at:now()/1000+3600})
    : Response.json({orderId:'OMO_FIXTURE',state:'PENDING',expireAt:expiry,redirectUrl:'https://mercury-uat.phonepe.com/transact?token=fixture'}),now,()=>{});
  assert.equal((await adapter(now()+86_400_000).pay(order)).expires.getTime(),now()+1_200_000);
  assert.equal((await adapter(now()+300_000).pay(order)).expires.getTime(),now()+300_000);
  for (const expiry of [now()-1,now(),String(now()+300_000),null,1e30,now()+0.5]) await assert.rejects(adapter(expiry).pay(order));
});
