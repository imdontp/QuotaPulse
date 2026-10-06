# Reference hierarchy v1.85.22

## Implemented changes

- Projects: compact recorded amounts with exact values; source-like amount/share
  and monetary column hierarchy; larger identity/sparkline regions; compact
  selected metrics and costs; ranked identity rows with numbered marks.
- History: actual harness ownership from Overview source/profile metadata drives
  harness marks independently of the model vendor. Compact summary tokens retain
  exact accessible values and full-precision titles. Identity colors follow the
  recorded harness key.
- Alerts: compact reset-break note and date/sample footer reduce chart overhead;
  the risk list has space for four actual risks. Expanded sample tables remain
  full-width and keyboard accessible.
- Live: compact matrix totals retain exact accessible values, titles and complete
  minute tables. Fixed numeric columns prevent long totals wrapping across lines.
- Overview: a darker local globe surface moves the ocean/land lighting toward
  the source. See [asset provenance and prompt](PULSE-EARTH-PROVENANCE.md).

The authorized swarm separated Projects, History and Alerts app changes, source
audits, and workflow-gate maintenance. Root combined, built and inspected the
application. All observations and forecast calculations remain production data.

## Validation

The web production build and 152 web unit tests pass. `QUOTAPULSE_CAPTURE_SCOPE=all
npm run test:stable` passes 40 repeat pairs: 33 byte-identical and seven within
the recorded raster tolerance, without masks. The manifest covers nine pages,
both languages and both themes; this folder preserves the five changed pages
and selected History detail plus Live boundary states (32 PNGs). History shows eight full rows and its
pagination bottom is 931.78125px in the 941px viewport.

The first combined attempt stopped at a test's incorrect image-size assumption;
direct inspection corrected it to 1254px, retaining the generated image. The
next attempt exposed Alerts rules extending 3.55px past the viewport; reducing
their desktop padding fixed that overflow before the passing full run.

The broader `test:history` gate is still being maintained and is not claimed
passing. Its changes are excluded from this checkpoint. A genuine compatibility
mismatch remains: bare `#cost` currently selects month, whereas blueprint v1.1
requires All time. The next repair must preserve bare bookmarks and make new
navigation/canonical design captures explicitly select `#cost?range=month`.

## Remaining work

Repeatability does not establish source likeness. Globe outer ring layering,
precise Projects/History typography and region composition still require closer
comparison. Fresh source audit identifies Cost header/card/donut proportions and
trend/table widths, and Providers ordering of observed versus unavailable owners
as further supported work. A reviewed eight-page baseline, visual acceptance,
manual accessibility, performance and release/rollback evidence remain open.
