# Isolated PhonePe UAT

Owner approved a separate test Vercel project and sandbox-only database access on
2026-10-15. No live activation, paid upgrade, Git push or production-key changes.

## Fixed boundary

- Test Vercel project: `portfolio-payments-uat`, `prj_w7Q4nTh7atnTv4T2G1t9CEWYxQGj`.
- Planned stable test origin: `https://portfolio-payments-uat-kashnordeens-projects.vercel.app`.
  Verify this alias after the first disabled deployment; it is not yet an online checkout.
- Test schema/role: `private_payments_uat` / `portfolio_payments_uat`, in the existing
  `portfolio-payments` Supabase project `ghseaquzqlnpmiltsyqy`.
- Separate schema and login, not a separate physical server: database resources and
  availability are shared. No test access to live payment objects and no real customer data.
- UAT orders/jobs accept **only** `sandbox` rows. The login starts disabled, has no
  elevated capabilities or memberships, and is limited to four connections.
- Runtime schema names use quoted Postgres.js identifiers selected from fixed constants.
  No request or environment variable can supply a schema or queue URL.
- Jobs require the exact test project ID, stable HTTPS origin, sandbox provider environment,
  and the project's Production deployment target. Here **Production means this separate
  test project's stable target**, never PhonePe production credentials.
- Queued messages contain only opaque job IDs. Signatures remain bound to the exact URL.
  Test queue credentials must be independently provisioned; never copy the live queue keys.

## Provisioning

`scripts/payment-uat-schema.mjs` renders the three canonical migrations into one bounded
transaction, rewriting only fixed schema/role identifiers. It rejects existing targets;
never use it to overwrite a schema or rotate credentials. Local tests create both schemas,
exercise the real store under the restricted test role, and prove live reads are denied.

Human-only `database/manual-uat-secrets.sql` enables only the new test login and returns
five independent values. Run once privately in the approved Supabase SQL Editor and save
**all five** to a password manager. Do not share results with the agent or in screenshots.
The recipe refuses reruns after the login is enabled. It does not rotate live credentials.

In the **separate UAT Vercel project**, use server-only Secrets for these five values and
the PhonePe **Test Mode** Client Id, Client Secret, Client Version and Merchant Id.
No `VITE_`/public prefix. No secret values in shell arguments, source, logs or chat.

Nonsecret settings (initially all disabled):

```ini
PHONEPE_ENV=sandbox
PAYMENT_SITE_ORIGIN=https://portfolio-payments-uat-kashnordeens-projects.vercel.app
PROJECT_MIN_PAISE=20000
PROJECT_MAX_PAISE=5000000
PAYMENTS_ENABLED=false
PAYMENT_RELEASE_APPROVED=false
COMMUNITY_PAYMENTS_ENABLED=false
PAYMENT_JOBS_ENABLED=false
```

## Still required before test activation

Private secret entry; actual restricted-login TLS/CA verification; independent test queue
credentials; disabled deployment and alias verification; test webhook registration/delivery;
explicit approval to enable UAT jobs/checkout; provider UAT cases and go-live signoff.
Do not create a recovery schedule or send real money without separate approval.
The production project and community checkout remain disabled throughout UAT.

## Verified checkpoint — 2026-10-15

- Code remains in isolated worktree `D:\Projects\Portfolio\payment-uat`, branch
  `feature/payment-uat`, based on main `a60e8f0`; no merge or push.
- Created the test Vercel project and saved all eight nonsecret settings above as
  Production-only Config variables. No shared environment variables or live keys copied.
- Applied migration `20261015154433_add_isolated_phonepe_uat_schema` to the approved
  Supabase project. Exact rendered SQL SHA-256:
  `c84cc6f44886a8d46ea09f682df51ea613263f40137f65a78f25a53d34fbc721`.
- Target metadata: login disabled; no elevated role flags/memberships; connection limit 4;
  RLS enabled on all five tables; no security-definer functions; both sandbox-only
  constraints installed; no schema access for browser roles or either opposite backend role.
- Test tables and live orders are empty. No real payment/provider/queue requests.
- Supabase security advisors: zero findings. Actual password login and TLS remain untested.
- Fresh local verification: **130/130 tests**, lint, `tsc -b`, Vite production build;
  dependency audit: zero known vulnerabilities. Embedded database tests use PostgreSQL 18,
  while the hosted database is PostgreSQL 17; no claim of a real-login/cloud concurrency test.
- Chrome handoff: three blank, Production-only Secret fields in the **test project** for
  `PHONEPE_CLIENT_ID`, `PHONEPE_CLIENT_SECRET`, `PHONEPE_CLIENT_VERSION`. Owner must enter
  the saved Test Mode values and submit privately. No values were read or entered by agent.
- No UAT deployment, activation, schedule, private credential generation or paid upgrade yet.
