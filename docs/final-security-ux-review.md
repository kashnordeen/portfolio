# Security and UI review — 2026-10-17

Reviewed application source: `28fa575`; documentation baseline: `d03ff0e`.
Scope: the payment/portfolio feature branch, current public deployment, restricted
database access, restored links, responsive UI and keyboard interactions. This is
a bounded engineering review, not a penetration test or compliance certification.

## Verification

- Full suite: 239 tests passed, no failures or skips. Lint and the TypeScript/Vite
  production build passed. The installed dependency audit reported zero known
  vulnerabilities; no dependency versions were changed for this review.
  A repeat build initially hit a Windows filesystem EPERM restriction; the same
  source built successfully when rerun with local filesystem permission. No
  deployment or source workaround was used.
- An independent security reviewer found no confirmed blocking issue in payment
  ownership, immutable order terms, webhook/queue authentication, idempotency,
  job generations/leases, SQL privileges, TLS or credential boundaries. Its 68
  focused tests passed, including embedded PostgreSQL state transitions and
  actual queue-SDK signature verification.
- Mutation experiment: temporarily removing the session-identity comparison from
  `sameTerms` caused the immutable-terms regression test to fail. Restoring the
  original file returned all 14 handler tests to green. The original SHA-256
  matched exactly; the mutation was neither committed nor deployed.
- A pattern scan covered 18,163 current tracked text lines and 10,521 patch lines
  across 85 unpublished commits. All 22 matches were deliberately fake test
  fixtures, including localhost database URLs and redaction-test sentinel values.
  No actual credentials were identified in these patterns. This was not an
  exhaustive secret-detection product scan. Real environment files, private keys,
  build output and Vercel metadata are not tracked. Added ignore rules for private
  keys and credential bundles to reduce accidental future commits.
- Supabase's security advisor returned no notices. All five private payment
  tables have RLS enabled, no anon/authenticated table grants and no browser-role
  policies. The payment login has no superuser, inherited-role, role-creation,
  database-creation, replication or RLS-bypass privileges. No customer rows or
  credentials were exported during this review.

## Live HTTP checks

| Check | Result |
| --- | --- |
| Portfolio and all three policy pages | 200 |
| Public payment config | Project enabled; community disabled; no-store |
| Session cookie attributes | Secure, HttpOnly, SameSite=Lax |
| GET to order-creation endpoint | 405 |
| Cross-origin checkout request | 403 before order creation |
| Malformed same-origin checkout body | 400 before order creation |
| Status without the owning browser session | 404; no customer/payment details |
| Unsigned webhook, jobs and recovery requests | 401 |
| `/.env` and `/.git/config` | 404 |
| HSTS, nosniff, frame protection | Present; frame policy DENY |
| Document referrer policy | strict-origin-when-cross-origin |

Current deployment `dpl_GPSXrx6x5uV71sk8apqchQHhypmt` received scheduled recovery
HTTP 200 responses at 17:05, 17:10 and 17:15 UTC. The separate unsigned audit probe
returned 401 as expected. Ingress region in a request log is not function location;
the application's function configuration remains Mumbai (`bom1`).

The owner's earlier real INR 200 payment was server-verified successfully. This
review did not create another order, initiate checkout or authorize any payment.

## UI and accessibility checks

- Desktop plus 390px and 320px responsive checks; inspected light and dark themes.
  Restored the original theme and cleared the temporary viewport override.
- Portfolio has one H1, no images missing an alt attribute, no unnamed buttons
  in the checked DOM, labelled contact fields, and safe rel attributes on external
  new-tab links. This does not establish full heading or screen-reader conformance.
- Mobile navigation opens using Enter; Escape closes its dialog and returns focus
  to the menu trigger. The skip link moves focus to the main content.
- Certificate preview opens by keyboard, names its dialog, initially focuses Close,
  and restores the triggering button's focus after Escape.
- Payment fields have accessible names; the reference is optional, with browser
  autocomplete disabled. INR 199.99 and 50,000.01 are rejected; 200 and 50,000 are
  accepted by amount validation. Name/email remain required by native form
  validation. No valid form was submitted. Review totals update with the amount.
- Project repository/site buttons, download menus and assets, Credly links and
  contact social links remain restored. Their browser and regression evidence is
  also recorded in `production-launch.md`. No installers were executed.
- No console errors were captured in the clean portfolio/payment audit tabs.

## Known gaps and accepted deferrals

- CSP remains report-only, not an enforced resource allowlist. Other headers above
  are enforced. Enforcing CSP needs a separately tested rollout.
- Automated production failure alerts and backup/restore testing remain explicitly
  deferred by the owner. Initial monitoring is manual through existing dashboards.
  A successful recovery request is not proof of automatic alerting or restoreability.
- Expired unresolved payments enter manual REVIEW; late notifications do not
  automatically release them. Review those cases before deciding payment/refund
  outcomes; never ask a customer to repeat an ambiguous payment.
- Community checkout remains disabled until its benefits/access process is agreed.
- No axe/Lighthouse, assistive-technology, load, live concurrent-session race or
  comprehensive penetration test was performed. These checks cannot prove an
  absence of every vulnerability. There is no automated CI accessibility audit.

## Version-control boundary

Publish the reviewed `feature/payment-uat` branch only, without force-pushing,
merging into `main`, changing production flags or creating new deployments.
Preserve the separate main checkout and its unrelated untracked files. Publishing
the branch is source backup/review delivery, not a claim that deferred operational
safeguards are complete.
