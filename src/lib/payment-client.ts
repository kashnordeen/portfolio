export type PaymentAvailability = { projectEnabled: boolean; communityEnabled: boolean };
export type PaymentStatus = { orderId: string; purpose: 'community' | 'project'; state: 'CREATED' | 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVIEW'; amountPaise: number; currency: 'INR'; paidAt: string | null; failureReason?: 'CANCELLED' };
export type CheckoutResult = { orderId: string; checkoutUrl?: string; state?: string; message?: string };

export function canRestartCancelledPayment(status: Pick<PaymentStatus, 'state' | 'failureReason'> | null) {
  return status?.state === 'FAILED' && status.failureReason === 'CANCELLED';
}

export function restartCancelledPayment(status: PaymentStatus | null, storage: Pick<Storage, 'removeItem'>, navigate: (path: string) => void) {
  if (!status || !canRestartCancelledPayment(status) || !['project', 'community'].includes(status.purpose)) return false;
  storage.removeItem('payment-request-key');
  navigate(`/?payment=${status.purpose}`);
  return true;
}

export class CheckoutError extends Error {
  editable: boolean;
  constructor(message: string, editable = false) { super(message); this.editable = editable; }
}

export async function getPaymentAvailability(signal: AbortSignal): Promise<PaymentAvailability> {
  try {
    const response = await fetch('/api/payments/config', { signal, credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('unavailable');
    const data = await response.json();
    return { projectEnabled: data.projectEnabled === true, communityEnabled: data.communityEnabled === true };
  } catch { return { projectEnabled: false, communityEnabled: false }; }
}

export async function startCheckout(input: { purpose: string; name: string; email: string; amount: string; reference: string }, key: string): Promise<CheckoutResult> {
  let response: Response;
  try {
    response = await fetch('/api/payments/orders', { method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(input) });
  } catch { throw new Error('Connection interrupted. Keep these details unchanged and retry this same request; do not start another payment.'); }
  let data: Record<string, unknown>;
  try {
    const parsed: unknown = await response.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object required');
    data = parsed as Record<string, unknown>;
  } catch { throw new Error('Unable to confirm the order. Please contact support before retrying.'); }
  if (!response.ok && ![202, 409].includes(response.status)) {
    throw new CheckoutError(typeof data.error === 'string' ? data.error : 'Unable to open checkout.', [400, 403, 415, 429].includes(response.status));
  }
  if (typeof data.orderId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.orderId)) throw new Error('Unable to confirm the order. Please contact support before retrying.');
  if (data.checkoutUrl) {
    if (![200, 201].includes(response.status) || typeof data.checkoutUrl !== 'string') {
      throw new Error('Unable to confirm checkout. Contact support before making another payment.');
    }
    const url = new URL(data.checkoutUrl);
    if (url.protocol !== 'https:' || !['mercury.phonepe.com', 'mercury-t2.phonepe.com', 'mercury-uat.phonepe.com'].includes(url.hostname) || url.username || url.password || url.port || url.hash) {
      throw new Error('Unable to verify the checkout destination. Please contact support.');
    }
  }
  return { orderId: data.orderId, ...(typeof data.checkoutUrl === 'string' ? { checkoutUrl: data.checkoutUrl } : {}),
    ...(typeof data.state === 'string' ? { state: data.state } : {}), ...(typeof data.message === 'string' ? { message: data.message } : {}) };
}

export async function getPaymentStatus(order: string, signal: AbortSignal): Promise<PaymentStatus> {
  const response = await fetch(`/api/payments/status?order=${encodeURIComponent(order)}`, { signal, credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error('Payment status is unavailable in this browser session. Contact support before making another payment.');
  const data = await response.json();
  if (data.orderId !== order || !['community', 'project'].includes(data.purpose) || !['CREATED', 'PENDING', 'COMPLETED', 'FAILED', 'REVIEW'].includes(data.state) ||
    !Number.isSafeInteger(data.amountPaise) || data.amountPaise < 100 || data.currency !== 'INR' ||
    (data.state === 'COMPLETED' && (typeof data.paidAt !== 'string' || !Number.isFinite(Date.parse(data.paidAt))))) {
    throw new Error('Payment status could not be verified. Please contact support.');
  }
  return { orderId: data.orderId, purpose: data.purpose, state: data.state, amountPaise: data.amountPaise,
    currency: data.currency, paidAt: data.paidAt,
    ...(data.state === 'FAILED' && data.failureReason === 'CANCELLED' ? { failureReason: 'CANCELLED' as const } : {}) };
}
