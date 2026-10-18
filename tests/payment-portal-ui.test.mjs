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
let chrome = compile(await read('../src/components/PaymentPortal/PaymentPageChrome.tsx'));
for (const dependency of ['react', 'lucide-react']) chrome = chrome.replaceAll(`"${dependency}"`, JSON.stringify(import.meta.resolve(dependency)));
chrome = chrome.replaceAll('"@/data/portfolio"', JSON.stringify(moduleUrl(await read('../src/data/portfolio.ts'))));
chrome = `import * as React from ${JSON.stringify(import.meta.resolve('react'))};\n${chrome}`;
source = source.replace('"./PaymentPageChrome"', JSON.stringify(`data:text/javascript;base64,${Buffer.from(chrome).toString('base64')}`));
for (const dependency of ['react', 'lucide-react']) source = source.replaceAll(`"${dependency}"`, JSON.stringify(import.meta.resolve(dependency)));
for (const [alias, path] of [['@/data/portfolio', '../src/data/portfolio.ts'],
  ['@/lib/payment-client', '../src/lib/payment-client.ts'], ['@/lib/project-payment-input', '../src/lib/project-payment-input.ts']]) {
  source = source.replaceAll(`"${alias}"`, JSON.stringify(moduleUrl(await read(path))));
}
source = `import * as React from ${JSON.stringify(import.meta.resolve('react'))};\n${source.replace(/import "\.\/PaymentPortal\.css";/, '')}`;
const { PaymentPortal } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const { PaymentIntro } = await import(`data:text/javascript;base64,${Buffer.from(chrome).toString('base64')}`);

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
  assert.match(html, /type="submit"[^>]*disabled=""/);
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
  assert.match(html, /type="submit"[^>]*disabled=""/);
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

test('thank-you copy is warm and clear while celebration graphics stay decorative', async t => {
  t.mock.property(globalThis, 'window', { location: { search: `?payment=project&order=${verifiedPayment.orderId}` } });
  const html = await renderWithVerifiedStatus(verifiedPayment);
  assert.match(html, />Thank you!</);
  assert.match(html, /Your payment is confirmed\./);
  assert.match(html, /Thank you for your trust\./);
  assert.match(html, /class="payment-success-icon" aria-hidden="true"/);
  assert.match(html, /Return to home/);
});

test('confirmation motion is opt-in, finite and animates only transform and opacity', async () => {
  const css = await read('../src/components/PaymentPortal/PaymentPortal.css');
  const motion = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: no-preference)'));
  assert.ok(motion, 'Celebration must be opt-in for users who allow motion');
  const frames = [...motion.matchAll(/@keyframes (payment-confirmation-[\w-]+)\s*\{([\s\S]*?)(?=@keyframes|$)/g)];
  assert.deepEqual(frames.map(frame => frame[1]).sort(), ['payment-confirmation-check', 'payment-confirmation-reveal', 'payment-confirmation-ring']);
  for (const [, name, body] of frames) {
    const properties = [...body.matchAll(/(?:\{|;)\s*([\w-]+)\s*:/g)].map(match => match[1]);
    assert.ok(properties.length > 0, `${name} must animate`);
    assert.ok(properties.every(property => ['opacity', 'transform'].includes(property)), `${name} must not animate layout or paint properties`);
  }
  assert.doesNotMatch(motion, /\binfinite\b|animation-iteration-count\s*:\s*[2-9]/);
});

test('redesigned checkout has a single primary heading, labelled navigation and accessible supporting help', t => {
  t.mock.property(globalThis, 'window', { location: { search: '?payment=project' } });
  const html = renderToStaticMarkup(createElement(PaymentPortal));
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.match(html, /Your project\./);
  assert.match(html, /One step forward\./);
  assert.match(html, /Fields are required unless marked optional/);
  assert.match(html, /aria-label="Back to portfolio"/);
  assert.match(html, /aria-label="Payment navigation"/);
  assert.equal((html.match(/<details>/g) ?? []).length, 3);
  assert.match(html, /Do I need a project reference/);
  assert.match(html, /No\. The reference is optional/);
  assert.equal((html.match(/type="submit"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /100% secure|guaranteed|receipt sent/i);
});

test('scroll effects are progressive, motion-safe and do not gate payment controls', async () => {
  const css = await read('../src/components/PaymentPortal/PaymentPortal.css');
  assert.match(css, /@supports \(animation-timeline: view\(\)\)/);
  assert.match(css, /animation-range: entry 0% entry 25%/);
  assert.match(css, /payment-guide:focus-within/);
  assert.doesNotMatch(css, /\.payment-fields[^}]*animation-timeline|\binfinite\b|scroll-behavior:\s*smooth/);
  assert.match(css, /prefers-reduced-motion: reduce[^]*animation: none !important/);
  assert.match(css, /:focus-visible[^}]*outline: 2px solid/);
});

test('connected payment milestones follow actual flow state without claiming payment success', () => {
  for (const [order, checkoutStarted, stage] of [['', false, 1], ['', true, 2], [verifiedPayment.orderId, false, 3]]) {
    const html = renderToStaticMarkup(createElement(PaymentIntro, { loaded: true, enabled: true, order, checkoutStarted }));
    assert.match(html, new RegExp(`data-stage="${stage}"`));
    assert.equal((html.match(/aria-current="step"/g) ?? []).length, 1);
    assert.match(html, /Verify status/);
    assert.doesNotMatch(html, /Payment successful|Payment complete/);
  }
});

test('checkout boost is tied to submission, stays finite and never animates disabled clicks', async () => {
  const css = await read('../src/components/PaymentPortal/PaymentPortal.css');
  const component = await read('../src/components/PaymentPortal/PaymentPortal.tsx');
  assert.match(component, /data-busy=\{busy\}/);
  assert.match(css, /payment-steps\[data-stage="2"\]::after[^}]*scaleX\(\.5\)/);
  assert.match(css, /payment-steps\[data-stage="3"\]::after[^}]*scaleX\(1\)/);
  assert.match(css, /payment-checkout-button:not\(:disabled\):active[^}]*scale\(\.97\)/);
  assert.match(css, /payment-checkout-button\[data-busy="true"\] svg[^}]*payment-button-boost/);
  assert.doesNotMatch(css, /payment-checkout-button:disabled:active|\binfinite\b/);
  for (const name of ['lift', 'boost']) {
    const body = css.match(new RegExp(`@keyframes payment-button-${name} ([^]*?)(?=\\n  @|\\n})`))?.[1] ?? '';
    const properties = [...body.matchAll(/(?:\{|;)\s*([\w-]+)\s*:/g)].map(match => match[1]);
    assert.ok(properties.length > 0);
    assert.ok(properties.every(property => ['transform', 'opacity'].includes(property)));
  }
});
