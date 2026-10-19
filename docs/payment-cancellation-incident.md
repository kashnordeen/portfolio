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
refund, Git push or production deployment was changed during this investigation.
The local fix needs a separately approved production deployment before live users
can see it. A new real payment has not been performed by the agent.
