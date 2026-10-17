import { gmailAlertCredentials } from './alert-settings.ts';
import { readJobBody } from './job-queue.ts';

const owner = 'kash.nordeen@gmail.com';
const sendScope = 'https://www.googleapis.com/auth/gmail.send';

async function providerJson(response: Response) {
  if (response.status !== 200 || response.redirected ||
    !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
    void response.body?.cancel().catch(() => {});
    throw new Error('alert provider rejected request');
  }
  const value: unknown = JSON.parse(await readJobBody(response.body, 8192));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid alert response');
  return value as Record<string, unknown>;
}

// Only called after the existing QStash signature and failure-category checks.
// No inbox access, attachments, HTTP-controlled recipients or provider fallback.
export async function sendGmailAlert(env: Record<string, string | undefined>, category: string, hour: string, send: typeof fetch) {
  const credentials = gmailAlertCredentials(env);
  if (!credentials || !['VERIFICATION_DELIVERY_EXHAUSTED', 'RECOVERY_DELIVERY_EXHAUSTED'].includes(category) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:00:00\.000Z$/.test(hour) || new Date(hour).toISOString() !== hour) {
    throw new Error('invalid Gmail alert configuration');
  }
  const token = await providerJson(await send('https://oauth2.googleapis.com/token', {
    method: 'POST', redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(6000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: credentials.clientId,
      client_secret: credentials.clientSecret, refresh_token: credentials.refreshToken }).toString(),
  }));
  // Refuse a token with inbox access or any other broader scope. Never log token responses.
  if (token.scope !== sendScope || token.token_type !== 'Bearer' || !Number.isInteger(token.expires_in) ||
    Number(token.expires_in) < 30 || Number(token.expires_in) > 86400 || typeof token.access_token !== 'string' ||
    !/^[A-Za-z0-9._~+/-]{16,4096}={0,2}$/.test(token.access_token)) throw new Error('invalid Gmail token');
  const message = [
    `From: Portfolio Payments <${owner}>`, `To: ${owner}`,
    `Date: ${new Date(hour).toUTCString()}`,
    'Subject: [Portfolio LIVE] Payment verification delivery needs attention',
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: 7bit', '',
    `Category: ${category}`, `UTC alert window: ${hour}`,
    'At least one delivery exhausted its retries. Check the LIVE QStash logs and dead-letter queue.',
    'Repeated notifications are possible. This is not a payment confirmation.', '',
  ].join('\r\n');
  // Target a fixed mailbox, not "me", so a token for a different account is rejected by Google.
  // Gmail provides no Resend-style idempotency key. Do not retry an ambiguous send in-process.
  const receipt = await providerJson(await send(`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(owner)}/messages/send`, {
    method: 'POST', redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(6000),
    headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ raw: Buffer.from(message, 'utf8').toString('base64url') }),
  }));
  if (typeof receipt.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(receipt.id)) throw new Error('invalid Gmail receipt');
}
