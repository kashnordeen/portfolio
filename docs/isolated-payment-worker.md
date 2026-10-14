# Isolated reconciliation worker — local candidate, not deployed

Prior candidate, now superseded by the local managed-queue implementation in `docs/managed-payment-jobs.md`.
Do not run this Node process alongside managed jobs; no separate server or worker-secret handoff is needed.

Owner scope: prepare an alternative without deployment, push, paid resources or activation.
This candidate makes **no Supabase permission changes** and does not use the rejected scheduler
installation through another route. Hosting selection, provisioning and activation need separate approval.

## Boundary

`private host / Node 24 → HTTPS POST /api/payments/reconcile → existing restricted backend → PhonePe status`

The process has one server credential, `PAYMENT_RECONCILIATION_SECRET`. It has no database password,
PhonePe credentials, Vault access, public listener, checkout capability or direct payment-state writes.
The backend still owns database leases, amount/reference verification and atomic order updates.
This secret authorizes status reconciliation, not a new charge; treat it as sensitive nonetheless.

Only the fixed `https://kkarn.vercel.app/api/payments/reconcile` endpoint is reachable through this
dispatcher. No arbitrary endpoint environment override is supported. Redirects are not followed;
TLS verification must remain on. The request is an empty JSON object with no customer information.
Do not install customer/proxy middleware that records Authorization headers.

## Implemented locally

- `workers/reconciliation.mjs`: import-safe dispatcher with disabled gates, one request at a time,
  45-second deadline, a 1 KiB response limit and strict `checked`/`deferred` counters totaling at most three.
- `workers/run-reconciliation.mjs`: explicit CLI runner with exclusive per-volume instance lock,
  persisted pause marker, SIGINT/SIGTERM cancellation and generic errors that never print credentials.
- Healthy calls wait one second after completion. HTTP 429, 5xx and transport failures back off
  3/6/10/30 seconds, pausing after five consecutive failures. Healthy responses reset that counter.
- Authentication failure, redirect, other rejected endpoint or malformed response pauses immediately.
  Pauses survive restart. Failure to save a pause stops the process and preserves the lock.
- Normal shutdown removes only this process's lock. Crashes leave the lock in place for operator review;
  there is no automatic stale-lock takeover, reset command or pause deletion.
- Aggregate HEALTHY counters are logged at most once per minute. They prove handler execution only,
  **not successful payments**. Backoff and pause states are fixed messages. No raw HTTP errors/bodies,
  headers, customer data, secret values or environment dumps reach application logs.

Offline checks (use Node 24):

```text
node workers/run-reconciliation.mjs --check
node --test tests/isolated-worker.test.mjs
```

The supplied template has both gates false: `--check` and `--run` print DISABLED and perform no
network or filesystem operation. A configured `--check` validates values but still makes no requests.
No service, scheduled task, startup command or workflow is installed by this repository.
Tests use synthetic credentials, mocked HTTP and disposable local filesystem markers only.
Local verification on 2026-10-15: all 76 repository tests pass, including 13 isolated-worker scenarios;
worker lint, project type checks, production build and the disabled CLI check also pass.

## Hosting/secret handoff — not yet performed

1. Approve a dedicated, continuously running Node 24 host with a durable local volume, non-root account,
   controlled outbound HTTPS, secret storage and restart/alert management. No provider or price has been
   selected; do not assume a free/serverless tier supports a persistent process. No resource was created.
2. Supply only `workers/` to that host. Do not load the portfolio's `.env`, database URL, browser build
   or PhonePe keys. Use a private host secret manager; never put the bearer in command arguments or Git.
   The owner did not retain the existing bearer. A separately approved, private replacement must match
   Vercel Production before running. Do not rerun the database-password recipe or the blocked Vault recipe.
3. Set a dedicated absolute `RECONCILIATION_WORKER_STATE_DIR`, on a trusted local persistent filesystem.
   Parent directories must be controlled by the operator. Linux ownership and 0700 directory permissions
   are enforced. Windows ACLs are not configured by this code and require a separate access review.
   Exclusive creation is not a distributed lock and is unsuitable for network filesystems.
4. Use exactly one instance and one persistent volume. Locks cannot coordinate different volumes/hosts;
   backend leases remain a second line of defense, not permission to scale this worker blindly.
   Verify fsync/volume crash durability and state retention on the selected host. Do not auto-delete state.
5. Deploy and verify the backend only after explicit approval, initially with checkout flags false.
   Verify production DB authentication/TLS, endpoint non-redirect behavior, matching credentials and
   callback delivery. Webhook SHA credential entry remains a separate private owner handoff.
6. Prepare a separately reviewed fixed sandbox endpoint/credential for provider-approved UAT.
   This candidate targets production only; it cannot claim sandbox coverage from mocked tests.
7. Prove target-runtime HTTP/TLS, restart/crash recovery, two-process exclusion, network stalls,
   actual provider reconciliation deadlines and representative backlog capacity. Three orders per
   response and sequential HTTP impose a real capacity limit; a one-second delay is not a timing SLA.
8. Configure alerts for process down, missing heartbeat, pauses/backoff, due-order backlog, late verification
   and REVIEW orders. Deferred status checks can be provider failures even when dispatch is HEALTHY.
   Monitor backend/PhonePe failures separately. Readiness checks and explicit activation approval are required
   before setting both worker gates true and supplying an operator-controlled `--run` startup command.

Keep checkout activation independent of reconciliation: disabling new checkout after launch must not
stop verification of existing orders. Community payments additionally require benefits/delivery/refund terms.

For a pause or crash: keep checkout disabled where appropriate, inspect non-secret metadata and backend
leases, stop all instances, resolve the cause and review any state removal before restarting. A timeout
does not prove the remote request stopped. Never force an immediate second payment or mark an order paid.

No real credentials, provider calls, secret rotations, resource creation, push, deployment or activation
were used to prepare this candidate. The pg_net draft remains blocked and is not part of this alternative.

Implementation references: [Node 24 fetch and AbortSignal](https://nodejs.org/docs/latest-v24.x/api/globals.html),
[exclusive filesystem creation and filesystem caveats](https://nodejs.org/docs/latest-v24.x/api/fs.html).
