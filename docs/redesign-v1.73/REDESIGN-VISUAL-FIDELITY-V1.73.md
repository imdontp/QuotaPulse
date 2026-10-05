# QuotaPulse dashboard fidelity candidate v1.73

## Live Activity changes

- The Overview rail now reads actual usage events from the selected Overview range's trailing 30 minutes and queries the latest event separately for each observed harness, so one busy harness cannot fill a shared page before deduplication. Known harness cards follow the source-reference order: Hermes Agent, Codex CLI, Claude Code, OpenCode.
- Call cards show a tokens/min average calculated from the exact minute-trend interval and use the same real API buckets for their sparkline. Rates aggregate matching harness/provider/model routes across profiles unless the user selected a source filter. The total is the call-only rate returned by the global minute-trend query. Raw event token totals remain available in the accessible card description.
- A custom interval entirely in the future skips activity requests and shows no activity/rate while the rest of Overview remains available.
- Hermes is currently classified by its adapter as a session aggregate. Its card shows the latest observed aggregate total, labels it as observed tokens, and explains that no per-call timeline exists. It does not invent a rate, a green Live indicator, or a sparkline.
- The cards now use the concept's compact four-column layout, per-harness color accents, route icons, and View All link. English and Thai text are localized. Timestamp and grain remain available to assistive technology, and every card still opens its related History view by keyboard.

Production UI values continue to come from the daemon. The browser screenshots use an in-memory synthetic fixture only. Concept sample rates and totals are not inserted into production.

## Validation

- `npm run build -w @quotapulse/web` passed. Vite continues to report the existing 532.87 kB `App` chunk advisory.
- `npm test` passed across daemon/web/tray: **440 tests passed** (99/143/198).
- Overview Chromium gate passed en/th × dark/light: **4 screenshot pairs, all byte-identical**, with no masks. It also checked API-derived totals and per-harness rates, per-harness latest-event queries, future-only custom-range handling, unique harness cards, aggregate and unknown-grain states, History keyboard navigation, sparkline bucket positions, and 390/900/1280px overflow.
- The existing Overview range, quota selection, Runtime Map detail/filter, and layout checks passed in the same browser gate. Review screenshots are candidates; repeatability is not whole-image similarity approval.
- The local reference viewer smoke test passed for current/previous Overview, expanded Runtime Map, and the carried-forward Live page.
- The extracted Windows bundle passed **5 start/stop checks outside the repository dependency tree**. The ZIP verifier checked every entry against its built source.
- Source concept hashes are unchanged from v1.72 and remain listed in [reference-hashes.json](reference-hashes.json).

The full redesign target of 99–100% visual fidelity remains open. The upper Overview metrics and navigation still differ from the concept, and the Hermes API grain cannot supply the per-call rate shown in the concept image. See the [v1.73 comparison viewer](reference-review.html) for the current/previous captures and source overlay.

## Local review package

- ZIP: `C:\Users\TH12367283\Projects\QuotaPulse\tmp\worktrees\redesign-foundation\tmp\review-bundles\QuotaPulse-v1.73-wDAWCX.zip` (**201,578,552 bytes**, 3,135 files).
- SHA-256: `e8d0eef48eb091cedc4b400fe00b4afa7f2a620596c63b9b3eb66ba512050f46`.
- Archive contains no application profile. It targets Windows x64, requires host Node ABI 127 (built with Node v22.13.1), disables readers, installs no scheduled tasks, and is a local review build rather than a production installer.
- Build, archive, and extracted-runtime manifests are in [bundle-build.json](bundle-build.json), [archive-verification.json](archive-verification.json), and [bundle-verification.json](bundle-verification.json).

## Next fidelity pass

Continue with the upper Overview composition and visible sidebar navigation. Keep metric labels and values bound to measurements the daemon actually provides; document any source-concept details that require unavailable data.
