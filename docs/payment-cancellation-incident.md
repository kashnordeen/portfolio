# Cancellation investigation — 19 October 2026

## Confirmed evidence

Owner reference: `26224397-35df-4004-ac4e-c44dccd21372`.
PhonePe order: `OMO2610191242587971155114W`.

- The INR 200 order was created at 07:12:58 UTC and a production PhonePe checkout
  URL was recorded. No checkout URL, session token or customer details were exported.
- PhonePe's failed event arrived at 07:13:19 UTC; separate authenticated status
  verification persisted FAILED at 07:13:21 UTC. Recovery jobs completed.
- The authenticated Live merchant transaction detail reports `TXN_CANCELLED`,
  `REQUEST_CANCEL_BY_REQUESTEE`, source CUSTOMER, stage PRE_AUTHENTICATION,
  description "Customer cancelled the payment."
- Nine other website orders completed in the preceding 24-hour diagnostic window.
  This does not prove all customer journeys work, nor explain other failed attempts.
  A cancellation code does not establish why the customer left checkout.

## Application defects and local fix

1. The UI previously collapsed this cancellation into a generic failure.
2. The browser retained the cancelled order's idempotency key even on a fresh form.
   Resubmitting that key correctly returned the original terminal order, trapping
   the customer instead of letting them deliberately start a distinct request.

The status endpoint now optionally requests PhonePe `errorContext=true`, only after
session ownership and only for persisted FAILED orders with a provider order ID.
The additional lookup is limited to three attempts per session per minute and is
fail-soft. Only the exact pre-authorization cancellation tuple above is mapped to
the fixed public category CANCELLED, after checking provider ID, root FAILED state
and amount against the stored order. Raw provider text/instruments are discarded.
This lookup never writes a payment state or creates an order.

Only that verified category shows a cancellation explanation and an explicit
"Start a new payment" action. Clicking it removes only the obsolete browser request
key and opens the empty form; it does not create a checkout or authorize money.
Unknown failures, pending, mismatched, missing-context and REVIEW responses retain
the existing support/no-retry protection. Customers seeing a debit are told to
contact support before trying again. No automatic retries were added.

Official API reference:
https://developer.phonepe.com/payment-gateway/website-integration/standard-checkout/api-integration/api-reference/order-status

## Verification / release boundary

Regression tests were added first and failed against the old implementation.
Coverage includes exact cancellation classification, identity/amount/state mismatch,
ownership, unavailable/rate-limited explanations, public-field filtering, pending
retry protection, explicit browser-key reset and rendered cancellation UI.
All 255 tests pass, together with ESLint, TypeScript and the Vite production build.
The first sandboxed Vite attempt hit a Windows realpath permission error; the
approved local build outside the filesystem sandbox completed successfully.

No database migration, credentials, flags, webhook, recovery schedule, payment,
refund or Git push was changed during this investigation.

## Approved production deployment

On 19 October the owner separately approved deployment with existing settings
unchanged and no Git push, checkout creation or payment. Source `636e8e2` was
staged as `dpl_4SkeXC5FrSsLjJjV1TFrdxD14U3G`, checked, then promoted to
`https://kkarn.vercel.app`. The public alias independently resolves to this Ready
production deployment. The prior live deployment, `dpl_8VotKPvm8bqmWZq3oY6Renz1wa7u`,
is the rollback target retaining the same recovery configuration.

The protected candidate passed runtime config, expected UI bundle and unsigned
webhook/jobs/recovery 401 probes. Remote build passed strict read-only DB/TLS/RLS
preflight and built from 184 audited source files, excluding local builds and
private files. Build completion reported 24 seconds. Existing install warnings
were unchanged; the remote dependency audit reported zero vulnerabilities.

Live root and policy pages returned 200; runtime config stayed project true /
community false with no-store. Framing DENY and nosniff remain. Unsigned callback,
jobs and recovery POSTs returned 401; GET orders returned 405.

Chrome, using the owner's existing session, displayed the verified cancellation
message for this exact incident and an enabled "Start a new payment" button.
Clicking it navigated to `/?payment=project`, with empty editable details, optional
reference, INR 0 summary and disabled empty-form submit. No order POST or payment
was initiated. A task visual records the resulting live page.

The release's bounded five-minute warning/error/fatal runtime scan returned no
entries. This is not a new payment acceptance test or proof of future uptime.
Scheduled recovery configuration was not modified; no new signed recovery probe
was sent. Automated alerts and backup/restore remain deferred with manual
monitoring as previously accepted. Log drains were not re-audited for this release.
