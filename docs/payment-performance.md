# Payment backend locality — 17 October 2026

## Scope and baseline

The owner approved moving backend execution to Mumbai, with no Git push and no
weakening of payment protections. Supabase project metadata confirms ap-south-1;
the accepted deployment's function summary confirms iad1. In the successful owner
checkout, order creation to checkout claim took 3.663 seconds. This measures only
part of backend preparation, not PhonePe's hosted-page load or full request time.
Available request logs did not provide per-phase durations or cold-start metrics.

## Change and safety

Set `regions: ["bom1"]` in vercel.json. All API functions move together; no route,
payment state transition, database schema, secret, amount limit, idempotency,
signature check, TLS configuration, queue region or webhook URL changes. Static
assets retain normal CDN delivery. No new payment or financial authorization is
needed to publish this infrastructure change, and none will be performed by the
agent. Existing manual monitoring and deferred alerts/backups are unchanged.

Reference: https://vercel.com/docs/functions/configuring-functions/region

## Release gate and rollback

Keep the current verified deployment serving during the candidate build. Run the
full tests, lint, build and native dependency audit, then require the candidate's
production DB preflight, actual bom1 function placement, expected config and
unsigned callback/job rejection before promotion. Preserve runtime project
checkout/release/jobs true, community and both alert flags false, INR 200–50,000,
production origin/environment and the existing server-only credentials.

Rollback target: `dpl_2jfComLTybSVH9sTofdJCP7YJPN8`, the owner-accepted payment
deployment, preserving recovery/jobs. No database rollback is needed. Roll back
on startup/DB failures, broken authenticated recovery or a checkout regression.

## Deployment and verification

- Source `838a408`, deployment `dpl_E9yLRPMQ5yh7B89ziDSiKV79uRL5`, URL
  `portfolio-7hqjb9qjg-kashnordeens-projects.vercel.app`, explicitly promoted to
  kkarn.vercel.app after candidate checks. No Git push or new payment occurred.
- All 235 tests passed, lint/build passed, native npm audit found zero known
  vulnerabilities, and the remote strict production DB preflight passed.
  Existing remote npm deprecation/cache/script-policy warnings were not suppressed;
  dependency installation scripts remain disabled.
- Vercel's deployed function summary reports bom1 for orders, config, jobs,
  reconciliation and alerts. Public config response routing also reports
  bom1::bom1, confirming actual execution rather than only build placement.
- Candidate and public config: project true, community false. Public root 200,
  correct PhonePe-compatible referrer policy, config no-store. Unsigned POSTs to
  jobs/recover/webhook remain 401 in both candidate and public checks.
- The existing scheduled authenticated recovery POST returned HTTP 200 on this
  exact deployment at 16:30:00 UTC / 22:00 IST. Its database/permission path worked
  after promotion; the 401s above were deliberate unsigned guard probes. No new
  schedule, credentials, financial request or customer-data probe was created.

No faster-checkout number is claimed before measurement. A region change cannot
guarantee an instant PhonePe-hosted page; provider/network latency remains outside
this app's control. The previous successful real-payment acceptance is retained;
this region-only change has not been used to initiate another real payment.
