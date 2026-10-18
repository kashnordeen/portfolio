# Verified payment confirmation — local update

Prepared 17 October 2026. The owner explicitly requested keeping this change local:
do not push or deploy it without new approval. Production settings and notification
services are unchanged.

## Customer experience

- A server-verified `COMPLETED` status replaces the frozen checkout form with
  “Payment successful” and “Thank you!”
- The confirmation displays the server-confirmed INR amount, payment reference,
  recipient, PhonePe as provider and received time in IST.
- A real `Return to home` link navigates to `/`. There is no automatic redirect,
  so the customer can retain their reference. No further checkout form is shown.
- Focus moves to the confirmation heading once completion is received. Tab reaches
  the return-home link. The portfolio's semantic color tokens are retained;
  no animation dependency was added.
- The copy confirms this transaction only, not remaining project balance or
  delivery fulfilment. It does not claim that any email or receipt was sent.

## Trust boundary

The existing authenticated status API and client response validation remain the
source of truth. Redirect/query parameters cannot mark an order paid. Pending,
failed, manual-review and malformed completed responses never show the receipt.
No payment creation, provider integration, database state transition, runtime flag,
webhook or background job was changed.

## Verification

- The new completed-state regression test failed against the old portal, then
  passed with the new UI. Six focused portal tests pass.
- Full suite after the motion refinement: 243 tests passed, zero failures/skips. ESLint and the TypeScript/Vite
  production build passed.
- Browser verification used a read-only loopback fixture server serving the built
  application with fake API responses. It used no production credentials or orders,
  and its script remains in ignored build output, not source control.
- Checked 320px, 768px, 1024px, 1440px and default desktop rendering. Confirmed
  heading focus, keyboard navigation and the return-home link actually reaching
  the portfolio.
- Browser checks confirmed a pending response plus `success=true` stays pending;
  a completed response without a valid paid timestamp displays a verification
  error rather than a receipt. No real payment was made for these checks.

## Owner notifications are a separate change

The existing deferred Gmail integration is for operational failure alerts, not
successful-payment confirmations. Success emails need their own server-side,
deduplicated post-verification delivery path and private send-only OAuth setup.
Do not send notifications from a browser return or trust an unauthenticated URL.
Email delivery failure must not reverse or alter a verified payment.

No Gmail permission/credential, paid SMS provider, additional service or notification
flag was created or enabled here. The owner can consider low-volume Gmail email
notifications and Gmail's phone push notifications before paying for SMS.

## Motion refinement — 18 October 2026

- Copy now reads “Thank you!” and “Your payment is confirmed. Thank you for your
  trust.” The decorative checkmark pops in, two soft rings dissipate and the text
  and receipt details reveal in a short sequence. The longest animation finishes
  after 1.2 seconds; none loops.
- New motion is scoped to `prefers-reduced-motion: no-preference`. The default
  static receipt stays complete, and the home action never waits for an animation.
  Keyframes animate only transform and opacity, not size, position or shadows.
- The heading retains programmatic focus without a decorative outline around the
  entire title. Keyboard-operated links keep their visible focus indicators.
- Two new regression tests failed before implementation and passed afterward.
  Browser computed styles confirmed the expected check, ring and reveal animation
  names, each with one iteration. The heading-to-home keyboard path still works.
- Checked 320px, 768px, 1024px, 1440px and default desktop rendering. Browser layout
  measurements showed no horizontal overflow, and the local preview logged no
  console errors. Reduced-motion gating was verified in the stylesheet regression
  test; the operating system preference was not changed.
- The read-only local preview used a fake INR 200 payment and no customer data or
  PhonePe requests. This refinement remains local, without a push or deployment.
