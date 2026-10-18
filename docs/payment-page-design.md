# Payment page design contract

Scope: local-only visual redesign of the existing payment portal. No provider, API,
database, secret, feature flag, or checkout authorization changes.

## Evidence and direction

- Reviewed the existing payment screen and the supplied payment/success screenshots:
  long vertical form, equally prominent unavailable option, and repeated reassurance
  made the action harder to scan.
- UI/UX Pro Max's `freelancer payment checkout minimal` search returned Flat Design
  and a three-step funnel. Adopt its clear progression, restrained surfaces, and
  typography-led hierarchy; reject marketing-funnel CTAs and its unrelated font/palette.
- Preserve the portfolio's locally bundled Geist font, semantic theme tokens and
  violet accent. No external font, UI-library or animation dependency is needed.

## Contract

- Job: pay an already agreed amount, not buy an undefined project or registration.
- Primary action: Continue to PhonePe. No guessed payment methods or delivery promises.
- Desktop: editorial heading, compact form plus sticky review panel; optional help below.
- Mobile: one column, full-width inputs and action, readable review and help sections.
- States: availability loading/disabled, community unavailable, valid/invalid amount,
  submitting, unresolved/failed/review, server-verified completion.
- Safety: reference stays optional; duplicate-attempt freeze and all server validation
  remain intact. URL parameters never prove payment.
- Motion: short entrance, button feedback, and progressive CSS scroll reveal for
  supporting help only. Form controls never depend on scroll animation. Reduced-motion
  gets all content without movement. No scroll hijack, confetti loop or fake trust badges.
- Finish gate: regression tests, lint/build, keyboard, responsive widths 320/768/1024/1440,
  light/dark visual inspection, and no overflow. Local fixture checks never charge money.

## Local verification — 18 October 2026

- 245 tests pass, including optional reference, amount limits, idempotency/security
  regressions, false-success rejection and new payment-page structure/motion checks.
- ESLint, TypeScript and Vite production build pass. No new package or network-loaded font.
- Browser checks: 320, 768, 1024 and 1440 CSS-pixel viewports, plus normal desktop;
  no horizontal overflow. Summary stacks below the form on narrow screens and is
  sticky beside it on desktop. The small-screen success receipt also fits.
- Keyboard: name → email follows visual order with a visible outline. Enter opens
  native help disclosures; focusing help cancels its scroll reveal. The completed
  heading receives focus, then Tab reaches Return to home.
- Read-only local fixtures: valid amount enables the action; over-limit amount
  disables it. Pending, failed and review freeze inputs and block checkout; none
  display success. Completed shows no form and uses the finite check animation.
- Visual review in both themes. Dark-theme measured idle input boundary contrast
  3.77:1 and supporting text contrast 6.99:1. Light supporting text contrast 10.35:1.
- Motion uses transform/opacity only and CSS scroll timelines with a static fallback.
  Reduced-motion disabling is covered by stylesheet tests; the OS preference was
  not changed. No screen-reader/axe or full penetration-test certification is claimed.
- All production settings and payment behavior remain untouched. No actual checkout
  or payment was created. The normal Vite page safely reports checkout unavailable
  because it has no local payment API. Test fixtures live only in ignored build output.
- Kept local per the owner's instruction: no deployment and no Git push.

## Connected progress and click feedback

- Three aligned points now share a connecting track. Transform-based fill advances
  from details to checkout when a submission starts, then to status verification
  when an order is being checked. The last point says "Verify status", not "paid".
- Submission triggers one short button lift and arrow launch. Disabled checkout
  does not animate on click or become enabled. Busy remains disabled and visibly busy.
- Desktop and 320px mobile tracker checked without overflow; native stage semantics
  retain exactly one `aria-current="step"`. Reduced-motion disables the transitions.
- A disposable loopback fixture confirmed actual click → stage 2 / both finite
  animations → stage 3 / pending, with no success receipt. The fixture never calls
  a provider or database and creates no real order or payment.
- 247 tests, ESLint, TypeScript and production build pass. Backend/flags unchanged.
