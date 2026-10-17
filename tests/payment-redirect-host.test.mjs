import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPhonePe, safeCheckoutUrl } from '../server/payments/phonepe.ts';
import { startCheckout } from '../src/lib/payment-client.ts';

const alternate = 'https://mercury-t2.phonepe.com/transact/pgv2?token=fixture';
const input = {purpose:'project',name:'Fixture',email:'fixture@example.test',amount:'200',reference:'Fixture'};

test('production server accepts the exact alternate host returned by PhonePe without retrying initiation', async () => {
  assert.equal(safeCheckoutUrl(alternate, 'mercury.phonepe.com'), alternate);
  assert.equal(safeCheckoutUrl('https://mercury.phonepe.com/transact?token=fixture', 'mercury.phonepe.com'),
    'https://mercury.phonepe.com/transact?token=fixture');
  const now = () => 1_800_000_000_000;
  let payCalls = 0;
  const provider = createPhonePe({environment:'production',origin:'https://kkarn.vercel.app',checkoutHost:'mercury.phonepe.com',
    clientId:'fixture',clientSecret:'fixture',clientVersion:'1'}, async url => {
    if (url.endsWith('/oauth/token')) return Response.json({access_token:'fixture',expires_at:now()/1000+3600});
    payCalls++;
    return Response.json({orderId:'OMO_FIXTURE',state:'PENDING',expireAt:now()+1200000,redirectUrl:alternate});
  }, now, () => {});
  const checkout = await provider.pay({id:randomUUID(),merchant_order_id:'KK_FIXTURE',amount_paise:20000,purpose:'project'});
  assert.equal(checkout.url, alternate);
  assert.equal(payCalls, 1);
});

test('browser accepts the same exact alternate production checkout host', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({orderId:randomUUID(),checkoutUrl:alternate},{status:201}));
  assert.equal((await startCheckout(input, randomUUID())).checkoutUrl, alternate);
});

test('alternate host support does not admit lookalikes, arbitrary subdomains, HTTP or unsafe URL components', async t => {
  let candidate;
  t.mock.method(globalThis, 'fetch', async () => Response.json({orderId:randomUUID(),checkoutUrl:candidate},{status:201}));
  for (const url of [
    'https://mercury-t2.phonepe.com.evil.test/transact', 'https://other.phonepe.com/transact',
    'http://mercury-t2.phonepe.com/transact', 'https://mercury-t2.phonepe.com@evil.test/transact',
    'https://fixture:fixture@mercury-t2.phonepe.com/transact', 'https://mercury-t2.phonepe.com:8443/transact',
    'https://mercury-t2.phonepe.com/transact#unexpected',
  ]) {
    assert.throws(() => safeCheckoutUrl(url, 'mercury.phonepe.com'));
    candidate = url;
    await assert.rejects(startCheckout(input, randomUUID()));
  }
  assert.throws(() => safeCheckoutUrl(alternate, 'mercury-uat.phonepe.com'));
  assert.throws(() => safeCheckoutUrl('https://mercury-uat.phonepe.com/transact', 'mercury.phonepe.com'));
});
