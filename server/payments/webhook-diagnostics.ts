import { sandboxTarget } from './targets.ts';

function disabledUat(env: Record<string, string | undefined>) {
  return env.PHONEPE_ENV === 'sandbox' &&
    env.VERCEL_ENV === 'production' && env.VERCEL_PROJECT_ID === sandboxTarget.projectId &&
    env.PAYMENT_SITE_ORIGIN === sandboxTarget.origin &&
    ['PAYMENTS_ENABLED','PAYMENT_RELEASE_APPROVED','COMMUNITY_PAYMENTS_ENABLED','PAYMENT_JOBS_ENABLED']
      .every(key => env[key] === 'false');
}

function diagnosticsEnabled(env: Record<string, string | undefined>) {
  return env.PAYMENT_UAT_DIAGNOSTICS === 'true' && disabledUat(env);
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

function emptyData(value: unknown) {
  return value === null || (plainObject(value) && Object.keys(value).length === 0) ||
    (Array.isArray(value) && value.length === 0);
}

// Connectivity-only setup probe, never a payment event or an activation bypass.
// Handler must authenticate and bounded-parse before calling this predicate.
export function isDisabledUatValidationProbe(body: unknown,
  env: Record<string, string | undefined> = process.env) {
  if (env.PAYMENT_UAT_VALIDATION_PROBE !== 'true' || !disabledUat(env) || !plainObject(body)) return false;
  const keys=Object.keys(body);
  if (keys.length === 0) return true;
  return keys.length === 2 && Object.hasOwn(body,'message') && Object.hasOwn(body,'data') &&
    typeof body.message === 'string' && body.message.trim().length > 0 && body.message.length <= 512 && emptyData(body.data);
}

// Call only after authentication and bounded parsing. Never emit actual field values.
export function logUatNotificationShape(body: Record<string, unknown>,
  env: Record<string, string | undefined> = process.env, log: (entry: string) => void = console.info) {
  if (!diagnosticsEnabled(env)) return;
  const payloadObject = !!body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload);
  const payload = payloadObject ? body.payload as Record<string, unknown> : {};
  const eventClass = body.event === undefined ? 'MISSING' : new Map([
    ['checkout.order.completed','CHECKOUT_COMPLETED'],['checkout.order.failed','CHECKOUT_FAILED'],
    ['pg.order.completed','LEGACY_COMPLETED'],['pg.order.failed','LEGACY_FAILED'],
  ]).get(typeof body.event === 'string' ? body.event : '') ?? 'OTHER';
  try {
    log(JSON.stringify({ event:'UAT_WEBHOOK_SHAPE',eventClass,payloadObject,
      emptyObject:Object.keys(body).length === 0,
      hasMessage:Object.hasOwn(body,'message'),hasTest:Object.hasOwn(body,'test'),
      hasData:Object.hasOwn(body,'data'),hasResponse:Object.hasOwn(body,'response'),
      hasCallback:Object.hasOwn(body,'callback'),hasBody:Object.hasOwn(body,'body'),
      hasTestCallback:Object.hasOwn(body,'testCallback'),hasEventType:Object.hasOwn(body,'eventType'),
      hasTestWebhook:Object.hasOwn(body,'testWebhook'),hasIsTest:Object.hasOwn(body,'isTest'),
      messageIsString:typeof body.message === 'string',dataIsNull:body.data === null,
      dataIsEmpty:emptyData(body.data),rootIsMessageDataOnly:Object.keys(body).length === 2 &&
        Object.hasOwn(body,'message') && Object.hasOwn(body,'data'),
      stateMatchesEvent:(body.event === 'checkout.order.completed' && payload.state === 'COMPLETED') ||
        (body.event === 'checkout.order.failed' && payload.state === 'FAILED'),
      merchantOrderIdValid:typeof payload.merchantOrderId === 'string' && /^[A-Za-z0-9_-]{1,63}$/.test(payload.merchantOrderId),
      orderIdValid:typeof payload.orderId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(payload.orderId),
      amountSafeInteger:Number.isSafeInteger(payload.amount),amountIsString:typeof payload.amount === 'string',
      merchantIdPresent:typeof payload.merchantId === 'string' && payload.merchantId.length > 0,
      legacyTypeRecognized:typeof body.type === 'string' &&
        ['PG_ORDER_COMPLETED','PG_ORDER_FAILED','CHECKOUT_ORDER_COMPLETED','CHECKOUT_ORDER_FAILED'].includes(body.type),
    }));
  } catch { /* Diagnostics must never alter webhook handling. */ }
}

// Temporary, opt-in diagnostics for the disabled, isolated UAT project only.
// Never emit a request URL, header value, credential/hash, payload or raw error.
export async function diagnoseUatWebhook(request: Request, run: () => Promise<Response>,
  env: Record<string, string | undefined> = process.env, log: (entry: string) => void = console.info) {
  if (!diagnosticsEnabled(env)) return run();
  const authorization = request.headers.get('authorization') ?? '';
  const headerKind = !authorization ? 'MISSING' : /^[a-fA-F0-9]{64}$/.test(authorization) ? 'SHA256' :
    /^Bearer /i.test(authorization) ? 'BEARER' : /^Basic /i.test(authorization) ? 'BASIC' : 'OTHER';
  const emit = (code: string, status: number) => {
    try { log(JSON.stringify({ event:'UAT_WEBHOOK_DIAGNOSTIC', code, status, headerKind })); }
    catch { /* Diagnostics must never alter webhook handling. */ }
  };
  let response: Response;
  try { response = await run(); }
  catch (error) { emit('HANDLER_THROWN',503); throw error; }
  let code = response.ok ? 'ACCEPTED' : 'OTHER_REJECTION';
  try {
    const body = await response.clone().json();
    if (response.ok && body.received === true && body.validationOnly === true) code = 'VALIDATION_PROBE';
    const reasons = new Map([
      ['Webhook authentication failed.','AUTHENTICATION_FAILED'],
      ['Payment notification merchant does not match.','MERCHANT_MISMATCH'],
      ['Unsupported payment notification.','UNSUPPORTED_NOTIFICATION'],
      ['Payment service is not configured.','CONFIGURATION_FAILED'],
      ['Payment service is temporarily unavailable.','SERVICE_UNAVAILABLE'],
      ['Method is not allowed.','METHOD_REJECTED'],
    ]);
    if (!response.ok && typeof body.error === 'string') code = reasons.get(body.error) ?? 'OTHER_REJECTION';
  } catch { /* Only fixed categories, never an arbitrary body/error. */ }
  emit(code,response.status);
  return response;
}
