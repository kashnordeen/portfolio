# Checkout handoff incident — open

## Second-stage checkout and optional-reference repair

After the exact-host fix, the owner reported that PhonePe opened but encountered
an immediate error, later described as continuous loading. No final completed
payment has been confirmed. The owner also showed Chrome's native saved reference
suggestions; the field incorrectly remained required in the UI, API and database.

PhonePe's current official troubleshooting documentation explicitly requires
`strict-origin-when-cross-origin` for its processing-error/missing-QR case:
https://developer.phonepe.com/payment-gateway/website-integration/standard-checkout/api-integration/troubleshooting
The deployed document used `no-referrer`. This is a confirmed configuration
mismatch, not yet proof that it is the sole cause of the owner's loading issue.
The fix sends only the public website origin on cross-origin HTTPS checkout;
no customer fields, query strings or opaque checkout tokens are added to logs.
Payment API responses keep their own no-referrer policy, and same-tab navigation
through the provider's exact returned URL is unchanged.

Project reference is now optional across form, server validation and storage.
Missing/null/blank references normalize to SQL NULL; supplied references still
reject invalid types, controls and more than 120 characters. The additive
`database/optional-project-reference.sql` migration removes only the expected
required-reference constraint after checking its exact definition, with bounded
lock/statement timeouts. It preserves data, RLS, immutable payment terms and all
other amount/state checks. Production migration `make_project_reference_optional`
was applied and its security-preservation metadata checks passed. Fresh isolated
UAT provisioning also includes the migration; existing UAT is not changed.

Five RED failures reproduced the form/server/schema/header problems before the
fix. GREEN: all 234 tests passed, lint passed, the normal-access build passed and
native npm audit found zero known vulnerabilities. The sandboxed build had the
same Windows realpath EPERM as earlier; no file/security protection was weakened.
New checkout is temporarily paused on the jobs-preserving rollback while the
reviewed candidate is prepared. Existing verification/recovery remains enabled.
No additional automated live checkout, funds authorization or Git push occurred.

### Deployment/acceptance

Application source `bdbd0f7` was deployed as
`dpl_2jfComLTybSVH9sTofdJCP7YJPN8`
(`portfolio-1mr6b8fqp-kashnordeens-projects.vercel.app`), verified as a candidate,
then explicitly promoted to kkarn.vercel.app. Remote strict DB preflight passed.
Runtime project checkout/release/jobs are true; community and both automated
alert flags are false; origin/environment and INR 200–50,000 bounds are unchanged.

Public checks: HTML 200 with strict-origin-when-cross-origin, config 200 with
project true/community false and API no-referrer; unsigned jobs/recover/webhook
POSTs each returned 401. A fresh Chrome payment tab displayed the optional label,
had no required/list attributes and autocomplete off; no console errors appeared.
The focused empty-reference screenshot is saved with the task's visual artifacts.
No new checkout was submitted by the agent.

The owner was handed a fresh form for one controlled INR 200 test with blank
reference, conditional on no previous authorization/debit. A previous unresolved
order remains PENDING with no paid timestamp, and its independent jobs continue.
Owner-controlled real-payment acceptance remains pending. Do not reuse/replay an
ambiguous old intent or call this incident resolved from tests alone. Chrome may
retain old local form history despite autocomplete off; no browser-wide
history/settings were cleared.

## Root cause identified; live acceptance pending

The single approved no-charge diagnostic session was submitted only to protected
candidate `dpl_4QvjqAYAJjqDS4VdZoAR4eQRPctL`, source `42eec7f`. It produced fixed
diagnostics `INVALID_CHECKOUT_URL`, reason `HOST`, host class `MERCURY_T2`.
PhonePe's authenticated production API returned its alternate
`mercury-t2.phonepe.com` checkout host, which both server and client rejected.
A token-free HTTPS HEAD to that exact host returned 200 under normal certificate
validation. The session was not authorized/paid and will not be replayed.

The root fix accepts exactly that additional production hostname in both layers,
retains the legacy production host and leaves sandbox pinned to its own host.
No wildcard, HTTP, credentials, non-default port, fragment, lookalike or arbitrary
PhonePe-subdomain allowance is added. New reproduction tests failed in both server
and client before the change, then passed. All 231 tests, lint/build and native
audit pass. Deployment and owner-performed real payment acceptance remain pending.

## Root fix published; waiting for owner authorization

Application source `87ddc37` is deployed as
`dpl_4dLS6wnZVUQDQzgmaBjPtCe5eQVo` and explicitly promoted to kkarn.vercel.app.
The production build preflight passed again; candidate and public config returned
project enabled/community disabled. The published `index-C04RFwdJ.js` bundle was
retrieved directly and contains the alternate host. Unsigned POSTs to jobs,
recovery and webhook still return 401. Existing amount limits, managed jobs and
disabled automated alerts are preserved. No Git push, financial authorization,
manual payment-state change or refund occurred.

The owner was asked to perform one final INR 200 checkout using reference
LIVE-CHECKOUT-ACCEPTANCE in a fresh Chrome tab, authorize payment privately, then
return the website reference for independent state/webhook/fulfilment checks.
The diagnostic-session approval was used exactly once and grants no permission
for another automated live checkout or any funds transfer. Real acceptance is
still pending; do not call this incident closed yet.

17 October 2026 (IST). Do not mark resolved until the owner can complete a real
payment and independent provider verification records the correct completed state.

## Observed evidence

- The initial public checkout request returned HTTP 202, not a redirect. The
  affected production order is pending, has a provider reference populated by
  verification, and has no saved checkout URL. No completion event or fulfilment
  was recorded at triage. Customer identity, amounts and credentials are omitted.
- Owner confirmed PhonePe's payment screen never opened and no debit occurred.
- Signed jobs are being published and processed. Current DB role has UPDATE
  privileges on checkout URL, provider reference, expiry and state columns.
- The original provider/checkout exception was deliberately suppressed in
  production. Existing evidence cannot yet distinguish response validation,
  transport interruption or persistence failure. Do not guess at a provider host,
  loosen redirects/TLS or retry the original ambiguous `/pay` call.
- Owner explicitly approved temporarily pausing new checkout, preserving managed
  verification/recovery, then reopening for the controlled test. Promoted safe-stage
  deployment `dpl_CF3UApBpyf5VjbXhMAhhsUJ18L7i`; this is not a jobs-off rollback.

## First diagnostic repair

- Production provider failures now emit only fixed event/operation/category and
  optional numeric HTTP status. Sandbox keeps its existing event namespace.
- Checkout catches emit only a fixed provider/persistence stage. Logging failure
  cannot change the HTTP 202 ambiguous-payment response or initiate a second pay.
- Pending UI no longer assumes that the customer returned from PhonePe when
  checkout never opened. No automatic retries or new financial state transitions.
- RED reproduced suppressed diagnostics and a throwing-logger regression; GREEN:
  227 tests passed, lint/build passed, native audit zero known vulnerabilities.
  The first sandboxed Vite build hit Windows EPERM; the approved normal-access
  rerun passed. This is diagnostic coverage, not proof of a working live redirect.

## Acceptance still required

The owner-controlled reproduction on the diagnostic build emitted
`PAYMENT_PROVIDER_FAILURE / PAY / INVALID_CHECKOUT_URL` followed by the fixed
PROVIDER-stage event. The failure is response URL validation, not OAuth or DB
checkout persistence. Structural diagnostics now classify URL components and
known host classes using fixed values only; they do not record hostnames, URLs,
tokens or customer data. All 228 tests, lint/build and native audit pass.
The owner approved exactly one additional no-charge INR 200 diagnostic session
using their public name/support email and reference CHECKOUT-DIAGNOSTIC. It has
not yet been submitted. Public checkout is paused again on the safe stage;
the diagnostic session is intended for a protected candidate only.

Diagnostic source `2c4fcbd` was built with a passing strict production DB preflight,
deployed as `dpl_DPLotpDu78iz27SjemN7gF1Lvjhr`, candidate config checked true/false,
then explicitly promoted. New project checkout is reopened only for the agreed
owner-controlled attempt; community/alerts remain false and managed jobs remain
true. Chrome disconnected before a fresh agent tab could be opened, so the owner
was asked to open a new Chrome tab and try Continue once, stopping before payment
authorization. The failed initial intent must not be automatically replayed.

Deploy the reviewed diagnostic candidate, preserve amount bounds and community off,
verify runtime flags, then use one owner-controlled checkout attempt. Inspect the
fixed failure category, reproduce the actual handoff defect, fix it with a failing
test and redeploy. Never clear the old order, fabricate paid status, replace a
provider reference, bypass signatures/TLS, publish credentials or push Git.
The owner must authorize any actual payment privately. Match its independent
provider state/amount/order, webhook processing and one fulfilment before closing.
