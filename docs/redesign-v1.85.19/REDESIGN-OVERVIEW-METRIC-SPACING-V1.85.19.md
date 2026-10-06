# Overview metric rail spacing v1.85.19

## Change

The desktop Overview metric rail previously ended noticeably above the source
concept. The top token row was already close to its reference position, while
the next three rows progressively sat too high. At the 1586×992 reference
viewport, the production Overview now uses 30px between metric rows and moves
the group down 18px. This places the four rows along the source's vertical
rhythm without changing the Pulse Core grid, quota values, labels, or other
sections.

The change is restricted to production Overview at widths of at least 1500px.
It changes no data or behavior. Usage, cost, cache values, and quota percentages
remain derived from current application/API data; the reference's `721M / 1.0B`
denominator is not inferred from a quota reader that only provides a percentage.

## Validation

- `npm run build -w @quotapulse/web` passed. Vite still reports its existing
  large-chunk advisory.
- `QUOTAPULSE_CAPTURE_SCOPE=overview npm run test:stable` passed all four
  language/theme combinations and their repeat captures: 4 of 4 pairs were
  byte-identical, with no masks. Existing quota selection, Runtime Map,
  keyboard, and responsive overflow checks passed.
- The first browser-gate attempt timed out inside an unrelated
  `checkActivityRenderer` failure message while reading a missing `h1`. A full
  rerun passed, including that check. The transient failure was not reproduced;
  no test or application workaround was added.
- `git diff --check` passed.

The browser gate uses an in-memory synthetic database to compare layout
repeatably. It does not measure whole-image similarity or approve the complete
source match. Live application values may differ from the illustrative source.

## Evidence

- [English dark Overview capture](overview-en-dark.png)
- [English light Overview capture](overview-en-light.png)
- [Thai dark Overview capture](overview-th-dark.png)
- [Thai light Overview capture](overview-th-light.png)
- [Measured layout](layout-en-dark.json)
- [Browser verification](verification.json)

Remaining visual work includes finer color/glow treatment, content and chart
composition, and the other Overview panels. Full source likeness remains open.
