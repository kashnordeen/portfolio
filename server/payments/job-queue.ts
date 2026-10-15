import { Receiver } from '@upstash/qstash';
import type { JobConfig } from './job-config.ts';
import { PaymentError, uuidPattern } from './security.ts';

// Structural boundary shared with the durable store. No customer fields belong here.
export type PaymentJob = { id: string; orderId: string; environment: 'production' | 'sandbox'; generation: number; dueAt: Date };
export async function readJobBody(body: ReadableStream<Uint8Array> | null): Promise<string> {
  if (!body) throw new PaymentError(400, 'Invalid scheduler request.');
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => { void reader.cancel().catch(() => {}); reject(new PaymentError(408, 'Scheduler request timed out.')); }, 4000);
  });
  try {
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      length += value.byteLength;
      if (length > 1024) throw new PaymentError(413, 'Scheduler request is too large.');
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function createJobQueue(config: JobConfig, { send = fetch }: { send?: typeof fetch } = {}) {
  const receiver = config.ready ? new Receiver({ currentSigningKey: config.currentSigningKey, nextSigningKey: config.nextSigningKey }) : null;
  return {
    async publish(job: PaymentJob): Promise<{ messageId: string }> {
      if (!config.ready) throw new PaymentError(503, 'Payment scheduler is not enabled.');
      try {
        if (!uuidPattern.test(job.id) || job.environment !== config.environment || !Number.isSafeInteger(job.generation) ||
          job.generation < 1 || !Number.isFinite(job.dueAt.getTime())) throw new Error('invalid job');
        const response = await send(`https://qstash.upstash.io/v2/publish/${config.jobUrl}`, {
          method: 'POST', redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(8000),
          headers: { Authorization: `Bearer ${config.publishToken}`, 'Content-Type': 'application/json',
            'Upstash-Deduplication-Id': job.id, 'Upstash-Not-Before': String(Math.ceil(job.dueAt.getTime() / 1000)),
            'Upstash-Retries': '3', 'Upstash-Timeout': '60s' },
          body: JSON.stringify({ jobId: job.id }),
        });
        if (!response.ok || response.redirected || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
          void response.body?.cancel().catch(() => {});
          throw new Error('invalid receipt');
        }
        const receipt = JSON.parse(await readJobBody(response.body));
        if (!receipt || typeof receipt.messageId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(receipt.messageId)) throw new Error('invalid receipt');
        return { messageId: receipt.messageId };
      } catch { throw new PaymentError(503, 'Payment scheduler is temporarily unavailable.'); }
    },
    async verify(request: Request, target: 'job' | 'recovery'): Promise<string> {
      if (!config.ready || !receiver) throw new PaymentError(503, 'Payment scheduler is not enabled.');
      const url = target === 'job' ? config.jobUrl : config.recoveryUrl;
      const signature = request.headers.get('upstash-signature') ?? '';
      if (request.method !== 'POST' || request.url !== url || signature.length > 4096 || !signature ||
        !/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '') ||
        Number(request.headers.get('content-length') ?? '0') > 1024) throw new PaymentError(401, 'Invalid scheduler request.');
      try {
        const body = await readJobBody(request.body);
        if (!await receiver.verify({ signature, body, url, clockTolerance: 0 })) throw new Error('invalid signature');
        return body;
      } catch { throw new PaymentError(401, 'Invalid scheduler request.'); }
    },
  };
}

type PublicationStore = {
  hasUnpublished(orderId: string | null): Promise<boolean>;
  pendingJobs(orderId: string | null, limit: number): Promise<PaymentJob[]>;
  published(jobId: string, messageId: string): Promise<void>;
  publicationFailed(jobId: string): Promise<void>;
};
export async function publishPending(store: PublicationStore, queue: Pick<ReturnType<typeof createJobQueue>, 'publish'>,
  orderId: string | null, limit = 3): Promise<number> {
  let published = 0;
  for (const job of await store.pendingJobs(orderId,Math.max(0,Math.min(limit,3)))) {
    try {
      const receipt = await queue.publish(job);
      await store.published(job.id,receipt.messageId);
      published++;
    } catch {
      await store.publicationFailed(job.id);
      throw new PaymentError(503,'Payment scheduler is temporarily unavailable.');
    }
  }
  if (await store.hasUnpublished(orderId)) throw new PaymentError(503,'Verification publication is pending.');
  return published;
}
