import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { after } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

Object.defineProperty(globalThis, 'window', { value: undefined, writable: true, configurable: true });
after(() => { delete globalThis.window; });

const compile = source => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React,
} }).outputText;
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(compile(source)).toString('base64')}`;
const read = path => readFile(new URL(path, import.meta.url), 'utf8');
let source = compile(await read('../src/components/PaymentPortal/PaymentPortal.tsx'));
for (const dependency of ['react', 'lucide-react']) source = source.replaceAll(`"${dependency}"`, JSON.stringify(import.meta.resolve(dependency)));
for (const [alias, path] of [['@/data/portfolio', '../src/data/portfolio.ts'],
  ['@/lib/payment-client', '../src/lib/payment-client.ts'], ['@/lib/project-payment-input', '../src/lib/project-payment-input.ts']]) {
  source = source.replaceAll(`"${alias}"`, JSON.stringify(moduleUrl(await read(path))));
}
source = `import * as React from ${JSON.stringify(import.meta.resolve('react'))};\n${source.replace(/import "\.\/PaymentPortal\.css";/, '')}`;
const { PaymentPortal } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

async function renderWithVerifiedStatus(status) {
  // Inject only the status state returned by the API; all other React state stays real.
  // This component has exactly one useState(null): the server-verified status.
  const fixtureSource = source.replace('useEffect, useRef, useState', 'useEffect, useRef') +
    `\nconst useState = initial => React.useState(initial === null ? ${JSON.stringify(status)} : initial);`;
  const { PaymentPortal: PortalWithStatus } = await import(`data:text/javascript;base64,${Buffer.from(fixtureSource).toString('base64')}`);
  return renderToStaticMarkup(createElement(PortalWithStatus));
}

const verifiedPayment = { orderId: '11111111-1111-4111-8111-111111111111', purpose: 'project',
  state: 'COMPLETED', amountPaise: 20000, currency: 'INR', paidAt: '2026-10-17T16:15:10.000Z' };

test('portal first render stays disabled, labels fields and explains the approved amount range', t => {
  t.mock.property(globalThis, 'window', { location: { search: '?payment=project' } });
  const html = renderToStaticMarkup(createElement(PaymentPortal));
  assert.match(html, /aria-label="Payment process"/);
  assert.match(html, /₹200 to ₹50,000/);
  assert.match(html, /Keshav Kumar Karn/);
  assert.match(html, /type="submit" disabled=""/);
  assert.match(html.match(/<input[^>]*value="community"[^>]*>/)?.[0] ?? '', /disabled=""/);
  assert.match(html, /aria-describedby="payer-email-help"/);
  assert.doesNotMatch(html, /<fieldset[^>]*style=/);
});

test('a community URL never grants checkout availability and UI supports reduced motion', async t => {
  t.mock.property(globalThis, 'window', { location: { search: '?payment=community' } });
  const html = renderToStaticMarkup(createElement(PaymentPortal));
  const communityInput = html.match(/<input[^>]*value="community"[^>]*>/)?.[0] ?? '';
  assert.match(communityInput, /disabled=""/);
  assert.match(communityInput, /checked=""/);
  assert.match(html, /type="submit" disabled=""/);
  assert.match(html, /Not open for registration/);
  const css = await read('../src/components/PaymentPortal/PaymentPortal.css');
  assert.match(css, /payment-checkout-button:not\(:disabled\)[^{]*\{[^}]*cursor: pointer/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test('pending status does not claim the customer returned from checkout when checkout never opened', t => {
  t.mock.property(globalThis, 'window', { location: { search: '?payment=project&order=11111111-1111-4111-8111-111111111111' } });
  const html = renderToStaticMarkup(createElement(PaymentPortal));
  assert.match(html, /Checkout or payment verification is still pending/);
  assert.match(html, /contact support if checkout did not open/);
  assert.match(html, /Please do not pay again/);
  assert.doesNotMatch(html, /A return from checkout/);
});

test('project reference is clearly optional and does not request saved form suggestions', t => {
  t.mock.property(globalThis, 'window', { location: { search: '?payment=project' } });
  const html = renderToStaticMarkup(createElement(PaymentPortal));
  const reference = html.match(/<input[^>]*id="payer-reference"[^>]*>/)?.[0] ?? '';
  assert.ok(reference);
  assert.doesNotMatch(reference, /\brequired(?:=|\s|>)/);
  assert.match(reference, /autoComplete="off"/i);
  assert.doesNotMatch(reference, /\blist=/);
  assert.match(html, /Project or invoice reference \(optional\)/);
  assert.match(html, /Leave blank if you don’t have one/);
  assert.doesNotMatch(html, /Keep your reference handy|UAT-ONLY|UAT-DIAGNOSTIC/);
});

test('server-verified completion replaces checkout with a thank-you receipt and return-home action', async t => {
  t.mock.property(globalThis, 'window', { location: { search: `?payment=project&order=${verifiedPayment.orderId}` } });
  const html = await renderWithVerifiedStatus(verifiedPayment);
  assert.match(html, /Thank you/);
  assert.match(html, /Payment successful/);
  assert.match(html, /₹200\.00/);
  assert.match(html, /Payment reference/);
  assert.match(html, new RegExp(verifiedPayment.orderId));
  assert.match(html, /<a[^>]*href="\/"[^>]*>[^<]*Return to home/);
  assert.match(html, /tabindex="-1"/);
  assert.match(html, /does not settle any remaining project balance/);
  assert.doesNotMatch(html, /<form|Continue to PhonePe|Review your payment|payer-name/);
  assert.doesNotMatch(html, /receipt.*(?:sent|emailed)|automatically redirect/i);
});

test('pending, failed, review and URL success claims never show a success receipt', async t => {
  t.mock.property(globalThis, 'window', { location: { search: `?payment=project&order=${verifiedPayment.orderId}&status=COMPLETED&success=true` } });
  for (const state of ['CREATED', 'PENDING', 'FAILED', 'REVIEW']) {
    const html = await renderWithVerifiedStatus({ ...verifiedPayment, state, paidAt: null });
    assert.doesNotMatch(html, /Payment successful|Thank you|Return to home/);
    assert.match(html, /<form/);
  }
  const html = renderToStaticMarkup(createElement(PaymentPortal));
  assert.doesNotMatch(html, /Payment successful|Thank you|Return to home/);
});
