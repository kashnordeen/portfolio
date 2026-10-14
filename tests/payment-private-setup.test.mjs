import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const recipe = await readFile(new URL('../database/manual-payment-secrets.sql', import.meta.url), 'utf8');

test('private setup is a human-run-only temporary invoker recipe, not a public credential endpoint', () => {
  assert.match(recipe, /HUMAN-RUN ONLY/);
  assert.match(recipe, /FUNCTION pg_temp\./);
  assert.match(recipe, /SECURITY INVOKER/);
  assert.doesNotMatch(recipe, /SECURITY DEFINER/);
  assert.match(recipe, /REVOKE ALL ON FUNCTION .* FROM PUBLIC/);
  assert.match(recipe, /current_user <> 'postgres'/);
  assert.match(recipe, /flags\.rolbypassrls/);
  assert.match(recipe, /flags\.rolinherit/);
  assert.match(recipe, /ALTER ROLE portfolio_payments_api PASSWORD %L/);
  assert.doesNotMatch(recipe, /ALTER ROLE postgres /);
});

test('setup creates independent random secrets, enables SCRAM, and keeps plaintext out of recipe literals', () => {
  assert.match(recipe, /password_encryption', 'scram-sha-256'/);
  assert.equal((recipe.match(/extensions\.gen_random_bytes\(32\)/g) ?? []).length, 4);
  for (const name of ['DATABASE_URL', 'PAYMENT_SESSION_SECRET', 'PAYMENT_RECONCILIATION_SECRET', 'PHONEPE_WEBHOOK_USERNAME', 'PHONEPE_WEBHOOK_PASSWORD']) {
    assert.match(recipe, new RegExp(`'${name}'`));
  }
  assert.doesNotMatch(recipe, /PASSWORD\s+'[^']+'/);
  assert.doesNotMatch(recipe, /^\s*(INSERT INTO|RAISE NOTICE|COPY\s+.*TO)/im);
  assert.match(recipe, /pooler\.supabase\.com:6543\/postgres/);
});
