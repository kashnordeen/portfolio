import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { CheckoutError, getPaymentAvailability, getPaymentStatus, startCheckout } from '../src/lib/payment-client.ts';

test('portal stays disabled on missing API, malformed config or Vite HTML fallback', async t => {
  for (const result of [new Response('not found', { status: 404 }), new Response('<html>Vite app</html>'), Response.json({ projectEnabled: 'true' })]) {
    const stub = t.mock.method(globalThis, 'fetch', async () => result);
    assert.deepEqual(await getPaymentAvailability(new AbortController().signal), { projectEnabled: false, communityEnabled: false });
    stub.mock.restore();
  }
});
test('checkout client retains request key and uses same-origin credentials without sending secrets', async t => {
  const id = randomUUID(), key = randomUUID();
  let options;
  t.mock.method(globalThis, 'fetch', async (_url, init) => { options = init; return Response.json({ orderId: id, checkoutUrl: 'https://mercury-uat.phonepe.com/transact?token=test' }); });
  const input = { purpose: 'project', amount: '12500.50', name: 'Test', email: 'test@example.test', reference: 'INV' };
  assert.equal((await startCheckout(input, key)).orderId, id);
  assert.equal(options.headers['Idempotency-Key'], key);
  assert.equal(options.credentials, 'same-origin');
  assert.deepEqual(JSON.parse(options.body), input);
});
test('pending or ambiguous responses never navigate or pretend payment succeeded', async t => {
  const id = randomUUID();
  t.mock.method(globalThis, 'fetch', async () => Response.json({ orderId: id, state: 'PENDING', message: 'Under verification' }, { status: 202 }));
  const result = await startCheckout({}, randomUUID());
  assert.equal(result.checkoutUrl, undefined);
  assert.equal(result.state, 'PENDING');
});
test('client rejects foreign checkout destinations and false success responses', async t => {
  const id = randomUUID();
  let stub = t.mock.method(globalThis, 'fetch', async () => Response.json({ orderId: id, checkoutUrl: 'https://evil.test' }));
  await assert.rejects(startCheckout({}, randomUUID())); stub.mock.restore();
  stub = t.mock.method(globalThis, 'fetch', async () => Response.json({ orderId: id, purpose: 'community', state: 'COMPLETED', amountPaise: 69900, currency: 'INR', paidAt: null }));
  await assert.rejects(getPaymentStatus(id, new AbortController().signal)); stub.mock.restore();
});
test('status displays only server-confirmed state and paid timestamp', async t => {
  const id = randomUUID();
  const status = { orderId: id, purpose: 'community', state: 'COMPLETED', amountPaise: 69900, currency: 'INR', paidAt: new Date().toISOString() };
  t.mock.method(globalThis, 'fetch', async () => Response.json(status));
  assert.deepEqual(await getPaymentStatus(id, new AbortController().signal), status);
});

test('client distinguishes definitive validation rejection from uncertain backend failures', async t => {
  for (const [status, editable] of [[400, true], [429, true], [503, false]]) {
    const stub = t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Test failure' }, { status }));
    await assert.rejects(startCheckout({}, randomUUID()), error => error instanceof CheckoutError && error.editable === editable);
    stub.mock.restore();
  }
});
