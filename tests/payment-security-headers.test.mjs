import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const globalHeaders = () => {
  const rule = config.headers?.find(entry => entry.source === '/(.*)');
  assert.ok(rule, 'Security headers must cover HTML, assets and payment API paths.');
  const headers = new Map(rule.headers.map(header => [header.key.toLowerCase(), header.value]));
  assert.equal(headers.size, rule.headers.length, 'Duplicate header names are ambiguous.');
  return headers;
};

test('deployment headers deny framing, MIME sniffing and unused browser capabilities without changing routing', () => {
  const headers = globalHeaders();
  assert.equal(headers.get('x-frame-options'), 'DENY');
  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  // PhonePe validates the registered source origin. Never send its full URL/query.
  assert.equal(headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(headers.get('permissions-policy'), 'camera=(), microphone=(), geolocation=()');
  assert.equal(config.framework, 'vite');
  assert.equal(config.installCommand, 'npm ci --ignore-scripts');
  assert.equal(config.rewrites, undefined, 'Do not route payment callbacks to the SPA.');
  assert.equal(config.routes, undefined);
  assert.equal(headers.has('access-control-allow-origin'), false, 'Do not change CORS.');
  assert.equal(headers.has('cache-control'), false, 'Keep API no-store responses intact.');
});

test('CSP starts in report-only mode and preserves reviewed first-party and existing integration sources', async () => {
  const headers = globalHeaders();
  assert.equal(headers.has('content-security-policy'), false, 'Enforcement requires hosted browser acceptance first.');
  const policy = headers.get('content-security-policy-report-only');
  assert.ok(policy, 'Review CSP violations before enforcing a resource policy.');
  const directives = new Map(policy.split(';').filter(part => part.trim()).map(part => {
    const [name, ...sources] = part.trim().split(/\s+/);
    return [name, sources];
  }));
  assert.deepEqual(directives.get('default-src'), ["'self'"]);
  assert.deepEqual(directives.get('object-src'), ["'none'"]);
  assert.deepEqual(directives.get('base-uri'), ["'self'"]);
  assert.deepEqual(directives.get('frame-ancestors'), ["'none'"]);
  assert.deepEqual(directives.get('form-action'), ["'self'"]);
  assert.deepEqual(directives.get('connect-src'), ["'self'", 'https://api.web3forms.com', 'https://api.github.com']);
  assert.deepEqual(directives.get('img-src'), ["'self'", 'data:', 'https://cdn.jsdelivr.net']);
  assert.deepEqual(directives.get('font-src'), ["'self'"]);
  assert.deepEqual(directives.get('style-src'), ["'self'", "'unsafe-inline'"]);
  const html = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).replace(/\r\n?/g, '\n');
  const inlineScripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(match => !/\bsrc\s*=/.test(match[1]));
  assert.equal(inlineScripts.length, 1, 'Review new inline scripts before allowing them.');
  const hashes = inlineScripts.map(match => `'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`);
  assert.deepEqual(directives.get('script-src'), ["'self'", ...hashes]);
  assert.doesNotMatch(policy, /unsafe-eval|report-uri|report-to|https:\s|\*/);
});
