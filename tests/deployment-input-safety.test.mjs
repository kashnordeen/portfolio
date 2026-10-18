import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Vercel uploads source, not local build fixtures or credential files', async () => {
  const rules = new Set((await readFile(new URL('../.vercelignore', import.meta.url), 'utf8'))
    .split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#')));
  for (const required of ['dist', 'dist-ssr', 'node_modules', '.git', '.vercel', '.env', '.env.*',
    '**/.env', '**/.env.*', '**/*.local', '**/*.pem', '**/*.key', '**/*.p12', '**/*.pfx']) {
    assert.ok(rules.has(required), `${required} must stay outside deployment inputs`);
  }
  assert.ok([...rules].every(rule => !rule.startsWith('!')), 'No credential or fixture re-inclusion');
});
