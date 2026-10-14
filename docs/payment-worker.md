# Background payment verification — local preparation

Status (2026-10-15): **blocked; not installed or activated in Supabase**. PGlite 0.5.10 executes
the worker functions in disposable PostgreSQL 18.6 with fake Cron, HTTP and Vault interfaces.
No real extension was enabled, HTTP request made, Vault secret generated or payment-integration deployment performed.
The existing `/api/payments/reconcile` handler remains responsible for authenticated PhonePe
status checks, amount/reference verification, leases and atomic order updates.

## Current blocker — supersedes the historical installation checklist below

- A local isolated Node candidate is now prepared in `workers/`; see `docs/isolated-payment-worker.md`.
  It avoids shared database scheduling/queue permissions but has not been hosted or activated.
- The owner approved the supported Vault server-administrator trust model, but that guard change
  has not been implemented. It would not resolve the separate shared transport/scheduler grants.
- Supabase documents that project-specific pg_net grant changes are unsupported and database login
  roles can read queued headers. Do not install the existing pg_net dispatcher with a Bearer credential
  on this project, and do not weaken its access guard.
- A synchronous HTTP alternative was investigated, not implemented. Restricted extension installation
  attempts failed on platform-owned grants and rolled back. Automatic security review rejected a
  retry that would leave public Cron scheduling permissions unrestricted. No extension, worker, job
  or Vault credential was installed, and no HTTP request was sent by these attempts.
- `database/payment-worker-extensions.sql` preserves strict checks for every HTTP function and
  Cron scheduling mutator. It is a **blocked checkpoint**, not an installation instruction. Do not
  remove checks, rerun a more permissive migration or switch tools to bypass the rejection.
- Next: obtain a reviewed platform-supported restriction design, or separately approve a worker
  host/design and its permissions. Broader database scheduling access requires explicit risk approval
  and another security review; it is not approved by a general request to continue.
- Do not run `manual-worker-secret.sql` until a supported disabled worker is installed and verified.
  No secret was rotated. Deployment was explicitly declined; no push or deployment was performed.

References: [Supabase pg_net grant limitation](https://supabase.com/docs/guides/troubleshooting/revoking-access-to-pg_net-objects-has-no-effect-0bbc16),
[Supabase inherited PUBLIC privileges](https://supabase.com/docs/guides/troubleshooting/custom-role-inherits-privileges-that-were-not-explicitly-granted-ddaa1c).

## Prepared files

- `database/payment-worker.sql`: blocked pg_net dispatcher draft; not installable under this project's intended isolation.
- `database/payment-worker-extensions.sql`: blocked, fail-closed restricted-extension checkpoint.
- `database/verify-payment-worker.sql`: post-install checks while both worker gates are off.
- `database/manual-worker-secret.sql`: **human-run-only**, one-time replacement of only the worker secret.
- `tests/payment-worker.test.mjs`: static SQL contract checks, not a PostgreSQL or HTTP simulation.
- `tests/payment-worker-runtime.test.mjs`: thirteen executable database scenarios using the existing order/backend
  migrations and worker SQL. Only the separately tested extension-presence preflight is removed to use mocks.
- `tests/fixtures/worker-extension-mocks.sql`: local-only extension interfaces, synthetic data, no HTTP transport.

Run `npm test` with Node 24. PGlite is pinned as a **development-only** dependency and uses an in-memory
database that is closed after testing; it has no Supabase connection or production credentials. Tests cover
disabled installation/verification, actual role permission denials, due-order filtering, missing/malformed/duplicate
secret fixtures, single in-flight dispatch, valid and invalid response handling, backoff, authentication failure,
stuck requests, column-level grant detection and rollback after enqueue failure. The human-only private
secret-generation recipe is never executed by these tests.

The dispatcher locks its singleton state with `FOR UPDATE SKIP LOCKED`, checks for due production
orders and ignores orders with an active reconciliation lease. It only POSTs an empty body to
`https://kkarn.vercel.app/api/payments/reconcile`, using a named Vault secret in a Bearer header.
It never calls checkout, writes payment states, or sends customer data.

Only one dispatch may be in flight. A missing response after 180 seconds pauses the worker and
preserves its request ID for review instead of endlessly queuing duplicates. Authentication failure
pauses immediately; other HTTP failures use bounded backoff and pause after five consecutive failures.
A successful HTTP response must be JSON with the handler's bounded `checked`/`deferred` counters;
a portfolio HTML fallback is not accepted as success. These counters only confirm handler execution,
not that any individual payment succeeded. Deferred orders continue to be verified by the handler.

## Historical preflight — not installation instructions

### Read-only review — 2026-10-14

- Target Supabase is PostgreSQL 17.11. pg_cron 1.6.4 and pg_net 0.20.4 are available but not installed;
  Vault 0.3.1 is installed. The worker is not installed and no queue/job exists from this implementation.
- Vault contains zero secrets; the worker's Vault name is absent. Only counts and catalog permissions
  were queried, never secret values, queued headers or function bodies.
- PUBLIC, anon, authenticated and portfolio_payments_api cannot read Vault. Browser/service_role roles
  have no usage/read access to private payment orders; only the restricted application role has backend grants.
  Its login is enabled, all elevated/inherited capabilities are off and it has no role memberships.
- The privileged service_role has Vault schema usage, SELECT/DELETE on its secret table/view and execution
  of Vault create/update/decrypt functions. Grants and object ownership originate from supabase_admin;
  postgres has grant options but cannot SET ROLE to that platform administrator. Do not assume a
  non-owner REVOKE removes another grantor's grant, and do not modify platform objects blindly.
- Security advisors returned no findings. The public security-definer rls_auto_enable function returns
  event_trigger, not an ordinary callable RPC. This is not evidence of leaked secrets or browser access.
- **Installation is paused for a design choice.** The current worker guard deliberately rejects
  service_role's Vault read permission. A regression case now confirms that it pauses without queuing.
  The supported Vault model treats this privileged server role as trusted; adopting that model would
  require an explicit, documented guard change, with browser/app Vault access and all non-admin worker
  control/queue access still denied. Alternatively, stricter platform-owned Vault restrictions require
  a separately reviewed administrative/support path. Neither option has been applied or approved.

See [Supabase Vault's privilege guidance](https://supabase.com/docs/guides/database/vault) and
[PostgreSQL's grantor-specific REVOKE rules](https://www.postgresql.org/docs/17/sql-revoke.html).

### Original proposed checks (blocked; do not execute)

1. Local function execution now passes in embedded PostgreSQL **18.6**, not the deployed **17**.
   Verify the target version and actual Cron/pg_net interfaces, multi-session locking, restart recovery,
   outage handling and delivery timing in UAT. PGlite is single-connection and the extensions are mocks;
   these tests do not prove cross-session concurrency, real network dispatch, TLS or Vault encryption.
   This preparation targets the project's previously observed PostgreSQL 17, pg_cron 1.6.4 and pg_net 0.20.4.
2. Review enabling Cron and pg_net in the dedicated payment project. Installation script deliberately
   does not enable extensions or modify shared extension permissions. [pg_net is beta](https://supabase.com/docs/guides/database/extensions/pg_net).
3. Resolve the above trust-model choice, then audit table, column, function and inherited grants to Vault and the `net` schema.
   pg_net temporarily stores the plaintext Authorization header in `net.http_request_queue`.
   The dispatcher fails closed if browser roles, service_role or the application role can read or modify
   queue/response columns, read decrypted Vault columns, or read/write dispatcher controls.
   Queue modification matters too: changing a queued URL could redirect its Bearer header.
   The guard does not replace
   a full privilege/RPC audit: trusted database/platform administrators can still access secrets.
   Do not dump queue headers or Vault contents for diagnostics. Review permission changes separately;
   this script does not silently revoke shared extension grants used by other workloads.
4. Apply the worker migration only after review, then run the post-install verification with both gates off.
   It installs `enabled=false` and creates `active=false` in the same transaction. Existing job names
   are rejected instead of overwriting another job. Keep both gates off until release approval.

## Worker-secret handoff

The owner did not retain a private copy of `PAYMENT_RECONCILIATION_SECRET`. Do not try to reveal the
saved Vercel Secret or rerun `manual-payment-secrets.sql`: that rotates the database password and
unrelated secrets. After disabled installation and access checks, the owner can run
`manual-worker-secret.sql` privately **once**. It generates 32 random bytes, stores their hex value
in Vault under `portfolio_payment_reconciliation`, and returns only the replacement
`PAYMENT_RECONCILIATION_SECRET` for the owner to update in Vercel Production as Secret.

The agent must not run this recipe or read its result. Never share, screenshot, export or commit the
result. Keep a private password-manager copy. The recipe refuses to replace an existing Vault name
or run with an active/in-flight worker. A failed value copy requires a separately reviewed recovery;
do not rerun it blindly. The database password, session secret and PhonePe credentials are untouched.
No general guarantee is made about privileged database/audit logging.

Vercel variable changes require a new deployment. Existing deployments retain the old worker secret,
so keep scheduling inactive during replacement and deploy only with explicit approval.

## Release and operation gates

- This dispatcher is production-specific. Do not point it at a Preview deployment or copy live secrets
  there. Prepare a separate, fixed UAT endpoint and independent test worker secret after sandbox access.
- Verify database TLS/authentication, webhook authentication, endpoint JSON responses and secret matching.
  Confirm the exact fixed HTTPS endpoint does not redirect before activation.
- [Supabase Cron supports second intervals](https://supabase.com/docs/guides/cron/quickstart), but a
  one-second trigger does not guarantee one-second HTTP delivery or PhonePe reconciliation timing.
  HTTP latency and batches of three orders limit capacity; measure under representative load.
- A one-second job can produce 86,400 run-history rows per day. Set an owner-approved retention policy
  scoped to this job (for example seven days) before activation. No history was deleted or cleanup job created.
- Monitoring/alerts must distinguish Cron errors, paused state, stale responses, growing due-order backlog,
  reconciliation lateness and orders in REVIEW. Merely seeing Cron "succeeded" is insufficient.
- Activate neither `worker_dispatch.enabled` nor the Cron job until the verified endpoint is deployed,
  operational safeguards are reviewed and the owner explicitly approves. No activation SQL is provided here.
- If disabling new checkout after launch, continue to reconcile existing orders. Do not erase an in-flight
  request ID to force retries: review its queue/response metadata and the order leases first.

The installation verification only checks the disabled path and permissions. Local tests execute the
SQL branches but do not prove target-version behavior, real HTTP dispatch, actual secret matching,
TLS, multi-session concurrency or UAT timing. Those remain release blockers.
