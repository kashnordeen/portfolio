# Production project payments — launch evidence

**Open incident:** a real checkout attempt failed before opening PhonePe. The owner
approved pausing NEW checkout on the jobs-preserving safe-stage deployment while
the handoff is diagnosed. See `checkout-incident-2026-10-17.md`; the launch record
below is historical evidence, not proof of successful real-payment acceptance.

17 October 2026 (IST). This record is not a claim of legal certification or an
independent financial-security audit. Community checkout remains closed. No Git
push, real payment, refund, database export or password rotation was performed.

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
