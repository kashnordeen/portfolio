# Production payment readiness — NOT a go-live approval

Prepared locally on 2026-10-17 IST. Live checkout/community remain disabled. No
deployment, scheduler creation, paid plan, DNS change or real transaction is authorized
by this document. Sandbox evidence is recorded in `payment-uat.md`.

## Completed evidence

- Sandbox success/failure callbacks, independently verified payment states and
  fulfilment deduplication were exercised; these are not production acceptance.
- UAT recovery is active and delivered HTTP 200. Its controlled exhausted-delivery
  callback returned 200; Resend showed the expected owner email Delivered.
- With explicit deletion approval, only the obsolete PhonePe Test Mode registration
  was removed. After reload one Enabled SHA registration with two events remained.
  Its dashboard validation reached the application (400 for the unsupported probe).
  No production webhook or credential was modified.
- Production alert support is now a local candidate, not deployed or configured.
- Fresh local checks: 167 tests passed, including UAT compatibility and production
  isolation, lint, TypeScript/API compilation and frontend build. Native npm audit
  reported zero known vulnerabilities; no server-only alert/queue markers appeared
  in the browser bundle. This is local evidence, not hosted production acceptance.

## Gate 1: production operational alerts and recovery

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
customer wording; Option B is not selected. Confirm the business identity/contact,
support calendar, scope/delivery terms, actual refund procedure and retention
process, and complete policy/legal review before publication. Publish approved
pages and link them before checkout. Do not invent refund promises or a tax-invoice
status. Community stays off until its benefits, access delivery and refund terms
are separately defined.

## Gate 3: real backup and isolated restore rehearsal

No full backup/restore is claimed. Local PostgreSQL regression tests are not a
backup of the hosted database. Before exporting, the owner must approve:

- The exact source project, isolated destination and private encrypted storage.
- Who can access the backup, retention, and handling of financial/customer data.
- Any additional project/compute cost. Free-plan restores are not assumed.

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

Confirm PhonePe's exact written deadline/time zone and what access closes. Ask the
provider which UAT evidence/refund scenarios remain required; the local integration
does not implement automated refunds. Do not represent the UAT pass as provider sign-off.

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
