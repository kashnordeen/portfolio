// Server-only configuration; the email provider must separately verify domain ownership.
export function productionAlertSender(env: Record<string, string | undefined>) {
  const value = env.PAYMENT_ALERT_FROM ?? '';
  const domain = value.split('@')[1]?.toLowerCase() ?? '';
  return value.length <= 254 && (value.split('@')[0]?.length ?? 0) <= 64 &&
    /^[A-Za-z0-9]+(?:[._+-][A-Za-z0-9]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(value) &&
    domain !== 'resend.dev' && !domain.endsWith('.resend.dev') ? value : '';
}

export const hasAlertKey = (env: Record<string, string | undefined>) =>
  /^re_[A-Za-z0-9_-]{16,256}$/.test(env.RESEND_API_KEY ?? '');

export function gmailAlertCredentials(env: Record<string, string | undefined>) {
  const clientId = env.GMAIL_CLIENT_ID ?? '';
  const clientSecret = env.GMAIL_CLIENT_SECRET ?? '';
  const refreshToken = env.GMAIL_REFRESH_TOKEN ?? '';
  return /^[0-9]{6,32}-[A-Za-z0-9_-]{8,200}\.apps\.googleusercontent\.com$/.test(clientId) &&
    /^[A-Za-z0-9_-]{16,256}$/.test(clientSecret) && /^[\x21-\x7e]{16,4096}$/.test(refreshToken) ?
    { clientId, clientSecret, refreshToken } : null;
}

export function alertDeliveryReady(env: Record<string, string | undefined>, sandbox: boolean) {
  const provider = env.PAYMENT_ALERT_PROVIDER ?? 'resend';
  if (provider === 'gmail') return !sandbox && Boolean(gmailAlertCredentials(env));
  return provider === 'resend' && hasAlertKey(env) && (sandbox || Boolean(productionAlertSender(env)));
}
