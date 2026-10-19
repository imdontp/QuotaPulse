# Map86 same-render visual trial review

Verdict: approve this bounded native dark backdrop change for implementation and compiled verification. It moves the Runtime Map toward the original Source by removing the regular cyan square lattice from the middle/right backdrop. It does not establish whole-screen or all-eight acceptance.

## What was examined

Offline read-only review of `tmp/map86-trial/overview-before.png`, `overview-after.png`, `source-before-after-roi.png`, `trial.css` and `verification.json`, plus authoritative original Overview previously viewed in the all-eight audit. Source/native ROI is `[790,600,930,668]`. The before/after intervention uses the identical actual production index `f072ce2aa183548974e24de8d8387efa171f6dd1c4108129ce7f5a29b65b79f2`.

The trial removes only the final repeated radial-dot background layer and corresponding background-list entries from native dark single-project `::before`. The existing left atmosphere SVG and two radial fields remain. The localhost asset URL in trial.css is a same-render probe detail; production must retain the source-relative imported asset URL, not copy localhost into CSS.

## Evidence and protected content

- Independently rechecked text equality, entire captured main markup equality and all1102 captured box equality directly from the before/after snapshots: all true.
- `errors` and `forbidden` arrays are both empty.
- Raw full-image comparison, without masks:2632 changed pixels, inclusive delta box `[466,527,1535,691]`, max channel delta19. Changes are confined to the map backdrop region; no image differences were found outside that bounding rectangle.
- Because the entire main markup is identical, original graph SVG paths, node texts, values, actual edge identities and accessibility content remain the same. Box equality also excludes moving nodes or compressing graph geometry to mimic Source.
- `offline-review-measures.json` records these checks and exact screenshot hashes.

## Source-direction finding

Original Source background between the luminous graph edges is mostly dark and sparse in this region. The before capture shows a highly regular repeated cyan square lattice that is absent from that Source crop. The after capture removes that competing visual texture while retaining actual dim/bright graph edges and existing left project atmosphere. At full-screen size the graph is clearer and its dark navy backdrop is closer to the Source treatment. This conclusion concerns this specific static layer; the number/order/shape of actual edges and their event-driven emphasis are not Source-copy targets.

No new particles, copied Source glow beads or invented runtime activity were introduced. Bright edge differences in the Source crop are deliberately excluded from the cosmetic acceptance claim because the approved motion contract requires real new observed calls and actual topology.

## Required next evidence

Apply the equivalent small change to the source-relative native dark override, preserving current constraints `min-width:1536px`, production Overview, dark theme and single-project map. Run a compiled native capture and compare its facts/geometry with this intervention. Verify unaffected theme/narrow/multi-project behavior through existing relevant gates. Preserve the separately observed85 strict raster repeat failures as open failures; this visual review neither diagnoses nor clears them.

No browser/build/Git operations or application source edits were performed by this reviewer.
