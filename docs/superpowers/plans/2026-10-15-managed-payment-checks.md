# Managed Payment Checks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Execution result: all five tasks locally committed; independent whole-branch review and one verified
Important recovery fix completed. Final 123/123 tests, lint, types and build passed. The original steps below
remain the approved plan; durable decisions/evidence are in `docs/managed-payment-execution-notes.md`.
Subsequently fast-forwarded into local main on 2026-10-15; merged-result verification passed all the same
gates. No push, deployment, external migration or activation occurred.

**Goal:** Replace the need for a standalone reconciliation process with durable signed QStash jobs, without enabling payments or deploying anything.

**Architecture:** Vercel handles checkout, webhook recording and provider verification; Supabase owns immutable orders, job generations and leases. QStash transports only opaque job IDs and a signed recovery heartbeat. Durable database intents survive the non-atomic database/queue boundary.

**Tech Stack:** Existing Node 24/TypeScript/native Request handlers, postgres 3.4.9, official pinned @upstash/qstash SDK, node:test and development-only PGlite.

**Spec:** `docs/superpowers/specs/2026-10-15-managed-payment-checks-design.md`

## Global Constraints

- Local code, dependency installation and migration/test drafts only; no Git push, deployment, external migration, queue publishing, schedule creation, account provisioning, secret rotation, paid resource or payment activation.
- Project payments stay INR 200–50,000; community remains disabled. Existing three checkout flags remain false in templates and live settings.
- No pg_net, Cron or Vault changes; no retry/bypass of the rejected privilege changes. Do not activate the prior Node worker.
- Production-only queue target is `https://kkarn.vercel.app`; UAT requires a separately approved fixed endpoint and independent keys. Never send live secrets to Preview.
- QStash payload is only `{ jobId: UUID }`; recovery payload is `{}`. No customer data, amounts, payment/database secrets or forwarded bearer headers.
- Preserve single /pay initiation, immutable order terms, session ownership, provider amount/reference checks, monotonic completed state and unique fulfilment outbox.
- First check 25 seconds after recorded initiation, then every 3/6/10/30 seconds through ages 55/115/175/235 seconds, then every minute until terminal/expiry. Expiry/uncertainty is REVIEW, never presumed FAILED.
- Use bounded requests, verified TLS, no redirects, official SDK signature verification, generic errors and no credential/body/header logging.
- Recovery is every five minutes, bounded to three intents per call. It is outage recovery, not normal deadline compliance. Free-tier quota is not a production capacity guarantee.
- Preserve unrelated `presentation/` files. Update status/changelog and commit each tested slice locally.

## Review Focus

1. Publish succeeds but its response is lost: stable job identity and durable replay must not charge twice (Tasks 1–3).
2. Old/early delivery races checkout claim or newer webhook generation: do not query an unattempted order or lose successor publication (Tasks 2, 4).
3. Provider status commits but successor publish fails: redelivery must flush the committed successor instead of repeating or dropping work (Tasks 2, 4).
4. Signature is valid but replayed, wrong-environment or stale: database binding and leases still enforce authorization/idempotency (Task 4).
5. Queue quota/transport loss while browser is closed: preserve intents, reject new checkout, recover boundedly and expose an operational failure rather than false success (Tasks 3–5).

## File Responsibilities

- `server/payments/job-config.ts`: disabled-by-default, fixed-origin queue configuration.
- `server/payments/job-queue.ts`: bounded SDK publication and raw-body signature verification only.
- `database/payment-jobs.sql`, `database/verify-payment-jobs.sql`: local private schema migration and rollback-only verification.
- `server/payments/job-store.ts`: job type definitions and transaction helpers bound to the existing SQL client; no second pool or administrative login.
- `server/payments/store.ts`: compose helpers into existing order/webhook/status transactions and retain existing exports.
- `server/payments/handler.ts`: checkout/webhook queue orchestration; existing public response shape retained.
- `server/payments/job-handler.ts`: signed job/recovery handlers and authenticated runtime construction.
- `api/payments/jobs.ts`, `api/payments/recover.ts`: thin native fetch routes only.
- New `tests/payment-job-*.test.mjs`: adapter, database and orchestration coverage; existing handler/security fixtures updated explicitly.
- `.env.example`, payment setup docs and changelog: disabled configuration and honest readiness handoff.

## Shared Types and Interfaces

Define in `job-store.ts` and consume unchanged across tasks:

```ts
type PaymentJob = { id: string; orderId: string; environment: 'production' | 'sandbox'; generation: number; dueAt: Date };
type JobClaim = { kind: 'READY'; job: PaymentJob; order: Order; leaseId: string }
  | { kind: 'EARLY' | 'STALE' | 'LEASED' | 'UNATTEMPTED' | 'TERMINAL'; orderId: string | null };
type JobResult = { state: 'ACK' | 'RETRY'; published: number };
```

`Order` remains the existing export in `store.ts`. It gains checkout-attempt/reconciliation timestamp fields when needed, without changing immutable terms.

### Task 1: Queue Configuration and Signed Transport

**Files:** Create `job-config.ts`, `job-queue.ts`, `tests/payment-job-queue.test.mjs`; modify package manifests and `.env.example`.

**Interfaces:** `loadJobConfig(env): JobConfig` returns `{ enabled, ready, publishToken, currentSigningKey, nextSigningKey, jobUrl, recoveryUrl }` (secrets optional while off). `createJobQueue(config, dependencies?)` returns `publish(job: PaymentJob): Promise<{ messageId: string }>` and `verify(request: Request, target: 'job' | 'recovery'): Promise<string>` (verified bounded raw body). Dependencies allow SDK client/receiver injection for offline tests.

- [ ] Write failing tests named `disabled adapter never publishes`, `SDK verifies original raw body and fixed URL`, `tampered expired wrong URL and oversized signatures fail before storage`, and `ambiguous publish uses stable deduplication identity`.
  Assert `publishCalls === 0` while disabled; published body equals `{jobId: job.id}`; deduplication ID equals `job.id`; not-before is `ceil(job.dueAt/1000)`; errors contain no supplied fixture secret.
- [ ] Run `node --test tests/payment-job-queue.test.mjs`; expect missing-module/interface failures.
- [ ] Resolve current official SDK API/version through Context7 and npm metadata; pin that exact audited version with install scripts disabled. Implement the two interfaces with SDK Receiver, 1 KiB inbound limit, eight-second publisher deadline and no redirects. Do not confuse the destination execution timeout with the publisher request deadline. Fail closed on unsupported transport controls rather than assume they exist.
- [ ] Keep `PAYMENT_JOBS_ENABLED=false`, with empty QSTASH_TOKEN/CURRENT_SIGNING_KEY/NEXT_SIGNING_KEY. Production configuration requires VERCEL_ENV=production and fixed kkarn origin. Do not invent a live sandbox origin; injected fixtures may test alternate URLs without adding an environment-controlled arbitrary target.
- [ ] Run the test file, TypeScript checks and `npm audit`; expect PASS/no known vulnerabilities. Review SDK transitive changes and commit `feat: add disabled signed payment job transport`.

### Task 2: Durable Intents and Database Transitions

**Files:** Create `payment-jobs.sql`, `verify-payment-jobs.sql`, `job-store.ts`, `tests/payment-job-store.test.mjs`; modify `store.ts`.

**Interfaces:** Helpers bind to the existing SQL transaction client. Extend the returned store with `pendingJobs(orderId: string | null, limit: number): Promise<PaymentJob[]>`, `published(jobId: string, messageId: string): Promise<void>`, `claimCheckout(orderId: string, initialJobId: string): Promise<Order | null>`, `claimJob(jobId: string): Promise<JobClaim>`, and `finishJob(jobId: string, leaseId: string, status: ProviderStatus | null): Promise<void>` (null means provider uncertainty). Existing `reserve` additionally returns `job: PaymentJob | null` and no longer claims /pay before scheduler acceptance. Existing `recordEvent`, `applyStatus` and `retryLater` save required successor intents in their own transactions.

- [ ] Write failing database tests: `one initial intent per reservation`, `unique order generation`, `browser roles denied`, `immutable job binding`, `duplicate checkout claim rejected`, `old lease cannot finish`, `status plus successor rollback together`, `early or stale job does not query provider`, and `never-attempted job cannot race a later checkout claim`.
  Assert one /pay claim per order; one current generation per order; terminal success never downgrades; next due interval at ages 54/55/114/115/174/175/234/235 equals 3/6/6/10/10/30/30/60 seconds.
- [ ] Run `node --test tests/payment-job-store.test.mjs`; expect missing migration/helpers failures.
- [ ] Add private `reconciliation_jobs` rows with UUID PK, order FK, immutable environment/generation/due time, publication receipt/lease metadata and processing state; unique `(order_id,generation)`, RLS, backend-only policy, no PUBLIC/anon/authenticated/service_role grants. Add a current generation field to orders, checked/incremented under order row lock. Never delete financial orders or reassign bindings.
- [ ] Implement transactional transitions: reservation plus intent; publication receipt tracking; single checkout claim only after initial acceptance; current-generation job/order lease (90 seconds); status/REVIEW plus successor intent; webhook plus immediate generation; stale replay flushes current pending publication. Earlier due-time changes create a fresh ID rather than deduplicating a needed reschedule. An unattempted job may retire the initial intent only atomically against checkout claim; a retired initial intent can never authorize /pay.
- [ ] Reuse existing status validation and age-based delays anchored to `checkout_attempted_at` for attempted orders, not time spent waiting for scheduler readiness. Enforce stored expiry as REVIEW if still uncertain; do not accidentally leave REVIEW on an active retry chain.
- [ ] Run local PGlite migration/constraint/role/transaction scenarios with synthetic fixtures and rollback. Exercise actual SQL transitions, not a separate reimplementation in test code; make query helpers injectable if required. Record that embedded PG18 does not prove PG17 multi-session behavior. Do not apply to Supabase.
- [ ] Run full tests/types/lint and commit `feat: persist leased payment verification intents`.

### Task 3: Checkout and Webhook Queue Integration

**Files:** Modify `config.ts`, `handler.ts`, `tests/payment-handler.test.mjs`, `tests/payment-security.test.mjs`; create `tests/payment-job-checkout.test.mjs`.

**Interfaces:** Runtime gains `queue: ReturnType<typeof createJobQueue>` and queue config. Export `publishPending(store, queue, orderId: string | null, limit = 3): Promise<number>` from `job-queue.ts`; it publishes store.pendingJobs then records receipts, preserving stable IDs after ambiguous errors. Consumes all Task 1/2 interfaces. Existing response JSON remains compatible with `payment-client.ts`.

- [ ] Write failing tests `missing queue readiness disables advertised checkout`, `queue refusal never reaches pay`, `reserve then accepted publication then atomic claim then pay`, `lost publish ACK preserves intent with no charge`, `checkout timeout never reinitiates`, and `webhook commit survives queue outage`.
  Assert call ordering `reserve < publish < claimCheckout < pay`; publish failure means pay count zero; repeated request pay count at most one; webhook returns success only after event/intent commit and never calls applyStatus directly.
- [ ] Run `node --test tests/payment-job-checkout.test.mjs`; expect missing runtime/orchestration failures.
- [ ] Gate advertised checkout on queue configuration plus existing checkout flags. Reserve/publish/claim in order, preserving session/idempotency protections. Provider ambiguity stays PENDING; no automatic second /pay. A failed initial scheduler publish cannot be described as a failed bank payment. Signed job readiness remains independent of disabling new checkout after launch.
- [ ] Commit a validated webhook and successor intent before publication. Best-effort immediate publication may fail without losing work; durable recovery owns the backlog. No background fire-and-forget promise after a serverless response.
- [ ] Update existing fixtures with explicitly injected fake queues and enabled test configuration; retain all prior assertions. Run full tests/types/lint and commit `feat: connect checkout and webhooks to durable verification jobs`.

### Task 4: Signed Job Execution and Recovery

**Files:** Create `job-handler.ts`, `jobs.ts`, `recover.ts`, `tests/payment-job-handler.test.mjs`; modify store/adapter only where the defined contracts require it.

**Interfaces:** `handleJob(request: Request, getRuntime?): Promise<Response>` and `handleRecovery(request: Request, getRuntime?): Promise<Response>`. Both consume the same injected runtime (config/store/provider/queue) as Task 3. `runJob(jobId: string, runtime): Promise<JobResult>` implements the signed job state machine; endpoint routes verify signatures/raw body before invoking it.

- [ ] Write failing tests `signature rejected before any DB/provider work`, `signed replay stale wrong environment does no status write`, `provider status verified with amount mismatch REVIEW`, `lease overlap defers safely`, `early job creates fresh due generation`, `commit then publish failure retries only publication`, and `recovery repairs accepted-but-lost and unpublished jobs without browser input`.
  Assert malicious signed amounts/order references are rejected as extra payload fields; only jobId is accepted; /pay count always zero on either endpoint; retry result is non-2xx; ACK is 200 only after required successor publication; completed order yields no successor; at most three recovered intents per call.
- [ ] Run `node --test tests/payment-job-handler.test.mjs`; expect missing handlers failures.
- [ ] Implement method/content-length/body/signature validation and server-owned job lookup. Claim a current, due, attempted order; READY invokes provider.status once and transactionally finishes. EARLY/STALE/TERMINAL/UNATTEMPTED flush any required current publication without a stale provider lookup; LEASED returns retryable response. Never turn a verified-but-replayed signature into repeated /pay or multiple fulfilments.
- [ ] Implement recovery of unpublished rows, overdue accepted messages and expired leases using fixed bounded queries/DB ordering. A recovery republish uses the same unfinished job identity; a real due-time/generation change uses a new one. Add durable retry/backoff metadata so repeated recoveries cannot create an unlimited hot retry loop. Failure/overdue state must be observable through generic logs and backlog/REVIEW queries, without raw provider errors or headers.
- [ ] Disable the old bearer reconcile route when managed jobs are selected to prevent two independent schedulers; preserve the disabled Node candidate files. Thin routes expose only the two new signed functions. Run all tests/types/lint and commit `feat: process signed payment jobs with durable recovery`.

### Task 5: Regression Gate and Private Setup Handoff

**Files:** Update `.env.example`, `docs/phonepe-integration.md`, `docs/payment-worker.md`, `docs/isolated-payment-worker.md`, `CHANGELOG.md`; create `docs/managed-payment-jobs.md`. Add missing acceptance tests to the owning test files above, not a separate test-only shadow implementation.

**Interfaces:** No new public API. Consumes Tasks 1–4 and documents their exact variables, fixed endpoints and disabled state.

- [ ] Add regression assertions `all templates stay disabled`, `no queue payload contains customer/payment credentials`, and `recovery quota loss leaves durable work, not paid state`. Scan changed source/diffs for accidentally logged secrets and preserve unrelated files.
- [ ] Run `node --test tests/*.test.mjs`, ESLint, `tsc -b`, Vite build and fresh online `npm audit`; expect all PASS/zero known findings. Verify no live API call, secret lookup or queue publication occurred. Review the whole change for spec compliance and remaining release blockers.
- [ ] Write a short grouped handoff: private Upstash sign-in; confirm account plan/quota; server-only secret entry; separately approved DB migration/rollback checks; disabled backend deployment; signed job/recovery delivery; PhonePe SHA webhook registration; target PG17/TLS/concurrency/crash and PhonePe UAT. Owner must explicitly approve each external mutation category; no real secrets in code, screenshots, chat or tool output.
- [ ] Document a five-minute recovery schedule proposal only—do not create it. Include 288 daily heartbeat deliveries plus order checks/retries, no free-tier/SLA promise, quota/lateness/paused-backlog alerts and independent new-checkout vs job-execution gates.
- [ ] State no launch readiness from mocked tests. No production activation until sandbox/provider-approved UAT, fixed UAT target/keys, real transport/driver tests and capacity review. Community benefits/refund/access delivery remain undefined and disabled.
- [ ] Commit `docs: record managed payment job readiness and private handoff`. Report local completion separately from the remaining account/deployment/UAT work.

## Self-Review and Execution Handoff

- [x] Spec coverage mapped to the five tasks, including durable publish recovery, permissions, secrets, timing and external gates.
- [x] Task interfaces and owning files are explicit; no second database pool or public credential endpoint.
- [x] Review Focus failures have named assertions in their owning task.
- [x] Local and real-platform verification are distinguished; no approval inferred for external writes.
- [x] Human plan review and execution-method selection: owner approved Native execution and an isolated worktree on 2026-10-15. Independent final review is required before external setup.
- [x] Execution began after the above review using executing-plans; no implementation was performed while writing this plan. Progress and review rulings are recorded in the plan-scoped execution ledger.
