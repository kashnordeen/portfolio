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
