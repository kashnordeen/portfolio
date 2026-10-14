import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, lstat, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDispatcher, workerConfig, ENDPOINT } from '../workers/reconciliation.mjs';

const secret = 'fixture-only-not-a-real-credential'.repeat(2);
const environment = {
  RECONCILIATION_WORKER_ENABLED: 'true', RECONCILIATION_WORKER_RELEASE_APPROVED: 'true',
  RECONCILIATION_WORKER_ENV: 'production', PAYMENT_RECONCILIATION_SECRET: secret,
};
const config = workerConfig(environment);
const healthy = () => Response.json({ checked: 2, deferred: 1 });
const cli = new URL('../workers/run-reconciliation.mjs', import.meta.url);
const execute = (argument, env) => spawnSync(process.execPath, [fileURLToPath(cli), argument], {
  env, encoding: 'utf8', timeout: 5000,
});

test('isolated worker defaults off and rejects bad environment, secrets and disabled TLS', () => {
  assert.deepEqual(workerConfig({}), { enabled: false });
  for (const key of ['RECONCILIATION_WORKER_ENABLED', 'RECONCILIATION_WORKER_RELEASE_APPROVED']) {
    assert.deepEqual(workerConfig({ ...environment, [key]: 'false' }), { enabled: false });
  }
  for (const invalid of [
    { RECONCILIATION_WORKER_ENV: 'preview' }, { NODE_TLS_REJECT_UNAUTHORIZED: '0' },
    { PAYMENT_RECONCILIATION_SECRET: '' }, { PAYMENT_RECONCILIATION_SECRET: `${secret}\r\n` },
  ]) assert.throws(() => workerConfig({ ...environment, ...invalid }), /CONFIGURATION_INVALID/);
});

test('disabled tick and pre-aborted ticks never send HTTP', async () => {
  let calls = 0;
  const dependencies = { fetchImpl: async () => { calls++; return healthy(); }, persistPause: async () => {} };
  assert.equal((await createDispatcher({ enabled: false }, dependencies).tick()).state, 'DISABLED');
  assert.equal((await createDispatcher(config, dependencies).tick(AbortSignal.abort())).state, 'STOPPED');
  assert.equal(calls, 0);
});

test('dispatcher uses fixed endpoint and credential-safe bounded POST without redirects', async () => {
  const dispatcher = createDispatcher(config, { persistPause: async () => {}, fetchImpl: async (url, options) => {
    assert.equal(url, ENDPOINT);
    assert.equal(options.method, 'POST'); assert.equal(options.body, '{}');
    assert.equal(options.redirect, 'manual'); assert.equal(options.credentials, 'omit');
    assert.equal(options.headers.Authorization, `Bearer ${secret}`);
    assert.ok(options.signal instanceof AbortSignal);
    return healthy();
  } });
  assert.deepEqual(await dispatcher.tick(), { state: 'HEALTHY', checked: 2, deferred: 1, delayMs: 1000 });
});

test('one dispatcher never overlaps calls', async () => {
  let release, calls = 0;
  const dispatcher = createDispatcher(config, { persistPause: async () => {}, fetchImpl: async () => {
    calls++; return await new Promise(resolve => { release = resolve; });
  } });
  const first = dispatcher.tick();
  assert.equal((await dispatcher.tick()).state, 'IN_FLIGHT');
  release(healthy()); await first; assert.equal(calls, 1);
});

test('auth errors and redirects persist pause and prevent further calls', async () => {
  for (const status of [401, 403, 302, 404]) {
    let calls = 0, paused;
    const dispatcher = createDispatcher(config, { persistPause: async reason => { paused = reason; },
      fetchImpl: async () => { calls++; return new Response('', { status }); } });
    assert.equal((await dispatcher.tick()).state, 'PAUSED'); assert.ok(paused);
    assert.equal((await dispatcher.tick()).state, 'PAUSED'); assert.equal(calls, 1);
  }
});

test('malformed, excessive and misleading success responses fail closed', async () => {
  const replies = [
    () => new Response('<html>portfolio</html>'), () => Response.json({ checked: 3, deferred: 1 }),
    () => Response.json({ checked: -1, deferred: 0 }), () => Response.json({ checked: '1', deferred: 0 }),
    () => Response.json({ checked: 0, deferred: 0, extra: 'not accepted' }),
    () => new Response('x'.repeat(1025), { headers: { 'Content-Type': 'application/json' } }),
    () => new Response('{bad', { headers: { 'Content-Type': 'application/json' } }),
  ];
  for (const reply of replies) {
    let pause;
    const dispatcher = createDispatcher(config, { fetchImpl: async () => reply(), persistPause: async r => { pause = r; } });
    assert.equal((await dispatcher.tick()).state, 'PAUSED'); assert.equal(pause, 'INVALID_RESPONSE');
  }
});

test('transport, 429 and server failures back off and persist pause after five failures', async () => {
  for (const fetchImpl of [async () => { throw new Error(secret); }, async () => new Response('', { status: 429 }),
    async () => new Response('', { status: 503 })]) {
    const pauses = [];
    const dispatcher = createDispatcher(config, { fetchImpl, persistPause: async r => pauses.push(r) });
    for (const delayMs of [3000, 6000, 10000, 30000]) assert.deepEqual(await dispatcher.tick(), { state: 'BACKOFF', delayMs });
    assert.deepEqual(await dispatcher.tick(), { state: 'PAUSED', reason: 'REPEATED_FAILURE' });
    assert.deepEqual(pauses, ['REPEATED_FAILURE']);
    assert.ok(!JSON.stringify(pauses).includes(secret));
  }
});

test('healthy response resets transient backoff and persistence errors stop execution', async () => {
  let failed = true;
  const dispatcher = createDispatcher(config, { persistPause: async () => {}, fetchImpl: async () => {
    if (failed) throw new Error('network'); return healthy();
  } });
  assert.equal((await dispatcher.tick()).delayMs, 3000);
  failed = false; assert.equal((await dispatcher.tick()).state, 'HEALTHY');
  failed = true; assert.equal((await dispatcher.tick()).delayMs, 3000);
  const broken = createDispatcher(config, { fetchImpl: async () => new Response('', { status: 401 }),
    persistPause: async () => { throw new Error('storage'); } });
  await assert.rejects(broken.tick(), /storage/);
  assert.equal((await broken.tick()).state, 'PAUSED');
});

test('request deadline aborts a stalled transport without disclosing its error', async () => {
  const keepAlive = setTimeout(() => {}, 200);
  try {
    const dispatcher = createDispatcher(config, { timeoutMs: 10, persistPause: async () => {},
      fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error(secret)), { once: true });
      }) });
    assert.deepEqual(await dispatcher.tick(), { state: 'BACKOFF', delayMs: 3000 });
  } finally { clearTimeout(keepAlive); }
});

test('shutdown cancellation stops a request without marking it paid or automatically retrying', async () => {
  const controller = new AbortController();
  const dispatcher = createDispatcher(config, { persistPause: async () => assert.fail('not a failure pause'),
    fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
    }) });
  const pending = dispatcher.tick(controller.signal);
  controller.abort();
  assert.deepEqual(await pending, { state: 'STOPPED' });
});

test('CLI check/default run are non-networking and never print a credential', () => {
  for (const command of ['--check', '--run']) {
    const result = execute(command, {});
    assert.equal(result.status, 0); assert.equal(result.stdout.trim(), 'DISABLED');
  }
  const result = execute('--check', environment);
  assert.equal(result.status, 0); assert.equal(result.stdout.trim(), 'CONFIGURATION_READY_NOT_RUNNING');
  assert.ok(!(result.stdout + result.stderr).includes(secret));
});

test('CLI fails closed on durable pause and exclusive lock without networking', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portfolio-worker-test-'));
  const env = { ...environment, RECONCILIATION_WORKER_STATE_DIR: directory };
  try {
    await writeFile(join(directory, 'paused.json'), '{}');
    let result = execute('--run', env);
    assert.equal(result.status, 1); assert.equal(result.stdout.trim(), 'PAUSED_REVIEW_REQUIRED');
    await rm(join(directory, 'paused.json'));
    await writeFile(join(directory, 'instance.lock'), '');
    result = execute('--run', env);
    assert.equal(result.status, 1); assert.match(result.stderr, /WORKER_STOPPED_REVIEW/);
    assert.ok(!(result.stdout + result.stderr).includes(secret));
  } finally {
    for (const file of ['paused.json', 'instance.lock']) await rm(join(directory, file), { force: true });
    await rmdir(directory);
  }
});

test('runner durably saves an auth pause, removes its own lock and refuses restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portfolio-worker-test-'));
  const env = { ...environment, RECONCILIATION_WORKER_STATE_DIR: directory };
  try {
    // Override transport before importing the CLI: never contact the production endpoint.
    const script = `process.argv = [process.execPath, 'offline-fixture', '--run']; globalThis.fetch = async () => new Response(null, { status: 401 }); await import(${JSON.stringify(cli.href)});`;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      env, encoding: 'utf8', timeout: 5000,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /PAUSED_REVIEW_REQUIRED/);
    const stored = await readFile(join(directory, 'paused.json'), 'utf8');
    assert.equal(JSON.parse(stored).reason, 'AUTHENTICATION_FAILED');
    assert.ok(!stored.includes(secret));
    await assert.rejects(lstat(join(directory, 'instance.lock')), { code: 'ENOENT' });
    const restarted = execute('--run', env);
    assert.equal(restarted.status, 1); assert.match(restarted.stdout, /PAUSED_REVIEW_REQUIRED/);
  } finally {
    for (const file of ['paused.json', 'instance.lock']) await rm(join(directory, file), { force: true });
    await rmdir(directory);
  }
});
