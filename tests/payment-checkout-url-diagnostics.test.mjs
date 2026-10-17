import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutUrlDiagnostic, safeCheckoutUrl } from '../server/payments/phonepe.ts';

test('rejected checkout URL diagnostics identify structural causes without returning a URL or token', () => {
  const host = 'mercury.phonepe.com';
  const cases = [
    [undefined, 'TYPE', 'NONE'],
    ['not a URL PRIVATE_TOKEN', 'PARSE', 'NONE'],
    [`http://${host}/?token=PRIVATE_TOKEN`, 'SCHEME', 'EXPECTED'],
    ['https://private.invalid/?token=PRIVATE_TOKEN', 'HOST', 'FOREIGN'],
    ['https://mercury-t2.phonepe.com/?token=PRIVATE_TOKEN', 'HOST', 'MERCURY_T2'],
    ['https://other.phonepe.com/?token=PRIVATE_TOKEN', 'HOST', 'PHONEPE_OTHER'],
    [`https://${host}:8443/?token=PRIVATE_TOKEN`, 'PORT', 'EXPECTED'],
    [`https://PRIVATE_USER:PRIVATE_PASSWORD@${host}/?token=PRIVATE_TOKEN`, 'CREDENTIALS', 'EXPECTED'],
    [`https://${host}/?token=PRIVATE_TOKEN#PRIVATE_FRAGMENT`, 'FRAGMENT', 'EXPECTED'],
  ];
  for (const [value, reason, hostClass] of cases) {
    assert.deepEqual(checkoutUrlDiagnostic(value, host), {reason, hostClass});
    assert.throws(() => safeCheckoutUrl(value, host));
    assert.doesNotMatch(JSON.stringify(checkoutUrlDiagnostic(value, host)), /PRIVATE|https?:|phonepe\.com|private\.invalid/);
  }
  assert.deepEqual(checkoutUrlDiagnostic(`https://${host}/?token=PRIVATE_TOKEN`, host), {reason:'VALID', hostClass:'EXPECTED'});
});
