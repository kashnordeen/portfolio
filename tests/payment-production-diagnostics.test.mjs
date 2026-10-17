import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadConfig } from '../server/payments/config.ts';
import { createPhonePe } from '../server/payments/phonepe.ts';
import { handlePayment } from '../server/payments/handler.ts';
import { sandboxTarget } from '../server/payments/targets.ts';

const now = () => Date.parse('2026-10-17T06:00:00.000Z');
const privateDetail = 'PRIVATE_ERROR owner@example.test https://secret.invalid/?token=PRIVATE_TOKEN OMO_PRIVATE';
function configFor(environment = 'production') {
  return loadConfig({ PHONEPE_ENV:environment, VERCEL_ENV:'production',
    PAYMENT_SITE_ORIGIN:environment === 'sandbox' ? sandboxTarget.origin : 'https://kkarn.vercel.app',
    ...(environment === 'sandbox' ? { VERCEL_PROJECT_ID:sandboxTarget.projectId,
      VERCEL_AUTOMATION_BYPASS_SECRET:'PRIVATE_BYPASS'.padEnd(40, 'x') } : {}),
    DATABASE_URL:'postgres://portfolio_payments_api:PRIVATE_DATABASE_PASSWORD@localhost/test',
    PHONEPE_CLIENT_ID:'PRIVATE_CLIENT_ID', PHONEPE_CLIENT_SECRET:'PRIVATE_CLIENT_SECRET', PHONEPE_CLIENT_VERSION:'1',
    PHONEPE_MERCHANT_ID:'PRIVATE_MERCHANT', PHONEPE_WEBHOOK_USERNAME:'PRIVATE_WEBHOOK_USER',
    PHONEPE_WEBHOOK_PASSWORD:'PRIVATE_WEBHOOK_PASSWORD', PAYMENT_SESSION_SECRET:'s'.repeat(32),
    PAYMENT_RECONCILIATION_SECRET:'r'.repeat(32), PROJECT_MIN_PAISE:'20000', PROJECT_MAX_PAISE:'5000000',
    PAYMENTS_ENABLED:'true', PAYMENT_RELEASE_APPROVED:'true', PAYMENT_JOBS_ENABLED:'true', QSTASH_TOKEN:'PRIVATE_QUEUE_TOKEN',
    QSTASH_CURRENT_SIGNING_KEY:'PRIVATE_QUEUE_CURRENT', QSTASH_NEXT_SIGNING_KEY:'PRIVATE_QUEUE_NEXT' });
}
const order = { id:randomUUID(), merchant_order_id:'KK_PRIVATE_ORDER', amount_paise:20000, purpose:'project' };
const tokenResponse = () => Response.json({ access_token:'PRIVATE_ACCESS_TOKEN', expires_at:Math.floor(now() / 1000) + 3600 });
const successfulCheckout = config => ({ orderId:'OMO_PRIVATE', state:'PENDING', expireAt:now() + 1200000,
  redirectUrl:`https://${config.checkoutHost}/transact?token=PRIVATE_CHECKOUT_TOKEN` });
function assertDiagnostic(entries, expected) {
  assert.equal(entries.length, 1, 'exactly one fixed diagnostic should be emitted');
  assert.equal(typeof entries[0], 'string');
  assert.deepEqual(JSON.parse(entries[0]), expected);
  assert.doesNotMatch(entries[0], /PRIVATE|owner@example|https?:|KK_|OMO_|stack|message|cause/);
}
const failures = [
  { operation:'TOKEN', code:'TRANSPORT_FAILED', response:async () => { throw new Error(privateDetail); } },
  { operation:'TOKEN', code:'HTTP_REJECTED', status:401, response:async () => new Response(privateDetail, {status:401}) },
  { operation:'TOKEN', code:'INVALID_RESPONSE', response:async () => new Response(privateDetail) },
  { operation:'TOKEN', code:'INVALID_RESPONSE', response:async () => Response.json({ access_token:privateDetail, expires_at:0 }) },
  { operation:'PAY', code:'TRANSPORT_FAILED', response:async () => { throw new Error(privateDetail); } },
  { operation:'PAY', code:'HTTP_REJECTED', status:503, response:async () => new Response(privateDetail, {status:503}) },
  { operation:'PAY', code:'INVALID_RESPONSE', response:async () => new Response(privateDetail) },
  { operation:'PAY', code:'INVALID_CHECKOUT_STATE', response:async config => Response.json({ ...successfulCheckout(config), state:privateDetail }) },
  { operation:'PAY', code:'INVALID_CHECKOUT_EXPIRY', response:async config => Response.json({ ...successfulCheckout(config), expireAt:now() }) },
  { operation:'PAY', code:'INVALID_CHECKOUT_URL', response:async config => Response.json({ ...successfulCheckout(config), redirectUrl:'https://secret.invalid/?token=PRIVATE' }) },
  { operation:'STATUS', code:'TRANSPORT_FAILED', response:async () => { throw new Error(privateDetail); } },
  { operation:'STATUS', code:'HTTP_REJECTED', status:429, response:async () => new Response(privateDetail, {status:429}) },
  { operation:'STATUS', code:'INVALID_RESPONSE', response:async () => new Response(privateDetail) },
  { operation:'STATUS', code:'INVALID_RESPONSE', response:async () => Response.json({ orderId:privateDetail, state:'COMPLETED', amount:20000 }) },
];

for (const [environment, event] of [['production', 'PAYMENT_PROVIDER_FAILURE'], ['sandbox', 'UAT_PROVIDER_FAILURE']]) {
  test(`${environment} provider diagnostics contain only fixed categories and optional numeric HTTP status`, async t => {
    for (const [index, failure] of failures.entries()) {
      await t.test(`${failure.operation} ${failure.code} case ${index + 1}`, async () => {
        const config = configFor(environment), entries = [], calls = [];
        const provider = createPhonePe(config, async (url, options) => {
          const operation = url.includes('/oauth/token') ? 'TOKEN' : url.includes('/checkout/v2/pay') ? 'PAY' : 'STATUS';
          calls.push(operation);
          assert.equal(options.redirect, 'error');
          return operation === failure.operation ? failure.response(config) : tokenResponse();
        }, now, entry => entries.push(entry));
        await assert.rejects(failure.operation === 'STATUS' ? provider.status(order.merchant_order_id) : provider.pay(order));
        assertDiagnostic(entries, { event, operation:failure.operation, code:failure.code,
          ...(failure.status === undefined ? {} : {status:failure.status}) });
        assert.ok(calls.filter(operation => operation === 'PAY').length <= 1, 'diagnostics must not retry /pay');
      });
    }
  });
}

test('a throwing production provider diagnostic sink preserves the failure and never retries /pay', async () => {
  let attempts = 0, logs = 0;
  const provider = createPhonePe(configFor(), async url => {
    if (url.includes('/oauth/token')) return tokenResponse();
    attempts++;
    throw new Error(privateDetail);
  }, now, () => { logs++; throw new Error('PRIVATE_LOG_SINK_FAILURE'); });
  await assert.rejects(provider.pay(order), error => error.status === 502 && !error.message.includes('PRIVATE'));
  assert.equal(attempts, 1);
  assert.equal(logs, 1, 'production logging must be attempted without altering provider behavior');
});

function checkoutFixture(environment, stage) {
  const config = configFor(environment);
  const pendingOrder = { ...order, state:'CREATED', checkout_url:null, expires_at:null,
    customer_name:'PRIVATE_NAME', customer_email:'owner@example.test', project_reference:'PRIVATE_REFERENCE' };
  const job = { id:randomUUID(), orderId:order.id, generation:1, dueAt:new Date(), environment };
  let attempted = false, payCalls = 0, saved = false, pending = [job];
  const store = { rate:async () => {}, reserve:async () => ({ order:pendingOrder, initiate:!attempted, job }),
    pendingJobs:async () => pending, hasUnpublished:async () => pending.length > 0,
    published:async () => { pending = []; }, publicationFailed:async () => {},
    claimCheckout:async () => { attempted = true; return pendingOrder; },
    checkout:async () => { if (stage === 'PERSISTENCE') throw new Error(privateDetail); saved = true; } };
  const provider = { pay:async () => { payCalls++; if (stage === 'PROVIDER') throw new Error(privateDetail);
    return { url:`https://${config.checkoutHost}/transact?token=PRIVATE`, orderId:'OMO_PRIVATE', expires:new Date(now() + 1200000) }; } };
  const runtime = { config, store, provider, queue:{ publish:async () => ({messageId:'PRIVATE_RECEIPT'}) } };
  const key = randomUUID();
  const run = () => handlePayment('orders', new Request(`${config.origin}/api/payments/orders`, {method:'POST', headers:{
    'Content-Type':'application/json', origin:config.origin, 'Idempotency-Key':key,
  }, body:JSON.stringify({ purpose:'project', name:'PRIVATE_NAME', email:'owner@example.test', reference:'PRIVATE_REFERENCE', amount:'200' })}), () => runtime);
  return { run, payCalls:() => payCalls, saved:() => saved };
}

for (const [environment, event] of [['production', 'PAYMENT_CHECKOUT_DEFERRED'], ['sandbox', 'UAT_CHECKOUT_DEFERRED']]) {
  for (const stage of ['PROVIDER', 'PERSISTENCE']) {
    test(`${environment} ${stage} checkout failures emit one safe stage diagnostic and remain non-retryable`, async t => {
      const entries = [];
      t.mock.method(console, 'warn', entry => entries.push(entry));
      const fixture = checkoutFixture(environment, stage), response = await fixture.run();
      assert.equal(response.status, 202);
      const body = await response.json();
      assert.equal(body.state, 'PENDING');
      assert.equal(body.orderId, order.id);
      assert.doesNotMatch(JSON.stringify(body), /PRIVATE|owner@example|https?:/);
      assertDiagnostic(entries, {event, stage});
      assert.equal(fixture.saved(), false);
      assert.equal((await fixture.run()).status, 409);
      assert.equal(fixture.payCalls(), 1, 'ambiguous initiation must not make a second /pay call');
      assert.equal(entries.length, 1);
    });
  }
}

for (const environment of ['production', 'sandbox']) {
  test(`${environment} checkout remains pending even when the diagnostic sink throws`, async t => {
    let logs = 0;
    t.mock.method(console, 'warn', () => { logs++; throw new Error('PRIVATE_LOG_SINK_FAILURE'); });
    const fixture = checkoutFixture(environment, 'PROVIDER'), response = await fixture.run();
    assert.equal(response.status, 202, 'logging failure must not convert an ambiguous payment into an error');
    assert.equal((await response.json()).state, 'PENDING');
    assert.equal(logs, 1);
    assert.equal((await fixture.run()).status, 409);
    assert.equal(fixture.payCalls(), 1);
  });
}
