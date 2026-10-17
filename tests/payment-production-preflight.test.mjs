import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyProductionDatabase } from '../server/payments/production-preflight.ts';
import { productionTarget, sandboxTarget } from '../server/payments/targets.ts';

const env = {
  VERCEL_PROJECT_ID: productionTarget.projectId, VERCEL_ENV: 'production', PHONEPE_ENV: 'production',
  PAYMENT_SITE_ORIGIN: productionTarget.origin, PAYMENTS_ENABLED: 'false', PAYMENT_RELEASE_APPROVED: 'false',
  COMMUNITY_PAYMENTS_ENABLED: 'false', PAYMENT_JOBS_ENABLED: 'true',
  PAYMENT_PRODUCTION_ALERTS_ENABLED: 'false', PAYMENT_UAT_ALERTS_ENABLED: 'false',
  PROJECT_MIN_PAISE: '20000', PROJECT_MAX_PAISE: '5000000',
  PAYMENT_SESSION_SECRET: 'fixture-session'.padEnd(40, 's'), PAYMENT_RECONCILIATION_SECRET: 'fixture-worker'.padEnd(40, 'w'),
  DATABASE_URL: 'postgres://portfolio_payments_api.ghseaquzqlnpmiltsyqy:fixture@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',
  PHONEPE_CLIENT_ID: 'fixture', PHONEPE_CLIENT_SECRET: 'fixture', PHONEPE_CLIENT_VERSION: '1',
  PHONEPE_MERCHANT_ID: 'fixture', PHONEPE_WEBHOOK_USERNAME: 'fixture', PHONEPE_WEBHOOK_PASSWORD: 'fixture',
  QSTASH_TOKEN: 'fixture', QSTASH_CURRENT_SIGNING_KEY: 'fixture-current', QSTASH_NEXT_SIGNING_KEY: 'fixture-next',
};
function fixture(result = {}) {
  let queries = 0, ended = 0;
  const sql = { begin: async (mode, query) => {
    assert.equal(mode, 'read only');
    return query(async parts => {
      queries++;
      assert.match(parts.join(''), /SELECT/);
      assert.doesNotMatch(parts.join(''), /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP)\b/i);
      return [{ role_ok: true, session_ok: true, read_only: true, live_access: true,
        uat_access: false, safe_role: true, memberships: 0, rls_tables: 5, ...result }];
    });
  }, end: async () => { ended++; } };
  return { connect: () => sql, counts: () => ({ queries, ended }) };
}
test('production build preflight refuses wrong project, unsafe configuration and any checkout activation before connecting', async () => {
  for (const change of [
    { VERCEL_PROJECT_ID: sandboxTarget.projectId }, { VERCEL_ENV: 'preview' }, { PHONEPE_ENV: 'sandbox' },
    { PAYMENT_SITE_ORIGIN: sandboxTarget.origin }, { PAYMENTS_ENABLED: 'true' }, { PAYMENT_RELEASE_APPROVED: 'true' },
    { COMMUNITY_PAYMENTS_ENABLED: 'true' }, { PAYMENT_JOBS_ENABLED: 'false' },
    { PAYMENT_PRODUCTION_ALERTS_ENABLED: 'true' }, { PAYMENT_UAT_ALERTS_ENABLED: 'true' },
    { PROJECT_MIN_PAISE: '100' }, { PROJECT_MAX_PAISE: '5000001' }, { NODE_TLS_REJECT_UNAUTHORIZED: '0' },
    { DATABASE_URL: env.DATABASE_URL.replace('portfolio_payments_api.', 'postgres.') },
    { DATABASE_URL: env.DATABASE_URL.replace('aws-0-ap-south-1.pooler.supabase.com', 'evil.test') },
    { DATABASE_URL: env.DATABASE_URL + '?sslmode=no-verify' }, { QSTASH_TOKEN: '' },
  ]) await assert.rejects(verifyProductionDatabase({ ...env, ...change }, () => assert.fail('no connection before guard')));
});
test('production preflight performs one read-only permission query and closes the restricted TLS connection', async () => {
  const f = fixture();
  assert.equal(await verifyProductionDatabase(env, f.connect), true);
  assert.deepEqual(f.counts(), { queries: 1, ended: 1 });
});
test('production preflight rejects unsafe database permissions and still closes the connection', async () => {
  for (const result of [{ safe_role: false }, { uat_access: true }, { live_access: false },
    { memberships: 1 }, { rls_tables: 4 }, { read_only: false }, { role_ok: false }, { session_ok: false }]) {
    const f = fixture(result);
    await assert.rejects(verifyProductionDatabase(env, f.connect), /Production preflight permissions failed/);
    assert.deepEqual(f.counts(), { queries: 1, ended: 1 });
  }
});
test('production preflight closes a rejected database query without consuming payment records', async () => {
  let ended = 0;
  await assert.rejects(verifyProductionDatabase(env, () => ({ begin: async () => { throw new Error('fixture-private'); },
    end: async () => { ended++; } })));
  assert.equal(ended, 1);
});
