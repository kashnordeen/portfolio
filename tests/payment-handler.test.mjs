import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { handlePayment } from '../server/payments/handler.ts';
import { createStore, reconciliationDelay, sameTerms, verifiedState } from '../server/payments/store.ts';
import { loadConfig } from '../server/payments/config.ts';
import { PaymentError, sessionHash, sha256 } from '../server/payments/security.ts';
import { sandboxTarget } from '../server/payments/targets.ts';

const config = loadConfig({ PHONEPE_ENV: 'production', VERCEL_ENV:'production', PAYMENT_SITE_ORIGIN: 'https://kkarn.vercel.app', DATABASE_URL: 'postgres://portfolio_payments_api:test@localhost/test',
  PHONEPE_CLIENT_ID: 'test', PHONEPE_CLIENT_SECRET: 'test', PHONEPE_CLIENT_VERSION: '1', PHONEPE_MERCHANT_ID: 'MID_TEST',
  PHONEPE_WEBHOOK_USERNAME: 'test-user', PHONEPE_WEBHOOK_PASSWORD: 'test-password', PAYMENT_SESSION_SECRET: 's'.repeat(32), PAYMENT_RECONCILIATION_SECRET: 'r'.repeat(32),
  PROJECT_MIN_PAISE: '100', PROJECT_MAX_PAISE: '10000000', PAYMENTS_ENABLED: 'true', PAYMENT_RELEASE_APPROVED: 'true',
  PAYMENT_JOBS_ENABLED:'true',QSTASH_TOKEN:'fixture',QSTASH_CURRENT_SIGNING_KEY:'fixture-current',QSTASH_NEXT_SIGNING_KEY:'fixture-next' });
const token = 'a'.repeat(64), orderId = randomUUID(), key = randomUUID();
const baseOrder = { id: orderId, idempotency_key: key, merchant_order_id: `KK_${orderId}`, purpose: 'project',
  customer_name: 'Test', customer_email: 'test@example.test', project_reference: 'INV_TEST', amount_paise: 1250050,
  state: 'PENDING', environment: 'production', session_token_hash: sessionHash(token, config.sessionSecret),
  phonepe_order_id: 'OMO_TEST', checkout_url: 'https://mercury.phonepe.com/transact?token=test',
  expires_at: new Date(Date.now() + 1200000), paid_at: null, created_at: new Date(), reconcile_lease_id: randomUUID() };
function fixture() {
  const calls = [];
  const job={id:randomUUID(),orderId,generation:1,dueAt:new Date(),environment:'production'};
  const store = {
    rate: async (...args) => calls.push(['rate', ...args]),
    reserve: async (...args) => { calls.push(['reserve', ...args]); return { order: baseOrder, initiate: true, job }; },
    pendingJobs:async()=>[job],hasUnpublished:async()=>false,published:async()=>{},publicationFailed:async()=>{},claimCheckout:async()=>baseOrder,
    checkout: async (...args) => calls.push(['checkout', ...args]),
    owned: async (id, session) => {
      if (id !== orderId || session !== baseOrder.session_token_hash) throw new PaymentError(404, 'Payment was not found in this browser session.');
      return baseOrder;
    },
    recordEvent: async (...args) => { calls.push(['event', ...args]); return orderId; },
    claimDue: async () => [baseOrder],
    applyStatus: async (...args) => calls.push(['apply', ...args]),
    retryLater: async (...args) => calls.push(['retry', ...args]),
    cleanupRates: async () => {},
  };
  const provider = { pay: async () => { calls.push(['pay']); return { orderId: 'OMO_TEST', expires: baseOrder.expires_at, url: baseOrder.checkout_url }; },
    status: async () => ({ orderId: 'OMO_TEST', amount: 1250050, state: 'COMPLETED' }) };
  const runtime = { config: { ...config }, store, provider, queue:{publish:async()=>({messageId:'fixture-receipt'})} };
  return { calls, store, provider, runtime, run: (route, request) => handlePayment(route, request, () => runtime) };
}
function request(body = {}, headers = {}) {
  return new Request('https://example.test/api/payments/orders', { method: 'POST', headers: { 'Content-Type': 'application/json',
    origin: config.origin, 'idempotency-key': key, cookie: `__Host-payment-session=${token}`, ...headers }, body: JSON.stringify(body) });
}
const input = { purpose: 'project', name: 'Test', email: 'test@example.test', reference: 'INV_TEST', amount: '12500.50' };

test('default API config fails closed with no secrets, database or external requests', async () => {
  const response = await handlePayment('config', new Request('https://example.test/api/payments/config'), () => { throw new Error('private configuration'); });
  assert.deepEqual(await response.json(), { projectEnabled: false, communityEnabled: false });
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('disabled checkout makes no storage or provider calls', async () => {
  const f = fixture(); f.runtime.config.projectEnabled = false;
  const response = await f.run('orders', request(input));
  assert.equal(response.status, 503);
  assert.equal(f.calls.length, 0);
});
test('origin, method, amount and idempotency validation happen before any provider call', async () => {
  for (const req of [request(input, { origin: 'https://evil.test' }), request(input, { 'sec-fetch-site': 'cross-site' }),
    request(input, { 'idempotency-key': 'invalid' }), request({ ...input, amount: '-100' }), new Request('https://example.test')]) {
    const f = fixture(); assert.ok((await f.run('orders', req)).status >= 400); assert.equal(f.calls.length, 0);
  }
});
test('unfinished community offering remains blocked even when project checkout is enabled', async () => {
  const f = fixture(); const response = await f.run('orders', request({ ...input, purpose: 'community', amount: '1' }));
  assert.equal(response.status, 503); assert.equal(f.calls.length, 0);
});
test('order is durably reserved before /pay and a repeat never initiates a second checkout', async () => {
  const f = fixture(); const response = await f.run('orders', request(input));
  assert.equal(response.status, 201);
  assert.ok(f.calls.findIndex(call => call[0] === 'reserve') < f.calls.findIndex(call => call[0] === 'pay'));
  assert.equal(f.calls.find(call => call[0] === 'reserve')[1].amount, 1250050);
  f.store.reserve = async () => ({ order: baseOrder, initiate: false });
  await f.run('orders', request(input));
  assert.equal(f.calls.filter(call => call[0] === 'pay').length, 1);
});
test('ambiguous checkout timeout stays pending, exposes no provider errors, and is not retried', async () => {
  const f = fixture(); f.provider.pay = async () => { f.calls.push(['pay']); throw new Error('SECRET_DIAGNOSTIC'); };
  const response = await f.run('orders', request(input));
  assert.equal(response.status, 202);
  const body = await response.json(); assert.equal(body.orderId, orderId); assert.equal(body.state, 'PENDING');
  assert.ok(!JSON.stringify(body).includes('SECRET_DIAGNOSTIC'));
  f.store.reserve = async () => ({ order: { ...baseOrder, state: 'CREATED', checkout_url: null }, initiate: false });
  assert.equal((await f.run('orders', request(input))).status, 409);
  assert.equal(f.calls.filter(call => call[0] === 'pay').length, 1);
});
test('status requires session ownership and never exposes customer data or provider tokens', async () => {
  const f = fixture(); const url = `https://example.test/api/payments/status?order=${orderId}`;
  assert.equal((await f.run('status', new Request(url))).status, 404);
  assert.equal((await f.run('status', new Request(url, { headers: { cookie: `__Host-payment-session=${'b'.repeat(64)}` } }))).status, 404);
  const response = await f.run('status', new Request(url, { headers: { cookie: `__Host-payment-session=${token}` } }));
  assert.deepEqual(Object.keys(await response.json()).sort(), ['amountPaise', 'currency', 'orderId', 'paidAt', 'purpose', 'state']);
});
test('webhooks authenticate merchant and durably queue an event; never trust notification as paid', async () => {
  const f = fixture(); const event = { event: 'checkout.order.completed', payload: { merchantId: 'MID_TEST', merchantOrderId: baseOrder.merchant_order_id, orderId: 'OMO_TEST', state: 'COMPLETED', amount: 1250050 } };
  assert.equal((await f.run('webhook', request(event))).status, 401);
  const auth = { authorization: sha256('test-user:test-password') };
  assert.equal((await f.run('webhook', request({ ...event, payload: { ...event.payload, merchantId: 'OTHER' } }, auth))).status, 401);
  assert.equal((await f.run('webhook', request(event, auth))).status, 200);
  assert.equal(f.calls.filter(call => call[0] === 'event').length, 1);
  assert.equal(f.calls.filter(call => call[0] === 'apply' || call[0] === 'pay').length, 0);
  f.store.recordEvent = async () => { throw new Error('database offline'); };
  assert.equal((await f.run('webhook', request(event, auth))).status, 503);
});

test('failed status explains cancellation only after ownership and matching provider identity, amount and state', async () => {
  const url = `https://example.test/api/payments/status?order=${orderId}`;
  const req = () => new Request(url, { headers: { cookie: `__Host-payment-session=${token}` } });
  const f = fixture();
  f.store.owned = async () => ({ ...baseOrder, state: 'FAILED' });
  const cancelled = { orderId: 'OMO_TEST', amount: baseOrder.amount_paise, state: 'FAILED', failureReason: 'CANCELLED' };
  let lookups = 0;
  f.provider.status = async (_id, details) => { lookups++; assert.equal(details, true); return cancelled; };
  assert.equal((await (await f.run('status', req())).json()).failureReason, 'CANCELLED');
  for (const altered of [{ orderId: 'OTHER' }, { amount: 100 }, { state: 'PENDING' }, { state: 'COMPLETED' }, { failureReason: 'UNKNOWN' }]) {
    f.provider.status = async () => ({ ...cancelled, ...altered });
    const body = await (await f.run('status', req())).json();
    assert.equal(body.state, 'FAILED'); assert.equal(body.failureReason, undefined);
  }
  f.provider.status = async () => { throw Error('PRIVATE_PROVIDER_ERROR'); };
  const fallback = await f.run('status', req());
  assert.equal(fallback.status, 200); assert.equal((await fallback.json()).state, 'FAILED');
  f.store.rate = async bucket => { if (bucket.startsWith('failure-status:')) throw new PaymentError(429, 'Too many requests'); };
  f.provider.status = async () => { lookups++; return cancelled; };
  assert.equal((await (await f.run('status', req())).json()).failureReason, undefined);
  f.store.owned = async () => { throw new PaymentError(404, 'Not found'); };
  f.provider.status = async () => { lookups++; return cancelled; };
  assert.equal((await f.run('status', req())).status, 404);
  assert.equal(lookups, 1);
  assert.equal(f.calls.filter(call => ['pay', 'apply', 'checkout'].includes(call[0])).length, 0);
});

test('UAT shape diagnostics preserve authentication, parsing, strict payload checks and zero-write guards',async t=>{
  const gate={PAYMENT_UAT_DIAGNOSTICS:'true',PHONEPE_ENV:'sandbox',VERCEL_ENV:'production',
    VERCEL_PROJECT_ID:sandboxTarget.projectId,PAYMENT_SITE_ORIGIN:sandboxTarget.origin,
    PAYMENTS_ENABLED:'false',PAYMENT_RELEASE_APPROVED:'false',COMMUNITY_PAYMENTS_ENABLED:'false',PAYMENT_JOBS_ENABLED:'false'};
  const previous=Object.fromEntries(Object.keys(gate).map(key=>[key,process.env[key]]));
  const logs=[];t.mock.method(console,'info',entry=>logs.push(entry));
  Object.assign(process.env,gate);
  try {
    const f=fixture(),auth={authorization:sha256('test-user:test-password')};
    const body={event:'PRIVATE_EVENT',payload:{merchantOrderId:'PRIVATE_ORDER',email:'PRIVATE_EMAIL'}};
    assert.equal((await f.run('webhook',request(body))).status,401);assert.deepEqual(logs,[]);
    assert.equal((await f.run('webhook',request([],auth))).status,400);assert.deepEqual(logs,[]);
    assert.equal((await f.run('webhook',request(body,auth))).status,400);
    assert.equal(logs.length,1);assert.equal(JSON.parse(logs[0]).eventClass,'OTHER');
    assert.doesNotMatch(logs.join(''),/PRIVATE|test-user|test-password/);
    assert.equal((await f.run('webhook',request({}))).status,401);
    const probe=await f.run('webhook',request({},auth));
    assert.equal(probe.status,400);assert.equal(probe.headers.get('set-cookie'),null);
    const envelope=await f.run('webhook',request({message:'Fixture probe',data:{}},auth));
    assert.equal(envelope.status,400);
    assert.equal((await f.run('webhook',request({message:'Fixture',data:{amount:1}},auth))).status,400);
    assert.equal((await f.run('webhook',request({test:true},auth))).status,400);
    process.env.PHONEPE_ENV='production';
    assert.equal((await f.run('webhook',request({},auth))).status,400);
    process.env.PHONEPE_ENV='sandbox';process.env.PAYMENT_JOBS_ENABLED='true';
    assert.equal((await f.run('webhook',request({},auth))).status,400);
    assert.equal(f.calls.length,0);
  } finally {
    for(const [key,value] of Object.entries(previous)) {
      if(value === undefined) delete process.env[key]; else process.env[key]=value;
    }
  }
});
test('worker is authenticated, verifies via provider status, and retries transient failures', async () => {
  const f = fixture(); f.runtime.config.jobsEnabled=false; assert.equal((await f.run('reconcile', request())).status, 401);
  const auth = { authorization: `Bearer ${config.workerSecret}` };
  assert.deepEqual(await (await f.run('reconcile', request({}, auth))).json(), { checked: 1, deferred: 0 });
  f.provider.status = async () => { throw new Error('timeout'); };
  assert.deepEqual(await (await f.run('reconcile', request({}, auth))).json(), { checked: 0, deferred: 1 });
  assert.equal(f.calls.filter(call => call[0] === 'retry').length, 1);
});
test('managed mode rejects the old bearer scheduler without a provider call',async()=>{
  const f=fixture();const response=await f.run('reconcile',request({},{authorization:`Bearer ${config.workerSecret}`}));
  assert.equal(response.status,403);assert.equal(f.calls.length,0);
});
test('amount and provider-order mismatch require review; immutable terms include session identity', () => {
  assert.equal(verifiedState(baseOrder, { orderId: 'OMO_TEST', amount: 1, state: 'COMPLETED' }), 'REVIEW');
  assert.equal(verifiedState(baseOrder, { orderId: 'OTHER', amount: 1250050, state: 'COMPLETED' }), 'REVIEW');
  const normalized = { purpose: 'project', name: 'Test', email: 'test@example.test', reference: 'INV_TEST', amount: 1250050 };
  assert.equal(sameTerms(baseOrder, normalized, baseOrder.session_token_hash, config.environment), true);
  assert.equal(sameTerms(baseOrder, { ...normalized, amount: 100 }, baseOrder.session_token_hash, config.environment), false);
  assert.equal(sameTerms(baseOrder, normalized, 'b'.repeat(64), config.environment), false);
  assert.equal(sameTerms(baseOrder, normalized, baseOrder.session_token_hash, 'sandbox'), false);
});
test('database refuses administrative accounts and weak TLS URL overrides before connecting', () => {
  assert.throws(() => createStore({ ...config, databaseUrl: 'postgres://postgres:fake@localhost/db' }));
  assert.throws(() => createStore({ ...config, databaseUrl: 'postgres://portfolio_payments_api:fake@localhost/db?sslmode=require' }));
});
test('reconciliation follows short polling intervals instead of a once-daily cron', () => {
  for (const [age, expected] of [[0, 25], [25, 3], [55, 6], [115, 10], [175, 30], [235, 60]]) {
    assert.equal(reconciliationDelay(new Date(1000000), 1000000 + age * 1000), expected);
  }
});
