# Production payment readiness — NOT a go-live approval

Prepared locally on 2026-10-17 IST. Live checkout/community remain disabled. No
deployment, scheduler creation, paid plan, DNS change or real transaction is authorized
by this document. Sandbox evidence is recorded in `payment-uat.md`.

## Current handoff

The updated UI/backend is deployed with payments disabled; real-charge activation
is still on hold. The owner has confirmed the Option A refund terms, seller name,
support email and support calendar. The following items still prevent a completed
live rollout:

- Production alert delivery has no verified sender. The owner has only a Vercel
  subdomain and declined another monitoring service. No domain purchase, service
  addition or workaround using Resend's testing sender is authorised. The owner
  approved preparing a Gmail send-only integration, then deferred Google account
  setup. Tested local sender code is prepared but not deployed or configured;
  no Gmail credentials or permissions were created. See `gmail-payment-alerts.md`.
- The owner confirmed email agreement on scope, milestones, delivery dates and
  acceptance criteria with each customer before payment. Remaining seller
  disclosures, retention periods and the support/refund procedure still need
  completion before public policy pages can be published. Do not invent those choices.
- A hosted backup and isolated restore rehearsal need approval of the source,
  destination, encrypted storage and any cost. Do not use the owner's unrelated
  Supabase project as a disposable target.
- PhonePe's deadline was communicated on a call, with no written message. Treat
  that as an owner report; clarify which access closes and when, without inventing
  an expiry or requiring a nonexistent written message to continue safe work.
  Confirm remaining go-live/refund cases. Provider sign-off, a real-payment test
  and production activation are not established by local tests or sandbox callbacks.

The owner explicitly approved deploying and publishing commits `f23bbfc` and
`006ef75` with checkout, community, jobs and alerts disabled. That scoped approval
does not enable real charges or authorise a Git push. Resolve the remaining checks
before requesting the separate activation stage. Community checkout stays off.

## Completed evidence

- Sandbox success/failure callbacks, independently verified payment states and
  fulfilment deduplication were exercised; these are not production acceptance.
- UAT recovery is active and delivered HTTP 200. Its controlled exhausted-delivery
  callback returned 200; Resend showed the expected owner email Delivered.
- With explicit deletion approval, only the obsolete PhonePe Test Mode registration
  was removed. After reload one Enabled SHA registration with two events remained.
  Its dashboard validation reached the application (400 for the unsupported probe).
  No production webhook or credential was modified.
- Production Resend alert code is deployed but disabled, without a configured or
  verified production sending route. Gmail sender code remains a local candidate.
- Fresh local checks: 176 tests passed, including UAT compatibility and production
  isolation, lint, TypeScript/API compilation and frontend build. Native npm audit
  reported zero known vulnerabilities; no server-only alert/queue markers appeared
  in the browser bundle. This is local evidence, not hosted production acceptance.
- Pre-deployment read-only live checks on 17 October 2026 (IST): the homepage returned HTTP 200
  with HSTS, and the public configuration returned project/community disabled.
  Other selected browser security headers were absent from the homepage response.
- The hosted `portfolio-payments` Supabase security advisor returned no findings.
  Metadata showed RLS enabled on all five production and five UAT payment tables.
  This does not prove backup recovery or certify all database permissions.

## Published disabled build (17 October 2026, IST)

- Source: `006ef75`, including security fix `f23bbfc` and prior header work.
- Existing project: `portfolio`, `prj_SV6MLqre8MI2eFF1hY2AdOJgik9z`, owned by
  `kashnordeens-projects`; no project was created or relinked.
- Deployment: `dpl_C7c6CbT6oLB27RqTTTWQjAAuYbuH`, Ready, then explicitly promoted.
  The public `kkarn.vercel.app` bundle contains the revised payment UI.
- Deployment-specific runtime and build overrides keep `PAYMENTS_ENABLED`,
  `PAYMENT_RELEASE_APPROVED`, `PAYMENT_JOBS_ENABLED`, `COMMUNITY_PAYMENTS_ENABLED`,
  `PAYMENT_PRODUCTION_ALERTS_ENABLED` and `PAYMENT_UAT_ALERTS_ENABLED` false.
  Provider environment/origin are production / `https://kkarn.vercel.app`.
  No project-level secrets, scheduler or UAT deployment were changed.
- Candidate checks: root 200, both public checkout flags false, sessionless status
  request rejected with 404. Public post-promotion checks confirm root 200, both
  checkout flags false and the deployed baseline/report-only security headers.
- Chrome verified the published UI and disabled checkout. Local Chrome tests
  checked the INR 199.99 error, INR 50,000 boundary, summary amount and keyboard
  progression. Captured warning/error console output was empty. Other responsive
  breakpoints and enabled/real-payment browser flows are not newly verified.
- Security changes add a four-second request-body deadline and reject malformed
  checkout response objects/IDs, URL fragments and redirects on ambiguous HTTP
  responses. Regression tests failed before the fixes and pass afterwards.
  An upper-amount-bound mutation was also caught by the input tests and restored.
- No Git push, real order/payment/refund, credential rotation or Gmail access was
  performed. Existing native dependencies still skip installation scripts. The
  remote build completed with zero known audit vulnerabilities, while warning
  about an unsupported ESLint version and unapproved install scripts; no scripts
  were blanket-approved and no dependency upgrade was made in this change.

## Deployed baseline headers and report-only CSP

`vercel.json` sets `nosniff`, `X-Frame-Options: DENY`, `no-referrer` and
disabled camera/microphone/geolocation permissions on all paths. It changes no
rewrites, CORS, API caching, authentication or payment flags. The configuration has
two regression tests, verified failing before the change and passing afterwards.
The homepage headers are now confirmed on the published build. Further route and
browser acceptance remains necessary before broadening or enforcing the CSP.

The resource CSP starts in report-only mode. It restricts the proposed script
sources to self and the exact static theme-script hash, while allowing existing
Web3Forms/GitHub API connections, jsDelivr images and self-hosted fonts. Inline
styles remain allowed for the existing React/motion styles. It adds no reporting
endpoint or third-party reporting service; inspect browser console violations.
Report-only CSP does not block script/resource loads. Its `frame-ancestors`
directive is not an enforced framing control; the separate X-Frame-Options header
provides that protection in browsers that support it after deployment.

Before enforcing CSP, validate the portfolio, both themes, payment-page navigation,
pending/failed/verified states, existing contact-form integration and UAT platform
toolbar under the real hosted responses. Observe reports for at least a week as
required by the CSP skill; classify any platform injection separately. Do not send
a customer message, create an order or pay merely to test a header. Recheck the
inline-script hash against the built HTML if the theme script changes. Enforcement
requires a reviewed follow-up, not an automatic flag change.

## Gate 1: production operational alerts and recovery

### Gmail candidate (account setup deferred; no configuration change)

The owner approved preparing the integration, then asked to defer Google project
setup. Gmail API OAuth with the `gmail.send` scope can send mail without mailbox
read/modify permissions. It is preferable to
granting a general account app password for this owner-alert use case. Sending
permission itself is not limited to the owner's recipient address; any future
implementation must enforce that fixed recipient and fixed category/hour content
in code, retain signature verification before sending, and keep secrets server-only.

The local candidate has 182 passing tests, including unchanged UAT/Resend behavior,
Gmail scope/recipient restrictions, authentication-first handling and generic
provider failures. Lint and the local production build pass. These are mocked
Google transport tests, not evidence of an authorized account or delivered mail.
The native npm audit reported zero known vulnerabilities with no dependency changes.
No Gmail code from this candidate has been deployed. A GET-only follow-up still
found live root/config HTTP 200, both checkout flags false, `nosniff` and framing
DENY; recovery/alerts reject GET with 405. No signed job or email was sent.

Account setup must wait until the owner resumes it. It then requires private
Google OAuth client/consent setup and credential storage, followed by a
no-customer-data delivery test. Do not reuse this
chat's Gmail connector tokens or read the owner's mailbox to configure runtime
email. Do not generate, paste or copy a credential through model-visible output.
An external OAuth app left in Testing normally gets a seven-day refresh-token
lifetime for Gmail scopes; do not present that as durable production monitoring.
Handle revoked/expired credentials and validate the actual deployment configuration.
Google discourages app passwords, which also require 2-Step Verification and may
be unavailable for some accounts. No Google Cloud project, consent, billing, mail,
account setting was changed. Gmail has no provider-enforced hourly deduplication
in this implementation; ambiguous sends may yield duplicate notifications.
Deferring Gmail does not authorize payment activation or waive production recovery
acceptance. Any monitored pilot needs an explicitly accepted monitoring process.

References: [Gmail OAuth scopes](https://developers.google.com/workspace/gmail/api/auth/scopes),
[refresh-token expiry](https://developers.google.com/identity/protocols/oauth2#expiration),
[Google app-password guidance](https://support.google.com/accounts/answer/185833?hl=en).

### Existing Resend candidate

The code uses a distinct `PAYMENT_PRODUCTION_ALERTS_ENABLED=false` default. Enabling
it requires the exact live Vercel project ID/origin, Production environment, healthy
job configuration, a sending key and `PAYMENT_ALERT_FROM` as a plain email address.
No `resend.dev` or subdomain sender is accepted. Syntax readiness does NOT establish
provider domain verification or successful delivery.

The owner currently has only `kkarn.vercel.app`, not control of a sender domain's
DNS. Resend documents its default sender as test-only. Do not use it for live
operational alerts or claim that the UAT email proves production alerting. Choose
a verified sender/domain or separately approve a suitable alternative; never buy
a domain, upgrade a plan or add an integration automatically.

Production notifications remain fixed to `kash.nordeen@gmail.com`, contain only a
failure category and UTC-hour window, and never include customer/order data. They
use independent LIVE subjects/idempotency namespaces. No UAT bypass key is forwarded
to production. QStash raw-body signature, URL, expiry and size checks remain required.

After separately approved deployment/configuration, prepare exactly one recovery
schedule (do not create it during local work):

| Setting | Reviewed production value |
| --- | --- |
| ID | `portfolio-payments-production-recovery-v1` |
| Target | `https://kkarn.vercel.app/api/payments/recover` |
| Method/body | POST / `{}` / JSON |
| Cadence | `*/5 * * * *` UTC |
| Retry/timeout | 3 retries / 60 seconds |
| Failure callback | `https://kkarn.vercel.app/api/payments/alerts` |
| Callback content type | `Upstash-Failure-Callback-Forward-Content-Type: application/json` |
| Vercel bypass | NONE — never copy the UAT bypass |

Use production's matching QStash region/signing keys, not the sandbox US keys.
Keep new checkout and community off while proving monitoring. A separately approved
no-money acceptance can queue one valid opaque job UUID with a deliberately
non-JSON content type: the job verifier must reject before any database work.
Use three retries with a short test-only delay, then verify the signed exhausted
callback and Delivered email. Do not shorten the operational schedule's retries,
create payment orders, change payment state or replay real financial jobs to test.

Verify one active schedule, recovery HTTP 200 and correct read-back settings before
calling recovery operational. Preserve the intentional failed test as evidence.
Track daily quota, DLQ, repeated failures and missing scheduled deliveries separately:
failure emails cannot detect a stopped scheduler or a complete queue/email outage.
Five-minute recovery alone uses 288 publications/day before job work and retries;
recheck the actual account limits and usage before activation.

## Gate 2: customer-facing policies and service definition

`payment-policy-draft.md` is an unpublished review draft, not enforceable published
terms or legal advice. On 17 October 2026 (IST), the owner selected Option A and
its response/processing targets. `project-refund-policy.md` contains prepared
customer wording; Option B is not selected. The owner confirmed Keshav Kumar Karn
as an individual freelancer, support email kash.nordeen@gmail.com and business days
of Monday to Friday excluding applicable Indian public holidays. Complete the
remaining seller disclosures and confirm the actual refund procedure and retention
process. Scope/delivery/acceptance agreement by email before payment is owner-confirmed.
Complete policy/legal review before publication.
Publish approved pages and link them before checkout. Do not invent refund promises
or a tax-invoice status. Community stays off until its benefits, access delivery and
refund terms are separately defined.

The owner has now confirmed written email agreements before payment covering
scope, milestones, delivery dates and acceptance criteria. The policy and refund
drafts reflect that decision. `docs/payment-owner-decisions.local` is a private,
Git-ignored review template for unresolved business/retention/storage decisions;
it is not a secrets file or authority to publish its contents. Do not commit it,
dump its eventual contents into chat/logs or treat an empty field as approval.

## Gate 3: real backup and isolated restore rehearsal

No full backup/restore is claimed. Local PostgreSQL regression tests are not a
backup of the hosted database. A local command-availability check found none of
`docker`, `pg_dump`, `psql` or `supabase` on PATH; this does not prove they are absent
elsewhere. No tooling was installed or database export attempted. Before exporting,
the owner must approve:

- The exact source project, isolated destination and private encrypted storage.
- Who can access the backup, retention, and handling of financial/customer data.
- Any additional project/compute cost. Free-plan restores are not assumed.

A metadata-only transaction on 17 October 2026 confirmed PostgreSQL 17.11 and
`transaction_read_only=on`, with RLS enabled on the five production and five UAT
payment tables. Available selected extensions were pgcrypto 1.3, uuid-ossp 1.1
and supabase_vault 0.3.1; no pg_cron/pg_net row was returned. No customer rows,
Vault contents, passwords or schema exports were requested. Use PostgreSQL 17
tooling for a version-matched restore target; the existing embedded PostgreSQL 18
tests with mocked extensions are not proof of a hosted PostgreSQL 17 restore.

Use the current Supabase procedure to export roles, schema and data consistently,
with required custom payment schemas included. Do not store exports in this repo,
chat, public CI artifacts or an unencrypted shared location. Enter passwords only
through private prompts; do not put them in shell history or process arguments.
Record checksums, source/version, export timestamp and encrypted storage reference
without recording a credential or a customer row.

Restore only into the separately approved disposable target, with no provider
credentials, no active scheduler and no outbound payment/email side effects.
Account for custom-role passwords separately: they are not included in daily backups.
Database backups do not include Storage API file objects; include any required
objects in the approved backup scope. Confirm extensions and role/grant behavior
against the real destination rather than assuming migrations alone are sufficient.

Verify table counts, foreign keys, RLS, least-privilege role access, isolation of
live/UAT schemas, representative synthetic state transitions, sequence state and
application read-only access. Compare financial aggregates without printing customer
records. Record restore duration and the recovery point actually achieved. A restore
is not successful merely because import completed without an error. Do not overwrite
the live database or rotate active credentials as part of rehearsal.

## Gate 4: provider and controlled release sign-off

Clarify PhonePe's exact deadline/time zone and what access closes using the owner's
call details or a provider follow-up; a written message is not a prerequisite to
safe preparatory work. Ask which UAT evidence/refund scenarios remain required;
the local integration does not implement automated refunds. Do not represent the
UAT pass as provider sign-off.

Then obtain explicit authority for production configuration/deployment, recovery/job
activation, an owner-performed bounded real-payment test, and finally public project
checkout. Keep the INR 200–50,000 approved bounds and community disabled. Validate
the live API/DB/TLS/credentials independently; do not reuse sandbox credentials.
No Git push is implicit in deployment approval.

Rehearse stopping new checkout while preserving safe verification of already-started
orders. Never abandon pending orders, retry an ambiguous `/pay`, mark an order paid
manually, disable TLS/signatures or roll back to a deployment with revoked credentials.

References: [QStash callbacks](https://upstash.com/docs/qstash/features/callbacks),
[Resend test-sender restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain),
[Supabase backups](https://supabase.com/docs/guides/platform/backups),
[isolated backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore),
[PhonePe UAT checklist](https://developer.phonepe.com/payment-gateway/uat-testing-go-live/uat-checklist).
