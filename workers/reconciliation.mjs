// Hosting-neutral preparation. Importing this module never starts a worker.
export const ENDPOINT = 'https://kkarn.vercel.app/api/payments/reconcile';
const BACKOFF = [3000, 6000, 10000, 30000];

export function workerConfig(env) {
  if (env.RECONCILIATION_WORKER_ENABLED !== 'true' ||
      env.RECONCILIATION_WORKER_RELEASE_APPROVED !== 'true') return { enabled: false };
  const secret = env.PAYMENT_RECONCILIATION_SECRET;
  if (env.RECONCILIATION_WORKER_ENV !== 'production' || env.NODE_TLS_REJECT_UNAUTHORIZED === '0' ||
      typeof secret !== 'string' || !/^[\x21-\x7e]{32,256}$/.test(secret)) {
    throw new Error('WORKER_CONFIGURATION_INVALID');
  }
  return { enabled: true, secret };
}

async function responseCounters(response) {
  if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '') || !response.body) {
    throw new Error('INVALID_RESPONSE');
  }
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 1024) throw new Error('INVALID_RESPONSE');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!data || Array.isArray(data) || Object.keys(data).sort().join(',') !== 'checked,deferred' ||
      !Number.isInteger(data.checked) || !Number.isInteger(data.deferred) ||
      data.checked < 0 || data.deferred < 0 || data.checked + data.deferred > 3) {
    throw new Error('INVALID_RESPONSE');
  }
  return data;
}

// The host supplies durable pause storage. No provider/database credentials are needed.
export function createDispatcher(config, { fetchImpl = fetch, persistPause, timeoutMs = 45000 }) {
  let busy = false, failures = 0, paused = false;
  async function pause(reason) {
    paused = true;
    await persistPause(reason); // Failure must stop the runner, not silently restart it.
    return { state: 'PAUSED', reason };
  }
  async function transient() {
    failures++;
    return failures >= 5 ? pause('REPEATED_FAILURE') : { state: 'BACKOFF', delayMs: BACKOFF[failures - 1] };
  }
  return {
    async tick(signal) {
      if (!config.enabled) return { state: 'DISABLED' };
      if (paused) return { state: 'PAUSED' };
      if (busy) return { state: 'IN_FLIGHT' };
      if (signal?.aborted) return { state: 'STOPPED' };
      busy = true;
      let response;
      try {
        try {
          response = await fetchImpl(ENDPOINT, {
            method: 'POST', redirect: 'manual', credentials: 'omit', cache: 'no-store',
            headers: { Authorization: `Bearer ${config.secret}`, 'Content-Type': 'application/json', Accept: 'application/json' },
            body: '{}', signal: AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])]),
          });
        } catch {
          return signal?.aborted ? { state: 'STOPPED' } : await transient();
        }
        if (response.status === 429 || response.status >= 500) return await transient();
        if (response.status === 401 || response.status === 403) return await pause('AUTHENTICATION_FAILED');
        if (response.redirected || response.status !== 200) return await pause('ENDPOINT_REJECTED');
        let counters;
        try { counters = await responseCounters(response); }
        catch { return signal?.aborted ? { state: 'STOPPED' } : await pause('INVALID_RESPONSE'); }
        failures = 0;
        return { state: 'HEALTHY', ...counters, delayMs: 1000 };
      } finally {
        await response?.body?.cancel().catch(() => {});
        busy = false;
      }
    },
  };
}
