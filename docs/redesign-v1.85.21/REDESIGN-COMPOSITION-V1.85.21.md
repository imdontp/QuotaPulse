# Reference composition v1.85.21

## Changes

- Overview: move the actual SVG globe center down 10px to the measured source
  focal point (approximately 734,243 at 1586x992). Counterrotate the progress
  gradient so the cyan-to-violet ramp retains its horizontal direction.
- Runtime Map: animate particles along existing, recently active graph edges
  using native SVG animation. Reduced motion, a hidden document, and an
  offscreen map disable motion. No timer or React frame loop was added.
- Projects: show observed harness/provider identity panels in Overview, retain
  the complete recorded breakdown in Details, and use full-width icon tabs.
  Compact the trend and identity panels to retain the ranking in the viewport.
- Models: group comparison heading, filters, coverage and table in one panel;
  restore colored summary icons, provider marks and selected-row treatment.
- History: put pause/export controls beside the heading, show more complete
  table rows, put range counts with pagination, and display compact tokens with
  exact accessible values and full-precision hover text. Retain the native
  modal, recorded metadata, export and focus behavior.

All displayed observations remain sourced from application data. Unsupported
concept quotas, lifecycle controls, performance benchmarks and prompt payloads
were not introduced.

## Validation state

The production web build and 152 web tests pass. The Runtime Map gate verifies
particle travel, offscreen suspension, reduced motion, connector geometry and
four language/theme repeat captures. The initial four repeats are byte-identical.

The combined capture gate passes all nine dashboard/settings pages in both
languages and themes: 40 repeat pairs, 36 byte-identical and four within the
recorded raster tolerance, with no masks. It verifies Projects identity counts
and complete breakdown against API data, exact History token values, modal
focus, keyboard access and 390/900/1280 overflow. History shows eight complete
rows and pagination ends at y=931.78 in every language/theme capture. The first
attempt detected out-of-viewport pagination; it passed after correcting heading
wrapping and the table viewport. The production build retains Vite's existing
large-chunk advisory. `git diff --check` passes.

Commands: `npm run build -w @quotapulse/web`,
`npm run test -w @quotapulse/web`,
`QUOTAPULSE_CAPTURE_SCOPE=runtime-layout npm run test:stable`, and
`QUOTAPULSE_CAPTURE_SCOPE=all npm run test:stable`.

The broader `npm run test:history` workflow currently stops at its inherited
Overview assertion expecting the old full-number metric (`7,525`). The current
metric uses compact notation and the four metric meanings have changed in prior
checkpoints. This gate is not reported as passing. Its initial modal and Projects
breakdown checks have been updated for the existing redesigned behavior.

## Remaining acceptance work

This is a review candidate. Repeat captures do not measure source-image likeness.
The globe land/ocean texture still differs from the source. Projects and History
retain additional recorded metadata; their detailed region composition needs
continued comparison with the revised blueprint's production overrides. Models
uses actual token components and observed effort rather than unsupported source
benchmarks. A reviewed eight-page baseline, regional mismatch inventory, source
visual acceptance, manual accessibility, performance and release evidence remain
open. The Cost legacy bare-route compatibility finding also remains open.

## Evidence

- [Overview](overview-en-dark.png), [Projects](projects-en-dark.png),
  [Models](models-en-dark.png), [History](history-en-dark.png).
- [Selected History](history-selected-en-dark.png).
- [Measured Overview layout](layout-en-dark.json).
- [Combined browser verification](verification.json).
- [Remaining regional differences](REFERENCE-GAPS.md).

The captures use in-memory synthetic observations to exercise the production
application deterministically. They do not depict the user's live usage profile.
