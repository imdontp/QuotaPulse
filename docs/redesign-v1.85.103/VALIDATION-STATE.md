# Cost typography and time-axis checkpoint v1.85.103

Functional checks pass. Strict cross-build visual controls remain RED; full concept acceptance is not achieved.

## Changes and reference evidence

- Cost Overview native dark title: 16px/400 to 18px/600, preserving its 22.5px line box. A 63-candidate size/weight probe of the identical original title preferred 18px/600. Diagnostic foreground IoU improved from 0.2504 to 0.5854 with local translation; this is a thresholded title-crop diagnostic, not whole-image likeness or a percentage acceptance score. Crop, threshold and translation method are retained in evidence/title-probes.json and the archived harness.
- Native plot horizontal geometry: x312,width637.83 to x298,width657.83, matching the original estimate x298,width658 within 1px. The plot moves down 3px to y394.80; the original estimate is about y410, so vertical parity remains incomplete. Visible pricing coverage and the full data disclosure remain present. Panel heights and chart values are preserved.
- The date axis now samples up to nine actual scope/bucket boundaries, with localized short labels, exact ISO datetimes and full date/time titles. It preserves exact endpoints; an exclusive midnight labels the last included day. Missing observations remain zero/unknown under the existing rules. Narrow layouts show endpoints; they do not squeeze nine dates together.
- Native axis labels use 12px, dates11px. Complete localized labels determine the amount/token columns' intrinsic widths. A reproduced Thai US$ label previously wrapped in the fixed40px column and overlapped the header tile. After sizing from the actual labels it is one line (52.53px text), with no heading collision. Before/after geometry, screenshots and distinct build hashes are retained.

## Checks

- TypeScript/Vite build exit0; existing >500KB bundle warning remains.
- Three date-axis unit tests pass: partial-day month endpoints and actual grid ticks; exclusive midnight/cross-year/one-day scope; localized hourly/invalid-range behavior.
- EN/TH × dark/light Cost stable gate passes: four repeat pairs, all byte-identical; 12 scoped route checks cover API/native bases and unpriced scope, actual values/zero/tiny/partial price coverage, bucket-centered token points and keyboard data disclosures. Four section-mark checks include 390/900/1280 containment/no text/control overlap. Existing money precision and page bounds checks remain enabled.
- Fresh all-eight canonical captures from the current compiled index have byte-identical immediate repeats, no browser errors or forbidden writes/external requests. Overview1586×992; other seven1672×941. The viewer reuses an older stored PNG only where its entire SHA256 matches the new capture; the manifest binds all eight images to this build.
- Full repository/native motion/package/rollback gates were not repeated for this bounded presentation change. Their previous results remain tied to the actual historical builds.

## Retained strict visual-control failures

An initial comparison to archived101/102 images found 20 changed pixels in the Projects sidebar Bell and 17 one-channel pixels on Providers. Do not call all seven other pages unchanged from this result.

Checkpoint102 was rebuilt into a separate output using exact Git inputs, reproducing its archived compiled-index SHA256 cefa1f53aa528eea2a8116f41784903952bd1b4193aad7be13db1e47502f24d7. A comparison using the same all-eight capture order still has: Projects20px/maxdelta35 (sidebar Bell), Models2px/maxdelta3 (Quick Stats icon plate corners), History2px/maxdelta2 (Quick Stats icon plate corners), Providers7px/maxdelta1 (header rounded corner x1652–1657,y73–75). Overview,Live,Alerts are byte-identical in this matched comparison. All counts are unmasked; see evidence/matched-pixels-RED.json.

Cold Projects-only captures are byte-identical across102 and103, while the all-route comparison differs. That constrains the diagnosis but does not establish a causal explanation for the warm comparison. Fresh Providers-only102/103 captures still differ; recorded parent/header computed geometry, backgrounds, radii, shadows and transforms are equal. The seven header pixels are the inverse of the earlier101 control. No source rendering fix or harmlessness/nondeterminism claim is justified yet. These controls remain RED; the successful functional/raster-repeat gates do not clear them.

## Review and continuation

[Open all-eight original/previous/current viewer](review.html). Cost also has EN/TH dark/light matrix views. Overlay and difference modes show every pixel; they do not mask truthful content differences. Test captures use an isolated synthetic DB; the application reads real data normally.

Continue shared-header workspace geometry, remaining palette/type/art/layout mismatches, the retained rendering controls and the full obligations in [next required work](../redesign-v1.85.95/NEXT-REQUIRED-WORK.md). Ranking-rail project identity colors remain pending from102. No full99–100% likeness or user visual acceptance is claimed.

## Reproduction

Build: npm run build -w @quotapulse/web. Matrix: QUOTAPULSE_CAPTURE_SCOPE=cost with language/theme filters unset, then node --import tsx scripts/check-stable-captures.mts. Unit: node --import tsx --test packages/web/test/cost-time-axis.test.ts. Archived .mts harnesses should be extracted into tmp before running so their relative imports resolve. Canonical capture uses port7816; matrix7804. Run capture harnesses sequentially. The virtual102 build script writes only tmp/build102-control and leaves current source/dist intact. Raw logs and harnesses are gzipped; source LF fingerprints are recorded separately.
