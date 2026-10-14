# Managed payment checks — execution decisions

Scope: approved Native implementation, isolated `feat/managed-payment-checks` branch. Main and the live
portfolio remain unchanged. All five implementation tasks are locally checkpointed. Independent
whole-branch review found one Important recovery defect and no Critical findings or deferred minors.
The author's single fix pass verified that defect RED→GREEN; no second review was dispatched.
No external setup, secrets, paid resources, migration application, push or deployment occurred.

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
