import { loadConfig } from './config.ts';
import { createPaymentDatabase } from './store.ts';
import { sandboxTarget } from './targets.ts';

// Build-time only. No HTTP route, provider calls, payment rows or credential output.
export async function verifyUatDatabase(env: Record<string, string | undefined>, connect = createPaymentDatabase) {
  if (env.VERCEL_PROJECT_ID !== sandboxTarget.projectId || env.VERCEL_ENV !== 'production' ||
      env.PHONEPE_ENV !== 'sandbox' || env.PAYMENT_SITE_ORIGIN !== sandboxTarget.origin ||
      env.NODE_TLS_REJECT_UNAUTHORIZED === '0' ||
      ['PAYMENTS_ENABLED','PAYMENT_RELEASE_APPROVED','COMMUNITY_PAYMENTS_ENABLED','PAYMENT_JOBS_ENABLED']
        .some(key => env[key] !== 'false')) throw new Error('UAT preflight guard failed.');
  if (!/^[\x21-\x7e]{32,4096}$/.test(env.VERCEL_AUTOMATION_BYPASS_SECRET ?? '')) {
    throw new Error('UAT callback credential is not configured.');
  }
  const config = loadConfig(env);
  const url = new URL(config.databaseUrl);
  if (!['postgres:','postgresql:'].includes(url.protocol) ||
      url.hostname !== 'aws-0-ap-south-1.pooler.supabase.com' || url.port !== '6543' ||
      url.pathname !== '/postgres' || url.search || url.hash ||
      decodeURIComponent(url.username) !== 'portfolio_payments_uat.ghseaquzqlnpmiltsyqy') {
    throw new Error('UAT preflight database target failed.');
  }
  const sql = connect(config);
  try {
    const [result] = await sql.begin('read only', tx => tx`
      SELECT current_user = 'portfolio_payments_uat' AS role_ok,
        session_user = 'portfolio_payments_uat' AS session_ok,
        current_setting('transaction_read_only') = 'on' AS read_only,
        has_schema_privilege(current_user,'private_payments','USAGE') AS live_access,
        has_schema_privilege(current_user,'private_payments_uat','USAGE') AS uat_access,
        (SELECT rolcanlogin AND NOT (rolsuper OR rolinherit OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)
          AND rolconnlimit = 4 FROM pg_roles WHERE rolname=current_user) AS safe_role,
        (SELECT count(*)::integer FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS memberships,
        (SELECT count(*)::integer FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='private_payments_uat' AND c.relname IN ('orders','events','fulfilments','rate_limits','reconciliation_jobs')
          AND c.relkind='r' AND c.relrowsecurity AND has_table_privilege(current_user,c.oid,'SELECT')) AS rls_tables
    `);
    if (!result?.role_ok || !result.session_ok || !result.read_only || result.live_access !== false ||
        !result.uat_access || !result.safe_role || result.memberships !== 0 || result.rls_tables !== 5) {
      throw new Error('UAT preflight permissions failed.');
    }
    return true;
  } finally { await sql.end({timeout:1}); }
}

export function uatFailureCode(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (code === '28P01' || code === '28000') return 'AUTH_FAILED';
  if (['CERT_HAS_EXPIRED','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'DEPTH_ZERO_SELF_SIGNED_CERT','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','ERR_TLS_CERT_ALTNAME_INVALID'].includes(String(code))) return 'TLS_FAILED';
  if (['CONNECT_TIMEOUT','ETIMEDOUT','ECONNREFUSED','ENOTFOUND'].includes(String(code))) return 'CONNECTION_FAILED';
  return 'CHECK_FAILED';
}
