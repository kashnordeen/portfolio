# Background payment verification — local preparation

Status: **not installed, not activated and not runtime-tested**. No extension was enabled,
HTTP request made, Vault secret generated or payment-integration deployment performed.
The existing `/api/payments/reconcile` handler remains responsible for authenticated PhonePe
status checks, amount/reference verification, leases and atomic order updates.

## Prepared files

- `database/payment-worker.sql`: administrator-only production dispatcher and an inactive Cron job.
- `database/verify-payment-worker.sql`: post-install checks while both worker gates are off.
- `database/manual-worker-secret.sql`: **human-run-only**, one-time replacement of only the worker secret.
- `tests/payment-worker.test.mjs`: static SQL contract checks, not a PostgreSQL or HTTP simulation.

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

## Required before installation

1. Validate the SQL on an isolated PostgreSQL instance with mocked extension interfaces, then test the
   actual Cron/pg_net versions, locking, restart recovery, outage handling and delivery timing in UAT.
   This preparation targets the project's previously observed PostgreSQL 17, pg_cron 1.6.4 and pg_net 0.20.4.
   No local PostgreSQL/psql or Docker executable was found during preparation; SQL execution is unverified.
2. Review enabling Cron and pg_net in the dedicated payment project. Installation script deliberately
   does not enable extensions or modify shared extension permissions. [pg_net is beta](https://supabase.com/docs/guides/database/extensions/pg_net).
3. Audit table, column, function and inherited grants to Vault and the `net` schema.
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

The installation verification only checks the disabled path and permissions. It does not prove that
real HTTP dispatch, secret matching, TLS, concurrency or UAT timing works. Those remain release blockers.
