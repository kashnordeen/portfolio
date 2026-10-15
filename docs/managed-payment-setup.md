# Managed payment setup — 2026-10-15

Owner approved external queue configuration and the reviewed database migration, without deployment,
payment activation or paid resources. Secrets remain private; none belong in this record.

## Database preflight

- Target: existing `portfolio-payments` project, `ghseaquzqlnpmiltsyqy`, ap-south-1, PostgreSQL 17.11.
- Existing organization is on the Free plan; no project, paid branch, backup upgrade or extension created.
- Before changes: orders=0, events=0, fulfilments=0, rate buckets=0; managed jobs absent.
- All four existing payment tables have RLS. Browser roles and service_role lack private schema usage.
- Backend login has no superuser, create-role/database, replication or RLS-bypass privileges or memberships.
- Existing migration history: `20261014112801_create_private_payment_store`,
  `20261014155321_prepare_private_payment_backend`.
- Reviewed artifact: `database/payment-jobs.sql`, SHA256
  `BA5212889DF82186D46EC1F38634852F91863AEC7DBE7D3F3B9454468727A90F`.

## Recovery and application safeguards

No full database backup or paid restore capability is claimed. The payment schema contains no customer or
financial records; its existing definitions are versioned in payment-orders.sql and payment-backend.sql.
The reviewed migration is additive and transaction-wrapped, with no credential, extension, network or
scheduler operations. Apply with a three-second lock timeout, ten-second statement timeout and locked
empty-orders assertion; refuse application if a payment has appeared since preflight.

An application error rolls back its transaction. A post-application verification failure leaves deployment
and checkout off: inspect the failure and preserve state, without automatic destructive down-migration,
password rotation or unrelated schema restoration. Any destructive reversal needs separate approval.
Before accepting real payments, establish and test a full backup/restore procedure.

## Applied migration and verification

- Applied migration `20261015071431_add_managed_payment_verification_jobs` using the reviewed artifact
  plus the bounded lock/statement timeouts and empty-orders guard above. Migration history confirms it.
- New jobs table has RLS; anon/authenticated/service_role have no schema, table or transition access.
- Seven managed functions are SECURITY INVOKER with fixed pg_catalog search path. Backend gets only
  intended table/function grants, not DELETE on financial/job rows or elevated role membership.
- Supabase security advisors reported zero findings after application and after synthetic checks.
- Target PG17.11 synthetic transition checks passed as the migration role: accepted scheduling before
  single-use initiation, cross-environment denial, lease/null-lease protection, stale replay rejection,
  pending successor, unique verified completion, amount mismatch to REVIEW and retired-job retry safety.
  Every synthetic record was rolled back; orders/jobs/events/fulfilments/rate buckets are all still zero.
- The initial verification script combined mutations and state subqueries in one IF. Subquery evaluation
  observed the old state and produced a false failure. This reproduced in local PostgreSQL; separating
  mutation statements from assertions fixed it RED→GREEN. No runtime or migration logic was changed.
- `database/check-payment-jobs-target.sql` preserves the restricted-role rollback test and has a local
  embedded PostgreSQL regression. Its SET LOCAL ROLE was denied by MCP's postgres role. Membership was
  not granted to bypass that boundary; the target transition run deliberately omitted role impersonation.
  Effective grants were checked separately. Actual restricted-login/driver/TLS and multi-session crash/
  locking tests remain mandatory before activation; the migration-role test does not establish them.

## Remaining progress

- QStash: owner completed private sign-in. Existing EU Region shows the Free subscription, and the
  Schedules panel reports no schedules created. The existing EU endpoint matches the implementation's
  fixed qstash.upstash.io publisher. No account, keys, messages, named queue or schedule were created by
  the agent; no paid plan, card or upgrade selected. A named queue is not required by this direct publisher.
- On the owner's retry request, Chrome blocked the GitHub authentication redirect through its origin
  approval gate. No workaround, alternate browser, cookie access or automatic authentication was used.
  Owner completed login privately and returned to Upstash before queue setup continued.
- Three empty Secret rows are prepared in Vercel portfolio, Production only: QSTASH_TOKEN,
  QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY. The owner must privately copy their EU Region
  Quickstart values and save them without redeploying. Names/type/scope alone were inspected; values,
  clipboard, token endpoints and production environment downloads were not accessed. Saving is pending
  owner confirmation; even saved variables do not prove an undeployed runtime can use them.
- Deployment, push, webhook registration, live transport tests and payment activation: not performed.
- Local verification after adding the target-check script: 124/124 tests pass; lint and TypeScript pass.
  No application runtime, frontend, amount limits, credentials or release flags were changed in this setup.

## Documentation checked

Supabase changelog and current backup documentation were checked. The PG17.11 ltree/legacy-pgcrypto/
btree_gist/custom-operator changes do not add dependencies to this plain payment migration. Direct
database TLS remains required. Free-plan dashboard restore availability is not assumed.

References: [Supabase backups](https://supabase.com/docs/guides/platform/backups),
[PG17.11 changes](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes),
[QStash regions](https://upstash.com/docs/qstash/howto/multi-region),
[QStash pricing](https://upstash.com/pricing/qstash),
[Vercel environment variables](https://vercel.com/docs/environment-variables).
