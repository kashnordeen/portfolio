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

### Empty-object UAT connectivity probe

- Authenticated dashboard Validate request showed event MISSING, no payload object, no
  payment identifiers/state/amount/merchant and no recognized legacy type. Actual values
  were never logged. This is not a complete payment notification.
- Added a separate, explicit `PAYMENT_UAT_VALIDATION_PROBE=true` opt-in for an **exactly
  empty JSON object**, only in the fixed sandbox project/origin and Production target,
  with all four payment/job flags exactly false. Authentication and bounded object parsing
  still happen first. The handler returns `received:true, validationOnly:true` immediately,
  without recording events, updating orders, setting a session or calling provider/queue.
- Nonempty notifications retain all original checks. The probe cannot run in live,
  preview, active UAT, without opt-in or with a missing release flag. Its diagnostic code
  is `VALIDATION_PROBE`, distinct from accepted payment events. A probe 200 proves only
  connectivity/authentication, never a successful payment or fulfilment.
- This opt-in is deployment-specific, not a project-wide setting; disable it before
  eventual separately approved UAT activation. No real payment, activation or push.
