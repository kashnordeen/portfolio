# Payment portal setup

## Current status

The Supabase database was provisioned on 2026-10-14:

- Project: `portfolio-payments` (`ghseaquzqlnpmiltsyqy`), in `kashnordeen's Org`.
- Region: South Asia (Mumbai), `ap-south-1`.
- Organization plan: Free, with the existing spend cap enabled. No paid upgrade was made.
- Dashboard: https://supabase.com/dashboard/project/ghseaquzqlnpmiltsyqy
- Data API and automatic table exposure were disabled at project creation; automatic RLS was enabled.
- Migration `create_private_payment_store` was applied from `database/payment-orders.sql`.
- Migration `prepare_private_payment_backend` was applied from `database/payment-backend.sql` on 2026-10-14.
- Tables: `private_payments.orders`, `private_payments.events`, `private_payments.fulfilments`, `private_payments.rate_limits`.
- All four tables have RLS enabled. Policies target only `portfolio_payments_api`; browser roles `anon` and `authenticated` still have no schema usage.
- `portfolio_payments_api` was provisioned with NOLOGIN, NOINHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE and NOBYPASSRLS. It inherits no other role.
- The owner enabled LOGIN in Chrome on 2026-10-14. Metadata checks confirm all elevated capabilities remain off.
  A password and application connection still require private setup; no credential value has been read by the agent.
- Real database checks in `database/verify-payment-backend.sql` passed: role restrictions, duplicate reservations/events/fulfilments,
  worker leases, immutable amounts, completed-state protection, and refusal to delete orders. These are database-level
  smoke checks, not a concurrent-load test or a driver/TLS connection test.
- Synthetic test records were rolled back. Counts in all four payment tables remain zero.
- The administrator's temporary SET-role permission was rolled back and verified restored (SET=false, INHERIT=false).
- The integrity checks in `database/verify-payment-orders.sql` passed, and all synthetic test data was rolled back.
- Before the backend migration, Supabase security advisors reported only the informational [RLS Enabled No Policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) notices. Backend-only policies are now present; there are still no browser-access policies.
- The security advisor was rerun after the backend migration and returned no findings.

The local checkout interface is available at `/?payment=community` and `/?payment=project`.
The server implementation and portal API wiring are now prepared locally, but have NOT been deployed.
Local Vite does not run the `/api` functions: the portal safely falls back to disabled checkout.
Production has only the initial PhonePe credentials, `PHONEPE_ENV=production` and `PAYMENTS_ENABLED=false`.
No real PhonePe API call or payment was made. The existing public portfolio actions are unchanged.

### Locally implemented

- Vercel Node functions: `GET /api/payments/config`, `POST /api/payments/orders`,
  `GET /api/payments/status?order=<uuid>`, `POST /api/payments/webhook`, `POST /api/payments/reconcile`.
- Server-owned community price (69900 paise), exact decimal project amount conversion, configurable integer-paise bounds.
- Same-origin creation requests; persistent rate limits; opaque Secure/HttpOnly/SameSite=Lax session cookie; session-owned status reads.
- Parameterized PostgreSQL queries, verified TLS, refusal to use administrative database usernames.
- Immutable order terms and durable idempotency: only the first reservation can call `/pay`.
  A timeout never automatically retries checkout. Uncertain orders remain pending until reconciliation/manual review.
- PhonePe OAuth expiry caching, Standard Checkout v2, environment-specific API URLs, strict checkout-host validation.
- SHA webhook authentication, merchant validation, semantic event deduplication, durable recording before acknowledgement.
  Notifications schedule verification; they cannot themselves mark a payment complete.
- Authenticated reconciliation endpoint, atomic worker claims with lease IDs, amount/provider-order crosschecks,
  monotonic completed state, and a unique pending fulfilment record. No access or emails are delivered automatically.
- Portal submission and return-status handling. No credentials or personal details are saved in browser storage;
  only an opaque idempotency UUID is persisted. A failed network request does not generate another key.
- Unit/contract tests use fake provider responses only. These do NOT replace real PostgreSQL integration tests or PhonePe UAT.

### Still required before deployment/go-live

1. The backend migration is now applied and the owner enabled role login. No application connection is configured.
   Set its strong password privately,
   and store its connection string in Vercel as `DATABASE_URL` (Secret), not an administrative connection string.
2. Configure the remaining values in `.env.example` directly in Vercel. Keep production secrets out of Preview.
   `DATABASE_URL` must have no `ssl`/`sslmode`/certificate query options; the driver enforces verified TLS.
   Use `DATABASE_CA_CERT` if the provider requires its CA certificate; never set `rejectUnauthorized=false`.
3. Configure a **SHA** webhook in PhonePe for `checkout.order.completed` and `checkout.order.failed` at
   `https://kkarn.vercel.app/api/payments/webhook`. Its username/password are independent of OAuth credentials.
   HMAC and refunds are not implemented; do not select HMAC or refund events for this listener.
4. Provide the real merchant ID as `PHONEPE_MERCHANT_ID` and choose `PROJECT_MIN_PAISE`/`PROJECT_MAX_PAISE`.
   Marketing price tiers are not hardcoded invoice/payment limits. Invoice matching remains manual;
   paying an arbitrary reference does not settle a full invoice.
5. Provision a durable worker outside the browser that calls `/api/payments/reconcile` with
   `Authorization: Bearer <PAYMENT_RECONCILIATION_SECRET>` at the required short intervals and continues
   when the browser closes. No scheduler is installed. A daily or once-minute Vercel cron is not sufficient
   for the initial short-interval checks. Worker endpoint runs small batches; capacity/load testing is required.
   The current Supabase project offers `pg_cron` 1.6.4 and `pg_net` 0.20.4 (neither enabled yet),
   and Vault 0.3.1 is installed. [Supabase Cron](https://supabase.com/docs/guides/cron) supports sub-minute schedules,
   so a database-driven dispatcher is an option without another worker service. It must check for due orders before
   dispatching, protect its secret in Vault, prevent overlapping requests, and monitor failure/latency/usage.
   It must stay inactive until the endpoint is deployed and verified. No job or outgoing HTTP request has been created.
6. Complete database concurrency/RLS integration tests, sandbox/UAT, authenticated webhook delivery checks,
   duplicate/out-of-order/timeout tests, and a deployment smoke test. Sandbox credentials are still missing.
7. Define terms/privacy/refunds, manual support/review/receipt procedures, monitoring and backups.
   Configure community benefits, fulfilment and delivery later; community checkout stays independently disabled.
8. Only after review and explicit approval: deploy, verify readiness, then set `PAYMENT_RELEASE_APPROVED=true`
   and `PAYMENTS_ENABLED=true`. Community additionally needs `COMMUNITY_PAYMENTS_ENABLED=true`.
   These are release gates, not proof that the worker or business procedures are configured.

No push, deployment, credential generation, worker subscription, scheduler activation or live payment has been made.
Only the private database migration and rolled-back smoke tests have now been executed externally.

### Current private-credential handoff

The owner enabled **User can login** for `portfolio_payments_api`; role creation, database creation, RLS bypass,
replication, superuser and inherited privileges remain off. A strong private password and verified-TLS connection
configuration are still required; the agent must not enter/confirm/submit a new authentication credential through the browser.
Do not change the existing `postgres` account or reuse its password. Never paste a database password into chat.

`database/manual-payment-secrets.sql` is a **human-run-only** setup recipe, NOT a migration. It has not been executed
by the agent. Run it once yourself in the correct project's SQL Editor, then copy each returned value directly into
Vercel Production as a Secret variable. It generates 32 random bytes per password/server secret (64 hexadecimal
characters), sets SCRAM-SHA-256 password storage, and uses a temporary SECURITY INVOKER function with PUBLIC
execution revoked. No literal password is written into the saved SQL recipe; the query result contains secrets.
Never share, screenshot, download, or commit those results. This does not make a general guarantee about database
audit logging; privileged database administrators must be trusted. Rerunning rotates the password and produces new
secrets, so do not rerun merely to check whether setup worked. Close the result after storing the values privately.

The connection endpoint was verified from the project's Chrome Connect panel:
transaction pooler `aws-0-ap-south-1.pooler.supabase.com:6543`, database `postgres`,
custom user `portfolio_payments_api.ghseaquzqlnpmiltsyqy`. The URL deliberately has no SSL query overrides;
the backend enforces certificate verification. Actual driver/TLS authentication is still untested.

Keep `PAYMENTS_ENABLED=false`, `PAYMENT_RELEASE_APPROVED=false`, and `COMMUNITY_PAYMENTS_ENABLED=false`.
The returned webhook username/password must later be configured in PhonePe's SHA webhook settings as well;
storing them in Vercel alone does not register a webhook or deploy an endpoint.

Run unit tests with Node.js 24 (`npm test`); the test runner imports server/client TypeScript using native type stripping.
The production dependency audit reports no vulnerabilities. The full audit currently reports two existing high-severity
development-only dependency warnings (`brace-expansion`, `source-map-js`); review/fix them before release.

## Before backend integration

1. Implement the backend using a restricted database role and a verified TLS connection. Do not expose an administrative database credential to the browser.
2. Connect the backend to the provisioned database via server-only environment variables. No application database connection is configured yet.
3. Define what community registration includes, how access is delivered, and the refund policy.
4. Confirm the accepted project payment range and whether a reference must match an issued invoice.
5. Obtain PhonePe sandbox credentials and configure the test webhook authentication method in the merchant dashboard.

Production credentials alone are not suitable for sandbox testing. Do not paste any credentials into chat.
Add secrets directly to the hosting provider's server-side environment settings; never use a `VITE_` prefix.
The merchant currently has production credentials only. Sandbox credentials must be obtained before end-to-end UAT testing.

## Proposed backend configuration

These are server-only backend configuration names; see `.env.example` for the complete template:

- `DATABASE_URL`: PostgreSQL connection string, with TLS enabled and certificate verification appropriate to the provider.
- `PHONEPE_ENV`: `sandbox` during testing. Production requires an explicit go-live change.
- `PHONEPE_CLIENT_ID`, `PHONEPE_CLIENT_SECRET`, `PHONEPE_CLIENT_VERSION`: matching credentials for the selected environment.
- `PHONEPE_MERCHANT_ID`: expected merchant ID in authenticated notifications (not the OAuth client ID).
- `PHONEPE_WEBHOOK_USERNAME` and `PHONEPE_WEBHOOK_PASSWORD`: PhonePe SHA webhook credentials. HMAC is not implemented.
- `PAYMENT_SESSION_SECRET`: independently generated server secret for order ownership/session verification.
- `PAYMENT_RECONCILIATION_SECRET`: independently generated credential for the background reconciliation worker.
- `PAYMENTS_ENABLED`: false until configuration, sandbox verification, and business terms are complete.
- `PAYMENT_RELEASE_APPROVED`: false until explicit release approval after all readiness checks.
- `COMMUNITY_PAYMENTS_ENABLED`: false while community benefits/delivery remain undecided.
- `PROJECT_MIN_PAISE` / `PROJECT_MAX_PAISE`: owner-approved project payment bounds as integer paise.
- `PAYMENT_SITE_ORIGIN`: the exact HTTPS origin (`https://kkarn.vercel.app` for production).

Do not use production secrets in preview deployments. Do not commit `.env` files or log credential values.

## Required server behavior

- Validate name, email, reference and decimal amount on the server. Convert decimal strings to integer paise without floating-point rounding.
- Community orders always use 69900 paise from the server's product definition, regardless of browser input.
- Bind project payment amounts and invoice references to immutable orders. The currently displayed Basic and Medium ranges are marketing estimates, not invoice totals.
- Save the pending order before contacting PhonePe. Use a persisted idempotency key for duplicate submissions and a unique merchant order ID.
- Authenticate order-status requests with an opaque session; knowing an order UUID alone must not expose customer information.
- Validate allowed origins for customer mutations, enforce request size limits, and use persistent rate limiting. Origin checks alone are not authentication.
- Use PhonePe's hosted checkout URL exactly as returned after validating it against the provider's current approved HTTPS hosts.
- Verify webhook authentication according to the configured SHA scheme. If HMAC is added later, verify the original request bytes before parsing using the provider's documented algorithm. Never use a frontend callback as payment proof.
- Verify the merchant, order, amount and root-level payment state against PhonePe's Order Status API before fulfilment.
- Apply payment state updates atomically and safely handle duplicate, replayed and out-of-order events. Never downgrade a confirmed paid order to pending because an earlier notification arrives late.
- Acknowledge authenticated webhooks promptly only after durable recording. Process delivery using an outbox/worker so retries cannot grant access twice.
- Reconcile pending orders on a durable background schedule even when the customer closes the browser. Follow PhonePe's current UAT reconciliation requirements; do not rely on a long-running serverless request or browser polling.
- Separate payment success from community access delivery and project invoice settlement. Partial project payments do not settle the full invoice.
- Display pending, failed and verified success states accurately. Provide receipts with the payment reference, amount and date; do not label receipts as tax invoices without the required business details.
- Restrict refunds and administration to authenticated administrators, with an audit trail and refund-status reconciliation.

## Sandbox verification

Test amount tampering, unauthorised status reads, repeated form submissions, wrong webhook authentication,
duplicate callbacks, delayed success, payment failure, cancelled checkout, refunds and interrupted delivery.
Review the customer-facing terms, privacy notice, service description and refund policy before enabling checkout.
Follow the merchant's PhonePe UAT/go-live process before switching to production.

## Official references

- [PhonePe Standard Checkout](https://developer.phonepe.com/payment-gateway/website-integration/standard-checkout/api-integration/api-integration-website)
- [PhonePe authorization](https://developer.phonepe.com/payment-gateway/website-integration/standard-checkout/api-integration/api-reference/authorization)
- [PhonePe webhook authentication](https://developer.phonepe.com/payment-gateway/website-integration/standard-checkout/api-integration/api-reference/webhook)
- [PhonePe UAT checklist](https://developer.phonepe.com/payment-gateway/uat-testing-go-live/uat-checklist)
