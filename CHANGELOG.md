# Changelog

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
