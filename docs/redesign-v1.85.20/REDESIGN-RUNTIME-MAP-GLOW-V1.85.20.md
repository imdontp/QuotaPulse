# Runtime Map glow v1.85.20

## Change

The source concept uses brighter electric trails and a visible halo around its
project and runtime nodes. The dark Overview now strengthens the glow on
primary token-flow paths, flow markers, the focused project node, and
harness/provider/model cards. Each accent still comes from the existing node
identity and token-flow classification. No graph edge, node, activity state,
or displayed value was added or changed.

## Validation

- `npm run build -w @quotapulse/web` passed. Vite still reports its existing
  large-chunk advisory.
- `QUOTAPULSE_CAPTURE_SCOPE=runtime-layout npm run test:stable` passed four
  language/theme capture pairs; three repeats were byte-identical and the
  remaining pair was within the established raster tolerance, with no masks.
- Runtime card positions remain within 2px of the measured source bounds;
  connector endpoints remain attached within 1px. Keyboard/detail behavior and
  the 390/900/1280 overflow checks passed.
- `git diff --check` passed.

The browser gate uses an in-memory synthetic database and verifies repeatability
and specified layout behavior. It does not score whole-image similarity. The
remaining source color, content, and composition gaps are open.

## Evidence

- [English dark Overview capture](overview-en-dark.png)
- [English light Overview capture](overview-en-light.png)
- [Thai dark Overview capture](overview-th-dark.png)
- [Thai light Overview capture](overview-th-light.png)
- [Measured layout](layout-en-dark.json)
- [Browser verification](verification.json)
