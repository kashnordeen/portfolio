# Gmail owner alerts — deferred, local code only

On 17 October 2026 (IST), the owner approved preparing send-only Gmail OAuth, then
asked to postpone Google project/account setup. Do not continue account setup,
create credentials, grant consent, change Vercel variables or activate this sender
until the owner resumes it. No Google project or credential was created by this work.

## Prepared implementation

- Production only, behind the existing production-alert opt-in and exact project,
  environment, origin, job and TLS checks. UAT keeps its existing Resend route.
- Explicit `PAYMENT_ALERT_PROVIDER=gmail`; the committed template still selects
  `resend`, with all payment/job/alert flags false and all Gmail values empty.
- Server-only `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`.
  No dependency, database table, public OAuth endpoint or customer login was added.
- Existing QStash raw-body signature, expiry, URL and category validation runs
  before any Google request. No unauthenticated email/test endpoint exists.
- Only Google's fixed token and Gmail send endpoints are called, with HTTPS,
  redirects forbidden, deadlines, response-size caps and generic errors.
- Refreshed tokens must report exactly `https://www.googleapis.com/auth/gmail.send`;
  broader or missing scopes are refused. This is a runtime check, not a substitute
  for carefully reviewing the original Google consent grant.
- The mailbox and recipient are fixed to `kash.nordeen@gmail.com`. Messages contain
  only a failure category, UTC-hour window and fixed operator guidance. No payment
  reference, customer record, original queue payload or credential enters an email.
- An accepted API receipt proves submission only. The owner must confirm actual
  receipt during a separately approved no-customer-data acceptance test.

Gmail has no equivalent to Resend's provider-enforced idempotency key in this code.
A successful callback stops retries, but an ambiguous send can produce duplicate
emails when QStash retries. There is no in-process send retry or silent provider
fallback. Do not promise hourly coalescing or exactly-once Gmail delivery. No
database dependency was added merely to deduplicate outage alerts.

## When the owner resumes setup

Use an isolated Google project, not the unrelated GramFlow project automatically
selected in Chrome. Do not add billing or paid services. The owner must complete
any terms, consent and credential creation privately, save recovery material in a
password manager and enter the three matching server-only values directly in the
existing portfolio project's Production environment. Never use `VITE_` variables,
chat, screenshots, shell arguments, Git or this chat's Gmail connector tokens.

Request only `gmail.send` for the owner's account, with offline access. Review
Google's actual application/verification requirements. An external OAuth app left
in Testing normally receives a seven-day refresh-token lifetime for Gmail scopes;
that is unsuitable as durable production alerting. Do not create a permanent
public OAuth login flow or automatically publish the Google consent application.

Keep checkout, community, jobs and alerts disabled while configuration is prepared.
Deployment and signed recovery/failure-delivery acceptance need their own scoped
approval. Test with no customer data, no payment order and no financial mutation;
verify owner receipt and revoked-token behavior before calling alerts operational.

If Gmail stays deferred, record an approved alternative monitoring/incident process
before a controlled payment pilot. Failure email alone also cannot detect a stopped
scheduler or total queue/email outage; existing provider dashboards require review.
Deferral does not silently waive recovery testing or authorize payment activation.

References: [Gmail sending](https://developers.google.com/workspace/gmail/api/guides/sending),
[OAuth scopes](https://developers.google.com/workspace/gmail/api/auth/scopes),
[offline authorization](https://developers.google.com/identity/protocols/oauth2/web-server#offline),
[token expiration](https://developers.google.com/identity/protocols/oauth2#expiration).
