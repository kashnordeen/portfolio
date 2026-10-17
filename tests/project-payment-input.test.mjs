import assert from 'node:assert/strict';
import test from 'node:test';
import { projectAmountError, projectAmountPaise } from '../src/lib/project-payment-input.ts';

test('project amount input accepts the approved inclusive INR range with exact paise', () => {
  for (const [input, expected] of [['200', 20000], ['200.01', 20001], ['50000', 5000000]]) {
    assert.equal(projectAmountPaise(input), expected);
    assert.equal(projectAmountError(input), '');
  }
});

test('project amount input explains malformed and out-of-range amounts without rounding', () => {
  assert.equal(projectAmountError(''), '');
  for (const input of ['199.99', '50000.01', '-200', '2e3', '200.001', ' 200', 'Infinity']) {
    assert.ok(projectAmountError(input));
    assert.equal(projectAmountPaise(input), null);
  }
});
