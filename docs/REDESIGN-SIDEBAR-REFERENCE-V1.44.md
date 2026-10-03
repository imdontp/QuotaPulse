# Shared sidebar reference refinement v1.44

Continue the entire real-data dashboard and Settings redesign. Direct inspection
of the reference sidebar showed framed stat icons with counts above labels,
larger navigation marks, a blue/violet active row and a waveform brand footer.
The previous application put stat counts on the right and omitted the footer.

## Changes

- Quick stats retain native definition-list semantics and their actual
  `/api/runtime-summary` values. Counts move above their labels, icon frames
  become 30px and numeric text uses tabular figures. The project's icon is a
  folder; models use a cube, providers headphones, and recent sessions activity.
- The last icon uses the success accent as decorative reference treatment.
  It does not claim that recent sessions are running. The recorded-data and
  five-minute observation explanation remains visible, including stale state.
- Desktop navigation icons become 23px. The dark active-row surface is adapted
  from sampled reference blue/violet endpoints: `refs/alerts.png` at (20,340)
  is RGB (9,28,95), and (200,340) is RGB (22,26,41). The existing light-theme
  treatment remains usable.
- The reference waveform/footer is restored with localized "Keep the flow
  going" copy and the real app name. No fabricated reference version number is
  displayed. The footer is hidden alongside Quick stats on collapsed sidebars.
- All nine existing navigation destinations remain available. No extra health,
  running-process, quota or account state is inferred from sidebar decoration.

## Validation

The web TypeScript/Vite build passed with the existing large-chunk warning. The full
capture set now includes Settings as well as the eight dashboard pages.
The shell gate independently reads runtime-summary values, checks count/label
geometry, and retains responsive navigation, command dialog, keyboard, fonts,
API/chart/detail and repeated-screenshot checks. Tests use an in-memory database,
readers disabled and forbid external/write requests.

The complete nine-page run passed English/Thai and dark/light, including selected
History views: 40 repeated pairs, 36 byte-identical. Selected History English
dark/light and Thai dark each differed by one pixel at channel delta 1; Projects
Thai light differed by 38 pixels at maximum channel delta 1. All were within the
unchanged raster tolerance, with no masks. Settings normal captures were
byte-identical in all four language/theme sets. This verifies the read-only
Settings landing page and shared shell; it is not a test of every Settings write
control or a visual approval.

[Browser verification](redesign-v1.44/verification.json) and
[reference viewer](redesign-v1.44/reference-review.html) retain the final build's
captures for all eight source concepts. [Settings capture](redesign-v1.44/settings-en-dark.png)
is separate because the source directory has no Settings reference PNG.
The archive's production index matches this tested build, and every recorded
canonical capture hash and all eight source/copy hashes were checked.

Version tag: `redesign-sidebar-reference-v1.44.0`, isolated branch
`design/redesign-foundation`, existing QuotaPulse origin.

The blueprint's integration unit gate, `npm test`, passed: 96 daemon tests,
124 web tests and 198 tray tests (418 total), with no failures or skips. The
tray suite tests existing behavior without launching a desktop instance;
task-entry uses a temporary NoReaders profile. No dependencies were installed
or native modules rebuilt. [Unit-test output](redesign-v1.44/unit-tests.log).

## Review bundle

`tmp/review-bundles/QuotaPulse-v1.44-dqXIzK.zip`: 199854169 bytes, 3132 files.
Each entry was decompressed and SHA256-compared with the bundle source; no
app profile is included. Archive SHA256:
`68e6e0a25954b0cf118c65a6b127377c678b9d04ce27ff0810118827c3ae41d8`.

Existing 87 runtime packages were copied. Requires Windows x64 and installed
Node ABI 127 (Node 22.13.1 used to build). Extract to a new dedicated folder;
run `./scripts/start-review.ps1` and stop using `./scripts/stop-review.ps1`.
Readers/account probes are disabled and a new review database has empty usage.
This is an unsigned review bundle. Extracted runtime/installer and manual
release acceptance were not rerun in this shared styling checkpoint.

Scoped process inspection after the browser/unit/archive checks found no
remaining Node/Chromium test processes. The original checkout remains clean at
`be8e145039247958992fa7673a9c77e1bff35db1`.

[Bundle build](redesign-v1.44/bundle-build.json) and
[archive verification](redesign-v1.44/archive-verification.json).

## Remaining goal

This shared styling checkpoint does not prove the requested 99–100% source
likeness. Reference geometry, finer typography, per-page composition, Settings
appearance and broader release/manual acceptance still need reconciliation.
Repeated application screenshots are not a source similarity score.
