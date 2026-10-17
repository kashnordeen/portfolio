import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export class PaymentError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
export const equalSecret = (a: string, b: string) => {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

export function parsePaise(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{1,8}(\.\d{1,2})?$/.test(value)) {
    throw new PaymentError(400, 'Enter an INR amount with up to two decimal places.');
  }
  const [whole, fraction = ''] = value.split('.');
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(paise) || paise < 100 || paise > 2_147_483_647) {
    throw new PaymentError(400, 'Amount is outside the supported range.');
  }
  return paise;
}

export function validateCustomer(input: Record<string, unknown>, min: number, max: number) {
  const text = (key: string, limit: number) => {
    const value = input[key];
    if (typeof value !== 'string' || !value.trim() || value.trim().length > limit || [...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) {
      throw new PaymentError(400, `Please provide a valid ${key}.`);
    }
    return value.trim();
  };
  if (input.purpose !== 'community' && input.purpose !== 'project') throw new PaymentError(400, 'Select a payment purpose.');
  const name = text('name', 100), email = text('email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PaymentError(400, 'Please provide a valid email.');
  const purpose = input.purpose;
  const amount = purpose === 'community' ? 69900 : parsePaise(input.amount);
  if (purpose === 'project' && (amount < min || amount > max)) throw new PaymentError(400, 'Amount is outside the accepted project payment range.');
  return { purpose, name, email, reference: purpose === 'project' ? text('reference', 120) : null, amount };
}

export function sessionHash(token: string, secret: string) {
  return createHmac('sha256', secret).update(token).digest('hex');
}

export function readSession(request: Request) {
  const matches = (request.headers.get('cookie') ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith('__Host-payment-session='));
  if (matches.length !== 1) return null;
  const value = matches[0].slice('__Host-payment-session='.length);
  return /^[a-f0-9]{64}$/.test(value) ? value : null;
}

export const newSession = () => randomBytes(32).toString('hex');
export const sessionCookie = (token: string) => `__Host-payment-session=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=86400`;

export async function boundedJson(request: Request, limit = 8192, timeoutMs = 4000): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new PaymentError(415, 'JSON is required.');
  const reader = request.body?.getReader();
  if (!reader) throw new PaymentError(400, 'Request body is required.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new PaymentError(408, 'Request body timed out.'));
      void reader.cancel().catch(() => {});
    }, timeoutMs);
  });
  try {
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      size += value.length;
      if (size > limit) { void reader.cancel().catch(() => {}); throw new PaymentError(413, 'Request is too large.'); }
      chunks.push(value);
    }
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object required');
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof PaymentError) throw error;
    throw new PaymentError(400, 'Invalid JSON request.');
  } finally { clearTimeout(timer); reader.releaseLock(); }
}

// Only the documented SHA scheme is implemented. HMAC must not be guessed.
export function authenticateWebhook(request: Request, username: string, password: string) {
  const expected = sha256(`${username}:${password}`);
  if (!equalSecret(request.headers.get('authorization') ?? '', expected)) throw new PaymentError(401, 'Webhook authentication failed.');
}
