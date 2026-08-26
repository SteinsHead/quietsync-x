# Changelog

## 0.5.1 — 2026-08-26

- Fixed the remote-source dialog treating Close and Cancel as form submissions.
- Made Close, Cancel, Escape, and backdrop clicks bypass required-field validation and exit reliably.
- Reset unfinished source fields after the dialog closes.
- Applied the same explicit close behavior to the sync-preview dialog.

## 0.5.0 — 2026-08-26

- Rebuilt the dashboard around the mute-list review workflow instead of a portal-style card grid.
- Replaced the fixed sidebar with a compact top app bar and quiet, familiar tabs.
- Collapsed four KPI cards into one summary strip and moved the review table into the first viewport.
- Removed the decorative sync pipeline, category chart, gradients, grid texture, glass effects, and heavy shadows.
- Turned remote sources into dense list rows and settings into a calm single-column form.
- Restyled the popup and dark mode to match the same restrained visual system.
- Replaced every README and store screenshot with fresh local-preview captures containing synthetic data only.

## 0.4.0 — 2026-08-26

- Replaced the default black-and-green interface with a fresh blue-and-white visual system.
- Added a persistent Light/Dark appearance switch shared by the dashboard and extension popup.
- Reworked cards, navigation, forms, tables, dialogs, status colors, and focus states for clearer hierarchy.
- Refined the optional dark theme from green-black to a quieter slate-and-blue palette.
- Updated all README and Chrome Web Store screenshots using synthetic preview data only.
- Kept appearance preferences local with no new permissions, telemetry, or remote requests.

## 0.3.2 — 2026-08-26

- Fixed an unsafe fallback that could mistake X's Settings search field for the muted-word editor.
- Added support for X's newer `mutedKeywordTextInput` editor identifier.
- Restricted all typing to the dedicated muted-word route or dialog and explicitly excluded search fields.
- Added fail-closed navigation guards so sync stops immediately if X leaves the muted-word flow.
- Improved duplicate recovery by safely returning to the list before processing the next word.
- Added a browser regression that proves the Settings search value remains untouched.

## 0.3.1 — 2026-08-26

- Fixed the false “Add button not found” error on X's current Muted words page.
- Added compatibility with X's route-based add control and newer input/save identifiers.
- Added language-tolerant fallbacks for Chinese, English, Traditional Chinese, and Japanese interfaces.
- Updated the browser fixture to mirror the current Chinese X settings flow.

## 0.3.0 — 2026-08-26

- Added the complete QuietSync product identity, Chrome icon set, and polished dashboard/popup design.
- Added real local-preview product screenshots and release-ready repository documentation.
- Added explicit attribution, third-party notices, contribution guidance, and privacy-safe issue templates.
- Removed the unnecessary `tabs` permission and narrowed content-script injection to X Muted words pages.
- Restricted remote sources to HTTPS and omitted credentials and referrer data from dictionary requests.
- Added a clear warning that exported backups may contain sensitive private lists and source URLs.
- Hardened add-only duplicate comparison when stored normalized values have inconsistent casing.

## 0.2.0 — 2026-08-26

- Added one-click subscription to the x-comment-blocker public list.
- Added categorized TXT parsing, invisible-character cleanup, and username-to-`@handle` conversion.
- Added safe handling for regex entries unsupported by X.
- Added ETag refreshes, response-size and entry-count limits.
- Added confidence-gated automatic sync.
- Added duplicate detection, retry, jittered pacing, cancellation, and stalled-run recovery.
- Added onboarding, sync preview, source catalog, export tools, and richer sync status.
- Added a browser fixture for the complete X form automation path.

## 0.1.0 — 2026-08-26

- Initial local-first Manifest V3 MVP.
