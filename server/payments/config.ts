import { PaymentError } from './security.ts';

export type PaymentConfig = ReturnType<typeof loadConfig>;
export function loadConfig(env: Record<string, string | undefined>) {
  const required = (name: string) => {
    const value = env[name]?.trim();
    if (!value) throw new PaymentError(503, 'Payment service is not configured.');
    return value;
  };
  const environment = required('PHONEPE_ENV');
  if (environment !== 'sandbox' && environment !== 'production') throw new PaymentError(503, 'Payment service is not configured.');
  if (environment === 'production' && env.VERCEL_ENV !== 'production') throw new PaymentError(503, 'Live credentials cannot be used in preview deployments.');
  const origin = new URL(required('PAYMENT_SITE_ORIGIN'));
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new PaymentError(503, 'Payment site must use an HTTPS origin.');
  }
  const sessionSecret = required('PAYMENT_SESSION_SECRET');
  const workerSecret = required('PAYMENT_RECONCILIATION_SECRET');
  if (sessionSecret.length < 32 || workerSecret.length < 32 || sessionSecret === workerSecret) throw new PaymentError(503, 'Independent payment secrets are required.');
  const min = Number(env.PROJECT_MIN_PAISE), max = Number(env.PROJECT_MAX_PAISE);
  const amountRangeReady = Number.isSafeInteger(min) && Number.isSafeInteger(max) && min >= 100 && max >= min && max <= 2_147_483_647;
  // Release approval is a separate gate: the five initial variables cannot turn payments on.
  const enabled = env.PAYMENTS_ENABLED === 'true' && env.PAYMENT_RELEASE_APPROVED === 'true';
  return {
    environment, origin: origin.origin, sessionSecret, workerSecret,
    databaseUrl: required('DATABASE_URL'), databaseCa: env.DATABASE_CA_CERT,
    clientId: required('PHONEPE_CLIENT_ID'), clientSecret: required('PHONEPE_CLIENT_SECRET'),
    clientVersion: required('PHONEPE_CLIENT_VERSION'), merchantId: required('PHONEPE_MERCHANT_ID'),
    webhookUsername: required('PHONEPE_WEBHOOK_USERNAME'), webhookPassword: required('PHONEPE_WEBHOOK_PASSWORD'),
    projectEnabled: enabled && amountRangeReady,
    communityEnabled: enabled && env.COMMUNITY_PAYMENTS_ENABLED === 'true', min, max,
    checkoutHost: environment === 'sandbox' ? 'mercury-uat.phonepe.com' : 'mercury.phonepe.com',
  };
}
