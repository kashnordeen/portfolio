# Payment portal setup

## Current status

The Supabase database was provisioned on 2026-10-14:

- Project: `portfolio-payments` (`ghseaquzqlnpmiltsyqy`), in `kashnordeen's Org`.
- Region: South Asia (Mumbai), `ap-south-1`.
- Organization plan: Free, with the existing spend cap enabled. No paid upgrade was made.
- Dashboard: https://supabase.com/dashboard/project/ghseaquzqlnpmiltsyqy
- Data API and automatic table exposure were disabled at project creation; automatic RLS was enabled.
- Migration `create_private_payment_store` was applied from `database/payment-orders.sql`.
- Tables: `private_payments.orders`, `private_payments.events`, `private_payments.fulfilments`.
- All three tables have RLS enabled; `anon` and `authenticated` roles have no schema usage or table-read privileges.
- The integrity checks in `database/verify-payment-orders.sql` passed, and all synthetic test data was rolled back.
- Supabase security advisors reported only the informational [RLS Enabled No Policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) notices. No browser-access policies are intentional for this backend-only store.

The local checkout interface is available at `/?payment=community` and `/?payment=project`.
It is a preview only. It does not save customer details, call PhonePe, create an order, or accept payments.
The checkout button is deliberately disabled. The existing public portfolio actions are unchanged.

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

These are proposed names for the backend integration; the current preview does not read them:

- `DATABASE_URL`: PostgreSQL connection string, with TLS enabled and certificate verification appropriate to the provider.
- `PHONEPE_ENV`: `sandbox` during testing. Production requires an explicit go-live change.
- `PHONEPE_CLIENT_ID`, `PHONEPE_CLIENT_SECRET`, `PHONEPE_CLIENT_VERSION`: matching credentials for the selected environment.
- `PHONEPE_WEBHOOK_SECRET` and `PHONEPE_WEBHOOK_KEY_ID`: if using HMAC authentication.
- `PHONEPE_WEBHOOK_USERNAME` and `PHONEPE_WEBHOOK_PASSWORD`: if using PhonePe's SHA authentication instead.
- `PAYMENT_SESSION_SECRET`: independently generated server secret for order ownership/session verification.
- `PAYMENT_RECONCILIATION_SECRET`: independently generated credential for the background reconciliation worker.
- `PAYMENTS_ENABLED`: false until configuration, sandbox verification, and business terms are complete.

Do not use production secrets in preview deployments. Do not commit `.env` files or log credential values.

## Required server behavior

- Validate name, email, reference and decimal amount on the server. Convert decimal strings to integer paise without floating-point rounding.
- Community orders always use 69900 paise from the server's product definition, regardless of browser input.
- Bind project payment amounts and invoice references to immutable orders. The currently displayed Basic and Medium ranges are marketing estimates, not invoice totals.
- Save the pending order before contacting PhonePe. Use a persisted idempotency key for duplicate submissions and a unique merchant order ID.
- Authenticate order-status requests with an opaque session; knowing an order UUID alone must not expose customer information.
- Validate allowed origins for customer mutations, enforce request size limits, and use persistent rate limiting. Origin checks alone are not authentication.
- Use PhonePe's hosted checkout URL exactly as returned after validating it against the provider's current approved HTTPS hosts.
- Verify webhook authentication according to the configured HMAC or SHA scheme. For HMAC, verify the original request bytes before parsing. Never use a frontend callback as payment proof.
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
