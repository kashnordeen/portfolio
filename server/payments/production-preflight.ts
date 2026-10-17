import { loadConfig } from './config.ts';
import { createPaymentDatabase } from './store.ts';
import { productionTarget } from './targets.ts';

// Build-time only: checkout stays closed while the production job infrastructure is checked.
export async function verifyProductionDatabase(env: Record<string, string | undefined>, connect = createPaymentDatabase) {
  const flags = { PAYMENTS_ENABLED: 'false', PAYMENT_RELEASE_APPROVED: 'false', COMMUNITY_PAYMENTS_ENABLED: 'false',
    PAYMENT_JOBS_ENABLED: 'true', PAYMENT_PRODUCTION_ALERTS_ENABLED: 'false', PAYMENT_UAT_ALERTS_ENABLED: 'false' };
  if (env.VERCEL_PROJECT_ID !== productionTarget.projectId || env.VERCEL_ENV !== 'production' ||
    env.PHONEPE_ENV !== 'production' || env.PAYMENT_SITE_ORIGIN !== productionTarget.origin ||
    env.PROJECT_MIN_PAISE !== '20000' || env.PROJECT_MAX_PAISE !== '5000000' ||
    env.NODE_TLS_REJECT_UNAUTHORIZED === '0' || Object.entries(flags).some(([key, value]) => env[key] !== value)) {
    throw new Error('Production preflight configuration failed.');
  }
  const config = loadConfig(env);
  if (!config.jobConfig.ready || config.projectEnabled || config.communityEnabled) throw new Error('Production preflight queue failed.');
  const url = new URL(config.databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
    decodeURIComponent(url.username) !== 'portfolio_payments_api.ghseaquzqlnpmiltsyqy' ||
    url.hostname !== 'aws-0-ap-south-1.pooler.supabase.com' || url.port !== '6543' ||
    url.pathname !== '/postgres' || url.search || url.hash) throw new Error('Production preflight target failed.');
  const sql = connect(config);
  try {
    const [result] = await sql.begin('read only', tx => tx`
      SELECT current_user = 'portfolio_payments_api' AS role_ok,
        session_user = 'portfolio_payments_api' AS session_ok,
        current_setting('transaction_read_only') = 'on' AS read_only,
        has_schema_privilege(current_user,'private_payments','USAGE') AS live_access,
        has_schema_privilege(current_user,'private_payments_uat','USAGE') AS uat_access,
        (SELECT rolcanlogin AND NOT (rolsuper OR rolinherit OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)
          FROM pg_roles WHERE rolname=current_user) AS safe_role,
        (SELECT count(*)::integer FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS memberships,
        (SELECT count(*)::integer FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='private_payments' AND c.relname IN ('orders','events','fulfilments','rate_limits','reconciliation_jobs')
          AND c.relkind='r' AND c.relrowsecurity AND has_table_privilege(current_user,c.oid,'SELECT')) AS rls_tables
    `);
    if (!result?.role_ok || !result.session_ok || !result.read_only || result.live_access !== true ||
      result.uat_access !== false || !result.safe_role || result.memberships !== 0 || result.rls_tables !== 5) {
      throw new Error('Production preflight permissions failed.');
    }
    return true;
  } finally { await sql.end({ timeout: 1 }); }
}
