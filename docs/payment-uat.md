# Isolated PhonePe UAT

Owner approved a separate test Vercel project and sandbox-only database access on
2026-10-15. No live activation, paid upgrade, Git push or production-key changes.

## Fixed boundary

- Test Vercel project: `portfolio-payments-uat`, `prj_w7Q4nTh7atnTv4T2G1t9CEWYxQGj`.
- Planned stable test origin: `https://portfolio-payments-uat-kashnordeens-projects.vercel.app`.
  Verify this alias after the first disabled deployment; it is not yet an online checkout.
- Test schema/role: `private_payments_uat` / `portfolio_payments_uat`, in the existing
  `portfolio-payments` Supabase project `ghseaquzqlnpmiltsyqy`.
- Separate schema and login, not a separate physical server: database resources and
  availability are shared. No test access to live payment objects and no real customer data.
- UAT orders/jobs accept **only** `sandbox` rows. The login starts disabled, has no
  elevated capabilities or memberships, and is limited to four connections.
- Runtime schema names use quoted Postgres.js identifiers selected from fixed constants.
  No request or environment variable can supply a schema or queue URL.
- Jobs require the exact test project ID, stable HTTPS origin, sandbox provider environment,
  and the project's Production deployment target. Here **Production means this separate
  test project's stable target**, never PhonePe production credentials.
- Queued messages contain only opaque job IDs. Signatures remain bound to the exact URL.
  Test queue credentials must be independently provisioned; never copy the live queue keys.
  UAT uses QStash **US** (`https://qstash-us-east-1.upstash.io`); live stays **EU**
  (`https://qstash.upstash.io`). These regions have independent tokens, signing keys,
  queues and billing. Only the existing/free tier is allowed; stop at any paid activation.

## Provisioning

`scripts/payment-uat-schema.mjs` renders the three canonical migrations into one bounded
transaction, rewriting only fixed schema/role identifiers. It rejects existing targets;
never use it to overwrite a schema or rotate credentials. Local tests create both schemas,
exercise the real store under the restricted test role, and prove live reads are denied.

Human-only `database/manual-uat-secrets.sql` enables only the new test login and returns
five independent values. Run once privately in the approved Supabase SQL Editor and save
**all five** to a password manager. Do not share results with the agent or in screenshots.
The recipe refuses reruns after the login is enabled. It does not rotate live credentials.

In the **separate UAT Vercel project**, use server-only Secrets for these five values and
the PhonePe **Test Mode** Client Id, Client Secret, Client Version and Merchant Id.
No `VITE_`/public prefix. No secret values in shell arguments, source, logs or chat.

Nonsecret settings (initially all disabled):

```ini
PHONEPE_ENV=sandbox
PAYMENT_SITE_ORIGIN=https://portfolio-payments-uat-kashnordeens-projects.vercel.app
PROJECT_MIN_PAISE=20000
PROJECT_MAX_PAISE=5000000
PAYMENTS_ENABLED=false
PAYMENT_RELEASE_APPROVED=false
COMMUNITY_PAYMENTS_ENABLED=false
PAYMENT_JOBS_ENABLED=false
```

## Still required before test activation

Private secret entry; actual restricted-login TLS/CA verification; independent test queue
credentials; disabled deployment and alias verification; test webhook registration/delivery;
explicit approval to enable UAT jobs/checkout; provider UAT cases and go-live signoff.
Do not create a recovery schedule or send real money without separate approval.
The production project and community checkout remain disabled throughout UAT.

## Verified checkpoint — 2026-10-15

- Code remains in isolated worktree `D:\Projects\Portfolio\payment-uat`, branch
  `feature/payment-uat`, based on main `a60e8f0`; no merge or push.
- Created the test Vercel project and saved all eight nonsecret settings above as
  Production-only Config variables. No shared environment variables or live keys copied.
- Applied migration `20261015154433_add_isolated_phonepe_uat_schema` to the approved
  Supabase project. Exact rendered SQL SHA-256:
  `c84cc6f44886a8d46ea09f682df51ea613263f40137f65a78f25a53d34fbc721`.
- Target metadata: login disabled; no elevated role flags/memberships; connection limit 4;
  RLS enabled on all five tables; no security-definer functions; both sandbox-only
  constraints installed; no schema access for browser roles or either opposite backend role.
- Test tables and live orders are empty. No real payment/provider/queue requests.
- Supabase security advisors: zero findings. Actual password login and TLS remain untested.
- Fresh local verification: **130/130 tests**, lint, `tsc -b`, Vite production build;
  dependency audit: zero known vulnerabilities. Embedded database tests use PostgreSQL 18,
  while the hosted database is PostgreSQL 17; no claim of a real-login/cloud concurrency test.
- Chrome handoff: three blank, Production-only Secret fields in the **test project** for
  `PHONEPE_CLIENT_ID`, `PHONEPE_CLIENT_SECRET`, `PHONEPE_CLIENT_VERSION`. Owner must enter
  the saved Test Mode values and submit privately. No values were read or entered by agent.
- No UAT deployment, activation, schedule, private credential generation or paid upgrade yet.

### Private-entry follow-up

- Owner saved the three PhonePe Test Mode credentials and the five generated UAT
  secrets. Metadata verified: all eight are server-only Secrets scoped to this test
  project's Production target. Values were not read, downloaded or copied by agent.
- Owner's first SQL attempt failed because the editor contained an appended fragment of
  the old production helper. UAT login was still disabled. Agent cleared the editor,
  verified it empty, and pasted only the UAT recipe; verified the clean final statement.
  No credential-generation query was executed by agent.
- After the owner's successful private run, UAT role login is enabled; all elevated flags
  remain false, memberships zero, and production schema access false. Do not rerun recipe.
- Still missing: test `PHONEPE_MERCHANT_ID` and three independent **US-region** QStash
  Secrets. No queue publication, schedule, provider request or deployment has been made.
- Opened the existing US-region QStash dashboard; its current plan is **Free**. No
  subscription, credit card, message, schedule or queue settings were changed.
- Prepared four blank Secret rows in the UAT Vercel project (Production target):
  `PHONEPE_MERCHANT_ID`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`,
  `QSTASH_NEXT_SIGNING_KEY`. Owner must enter the actual Test Mode merchant ID and
  US-region Quickstart credentials privately, save a password-manager copy, then Save.
  No values were read or submitted. All four payment/job flags remain false.
- Owner completed those four entries. Metadata check confirms **all twelve** required
  credentials exist as Production-only Secrets in `portfolio-payments-uat`, with values
  Hidden. This proves saved presence/type/scope only, not credential validity or region.
  No secret values were fetched. Next gate: owner approval for a disabled UAT-only
  deployment, followed by alias/config and restricted database TLS checks. No live
  deployment, activation, schedule, provider request or Git push is authorized by this
  private-entry completion.

### Disabled UAT deployment — 2026-10-15

- Owner explicitly approved: "Deploy UAT only with all payment/job flags false".
- Deployed source `b4a4076` only to `portfolio-payments-uat`:
  `dpl_GhiAmVcA5912S2Eixj5qiZXrUPaQ`, Ready at approximately 23:00 IST.
  Stable origin verified: `https://portfolio-payments-uat-kashnordeens-projects.vercel.app`.
- Forced all eight nonsecret sandbox settings above at build and runtime; all four
  payment/job flags are false. No Git push, schedule, provider request or payment.
- Vercel Authentication remains enabled. Public requests stop at that boundary.
  Authenticated `vercel curl` checks: homepage 200; config 200 with both options false;
  empty orders 503 (disabled); jobs/recovery 503 (disabled); unauthenticated webhook 401;
  status without a session 404. Application API responses are no-store/nosniff and set no
  payment-session cookie. CLI's automatic protected access generated an automation bypass
  token internally; its value was never read or copied. No protection settings were disabled.
- Fresh verification: 130/130 local tests, zero known npm audit vulnerabilities, remote
  `tsc -b && vite build` and function builds successful. Nonfatal ESLint support warning
  remains; no dependency changes made in this deployment.
- Live alias `kkarn.vercel.app` still resolves to existing deployment
  `dpl_2re2bWtZRrCd1iMtxwn9GX4p999j`; it was not redeployed.
- Still pending: actual UAT database password login/TLS check, provider credential
  validation, test webhook registration/delivery and end-to-end UAT cases. Vercel's login
  boundary currently blocks external webhook/queue callbacks; any narrowly scoped access
  change needs separate approval. Do not broadly disable protection to unblock callbacks.

### Verified database and prepared UAT callbacks — 2026-10-15

- Added a build-only read-only diagnostic (`vercel.uat.json`); no public diagnostics route.
  It refuses the wrong project, provider environment, database destination, unsafe TLS,
  missing system bypass key, or any payment/job flag not exactly false. The shared runtime
  connection builder enforces certificate verification. No credentials or raw errors logged.
  Use this special build configuration only for disabled UAT verification, not activation.
- First cloud preflight stopped with `TLS_FAILED` (`dpl_9Ycej7paz83LE1V9m5FBHLAVfGCq`).
  Added the **public** CA linked from the approved Supabase project's Database Settings as
  UAT-only `DATABASE_CA_CERT` Config, without altering a private credential or disabling TLS.
  Source: `https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`.
  SHA-256: `807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa`.
- Subsequent cloud preflight passed actual password login and verified TLS. Confirmed
  both session/current role are the restricted UAT role, zero memberships, no elevated
  flags, four-connection limit, read-only transaction, denied live-schema USAGE and SELECT
  privileges on all five RLS-protected test tables. No customer rows read or written.
- Owner approved UAT-only automation bypass sharing with PhonePe/QStash. Retained Vercel
  Authentication. Vercel exceptions are domain-wide, so no public domain exception added.
- QStash publisher now forwards the server-only `VERCEL_AUTOMATION_BYPASS_SECRET` as
  `Upstash-Forward-x-vercel-protection-bypass` **only for sandbox**, with exact project,
  fixed destination and existing signature validation unchanged. Never in job URL/body;
  production drops it even if its own system key exists. Sandbox readiness fails closed
  without the system key. No queue publication or schedule has occurred.
- Latest Ready deployment: `dpl_DsKfxeVEJM67mJcPa3f7Zt8xyFVb`, source `925f728`.
  Cloud build printed `UAT_DB_CHECK_PASSED` and `UAT_CALLBACK_KEY_PRESENT` (not values).
  All four flags forced false at build/runtime; aliases unchanged. Fresh checks: 134 tests,
  lint, TypeScript, successful remote build, zero known dependency vulnerabilities.
  Authenticated smoke: config 200 false/false, orders/jobs 503 disabled, webhook 401.
- Chrome PhonePe **Test Mode** Create New Webhook form is prepared with SHA and only
  `checkout.order.completed` / `checkout.order.failed`. Nonsecret description and URL
  prefix entered; URL ends in `?x-vercel-protection-bypass=` pending owner-private suffix.
  The first loading view was misread as unavailable; fully loaded UI supports creation.
  Owner must privately append the existing UAT system bypass key, replace any autofilled
  username/password with the saved UAT webhook pair, then submit Create. Agent has not
  read, entered or submitted those credential values; webhook registration is not complete.
- Handoff tabs: UAT Vercel Deployment Protection and PhonePe Test Mode webhook form.
  Save the full callback URL privately; never paste it into chat, logs or source.
  Still pending: registered test webhook, actual provider/queue delivery, UAT scenarios,
  any explicitly approved UAT activation and provider go-live signoff. Live site unchanged;
  no push, paid upgrade, live credential rotation, real payment or schedule.

### Opt-in callback rejection diagnostics — 2026-10-16

- Owner replaced the UAT webhook pair privately. Disabled deployment
  `dpl_F9fFJPTfJTBq9vpywNLBiT84fZQr` passed cloud database/TLS preflight and was Ready.
  PhonePe Test Mode now lists one Enabled SHA webhook with two events. Its URL shape
  matches the fixed UAT origin/path and contains a nonempty bypass parameter.
- Owner reported a successful-request toast, but UAT CDN metadata still showed POST 401
  responses. Registration/Enabled/toast is not proof of authenticated delivery. Do not
  rotate credentials blindly or activate checkout to troubleshoot this.
- Owner approved a disabled UAT diagnostic update. Set `PAYMENT_UAT_DIAGNOSTICS=true`
  only on that deployment, not as a persistent project setting. The wrapper also requires
  the fixed UAT project/origin, sandbox environment, Production target and all four flags
  exactly false. It is inert for live, active or differently targeted deployments.
- Emits only `UAT_WEBHOOK_DIAGNOSTIC`, a fixed rejection category, HTTP status and header
  format (missing/SHA256/Bearer/Basic/other). No URL/query string, authorization value,
  credential/hash, payload, merchant/customer/order identifier, raw body or error is logged.
  Original authentication, merchant checks, response/body and storage behaviour remain
  unchanged; logger failures cannot change a response. No diagnostic endpoint is added.
- A diagnostic response proves the request reached the application. CDN-only rejection
  without that marker requires separate protection-layer investigation, not auth weakening.
  Disable the opt-in flag after diagnosis; no UAT activation, schedule or live push authorized.

### Confirmed callback rejection — 2026-10-16

- Diagnostic source `94a15e9` deployed Ready as `dpl_5GhfKej6Vpz1dikAcGyRqEJUeYqs`.
  Cloud database/TLS checks passed; checkout config remained false/false. Local verification:
  137 tests, lint, TypeScript and npm audit (zero known vulnerabilities).
- Control request without authorization logged `AUTHENTICATION_FAILED` / 401 / `MISSING`.
  PhonePe Validate then logged `AUTHENTICATION_FAILED` / 401 / `SHA256` at 07:24:54 UTC.
  This proves PhonePe passes Vercel protection and reaches the handler with a correctly
  shaped SHA header, but it does not match the configured UAT username/password hash.
  Merchant/payload/database checks are not reached. No provider payment or queue request.
- Do not weaken SHA verification, modify the bypass key, generate another credential pair,
  or enable payment/job flags. Owner must privately synchronize the exact saved webhook
  pair between PhonePe Test Mode and the separate UAT project's two webhook Secrets,
  avoiding leading/trailing whitespace. Redeploy disabled UAT after any saved env change.
  No credential values were read. Temporary diagnostic opt-in is being disabled after
  this bounded investigation; no successful authenticated delivery is claimed yet.

### Replacement authentication verified; payload diagnosis — 2026-10-16

- Owner synchronized UAT Vercel secrets and created a second Test Mode SHA webhook.
  No old/live webhook was deleted or changed. In the observed table order, first-row
  Validate returned 400; second-row Validate returned 401. Both point to the fixed UAT
  endpoint with a bypass parameter and two subscribed events; values were not read.
- Bounded diagnostic deployment `dpl_7KqUq2AKt8QKpY3Exi6fiyF9iToh`, source `9eb4e98`,
  confirmed `UNSUPPORTED_NOTIFICATION` / 400 / `SHA256` for the first row at 08:51:52 UTC.
  This proves its SHA authentication passes. The shape check fails before merchant,
  storage, provider or queue processing. No 200 payment-event delivery is claimed.
- Restored the previously verified diagnostics-off deployment
  `dpl_94nCv3KTPhEGbYW3S5RMH1BJ9Acc` without rebuilding; stable UAT alias and false/false
  checkout config reverified. All four payment/job flags remain false. Live unchanged.
- Follow-up shape diagnostic emits only fixed event classes and validity booleans after
  authentication and bounded JSON parsing, and only in disabled, opt-in UAT. It reports
  payload-object presence, state/event consistency, identifier validity, amount type,
  merchant-ID presence and recognition of a legacy type label. No actual field, ID,
  amount, header, URL, credential or customer value is emitted. Rejection rules unchanged.

### Dashboard envelope diagnosis and rejected probe experiments

- Authenticated first-row Validate request has event MISSING, no root payload object,
  no root payment identifiers/state/amount/merchant, and no recognized legacy type.
  `message`/`data` exist, but message is not a string, data is nonempty, and the root
  contains additional fields. Only presence/type-validity booleans were logged, never
  field names outside the fixed vocabulary or message/data contents. Do not infer its
  exact legacy protocol or payment status from these limited observations.
- Tried two tightly gated, read-only UAT probe predicates: an empty object and an exact
  message/empty-data pair. Neither matched the observed dashboard request, so they
  continued returning 400. They never produced a successful cloud probe or touched
  payment records. Both acceptance predicates and their opt-in handling were then
  **removed from current source**; commits preserve the experiment audit trail.
- Last diagnostic: source `2bd9b53`, `dpl_2VznzXKNrjZyDcDzjiFjLfCmEP8U`, at
  09:12:56 UTC returned `UNSUPPORTED_NOTIFICATION` / 400 after successful SHA auth.
  This dashboard test is not a supported Standard Checkout event. No fabricated 200,
  weak authentication, merchant-check bypass or payment-state update was introduced.
- Current handler retains the original payment-event validation, plus dormant UAT-only
  shape logging. Before ending investigation, deploy diagnostics false and all four
  payment/job flags false. No persistent probe or diagnostic project setting was added.
- Next useful gate: separately approved **UAT-only** project checkout and managed-job
  testing with PhonePe sandbox, synthetic customer data, no real money, no community
  activation and no schedule. This requires new activation approval; do not interpret
  the owner's secret-entry or webhook-created reply as permission to enable flags.
  Old failing test webhook remains untouched. Live site and Git remote unchanged.

### Approved sandbox checkout test profile — 2026-10-16

- Owner approved project checkout and verification jobs on protected UAT only. This
  does not authorize live/community payments, real money, schedules, paid upgrades,
  credential rotation or a Git push. Use synthetic customer data only.
- `vercel.uat-active.json` selects a separate build-only preflight. The original
  `vercel.uat.json` still requires all four flags false; it is not weakened. The active
  profile requires project/release/jobs true, community false, diagnostics/probe false,
  exact sandbox project/origin, the approved ₹200–₹50,000 limits and ready queue config.
  Both profiles retain the same verified TLS, fixed restricted UAT login and read-only
  database permission checks. Neither preflight creates orders or contacts PhonePe.
- Apply active flags explicitly to both build and runtime of the UAT deployment only;
  saved project flags remain disabled. Keep Vercel Authentication and signed queue
  verification enabled. Do not call a dashboard Validate toast an end-to-end success.
- Known disabled fallback: source `20902ab`, deployment
  `dpl_oNeKDMEPXfMJzintWFeV3qczz8vg`. Promote this same-project deployment if needed
  to turn the UAT site back off without rebuilding or exposing any saved secrets.

### First approved checkout test: transport passes, expiry guard corrected

- Active source `e3fdae7` deployed Ready as `dpl_9E971MnDoJfnZmALm6cGfrSy6tbi`.
  Preflight passed; project config true, community false; unsigned jobs rejected 401.
  Synthetic ₹200 checkout returned 202 rather than exposing an unverified redirect.
- Signed QStash deliveries returned 200, and restricted UAT database metadata showed
  attempted checkout, a provider order from independent status reconciliation, and
  no saved checkout URL. No successful payment callback/event yet; no real money.
- Sandbox-only fixed-category logging (never payloads, URLs, IDs, tokens or raw errors)
  isolated the rejection to PAY expiry validation. Source `c81abb5`, deployment
  `dpl_HZUv6oX53YnS1f5QjtYfEphfWSDD`, showed only that expiry was numeric, future,
  and beyond the previous one-hour guard. Temporary expiry-shape logging was removed.
- Corrected adapter requires a future safe-integer epoch timestamp and caps the local
  checkout expiry to the earlier of provider expiry and the requested 20-minute window.
  Long provider lifetimes cannot lengthen local checkout availability; stale/invalid
  timestamps, wrong redirect hosts and all payment verification checks still fail closed.

### End-to-end sandbox success and failure verified — 2026-10-16

- Source `c2c56d5` deployed Ready to the separate protected UAT project as
  `dpl_6CHAtZsovjyyYZ8omZ4hQEbuji3i` (stable UAT aliases retained). Active build-only
  guard and verified restricted database/TLS checks passed; no TypeScript build errors.
  Local verification: 144/144 tests, lint, TypeScript and npm audit (zero known advisories).
- Synthetic ₹200 project checkout now returns a hosted PhonePe sandbox page with QR,
  cards and net banking. Used explicit TESTBANK and PhonePe's simulator, never real
  payment details or funds. Sandbox success callback returned 200 at 15:24:13 UTC;
  signed status verification produced COMPLETED, correct amount, paid timestamp,
  one durable event and one fulfilment. Local expiry stayed within 20 minutes.
  Browser return page displayed Payment verified.
- Separate synthetic ₹200 failure callback returned 200 at 15:27:52 UTC. Independent
  verification produced FAILED, correct amount, no paid timestamp, one event and
  zero fulfilments. Thus a failed attempt did not grant delivery/access.
- Old stale Test Mode webhook also received callbacks but correctly returned 401;
  it remains untouched. The replacement's actual completed/failed payment events
  are now proven, unlike the incompatible dashboard Validate envelope. Retire the
  stale test webhook only with owner approval and unambiguous row identification.
- Final UAT config: project true, community false; unsigned jobs still return 401.
  Fresh public live config at kkarn.vercel.app remains false/false. No live deployment,
  real money, community activation, Git push, schedule, paid upgrade or secret rotation.
- Remaining go-live gates are separate: approved operational recovery scheduling and
  alerts, stale UAT webhook cleanup, production configuration/release approval and
  owner-controlled live payment acceptance testing. Sandbox success is not live approval.

### Portfolio payment-page discovery — 2026-10-16

- Added a native same-origin project-payment link beside About pricing, in desktop and
  mobile navigation, and in the footer. Opening the page does not submit an order or
  enable checkout. The existing discussion action and independent community gate remain.
- Chrome checks at 320, 768, 1024 and 1440 pixels showed no horizontal page overflow;
  visible payment links fit the viewport and retain at least 44-pixel target heights.
  Desktop and mobile-menu keyboard activation reached the existing portal. Missing
  local backend config still showed Checkout coming soon, with no payment submitted.
- Added syntax-aware navigation checks. Local verification: 146 tests, lint, TypeScript,
  frontend build and npm audit (zero known advisories). No payment handlers, credentials,
  database settings, release flags, production deployment or Git remote were changed.
- Source `6eab1cf` deployed Ready as `dpl_7NCQfNhfu3FTo1f3t3XF7y4Y6t8y` to the
  same protected UAT project. Active database/TLS preflight and build passed; deployed
  portfolio contains the project-payment link. UAT config remains true/false and fresh
  live kkarn config remains false/false. No order or payment was submitted for this UI test.

### Recovery/alert preparation; no production publication — 2026-10-16

- Owner declined live portfolio publication and asked to continue recovery/alerts and
  stale-test-webhook cleanup instead. Live deployment, checkout, community activation,
  Git push and paid services remain out of scope. Owner selected kash.nordeen@gmail.com
  for Upstash UAT operational emails.
- US Region QStash console verified Free, 101/1,000 daily messages, $0 cost, no active
  or paused schedules. Account transactional usage-limit emails were already enabled
  for the selected email; no preference, email address, billing or key was changed.
  This is NOT confirmation of payment-delivery-failure email alerting. The current
  region Settings view offers paid Datadog/Prometheus, not a native failure-email rule.
  Failure callbacks need an approved monitored destination/email service; none added.
- Prepared an UNSAVED recovery schedule in Chrome: fixed stable UAT `/api/payments/recover`,
  POST `{}`, Content-Type application/json, every five minutes in default UTC,
  one-minute timeout, three default retries and ID `portfolio-payments-uat-recovery-v1`.
  `Upstash-Forward-*` header name is `x-vercel-protection-bypass`; its private value
  is deliberately blank. Never substitute a PhonePe password, QStash token, or live key.
  The owner must privately supply the existing UAT Vercel automation-bypass secret
  and submit. No schedule was created/activated or signed recovery delivery claimed.
- A five-minute schedule uses 288 deliveries/day before retries and order work. Each
  retry consumes another delivery. Recheck the actual plan/usage before activation;
  never upgrade automatically. After creation, verify signed recovery POST 200 and
  expected bounded publication counts; preserve normal signature/TLS checks. Pause
  the identified UAT schedule if delivery fails rather than weakening protection.
- PhonePe initially opened in Production VIEW; switched to Test Mode before inspection.
  Two Enabled SHA rows remain. Only Validate is exposed in the inspected table; no
  edit/disable/delete control was found. A status-cell inspection made no change.
  No hook was removed, no credentials replaced, and no production webhook changed.
  Owner/provider assistance is needed to expose a retirement control for the stale
  test registration. Do not identify it solely by row order or delete the verified hook.

References: [QStash schedules](https://upstash.com/docs/qstash/features/schedules),
[pricing and retry accounting](https://upstash.com/pricing/qstash),
[failure callbacks](https://upstash.com/docs/qstash/howto/handling-failures).

### Owner-created recovery schedule verified — 2026-10-16

- Owner privately supplied the existing UAT automation-bypass value and submitted
  `portfolio-payments-uat-recovery-v1`. Console verified one active schedule, zero
  paused, and the fixed stable UAT `/api/payments/recover` destination. The prepared
  five-minute POST configuration is now saved; no duplicate schedule was created.
- First scheduled run at 16:05:00 UTC (21:35 IST) is DELIVERED in QStash, duration
  five seconds. Vercel independently recorded POST 200 at 16:05:00.452 UTC on
  `dpl_7NCQfNhfu3FTo1f3t3XF7y4Y6t8y`. No response publication count was inspected;
  this verifies delivery and handler acceptance, not a new payment or fulfilment.
  The QStash dead-letter view explicitly showed DLQ is currently empty.
- Separate unsigned control POST returned 401 Invalid scheduler authentication at
  16:05:23.404 UTC. This expected rejection is not a scheduled-delivery failure.
  UAT config remained project true/community false; fresh live config was false/false.
- An editor snapshot accidentally included the UAT bypass value in tool output before
  the collapse transition finished. No value is recorded here or in source. Stop
  full-form snapshots; consider owner-approved coordinated UAT bypass rotation before
  further external testing, updating both test callbacks and the schedule together.
  No credential was rotated, and production credentials were not involved.
- Delivery-failure email alerts remain unconfigured: usage-limit emails are not a
  substitute. A monitored failure-callback destination requires owner approval.
  Stale PhonePe test-webhook retirement still needs an exposed management control or
  provider assistance. No live rollout, Git push, paid upgrade or real payment occurred.

### Rotated UAT key and approved email-alert deployment — 2026-10-17 IST

- Owner approved coordinated UAT bypass rotation, regenerated the value privately,
  and confirmed updating the existing PhonePe Test Mode callback and paused QStash
  schedule. Replacement values were not read or recorded. Recovery stayed paused.
- Rebuilt UAT source `8f7f92c` as `dpl_AyJE5pqvNjENhgr1knTrC7uBYGSu`. A single
  signed recovery test returned 200 at 2026-10-16 16:29:58.500 UTC; unsigned controls
  returned 401. The updated PhonePe dashboard envelope reached the handler and
  returned 400, consistent with unsupported Validate payloads, not a new payment test.
- The obsolete PhonePe callback was identified by its different, revoked bypass
  value on the same UAT host/path, not solely by row order. An attempt to uncheck
  Enabled and save did not persist: refresh still showed two Enabled registrations.
  Do not claim retirement. Permanent deletion requires explicit action-time approval;
  the revoked value no longer grants UAT deployment access. No production hook changed.
- Owner approved free-tier Resend for UAT operational failure summaries to the existing
  selected email, created a Sending access key privately, and saved `RESEND_API_KEY`
  as Production-only Secret in the separate UAT project. No key value was retrieved.
- Source `a647799` adds the signed UAT-only alert endpoint and fixed failure callback
  on opted-in sandbox jobs. Fresh local verification: 153 tests, lint, TypeScript,
  frontend build and dependency audit (zero known vulnerabilities). No new package
  or database privileges. See `uat-payment-alerts.md` for privacy/coalescing limitations.
- Deployed Ready as `dpl_5wdPL5Cugtpt3U9zATGjBpy9mMDk`, with both stable UAT aliases,
  sandbox identity, project/jobs active, community false and diagnostics false. The
  alert flag is true only on this UAT build/runtime; no live/project-saved flags changed.
  Unsigned POST `/api/payments/alerts` returned 401, confirming fail-closed routing.
  Fresh live kkarn config remained false/false; UAT config remained true/false.
- The Upstash schedule editor repeatedly closed before automation could add headers.
  No duplicate schedule was created or existing schedule resumed. Owner handoff is
  to add the fixed alerts URL as `Upstash-Failure-Callback` and privately supply the
  rotated UAT key as `Upstash-Failure-Callback-Forward-x-vercel-protection-bypass`,
  preserving the existing paused schedule. Signed failure-to-email delivery and
  inbox receipt remain UNVERIFIED until that configuration and a controlled test.
- No live rollout, real payment, paid upgrade, credential output or Git push occurred.

### Signed alert acceptance and recovery activation — 2026-10-17 IST

- Owner ran the private two-phase helper from local source `3d50fc5`; credentials
  were entered only at hidden prompts. The first attempt did not start because the
  owner's terminal lacked `pwsh` on PATH. The verified bundled PowerShell executable
  resolved startup without installation, an execution-policy change or elevation.
- Preparation left the schedule paused and published two no-money controls. Signed
  recovery returned HTTP 200 at 2026-10-16 21:00:54.340 UTC. The intentionally
  unbypassed jobs request was rejected by deployment protection, not used to create
  an order. Default exponential retries made this acceptance test take roughly
  36 minutes; a future isolated acceptance test should explicitly use short retry
  delays rather than alter the recovery schedule's production-like retry policy.
- The final intentional rejection returned 401 at 21:36:35.690 UTC. Its signed
  failure callback returned 200 from `/api/payments/alerts` at 21:36:36.352 UTC on
  `dpl_5wdPL5Cugtpt3U9zATGjBpy9mMDk`. Resend independently showed the expected
  `[Portfolio UAT] Payment verification delivery needs attention` email Delivered
  to the approved recipient. This proves provider delivery, not owner inbox reading,
  payment completion or the recovery-failure category specifically.
- After these checks, the owner entered `VERIFIED` and reported completion. The
  helper updates the same fixed schedule ID with callback-forward headers, resumes
  it and reads back its guarded settings. Console inspection independently showed
  one schedule row for the stable UAT `/api/payments/recover` destination with the
  Pause action (active). First scheduled recovery returned HTTP 200 at
  21:40:00.587 UTC (03:10:00.587 IST), on the same reviewed deployment.
- Preserve the intentional failed test as diagnostic evidence; do not describe the
  DLQ as empty. Alerting is not a dead-man monitor for a paused/missing scheduler,
  an exhausted publication quota or complete queue/email-provider outage.
- Obsolete PhonePe test-webhook retirement still requires exact-target identification
  and action-time deletion approval. No stale hook was deleted during these checks.
  Live rollout/community enablement, Git push and any paid upgrade remain unapproved.
  No source deployment, credential disclosure, real payment or live flag change was
  performed as part of this acceptance and activation handoff.
