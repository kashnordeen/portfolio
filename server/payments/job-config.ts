import { paymentTarget } from './targets.ts';

export function loadJobConfig(env: Record<string, string | undefined>) {
  const enabled = env.PAYMENT_JOBS_ENABLED === 'true';
  const secret = (name: string) => {
    const value = env[name] ?? '';
    return /^[\x21-\x7e]{1,4096}$/.test(value) ? value : '';
  };
  const publishToken = secret('QSTASH_TOKEN');
  const currentSigningKey = secret('QSTASH_CURRENT_SIGNING_KEY');
  const nextSigningKey = secret('QSTASH_NEXT_SIGNING_KEY');
  const target = paymentTarget(env.PHONEPE_ENV ?? '');
  // Vercel injects this server-only system value; never forward a live project's key.
  const automationBypassSecret = target.environment === 'sandbox' ? secret('VERCEL_AUTOMATION_BYPASS_SECRET') : '';
  const identityReady = env.PHONEPE_ENV === target.environment && env.PAYMENT_SITE_ORIGIN === target.origin &&
    (target.environment === 'sandbox' ? env.VERCEL_PROJECT_ID === target.projectId :
      !env.VERCEL_PROJECT_ID || env.VERCEL_PROJECT_ID === target.projectId);
  const ready = enabled && env.VERCEL_ENV === 'production' && identityReady && env.NODE_TLS_REJECT_UNAUTHORIZED !== '0' &&
    Boolean(publishToken && currentSigningKey && nextSigningKey) &&
    (target.environment !== 'sandbox' || automationBypassSecret.length >= 32);
  const failureCallbackUrl = ready && target.environment === 'sandbox' && env.PAYMENT_UAT_ALERTS_ENABLED === 'true' &&
    /^re_[A-Za-z0-9_-]{16,256}$/.test(env.RESEND_API_KEY ?? '') ? `${target.origin}/api/payments/alerts` : '';
  return { enabled, ready, publishToken, currentSigningKey, nextSigningKey, automationBypassSecret, environment: target.environment, queueOrigin: target.queueOrigin,
    jobUrl: `${target.origin}/api/payments/jobs`, recoveryUrl: `${target.origin}/api/payments/recover`, failureCallbackUrl };
}
export type JobConfig = ReturnType<typeof loadJobConfig>;
