import type { PaymentConfig } from './config.ts';
import { PaymentError } from './security.ts';

export type ProviderStatus = { orderId: string; state: 'PENDING' | 'COMPLETED' | 'FAILED'; amount: number };

export function safeCheckoutUrl(value: unknown, hostname: string): string {
  if (typeof value !== 'string') throw new PaymentError(502, 'Invalid payment provider response.');
  let url: URL;
  try { url = new URL(value); } catch { throw new PaymentError(502, 'Invalid payment provider response.'); }
  if (url.protocol !== 'https:' || url.hostname !== hostname || url.port || url.username || url.password || url.hash) {
    throw new PaymentError(502, 'Invalid payment provider response.');
  }
  return url.href;
}

export function normalizeStatus(value: unknown): ProviderStatus {
  if (!value || typeof value !== 'object') throw new PaymentError(502, 'Invalid payment provider response.');
  const data = value as Record<string, unknown>;
  const amount = typeof data.amount === 'string' && /^\d+$/.test(data.amount) ? Number(data.amount) : data.amount;
  if (typeof data.orderId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(data.orderId) ||
    !['PENDING', 'COMPLETED', 'FAILED'].includes(String(data.state)) || !Number.isSafeInteger(amount) || Number(amount) < 100) {
    throw new PaymentError(502, 'Invalid payment provider response.');
  }
  return { orderId: data.orderId, state: data.state as ProviderStatus['state'], amount: Number(amount) };
}

export function createPhonePe(config: PaymentConfig, send: typeof fetch = fetch, now = Date.now) {
  const base = config.environment === 'sandbox' ? 'https://api-preprod.phonepe.com/apis/pg-sandbox' : 'https://api.phonepe.com/apis/pg';
  const authUrl = config.environment === 'sandbox' ? `${base}/v1/oauth/token` : 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token';
  let cached: { token: string; expires: number } | undefined;
  let inflight: Promise<string> | undefined;
  const json = async (url: string, init: RequestInit) => {
    let response: Response;
    try { response = await send(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(8000) }); }
    catch { throw new PaymentError(502, 'Payment provider is unavailable. Your order will be checked before any retry.'); }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) cached = undefined;
      throw new PaymentError(502, 'Payment provider could not complete the request.');
    }
    try { return await response.json() as Record<string, unknown>; }
    catch { throw new PaymentError(502, 'Invalid payment provider response.'); }
  };
  const token = async (): Promise<string> => {
    if (cached && cached.expires > now() + 60000) return cached.token;
    if (inflight) return inflight;
    inflight = (async () => {
      const data = await json(authUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, client_version: config.clientVersion, grant_type: 'client_credentials' }) });
      if (typeof data.access_token !== 'string' || !data.access_token || typeof data.expires_at !== 'number' || data.expires_at * 1000 <= now() + 60000) {
        throw new PaymentError(502, 'Invalid payment provider response.');
      }
      cached = { token: data.access_token, expires: data.expires_at * 1000 };
      return cached.token;
    })();
    try { return await inflight; } finally { inflight = undefined; }
  };
  return {
    async pay(order: { id: string; merchant_order_id: string; amount_paise: number; purpose: string }) {
      const redirect = new URL('/', config.origin);
      redirect.searchParams.set('payment', order.purpose);
      redirect.searchParams.set('order', order.id);
      const data = await json(`${base}/checkout/v2/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `O-Bearer ${await token()}` },
        body: JSON.stringify({ merchantOrderId: order.merchant_order_id, amount: order.amount_paise, expireAfter: 1200, disablePaymentRetry: true,
          paymentFlow: { type: 'PG_CHECKOUT', merchantUrls: { redirectUrl: redirect.href } } }) });
      if (data.state !== 'PENDING' || typeof data.orderId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(data.orderId) ||
        typeof data.expireAt !== 'number' || data.expireAt <= now() || data.expireAt > now() + 3_660_000) {
        throw new PaymentError(502, 'Invalid payment provider response.');
      }
      return { orderId: data.orderId, expires: new Date(data.expireAt), url: safeCheckoutUrl(data.redirectUrl, config.checkoutHost) };
    },
    async status(merchantOrderId: string) {
      return normalizeStatus(await json(`${base}/checkout/v2/order/${encodeURIComponent(merchantOrderId)}/status?details=false`, {
        method: 'GET', headers: { Authorization: `O-Bearer ${await token()}` },
      }));
    },
  };
}
