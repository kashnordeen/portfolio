# Managed payment checks — execution decisions

Scope: approved Native implementation on isolated `feat/managed-payment-checks`, subsequently fast-forwarded
into local `main` at `cade4ed` on 2026-10-15 after the owner's continuation request. The live portfolio remains
unchanged. All five implementation tasks are locally checkpointed. Independent
whole-branch review found one Important recovery defect and no Critical findings or deferred minors.
The author's single fix pass verified that defect RED→GREEN; no second review was dispatched.
At the implementation/local-merge checkpoint, no external setup, secrets, paid resources, migration
application, push or deployment had occurred. Subsequent separately approved database setup and its
verification limits are recorded in managed-payment-setup.md; there is still no push or deployment.

Local integration verification: 123/123 tests, lint, TypeScript and frontend build passed in the main
checkout. Its unrelated untracked `presentation/` folder was preserved. Dependencies were installed from
the existing lockfile with lifecycle scripts disabled; package manifests/lockfile were unchanged by install.
The integrated temporary worktree is eligible for normal Git cleanup; its commits and decisions are retained.

## Rulings made, in execution order

1. Used the approved manual Git worktree because the app's native tool could not recognize the nested
   repository. Cost/risk: local worktree management differs from an app-managed checkout; main is preserved.
2. Used documented REST publication with controlled native fetch and the official Receiver SDK for
   signatures. Cost/risk: the small REST header/receipt contract needs maintenance alongside SDK updates;
   this avoids unsupported SDK deadline controls or global fetch patching.
3. Recovery of overdue accepted messages creates a fresh generation/due time instead of relying on an
   old receipt that can be deduplicated for ten minutes. Cost/risk: an extra status-check message; stale
   generations cannot apply results or initiate checkout.
4. Introduced the managed-mode bit with legacy store behavior retained while off during staged commits.
   Cost/risk: legacy regression coverage is still needed; enabled managed mode rejects the old bearer
   scheduler and checkout requires queue readiness.
5. Added an explicit unpublished-intent check so an empty ready batch caused by backoff cannot produce a
   false ACK. Cost/risk: one bounded EXISTS query for each publication pass.
6. Made finishJob return whether its lease-owned update applied. Cost/risk: one internal return-type
   extension; expired/lost ownership now retries instead of falsely acknowledging unfinished verification.
7. Limited authenticated jobs to 120/minute and recovery to 12/minute in the shared database, after signature
   verification. Cost/risk: unsuitable limits can delay payment checks; real traffic/timing UAT is required.
8. Permit manual retry of the same immutable, session-bound order only while CREATED with no initiation
   timestamp, provider ID or checkout URL. Reuse a live intent or create a fresh generation after retirement;
   require accepted scheduling and the original locked single checkout claim. If retirement races that claim,
   return retryable 503 without exposing an order as being verified. Cost/risk: extra publication; an incorrect
   eligibility guard could duplicate initiation, so ambiguous attempts remain non-retryable and are tested.

## Rulings on behaviors the reviewer declined to judge

9. PG17 multi-session locking/crash behavior remains a mandatory external release gate, not inferred from
   PGlite PG18. Cost if skipped/wrong: real concurrency or crash recovery could fail despite local tests.
10. Live QStash timing/deduplication/retries/quotas/TLS and Vercel routing/duration remain mandatory approved
    transport tests. Cost if skipped/wrong: verification deliveries could be lost, late or refused.
11. Applied migration permissions, restore, private credentials, provisioning and monitoring remain separate
    approved setup work. Cost if skipped/wrong: excessive permissions, outages or stranded real records.
12. Checkout pausing is operator-driven for this candidate. Activation requires an assigned alert recipient
    and rehearsed pause procedure; publication acceptance alone is not healthy destination delivery. Pause
    new checkout on delivery failure while preserving job execution for in-flight orders where safe.
    Cost if wrong: human reaction delay can admit payments while verification is unavailable.
13. REVIEW resolution/refunds remain manual; community checkout stays disabled until benefits/delivery/refund
    terms are defined. Cost if wrong: unresolved customers need support rather than automated resolution.

## Review fix and deferred minors

Important finding: pre-charge queue failure or lost receipt could strand an order in CREATED forever.
The integrated regression executes the actual browser checkout client, handler and production store queries
under the restricted database role. Three failure cases were observed before the fix: queue refusal/retry,
retired unattempted delivery, and retirement racing the checkout claim. All now pass with the same browser
request key and order; retired jobs cannot authorize checkout and ambiguous provider attempts never repeat.
The fix changes no UI, payment amount, release flag or external configuration.

Deferred minors: none raised.

## Evidence and limitations

Final local verification: 123/123 tests, lint, type checks and frontend build pass; online npm audit has zero known
advisories and runtime signature audit has no missing/invalid registry signatures. Tests execute real
signature validation and local PostgreSQL transition/query logic with synthetic data, not live services.
PGlite PG18 does not establish target PG17 multi-session locking, driver/TLS, transport timing or provider UAT.

The skill's separate security-checklist reference was absent. Its fully read security-and-hardening
controls and hardening-patterns reference were used; no compliance certification is claimed.
Local verification and an independent review do not establish production readiness. Remaining account,
database, deployment, webhook, delivery/health and UAT gates are grouped in managed-payment-jobs.md.

## Disabled deployment preparation — 2026-10-15

Owner approved deploying the backend with all four payment/job flags false, without Git push,
payment/job activation, a schedule, credential rotation or a real payment. Vercel MCP lacked
the required team scope; the official pinned CLI 64.2.0 authenticated through the owner account
and verified project portfolio (prj_SV6MLqre8MI2eFF1hY2AdOJgik9z), Node.js 24 and Vite.
Only the committed source archive is uploaded; unrelated presentation files and local environment
files are excluded. CLI linking unexpectedly generated a staging .env.local; it was removed unread.
The CLI's protected-deployment curl command automatically provisioned its project bypass credential;
no value was read or logged and project deployment protection remains enabled.

Initial staged deployment dpl_EakYdvCq62bra5mEBovSpgK8eZD5 was READY but its config function
returned 500: emitted config.js still imported server/payments/handler.ts, which was not present.
Do not promote that build. The root compiler config lacked the import rewriting setting used by
Vercel's native API compiler (local noEmit checks used tsconfig.node.json instead). A new test
reproduced TS5097 before the fix and compiles all seven native API entries and dependencies in
memory, checking the emitted JavaScript graph. Root rewriteRelativeImportExtensions fixes the
deployment compiler without changing source imports, payment logic or release gates.
vercel.json keeps remote dependency lifecycle scripts disabled.

Corrected source commit 477c6424a5608a1b1c56f8cf6bb24662843c0f91 was deployed as
dpl_3TGoNXadSgrvW1uEuXRQAF3Vd7jA, production target, READY. Its build emitted all seven
native Node.js API functions without the earlier TS5097 diagnostics. Staged runtime probes passed
before promotion; kkarn.vercel.app was then confirmed to resolve to this exact deployment.
Prior main-domain deployment for rollback reference: dpl_9fF4RvfMe4feMtaPP7Wgu39SGeeT.

All four Production flags were explicitly saved as Config=false as well as overridden false in
the deployment build/runtime inputs: PAYMENTS_ENABLED, PAYMENT_RELEASE_APPROVED,
COMMUNITY_PAYMENTS_ENABLED, PAYMENT_JOBS_ENABLED. No secrets were retrieved.

Fresh local verification: 125/125 tests, lint, TypeScript and frontend production build passed;
npm audit reported zero known vulnerabilities. Public-domain HTTP checks confirmed:
config GET=200 with exactly disabled project/community booleans, orders POST=503 disabled,
unauthenticated webhook POST=401, jobs/recover POST=503 disabled, and unowned status GET=404.
All API probes returned JSON, no-store, nosniff and no Set-Cookie. Homepage=200 with full name.
These probes reject before database writes/provider calls; they do not establish database login/TLS,
signed queue delivery/retries, provider UAT, backup restoration, or successful real payments.
No Git push, payment activation, recovery schedule, real payment or PhonePe webhook registration
was performed. Remaining launch gates in managed-payment-jobs.md still apply.
Final scoped 15-minute runtime scan returned zero error/fatal/stderr records for this deployment.
Chrome verification of the live project portal showed the setup notice and disabled
"Checkout coming soon" button. Monitoring/alert delivery itself has not been established.

## Webhook credential replacement deployment — 2026-10-15

Owner could not recover the original private webhook pair and explicitly approved replacing only
PHONEPE_WEBHOOK_USERNAME and PHONEPE_WEBHOOK_PASSWORD, followed by a disabled redeployment.
Owner reported saving replacements directly in Vercel. Both rows were verified as recently updated,
Production-only Secrets; no credential input values, clipboard or stored secrets were read.
Private password-manager retention was explicitly requested. The original all-secrets SQL recipe
must not be rerun for this replacement because it also rotates the database password.

Reviewed source commit 477c6424a5608a1b1c56f8cf6bb24662843c0f91 was rebuilt without cache using
current Production environment settings. Deployment dpl_2re2bWtZRrCd1iMtxwn9GX4p999j was staged,
verified, promoted, then confirmed as kkarn.vercel.app's READY production deployment. Build duration
was 30 seconds. All four release/job flags were explicitly false at build and runtime.
The 125-file source manifest excluded private environment and unrelated untracked files.
Fresh verification: 125/125 local tests and npm audit with zero known vulnerabilities; staged
config/orders/webhook/jobs/recover guards passed. Public-domain checks passed for all six API guards
and homepage. The first unowned-status request timed out at 20 seconds; one bounded full-suite retry
passed. A scoped runtime error/fatal/stderr scan returned zero records. No database/provider test,
Git push, job/payment activation, schedule or PhonePe webhook creation was performed.

PhonePe must receive this same new private pair before registration and authenticated delivery tests.
Earlier deployments retain older credential values: do not roll back to one after registering the
new pair without a coordinated credential plan. No secret-value matching or end-to-end delivery is
claimed by the unauthenticated rejection checks above.
