# Managed payment checks — approved for local implementation

Fresh builder review completed: nothing important left. The owner's 2026-10-15 request to
continue after the design-approval question authorizes the local scope below. No external actions approved.

## Intent and recommendation

Make the portfolio's PhonePe integration reliable without asking its owner to operate a server.
Keep the existing Vite/React portfolio, Vercel functions and restricted Supabase database.
Use Upstash QStash for delayed, signed HTTP jobs; Vercel performs the actual PhonePe status checks.
This is the assistant's recommended implementation choice, now approved for the local scope only.
One capability is in scope: durable payment-status reconciliation and its recovery path.

## Owner requirements and current constraints

- Secure customer-entered project payments, INR 200–50,000; community remains disabled until its terms exist.
- Owner wants the technical work handled with minimal decisions and no unnecessary server maintenance.
- Deployment is explicitly declined. No push, deployment, resource creation, secret rotation or activation
  is authorized by this design. Never perform a real payment without separate approval.
- Only production PhonePe credentials exist; sandbox/provider-approved UAT remains a release blocker.
- Existing database orders, events, leases, immutable terms and completion/outbox protection must be preserved.
- Do not retry or bypass the rejected Supabase extension/scheduler installation. No pg_net/Cron/Vault changes.
- The standalone Node worker stays disabled and unused; preserve its files as a prior candidate, not two active schedulers.

## Proposed behavior

1. Saving a new order also saves its initial verification intent in the same database transaction.
   The intended first check is 25 seconds after checkout initiation. A committed intent exists before any
   PhonePe charge initiation, so a crash cannot leave a payment with no recorded verification work.
2. Before calling PhonePe /pay, verify scheduler configuration and obtain QStash acceptance of the initial job.
   On unavailable/ambiguous publish, do not initiate a payment or automatically repeat /pay. Preserve the intent
   and return an honest unavailable/pending response. Checkout initiation is claimed atomically once only
   after scheduler acceptance; duplicate submissions cannot create a second provider request.
   Jobs must not query a never-attempted order as though a payment occurred. Adjust the first due time from
   the actual initiation claim and republish the same durable intent if necessary; early jobs reschedule,
   never charge. A changed due time uses a fresh generation/job ID; stable deduplication IDs apply only
   to retries of the same generation, not rescheduling it. Stale deliveries must flush any unpublished
   successor before ACK, without doing a stale provider lookup. The builder chooses the small schema
   and state transitions to enforce this sequence.
3. PhonePe webhooks retain existing SHA/merchant/event validation and durable recording. In that same
   transaction, request immediate verification without trusting the notification alone as payment proof.
   Publish after commit; a queue outage must not discard the recorded notification.
4. A signed QStash job verifies exactly its intended order through the existing backend status adapter.
   Claims use database leases and immutable amounts/provider IDs. No callback itself can mark an order paid.
5. For PENDING, persist the next intent transactionally with the status update and publish the next delayed
   job. Use PhonePe's documented age-based phases: first check 20–25 seconds, then 3/6/10/30-second
   intervals for the next 30/60/60/60 seconds respectively, then every minute to terminal status/expiry.
   With the first check at age 25 seconds, phase boundaries are ages 55/115/175/235 seconds.
   On expiry/API uncertainty use REVIEW, never assume FAILED. A later verified success is monotonic.
6. ACK a job only after its durable state transition and accepted publication of required successor work.
   If publication fails, return a retryable error. On redelivery, resume any pending successor publication
   rather than repeating the payment operation or skipping recovery because the prior step is already recorded.
7. Use one signed QStash recovery schedule every five minutes to flush unpublished intents and recover
   overdue/lost deliveries or expired leases. It processes bounded batches and persists progress; duplicate
   recovery attempts share the same job identity and lease rules. This is outage recovery, not a replacement
   for the seconds-level normal checks. Alert on lateness and stop accepting new checkout when queue
   readiness is lost. Never depend on the customer's browser to keep reconciliation alive.

## Durable interface and security contract

- Proposed endpoint: POST `https://kkarn.vercel.app/api/payments/jobs`; recovery uses a distinct fixed
  endpoint. Exact route filenames and internal helper names are left to the builder.
- Job body contains only a server-generated opaque `jobId` UUID. The database maps it to order,
  environment, generation and intended due time. Never put customer name/email, amount, project reference,
  PhonePe keys, database credentials or a forwarded reconciliation bearer into QStash messages.
- Use the official QStash SDK Receiver for current/next signing keys. Verify the bounded raw body,
  issuer, fixed public destination URL and validity window before parsing or accessing storage.
  Signed does not mean one-time: database job/generation/lease checks prevent harmful replays.
- A unique durable identity per order/generation and a stable publisher deduplication ID handle
  ambiguous publishes. QStash's ten-minute deduplication window is not the financial correctness mechanism.
- New private job/outbox data has RLS and grants only to the existing restricted backend role;
  browser/PUBLIC/service_role gains no payment data access. No administrative database credential.
- Target URLs, environment, due times and job-to-order bindings are server-owned. Production queues
  never invoke Preview, arbitrary hosts or a sandbox merchant. Define a separate fixed UAT target/keys
  before sandbox testing; no production credentials copied to previews or the test queue.
- Enforce body/time/batch limits, verified TLS, no redirects, redacted errors, and rate/concurrency limits.
  Failure callbacks/logs contain only generic state and opaque IDs, not raw headers or provider bodies.
- Queue execution gates are independent of new-checkout gates: after launch, disabling new checkout
  must not abandon previously initiated payments. Missing scheduler config fails closed before /pay.

## Cost and account boundary

Assumption/default: zero paid upgrades until explicitly approved. Provision nothing in this phase.
QStash currently lists 1,000 free messages/day; every delivery attempt/retry counts. A five-minute
recovery schedule alone uses 288 deliveries/day, leaving at most 712 before per-order work/retries.
Free capacity is for preparation/UAT, not a promise that production traffic fits. No billing change,
credit-card entry, plan upgrade or live checkout until real traffic capacity and cost are reviewed.
There is no inferred production SLA from free delayed jobs; measure delivery lateness in UAT.
The owner will sign into Upstash privately, and enter service secrets into Vercel's server-only
Production secret fields. The agent can guide Chrome setup after approval but never read credentials.
No database/session/PhonePe password rotation is needed for this design.

## Implementation conventions and local commands

- Current stack: Node 24, TypeScript, native Request/Response Vercel handlers, postgres 3.4.9.
  Add a pinned official `@upstash/qstash` version only after design approval and current API/audit review.
- `server/payments/`: scheduler adapter, job handlers and store changes; `api/payments/`: thin fetch routes.
  `database/`: local versioned migration/rollback verification draft; `tests/`: native node:test scenarios;
  `docs/`: operational setup and readiness. Do not modify portfolio styling or unrelated presentation files.
- Follow existing two-space TypeScript, explicit types and generic errors, e.g.
  `return reply({ received: true });` only after durable work. Never log raw exceptions containing secrets.
- Tests: `node --test tests/*.test.mjs`; lint: `node node_modules/eslint/bin/eslint.js .`;
  types: `node node_modules/typescript/bin/tsc -b`; build: `node node_modules/vite/bin/vite.js build`.

## Acceptance criteria and release checks

- [ ] Disabled/missing queue config performs no provider/queue calls and never permits checkout.
- [ ] SDK signatures reject tampered/expired/wrong-body/wrong-URL requests before storage/provider calls.
- [ ] Duplicate/stale/reordered jobs and webhook replays cause no extra charge or premature paid state.
- [ ] Crash/timeout tests cover order reservation, /pay uncertainty, publish acceptance lost, status commit
  before successor publication, duplicate recovery and lease expiry. No payment intent becomes unrecoverable.
- [ ] Callback recording survives a queue outage; due work resumes without a customer browser.
- [ ] Customer data and all payment credentials stay out of queued payloads and diagnostic logs.
- [ ] Target Supabase 17 migration/permission checks run transactionally with synthetic data rolled back,
  only after explicit database-change approval; no shared extension privileges are widened.
- [ ] Local regression tests/lint/types/build/audit pass, and changes are saved as small local commits.
- [ ] Real driver/TLS, signed deliveries, outages, recovery, quota exhaustion, concurrency and exact
  PhonePe reconciliation timing/capacity pass provider-approved UAT before release approval.
- [ ] Production release additionally needs explicit push/deploy/activation permissions and account cost
  review; community terms/access delivery remain a separate unmet gate.

## Approval boundary and work remaining

Design approval authorizes local implementation, pinned SDK installation and local migration/test drafts
only. It does not authorize applying migrations, account provisioning, secrets entry, paid resources,
publishing messages, schedule creation, Git push, deployment or enabling payments. Obtain the relevant
approval at each external step and bundle human handoffs rather than asking after every small code edit.
Next after design approval: write the implementation plan, then build/test in small verifiable slices.
The existing 76-test result describes the prior code, not this unimplemented queue design.

## Sources checked 2026-10-15

- [QStash delayed jobs](https://upstash.com/docs/qstash/features/delay)
- [Signature verification](https://upstash.com/docs/qstash/howto/signature)
- [Deduplication window](https://upstash.com/docs/qstash/features/deduplication)
- [Schedules](https://upstash.com/docs/qstash/features/schedules)
- [Pricing and message counting](https://upstash.com/pricing/qstash)
- [PhonePe UAT requirements](https://developer.phonepe.com/payment-gateway/uat-testing-go-live/uat-checklist)
