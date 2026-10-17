# Changelog

## Unreleased — payment integration (disabled)

### Fixed

- Bound payment request-body reads to four seconds and reject malformed/ambiguous checkout redirects, with regression tests. Published with checkout and jobs disabled.
- Rewrites TypeScript-relative imports when compiling native Vercel API functions, preventing missing-module startup failures. Added an emitted-module-graph regression check and disabled dependency installation scripts for deployments.

### Added

- Added owner-approved service, refund and privacy pages linked from checkout and the footer, plus an opt-in read-only production database preflight. Community remains closed; Gmail and backup setup are deferred by the owner.
- Prepared a production-only Gmail send-only owner-alert option with fixed recipients, strict OAuth scope checks and credential-safe failure handling. Account setup is deferred; this code is not deployed and all gates remain off.
- Added a project-payment button beside pricing, plus desktop/mobile navigation and footer links to the same-origin payment page. Checkout release gates are unchanged; community payments remain off.
- Added disabled managed-job transport with official QStash signature verification, opaque payloads, fixed targets and bounded publishing; not deployed or configured with real keys.
- Prepared backend-only durable job generations, checkout acceptance claims, verification leases and transactional successor intents, with local PostgreSQL rollback and permission tests; migration not applied externally.
- Connected checkout to scheduler acceptance before its single provider initiation, and webhook recording to durable immediate-verification intents; live release flags remain off.
- Added signed managed verification/recovery endpoints with shared-store throttles, stale-generation/lease protection, retryable publication failures and no database access before production signature verification. Managed mode rejects the old bearer scheduler.
- Prepared a disabled, isolated Node reconciliation worker candidate with no database/PhonePe credentials, bounded HTTP, durable pause markers and exclusive instance locking. Hosting, credentials, real transport/UAT and activation remain unapproved and untested.
- Server-only PhonePe checkout preparation with immutable orders, session-owned status reads, authenticated webhook recording and worker-driven verification.
- Portal API connection and honest pending/failed/review/verified states, with no automatic second payment after ambiguous errors.
- Independent community and production release gates. Payments remain disabled; no deployment or real payment test has been made.
- A server environment template, restricted database-role migration and automated security/contract checks.
- Applied the backend database migration with a non-login, non-inheriting role and verified real PostgreSQL order-integrity checks; all synthetic records were rolled back.
- Added a human-run private credential setup recipe; it generates no literal passwords in the saved query text and cannot be invoked through the public payment portal.
- Prepared an inactive, administrator-only background dispatcher with due-order filtering, overlap protection, fixed HTTPS target and failure pausing; installation, HTTP and database runtime testing are still required.
- Prepared a separate human-run worker-secret/Vault recipe that does not rotate the database password or unrelated credentials; it has not been executed.
- Added disposable local PostgreSQL function tests for worker gates, permission denials, filtering, malformed responses, backoff and rollback using a pinned development-only PGlite runtime and fake extension interfaces. Supabase PostgreSQL 17, real HTTP/TLS and scheduler timing still require testing.
- Recorded the read-only Supabase access review and verified that the strict worker guard pauses on the platform's privileged service-role Vault access; no installation or permission changes were made.
- Recorded the blocked extension setup: restrictive attempts rolled back, and broader scheduler grants were rejected by security review. Preserved strict guards; worker and webhook registration remain pending, with deployment explicitly declined.

### Changed

- Recorded the owner-confirmed email agreement on project scope, milestones, delivery dates and acceptance criteria before payment. Customer-policy publication and live activation remain pending.
- Refined the payment portal with amount guidance, a recipient/review summary, clearer closed/loading/error states, keyboard-accessible field guidance and reduced-motion styling. Published to kkarn.vercel.app with all checkout/job/alert gates false; no Git push or real payment.
- Recorded the owner-approved ₹200–₹50,000 inclusive project-payment range in the setup template, with boundary tests. Live payments remain disabled and hosting configuration is unchanged.

### Security

- Prepared browser security headers for all Vercel paths and a report-only CSP candidate, with regression tests. This local change is not deployed; payment flags, API routing and CORS are unchanged.
- Rechecked local build/lint, 169 tests and npm audit (zero known vulnerabilities). Read-only hosted checks confirmed checkout disabled, RLS enabled on the ten payment/UAT tables and no Supabase security-advisor findings; production monitoring, policies and restore acceptance remain open.
- Patched transitive development dependencies brace-expansion and source-map-js without changing direct dependencies or enabling installation scripts.

## [1.6.0] - 2026-10-14

### Added

- Community registration fee of ₹699/- and indicative Basic (₹10K-₹20K+) and Medium (₹50K-₹80K+) project pricing.

### Changed

- Rebuilt the About section with clearer personal copy, a dedicated community invitation, readable pricing, and a compact portfolio facts strip.
- Centered the contact action beneath pricing, with smoother floating motion that pauses offscreen and respects reduced-motion preferences.
- Refined mobile and desktop layouts, keyboard navigation, and light and dark theme styling.

## [1.5.1] - 2026-10-12

### Updated

- Portfolio identity now consistently uses the full name Keshav Kumar Karn.
- Social sharing assets now use the canonical `https://kkarn.vercel.app` deployment URL.

### Changed

- Project links, installer downloads, Credly verification links, and contact social links are temporarily hidden behind policy visibility flags for straightforward restoration.

## [1.5.0] - 2026-10-07

### Added

- Downloads Organizer menus check GitHub's latest stable release on page load and use its actual installer assets without requiring portfolio redeployment.
- Loading and fallback status announcements, unavailable-build labels, and release metadata/error regression checks.

### Updated

- Download version and release notes now follow the detected release; verified v1.0.0 links remain an explicitly labeled fallback.
- Portfolio package version to 1.5.0; existing platform logo menus and styling preserved.

### Fixed

- Removed the fixed desktop release version from the project card.
- Missing, incomplete, or unexpected installer links are not guessed or mixed with older release assets.
- GitHub errors, invalid responses, and eight-second request timeouts retain usable fallback downloads.

## [1.4.0] - 2026-10-06

### Added

- Voxel avatar in the header and a generated transparent portrait on the interactive ID card.
- Downloads Organizer with its real app screenshot, GitHub link, and six verified Windows, macOS, and Linux download options.
- GramFlow Web live website action and project technology summaries.
- Repository-backed engineering notes, project status, real GramFlow sign-in screenshot, and explicit concept-artwork labels.
- Resume PDF linked unchanged with the owner's approval, and social sharing image metadata.

### Updated

- Redesigned project cards with readable copy, separate actions, mouse depth, and scroll reveals.
- Shorter hero and About summaries, with full About information available on demand.
- Professional strengths with concise keywords and evidence from actual projects.
- Logo-led technical toolkit with expandable skill lists, a project-backed capabilities section, and a cleaner contact form layout.
- Rebuilt avatar ID-card design; specialty updated to Web, Android & Applied AI with remaining personal details preserved.
- Windows, macOS, and Linux logo menus with platform-specific download choices.
- Portfolio package version to 1.4.0.
- Compact career milestones, education, certification cards, skills, and footer; full details remain available on demand.
- Degree and CS fundamentals aligned with the resume; selected technologies now prioritize the project stack.
- Displayed avatar optimized from 1.37 MB PNG to 84 KB WebP; removed the global cursor trail and animated footer banner.

### Fixed

- ID-card animation avoids React renders every frame and supports keyboard interaction and vertical touch scrolling.
- Reduced-motion handling, visible keyboard focus, and anchor spacing.
- Tablet navigation and narrow-screen ID-card sizing.
- Unified navigation buttons with the existing smooth-scroll engine to avoid competing scroll animations.
- Removed cursor spotlight and glowing borders from both certificate cards without changing full previews or Credly verification.
- Keyboard-accessible certificate preview buttons, native focus-trapped previews with Escape support, and screen-reader announcements for contact form results.
- Added runnable checks for platform download mappings, toolkit logos, and image-only certificate previews.
- Native keyboard-operable, named dock buttons and focus-trapped mobile navigation with Escape support.
- Higher-contrast primary colors and light-theme headings, a skip link, and larger social touch targets.
- System-aware, storage-safe theme initialization and reduced-motion theme changes.
- Contact validation for whitespace-only messages and field lengths, HTTP/timeout handling, and persistent result announcements.
- Resume button styles apply to the actual link, with a regression check; technology motion can be paused, and decorative duplicates are hidden from screen readers.

## [1.3.0] - 2026-09-18

### Added

- Official Cisco Credly badge artwork and public verification links for Network Defense and Cyber Threat Management.

### Updated

- Certification cards now present certificate previews and independently verifiable digital badges together.
- Portfolio package version to 1.3.0.

### Fixed

- Replaced sign-in-dependent Credly earner links with shareable public credential URLs.

## [1.2.0] - 2026-09-18

### Added

- GramFlow Android as a standalone project with its verified repository link and dedicated artwork.
- Expanded cybersecurity, security tooling, systems, cloud, database, language, and AI/ML skill categories.

### Updated

- Standardized the portfolio identity to Keshav Karn and repositioned the profile as a CSE student.
- Expanded the bio, About copy, project-based specialty, technology stack, and professional strengths.
- Split GramFlow into dedicated Web and Android project entries.

### Fixed

- Removed self-assessed proficiency percentages from the skills section.
- Removed the self-referential Portfolio Website project card.
- Restored the ESLint 9 validation workflow with a project-local flat configuration.
- Tightened shared form and theme-transition types and removed an invalid textarea utility class.

## [1.1.0] - 2026-09-18

### Added

- FINDORA project with verified repository link, project summary, and branded artwork.
- Svelte, FastAPI, and PyTorch to the displayed technology stack.
- Cisco Cyber Threat Management certification with a verified image preview.

### Updated

- Professional profile, About copy, experience timeline, technical skills, social links, and page metadata.
- Portfolio package version to 1.1.0.

### Fixed

- Removed the obsolete API Dashboard project link and unverified testimonial placeholders.
- Removed the non-functional resume placeholder until a valid resume is supplied.
- Aligned primary navigation with the visible page sections and improved keyboard accessibility.
- Associated contact form labels with their inputs and added browser autofill hints.
- Updated the timeline listener to remove a deprecated Framer Motion console warning.
- Removed public certificate PDFs and the completion transcript asset for improved credential security while preserving full-screen image previews.
