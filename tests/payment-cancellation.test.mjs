import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStatus } from '../server/payments/phonepe.ts';
import { canRestartCancelledPayment, getPaymentStatus, restartCancelledPayment } from '../src/lib/payment-client.ts';

const context = { errorCode: 'TXN_CANCELLED', detailedErrorCode: 'REQUEST_CANCEL_BY_REQUESTEE',
  source: 'CUSTOMER', stage: 'PRE_AUTHENTICATION', description: 'PRIVATE_PROVIDER_TEXT' };
const response = { orderId: 'OMO_FIXTURE', state: 'FAILED', amount: 20000, errorContext: context };

test('only explicit pre-authorization customer cancellation is classified; raw provider text is discarded', () => {
  assert.deepEqual(normalizeStatus(response), { orderId: 'OMO_FIXTURE', state: 'FAILED', amount: 20000, failureReason: 'CANCELLED' });
  for (const altered of [{ state: 'PENDING' }, { state: 'COMPLETED' }, { errorContext: undefined },
    ...['errorCode', 'detailedErrorCode', 'source', 'stage'].map(key => ({ errorContext: { ...context, [key]: 'UNKNOWN' } })),
    { paymentDetails: [{ ...response }], errorContext: undefined }]) {
    assert.equal(normalizeStatus({ ...response, ...altered }).failureReason, undefined);
  }
});

test('restart is allowed only for a failed order with a verified cancellation reason', () => {
  for (const state of ['CREATED', 'PENDING', 'COMPLETED', 'REVIEW', 'FAILED']) {
    assert.equal(canRestartCancelledPayment({ state, failureReason: 'CANCELLED' }), state === 'FAILED');
    assert.equal(canRestartCancelledPayment({ state }), false);
  }
  assert.equal(canRestartCancelledPayment(null), false);
});

test('client accepts only the fixed cancellation category and never raw provider errors', async t => {
  const orderId = '11111111-1111-4111-8111-111111111111';
  const base = { orderId, purpose: 'project', state: 'FAILED', amountPaise: 20000, currency: 'INR', paidAt: null };
  for (const [state, reason, expected] of [['FAILED', 'CANCELLED', 'CANCELLED'], ['PENDING', 'CANCELLED', undefined],
    ['FAILED', 'PRIVATE_PROVIDER_TEXT', undefined]]) {
    const stub = t.mock.method(globalThis, 'fetch', async () => Response.json({ ...base, state, failureReason: reason, errorContext: context }));
    const result = await getPaymentStatus(orderId, new AbortController().signal);
    assert.equal(result.failureReason, expected);
    assert.equal(result.errorContext, undefined);
    stub.mock.restore();
  }
});

test('explicit cancellation restart drops only the old request key and navigates to an empty form; uncertain states do nothing', () => {
  const actions = [];
  const storage = { removeItem: key => actions.push(['remove', key]) };
  const navigate = path => actions.push(['navigate', path]);
  const base = { state: 'FAILED', failureReason: 'CANCELLED', purpose: 'project' };
  for (const status of [null, { ...base, state: 'PENDING' }, { ...base, state: 'REVIEW' },
    { ...base, failureReason: undefined }, { ...base, purpose: 'https://evil.test' }]) {
    assert.equal(restartCancelledPayment(status, storage, navigate), false);
  }
  assert.deepEqual(actions, []);
  assert.equal(restartCancelledPayment(base, storage, navigate), true);
  assert.deepEqual(actions, [['remove', 'payment-request-key'], ['navigate', '/?payment=project']]);
});
