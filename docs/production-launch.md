# Production project payments — launch evidence

**Current UI release — 18 October 2026 (IST):** source `7935714`, deployment
`dpl_8VotKPvm8bqmWZq3oY6Renz1wa7u`, explicitly staged, verified, then promoted to
`https://kkarn.vercel.app`. The owner requested deployment of the local payment-page
redesign, connected progress tracker, checkout click feedback and verified thank-you
screen. No Git push was requested or performed.

- All 248 tests, ESLint and TypeScript pass; production dependency audit reports
  zero known vulnerabilities. Remote strict read-only DB/TLS/RLS preflight and build
  pass. Existing npm configuration/ESLint-deprecation/install-script warnings remain;
  no new dependency or weakened installation/TLS protection was introduced.
- A dry upload audit stopped the first attempt before upload because Vercel included
  local `dist` files. Added `.vercelignore` and its regression test. The verified
  182-file source upload excludes all build fixtures, environment files and private
  key material. This deployment builds fresh from source.
- Functions remain in Mumbai (`bom1`). Runtime project checkout/release/recovery
  flags stay true; community and both alert flags stay false. Production PhonePe,
  the exact site origin and INR 200–50,000 bounds are preserved via deployment-only
  overrides. No project-level variables, credentials, webhook or scheduler changed.
- Candidate unsigned webhook/jobs/recovery probes return 401, and the expected UI
  assets match. Public site and all three policy pages return 200; config is
  project true/community false with no-store. Public unsigned callback/recovery
  probes return 401 and GET orders returns 405. Framing DENY and nosniff remain.
- Public alias independently resolves to this Ready production deployment. Browser
  check confirms connected points, optional reference, safe disabled empty form,
  no horizontal overflow and no captured console errors. Screenshot:
  `payment-ui-production-release.png` in the task visual artifacts.
- Existing scheduled production recovery returned HTTP 200 on this deployment at
  21:35:00.677 IST (16:05:00.677 UTC). The scoped recent runtime error/fatal/stderr
  scan returned zero records. Automated alerts and backup/restore remain deferred;
  the owner's existing manual monitoring commitment is unchanged.
- Rollback target: the previous Mumbai deployment below, retaining payment recovery.
  No database rollback is needed. No real checkout, payment, refund or fulfilment
  was created by this UI release verification. The earlier owner acceptance remains
  historical payment evidence, not a newly executed transaction.

**Previous release / UI rollback:** source `28fa575`, deployment
`dpl_GPSXrx6x5uV71sk8apqchQHhypmt`, now serves kkarn.vercel.app. At the owner's
request, the four originally hidden groups are restored: five project repository
buttons and one configured website link, three download menus with six existing
installers plus release notes, two Credly verification links, and contact GitHub/
LinkedIn links. Candidate and public Chrome rendering were verified; all three
download menus were exercised without downloading/installing binaries. The live
release check returned v1.1.0. No contact submission, financial action or Git push
occurred. All 239 tests, lint/build/audit and remote strict DB preflight passed.
Public config remains project true/community false, bom1 routing and no-store;
unsigned jobs/recover/webhook POSTs still return 401. No payment backend code,
credentials, limits, policies or release gates were changed. The previous Mumbai
deployment below remains available for rollback. Chrome proof is saved as
portfolio-links-restored.png in the task's visual artifacts.

**Infrastructure baseline:** source `838a408`, deployment
`dpl_E9yLRPMQ5yh7B89ziDSiKV79uRL5`, established the functions in
Mumbai (`bom1`), close to the existing database. Payment code, flags and secrets
are unchanged from the accepted flow below. All 235 tests, lint/build/audit, remote
strict DB preflight, function-region and public security checks passed. The existing
authenticated recovery schedule returned HTTP 200 on this deployment at 22:00 IST.
The prior
accepted deployment remains the rollback target. See `payment-performance.md`
for measurements, verification and the limit on claimed speed improvements.

**Live payment accepted:** the owner completed INR 200 on source `bdbd0f7`,
deployment `dpl_2jfComLTybSVH9sTofdJCP7YJPN8`, with project reference left blank.
Payment `c7050c88-1641-4dd0-b9f8-585537c6dec5` independently verified COMPLETED
at 21:45 IST on 17 October 2026, with one received completion notification,
one fulfilment record and no pending jobs. The website displayed Payment verified.
It retains the exact alternate PhonePe host fix, adds PhonePe's documented source
referrer policy and makes project reference optional in UI/API/storage. All 234
tests, lint/build/audit, strict remote DB preflight and public header/config/
unsigned-callback guards passed; the live Chrome form was checked. Full evidence
and notification-processing caveat: `checkout-incident-2026-10-17.md`. Earlier
launch evidence below is historical. This verifies payment, not service delivery.

17 October 2026 (IST). This record is not a claim of legal certification or an
independent financial-security audit. Community checkout remains closed. No Git
push, agent-authorized payment, refund, database export or password rotation was
performed. The real payment above was authorized privately by the owner.

## Owner decisions

- Approved project-only launch, INR 200–50,000 inclusive, after written email
  agreement on scope, price, milestones, delivery and acceptance.
- Confirmed the enabled Production PhonePe webhook at
  `https://kkarn.vercel.app/api/payments/webhook`, with
  `checkout.order.completed` and `checkout.order.failed` events. This is owner
  confirmation, not yet a real-payment callback acceptance test.
- Approved publication of the service terms, Option A refunds and factual privacy
  notice using kash.nordeen@gmail.com. No unprovided address or tax status is used.
- Accepted manual review of the existing PhonePe, Upstash and Vercel dashboards
  during the initial launch. Gmail automated alerts and backup/restore are
  explicitly deferred. No automatic outage detection or tested backup is claimed.

## Published safe stage

- Source `bb39a5e`; existing Vercel project `portfolio`,
  `prj_SV6MLqre8MI2eFF1hY2AdOJgik9z`. UAT worktree linkage was not changed.
- Deployment `dpl_CF3UApBpyf5VjbXhMAhhsUJ18L7i`, then explicitly promoted to
  `https://kkarn.vercel.app`. New project/community checkout remains disabled;
  managed jobs are enabled; both automated alert flags remain false.
- Runtime and build amount bounds: `PROJECT_MIN_PAISE=20000`,
  `PROJECT_MAX_PAISE=5000000`. Production PhonePe environment and exact site origin.
- Read-only build preflight passed strict TLS, the restricted production login,
  a read-only transaction, denial of UAT schema access and five RLS payment tables.
  An initial TLS failure correctly blocked the earlier candidate. Added only the
  public Supabase Root 2021 CA to Production, pinning DER SHA-256
  `807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa`.
  No TLS verification was weakened and no database credential was rotated.
- Live GET checks: all three `/policies/*.html` pages returned 200 HTML with
  nosniff/framing DENY; public config returned both flags false. Unsigned recovery
  POST returned 401 before database work. Chrome verified service terms content.
- Local source checks before deployment: 189 passing tests, lint and production
  build passed; native npm audit reported zero known vulnerabilities. Remote build
  passed with install scripts disabled; existing ESLint/npm warnings remain.

## Production recovery

Created one EU Region schedule, `portfolio-payments-production-recovery-v1`:
POST `https://kkarn.vercel.app/api/payments/recover`, JSON body `{}`,
`*/5 * * * *` UTC, three retries and a one-minute (60-second) timeout.
No failure callback or Vercel bypass header is configured. Reloaded schedule list
shows one active and zero paused. The first scheduled run, 17 October at 16:55 IST,
was Delivered in four seconds; its delivery detail shows STATUS 200. This proves
the production queue/signature/database recovery path, not PhonePe payment success.

Five-minute recovery uses 288 publications/day before order jobs and retries.
Review the account's live quota, delivery failures and DLQ; manual checks do not
replace automated outage alerts. Do not upgrade a plan automatically.
The existing EU dashboard identifies the Free plan with 1,000 messages/day and a
15-minute maximum timeout. The displayed daily counter lagged a known delivery;
do not treat that counter alone as proof that no messages have been sent.

## Project checkout published

- Source `401ea32` (application source unchanged from `bb39a5e`); deployment
  `dpl_4FeuNPbr4GnwwEUARyZNYmAvDTnX`, Ready, explicitly promoted to
  `https://kkarn.vercel.app` on 17 October 2026 (IST).
- Deployment runtime overrides: `PAYMENTS_ENABLED=true`,
  `PAYMENT_RELEASE_APPROVED=true`, `PAYMENT_JOBS_ENABLED=true`;
  `COMMUNITY_PAYMENTS_ENABLED=false`, `PAYMENT_PRODUCTION_ALERTS_ENABLED=false`,
  `PAYMENT_UAT_ALERTS_ENABLED=false`. Provider/origin/amount bounds are unchanged.
  Build-time checkout flags stayed false for the gated read-only preflight; the
  candidate and public runtime config were separately verified true/false.
- Public config returned HTTP 200, project enabled and community disabled, with
  `Cache-Control: no-store` and Secure/HttpOnly/SameSite=Lax session attributes.
  Cookie values were not recorded here. Unsigned POSTs to recovery, jobs and
  webhook each returned 401. Root and all three policy pages returned 200 with
  nosniff and framing DENY. Chrome shows "Checkout available" and policy links;
  Continue is disabled for an empty form, as intended. Captured warning/error
  browser output was empty. No checkout submission or real transaction was made.
- Enablement is deployment-specific. Project-level defaults remain fail-closed;
  no production credential or UAT environment was altered. Future redeployments
  must explicitly preserve production verification/jobs for pending orders and
  recheck the public runtime flags. Do not push an older/unreviewed main build.

## Remaining acceptance and safe operation

- Project checkout is now open on the verified deployment. Community and alerts
  remain false. Do not call real-payment or refund acceptance complete yet.
- The owner, not the agent, must perform the first agreed, bounded real transaction
  and check independent completed state, webhook delivery and exactly one recorded
  fulfilment. No bank debit/screenshot alone is proof. Do not repay a pending or
  ambiguous attempt. Refunds are handled by the owner in the PhonePe dashboard;
  automated refund support is not implemented.
- During initial launch review PhonePe orders/webhooks, QStash delivery/DLQ/quota
  and Vercel fixed-category errors. Support/refund issues go through the approved
  Gmail address. Stop accepting new payments on unexplained failures.
- The safe-stage deployment above is the rollback target for stopping new
  checkout while preserving verification/recovery of already-started orders.
  Never roll back to jobs-off during pending financial work or delete orders.
- A saved Upstash builder unexpectedly included a UAT-only bypass in a tool
  snapshot. It was removed before creating the production schedule. The owner
  should rotate that UAT key privately before further UAT use, then update the
  existing UAT webhook/schedule together. No key is recorded here.
