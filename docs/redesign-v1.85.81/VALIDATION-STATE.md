# v1.85.81 - Runtime Map first-return motion

Validated bounded application change. The full concept/blueprint/release goal remains active and unachieved. Original-reference likeness is not approved.

## Implemented

ProductionOverview records synchronous Runtime Map eligibility at refresh execution start. IntersectionObserver/document visibility changes advance the shared epoch before React renders. A first ordinary eligible refresh after return can present a fresh new CALL exactly once. Held requests from an ineligible/previous epoch remain consumed. Pending selected-project graph motion cannot revive across an eligibility loss, including rapid transitions without a hidden React frame.

Aggregate revisions retain node-only highlighting with an unchanged session timestamp when a validated baseline belongs to the current epoch. The first initial/dependency request may establish a cold baseline across exactly one false-to-true transition; it never animates that seed. Held requests and old serials cannot promote their baseline. Legacy callers without provenance retain conservative return seeding. Initial/dependency/visible/online batches remain catch-up seeds.

No app artwork/CSS, graph facts, token-weight edge widths, API/schema or dependencies changed. Existing main/user changes are outside this worktree/checkpoint.

## Current validation

- Web TypeScript/Vite build exit0. Existing large-chunk warning remains.
- Repository520 tests: daemon106 + web216 + tray198, all pass. Motion33 pure tests include genuine original-source red regressions, aggregate regression red and cold-baseline red; archived logs distinguish those from harness failures.
- `node --import tsx scripts/check-runtime-motion.mts` passes against the compiled application and an isolated in-memory daemon. Scheduler notification is emitted manually; ingestion/native event delivery is not claimed. Checks include cold aggregate revision, first CALL, moving position, one .7s SMIL pass, bounded expiry, duplicate snapshots, reduced motion, aggregate version revision, offscreen consumption, first post-return call, held overview response, held selected graph across eligibility change, next genuine calls, Pulse6s/idle/stale/unavailable/offscreen behavior and same-document SPA unmount.
- First particle removal was observed743.4ms after first observed presentation; gate allows700ms plus600ms scheduling margin. This is a regression bound, not precise animation benchmarking.
- Eight native1586x992 EN-dark route captures pass existing layout/facts checks. Compared with79: seven byte-identical; Models2 differing pixels/max3. Cause of this small raster fringe is not established. Native here describes viewport size, not an Electron lifecycle test.
- Canonical Overview4 EN/TH dark/light repeat pairs pass the original maxChannelDelta10/maxChangedPixelFraction0.00005 tolerance, no masks. Three pairs are byte-identical; TH-dark differs9pixels/max1. See overview-repeat/verification.json. Current source differs from80; the historical40-pair gate from80 is not relabeled as a current full-matrix run.
- Read-only review found no remaining material source blocker. Its probe requests were resolved by an explicit expiry bound and hash navigation retaining a document sentinel. The earlier temporary cold-node assertion expected a nonexistent data-motion-state attribute; archived failure is a harness mismatch, not an application defect.

Source, built index and every built asset are recorded in build-provenance.json.

## Artwork trials are unaccepted

Four rounds of Runtime Map atmosphere experiments used a frozen80 build, actual daemon facts and three pre-frozen decorative ROIs. No candidate enters application source. Flat ribbon/cap variants were rejected despite some passing regional scores. V4 continuous radial fields remove the flat cap, but three upper-gap MAE regressions remain underdy-1 shifts. Muted V4 also exposes a boundary-sensitive support gate: the perfect Source itself loses its sole >70 pixel when translateddy+1 out of the fixed ROI. No ROI, mask or tolerance changed and no candidate was accepted retrospectively. See visual-trials/final81-verdict.md and the labeled trial montage. original-trial-vectors.zip preserves the exact SVG bytes used in the historical trial, including line endings. Trial paint checks preserve graph markup/styles/facts;17pixels/max1 outside-patch raster fringe prevent a zero full-frame foreground-change claim.

## Limits and next work

The compiled motion probe tests real IntersectionObserver exit/reentry, not browser document.hidden or production Electron minimize/restore. Native lifecycle/recovery/package/rollback, remaining API/motion/performance/accessibility coverage, Source artwork and human visual acceptance remain open. API observation sampling still returns one newest row per observed harness; this does not prove every ingested CALL is animated. An old-timestamp aggregate first seen after return seeds a new baseline before later revisions can highlight.

Next priority is the remaining original-reference artwork/detail reconciliation and production-equivalent native/release gates. Calibrate the documented Source boundary uncertainty before making stronger atmosphere acceptance claims. No99-100% whole-application likeness claim is made.

## Reproduce

From this isolated worktree:

```powershell
npm.cmd run build -w @quotapulse/web
npm.cmd test
node --import tsx scripts/check-runtime-motion.mts
$env:QUOTAPULSE_CAPTURE_SCOPE='overview'
node --import tsx scripts/check-stable-captures.mts
```

The eight-route capture uses checkpoint79's archived fixture harness with its output path changed to source-art81. The static review page labels current captures and rejected experiments separately.
