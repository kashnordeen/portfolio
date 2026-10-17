import { randomUUID } from 'node:crypto';
import { loadConfig } from './config.ts';
import { createPhonePe, safeCheckoutUrl } from './phonepe.ts';
import { createStore } from './store.ts';
import { createJobQueue, publishPending } from './job-queue.ts';
import { logUatNotificationShape } from './webhook-diagnostics.ts';
import { PaymentError, authenticateWebhook, boundedJson, equalSecret, newSession, readSession, sessionCookie, sessionHash, sha256, uuidPattern, validateCustomer } from './security.ts';

type Route = 'config' | 'orders' | 'status' | 'webhook' | 'reconcile';
export type Runtime = { config: ReturnType<typeof loadConfig>; store: ReturnType<typeof createStore>; provider: ReturnType<typeof createPhonePe>; queue: ReturnType<typeof createJobQueue> };
let cached: Runtime | undefined;
export function paymentRuntime(): Runtime {
  if (!cached) {
    const config = loadConfig(process.env);
    cached = { config, store: createStore(config), provider: createPhonePe(config), queue: createJobQueue(config.jobConfig) };
  }
  return cached;
}

export async function handlePayment(route: Route, request: Request, getRuntime: () => Runtime = paymentRuntime): Promise<Response> {
  let cookie: string | undefined;
  const headers: Record<string, string> = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, ...(cookie ? { 'Set-Cookie': cookie } : {}) } });
  try {
    const expectedMethod = route === 'config' || route === 'status' ? 'GET' : 'POST';
    if (request.method !== expectedMethod) { headers.Allow = expectedMethod; throw new PaymentError(405, 'Method is not allowed.'); }
    if (route === 'config') {
      try {
        const { config } = getRuntime();
        if ((config.projectEnabled || config.communityEnabled) && !readSession(request)) cookie = sessionCookie(newSession());
        return reply({ projectEnabled: config.projectEnabled, communityEnabled: config.communityEnabled });
      } catch { return reply({ projectEnabled: false, communityEnabled: false }); }
    }
    const { config, store, provider, queue } = getRuntime();
    if (route === 'orders') {
      if (!config.projectEnabled && !config.communityEnabled) throw new PaymentError(503, 'Online payments are not enabled yet.');
      if (request.headers.get('origin') !== config.origin || request.headers.get('sec-fetch-site') === 'cross-site') {
        throw new PaymentError(403, 'Use the payment form on this website.');
      }
      const input = validateCustomer(await boundedJson(request), config.min, config.max);
      if (input.purpose === 'project' ? !config.projectEnabled : !config.communityEnabled) throw new PaymentError(503, 'This payment option is not enabled yet.');
      const idempotency = request.headers.get('idempotency-key') ?? '';
      if (!uuidPattern.test(idempotency)) throw new PaymentError(400, 'A valid payment request key is required.');
      const previous = readSession(request), token = previous ?? newSession();
      if (!previous) cookie = sessionCookie(token);
      const session = sessionHash(token, config.sessionSecret);
      await store.rate(`orders:global:${config.environment}`, 100, 600);
      await store.rate(`orders:email:${sessionHash(input.email, config.sessionSecret)}`, 5, 600);
      const { order, initiate, job } = await store.reserve(input, idempotency, session);
      if (!initiate) {
        if (order.state === 'PENDING' && order.checkout_url && order.expires_at && order.expires_at.getTime() > Date.now()) {
          return reply({ orderId: order.id, checkoutUrl: safeCheckoutUrl(order.checkout_url, config.checkoutHost) });
        }
        // No second /pay call, even when the first response was lost or ambiguous.
        return reply({ orderId: order.id, state: order.state, message: 'This order is being checked. Do not start another payment.' }, 409);
      }
      if (!config.jobConfig.ready || !job) throw new PaymentError(503,'Payment scheduler is not ready.');
      await publishPending(store,queue,order.id,1);
      const claimed = await store.claimCheckout(order.id,job.id);
      if (!claimed) {
        const current = await store.owned(order.id,session);
        // A job may retire before the claim. Do not trap a never-initiated checkout in verification.
        if (current.state === 'CREATED' && current.checkout_attempted_at === null &&
          current.phonepe_order_id === null && current.checkout_url === null) {
          throw new PaymentError(503,'Checkout has not started. Keep your details unchanged and retry this same request shortly.');
        }
        return reply({ orderId: current.id, state: current.state, message: 'This payment request is already being checked.' },409);
      }
      let checkoutStage: 'PROVIDER' | 'PERSISTENCE' = 'PROVIDER';
      try {
        const checkout = await provider.pay(claimed);
        checkoutStage = 'PERSISTENCE';
        await store.checkout(order.id, checkout);
        return reply({ orderId: order.id, checkoutUrl: checkout.url }, 201);
      } catch {
        try {
          console.warn(JSON.stringify({event:config.environment === 'sandbox' ? 'UAT_CHECKOUT_DEFERRED' : 'PAYMENT_CHECKOUT_DEFERRED',stage:checkoutStage}));
        } catch { /* Logging failure must not change an ambiguous payment response. */ }
        // The persisted order will be reconciled; a timeout must not imply failed payment.
        return reply({ orderId: order.id, state: 'PENDING', message: 'We could not open checkout. Your order is being checked; do not create another payment.' }, 202);
      }
    }
    if (route === 'status') {
      const id = new URL(request.url).searchParams.get('order') ?? '';
      const token = readSession(request);
      if (!uuidPattern.test(id) || !token) throw new PaymentError(404, 'Payment was not found in this browser session.');
      const session = sessionHash(token, config.sessionSecret);
      await store.rate(`status:${session}`, 30, 60);
      const order = await store.owned(id, session);
      return reply({ orderId: order.id, purpose: order.purpose, state: order.state, amountPaise: order.amount_paise, currency: 'INR', paidAt: order.paid_at?.toISOString() ?? null });
    }
    if (route === 'webhook') {
      authenticateWebhook(request, config.webhookUsername, config.webhookPassword);
      const body = await boundedJson(request, 65536);
      const payload = body.payload as Record<string, unknown> | undefined;
      const event = body.event;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
        !['checkout.order.completed', 'checkout.order.failed'].includes(String(event)) ||
        payload.state !== (event === 'checkout.order.completed' ? 'COMPLETED' : 'FAILED') ||
        typeof payload.merchantOrderId !== 'string' || !/^[A-Za-z0-9_-]{1,63}$/.test(payload.merchantOrderId) ||
        typeof payload.orderId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(payload.orderId) || !Number.isSafeInteger(payload.amount)) {
        logUatNotificationShape(body);
        throw new PaymentError(400, 'Unsupported payment notification.');
      }
      if (payload.merchantId !== config.merchantId) throw new PaymentError(401, 'Payment notification merchant does not match.');
      const digest = sha256(JSON.stringify([config.environment, config.merchantId, event, payload.merchantOrderId, payload.orderId, payload.state, payload.amount]));
      const orderId = await store.recordEvent(payload.merchantOrderId, String(event), digest);
      if (config.jobConfig.ready && orderId) {
        // The event/intent already committed. Queue failure cannot discard that durable work.
        try { await publishPending(store,queue,orderId,1); } catch { /* signed recovery resumes publication */ }
      }
      // ACK only after durable recording, without waiting on the provider or granting access.
      return reply({ received: true });
    }
    if (config.jobsEnabled) throw new PaymentError(403,'Use signed managed verification jobs.');
    if (!equalSecret(request.headers.get('authorization') ?? '', `Bearer ${config.workerSecret}`)) throw new PaymentError(401, 'Worker authentication failed.');
    const due = await store.claimDue();
    let checked = 0, deferred = 0;
    await Promise.all(due.map(async order => {
      try { await store.applyStatus(order, await provider.status(order.merchant_order_id)); checked++; }
      catch { await store.retryLater(order); deferred++; }
    }));
    await store.cleanupRates();
    return reply({ checked, deferred });
  } catch (error) {
    const status = error instanceof PaymentError ? error.status : 503;
    if (status === 429) headers['Retry-After'] = '60';
    return reply({ error: error instanceof PaymentError ? error.message : 'Payment service is temporarily unavailable.', requestId: randomUUID() }, status);
  }
}
