# Managed payment verification — local candidate, not online

Status: implemented and reviewed in an isolated worktree, then fast-forwarded into local `main` on
2026-10-15 at `cade4ed`. The merged checkout passed 123/123 tests, lint, type checks and the frontend build.
After separate owner approval, managed jobs migration `20261015071431` was applied to the existing
portfolio-payments database; see managed-payment-setup.md for checks and remaining limits. No Git push,
deployment, QStash account/message/schedule or payment activation has occurred.
All checkout/job template flags are false. No real credentials were viewed/generated/rotated or
PhonePe payment/status API called by the agent. Existing production portfolio is unchanged.

## What is simplified

Vercel handles payment logic; Supabase stores orders and durable verification jobs; QStash requests
signed delayed checks. No VPS, always-on Node process, pg_net, Cron, Vault worker secret or forwarded
reconciliation bearer is needed. The older worker files are preserved but must remain unused/off.

Job payloads contain only opaque `jobId`. The authenticated backend resolves all merchant/order/amount
terms from private storage. Queue identity is not payment proof: PhonePe status and amount/reference
checks remain mandatory. Jobs never call /pay or grant community access automatically.

## Implemented protections

- Official SDK raw-body signature/URL/time checks before production DB or PhonePe runtime construction.
- Fixed production URLs, no redirect following, verified TLS, eight-second publishing timeout, one-KiB
  scheduler payload/receipt cap and bounded request reading. Destination/Vercel job limits are 60 seconds.
- Private RLS job rows with immutable order/environment/generation/due time. No browser/service_role
  access. State transitions are SECURITY INVOKER with PUBLIC execution revoked, not privileged RPCs.
- Reservation and initial intent are atomic; scheduler acceptance precedes the one checkout claim.
  Uncertain /pay is never automatically repeated. Queue failures do not masquerade as bank failures.
  A customer can manually retry the same immutable request when checkout definitively never started;
  retired unattempted jobs require a fresh accepted generation and cannot authorize a charge themselves.
- Current generations and 90-second leases reject stale/overlapping results. A null/expired lease cannot
  complete an order. Status changes and successor intents commit together, and unpublished backoff work
  cannot be falsely acknowledged. A superseded callback flushes successors without another charge.
- Authenticated jobs: shared database limit 120/minute; recovery: 12/minute, at most three publications.
  Five-minute recovery handles missed publication and overdue accepted messages with expired leases.
  Recovery changes overdue accepted jobs to a fresh generation to avoid the queue's deduplication window;
  old callbacks/results cannot apply. No unbounded polling loop, public URL override or browser dependency.
- Signed recovery also removes up to 1000 rate buckets older than one day per call. No financial orders
  or job audit records are automatically erased. Agree retention/privacy/refund policies before launch.
- Fixed, non-sensitive operational warnings; no raw request/provider bodies, headers, credentials or
  customer fields in queue logs or API errors. Managed mode rejects the old bearer reconcile endpoint.

## Private handoff — external steps require approval

1. **Upstash account:** owner signs in privately using Chrome. Review actual plan, region/data terms,
   quotas and cost before provisioning. Do not create paid resources, enter a card or upgrade automatically.
   This has not been done; no account access is assumed.
2. **Server secrets:** owner privately enters QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY and
   QSTASH_NEXT_SIGNING_KEY into the appropriate Vercel server-only secret scope. Never use VITE_ names,
   chat, source, command arguments, screenshots or environment downloads. No existing database/session/
   PhonePe password rotation is required. The old lost worker bearer is not shared with QStash or Vault.
3. **Database:** reviewed migration applied after approval to the initially empty PG17.11 payment schema.
   Target synthetic transitions passed with rollback, RLS/grants checked and security advisors empty.
   Actual restricted-login/driver/TLS, multi-session/crash and full backup/restore tests remain pending;
   migration-role target checks and local restricted-role PGlite checks are not proof of those gates.
4. **Deployment:** the local merge is complete; separately approve pushing/deploying the backend with checkout
   and job execution disabled. Verify route recognition, native duration config, production DB driver/TLS
   and private environment scopes. Local Vite does not execute Vercel /api routes; a frontend build alone
   is not a deployed backend test. Do not copy production credentials into Preview.
5. **Provider-approved UAT:** obtain PhonePe sandbox credentials/approved test process and review a fixed
   UAT endpoint with independent queue keys. Current queue configuration intentionally enables only the
   production kkarn origin. Adding a UAT target is a separate reviewed change, not an arbitrary URL flag.
   Verify signatures, publication ambiguity, callback replay, crashes, provider outages, recovery,
   rate/quota limits, real concurrent leases and representative backlog capacity before activation.
6. **PhonePe webhook:** the Chrome draft is not registered. Configure SHA username/password privately to
   match the corresponding Vercel secrets; select checkout.order.completed/failed and the approved HTTPS
   `/api/payments/webhook` URL. Register only against a deployed verified endpoint, then prove real signed
   delivery and order matching. Saving Vercel variables alone does not register it.
7. **Schedule/monitoring:** after explicit setup approval, propose one signed recovery schedule to the fixed
   `/api/payments/recover` endpoint, body `{}`, cron `*/5 * * * *` in UTC. Never forward a bearer secret.
   No schedule creation command is executed by this code. Confirm signature URL and schedule delivery;
   configure alerts for missing schedule delivery, repeated retries, unpublished/late jobs, quota failures
   and REVIEW orders. Generic warnings indicate dispatch trouble, not that a payment failed.
8. **Go-live:** requires explicit activation approval after UAT/cost/capacity checks, privacy/service/refund
   terms and operational monitoring. Project range is INR 200–50,000. Community remains off until benefits,
   delivery and refund terms are defined. No automated refund or membership delivery is implemented.

## Cost and timing limits

QStash's currently listed free tier is 1000 deliveries/day; retries also consume deliveries. One five-minute
recovery schedule consumes 288/day before order work/retries. This is preparation capacity, not a promise
that live payments fit a free plan. Account/billing selection and real usage are not verified.

Normal jobs request the first status check at 25 seconds and then PhonePe's 3/6/10/30/60-second phases.
An early job reschedules from the initiation timestamp; an overdue/uncertain expired order goes to REVIEW,
not presumed FAILED. Managed delayed delivery is not an exact timing SLA, and recovery is not normal
deadline compliance. SDK/function/DB/network latency, cold starts, limits and load must pass PhonePe UAT.

## Verification and incident handling

Local implementation checkpoint: 123/123 tests passed with lint, TypeScript and the frontend build.
After approved database setup, the added rollback-script regression brings the passing suite to 124/124;
online npm audit reports zero known vulnerabilities. No server-secret variable names appear in the built
frontend. Independent whole-branch review found one Important pre-charge recovery defect, fixed in one
RED→GREEN pass with integrated client/handler/restricted-role SQL coverage; no Critical findings or deferred
minors. No re-review of that fix was dispatched. See managed-payment-execution-notes.md for all decisions.
Do not infer launch readiness.
Runtime registry-signature audit also returned no invalid or missing signatures.

Use Node 24: `node --test tests/*.test.mjs`, ESLint, `tsc -b`, Vite build and online npm audit.
Local tests use synthetic keys and real SDK validation; database scenarios execute production SQL/queries
in disposable PGlite with rollback. No live services are touched. Real transport, target-version behavior,
multi-session concurrency and signed provider delivery are still untested.

Before activation, assign an operator/alert recipient and rehearse checkout pausing. Pause new checkout
on destination-delivery failure: enqueue receipts alone are not delivery-health evidence. This candidate
does not pause automatically. With separately authorized production configuration/deployment changes,
set PAYMENTS_ENABLED=false or PAYMENT_RELEASE_APPROVED=false while preserving PAYMENT_JOBS_ENABLED
for previously initiated orders where safe. Test that new checkout is off and existing verification still
runs, and require verified recovery before reopening. On provider trouble use the same incident review.
Inspect only counts/oldest due ages and generic error categories, never secret
headers or raw queued/customer data. Do not delete intent rows, force /pay retries, mark pending paid,
disable TLS/signature checks or widen database permissions to make a test pass. Review and preserve
unresolved orders for manual investigation; verify any rollback will not abandon in-flight payments.

References: [QStash signatures](https://upstash.com/docs/qstash/howto/signature),
[delays](https://upstash.com/docs/qstash/features/delay), [pricing](https://upstash.com/pricing/qstash),
[PhonePe UAT](https://developer.phonepe.com/payment-gateway/uat-testing-go-live/uat-checklist).
