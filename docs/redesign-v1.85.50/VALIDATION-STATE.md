# Current validation: incremental checkpoint50

Current production index SHA256:`ebd7e3f68172b25fcfaff66924d0580dc59b8493d929bbc25edd168894edde1a`.

- Build completed;170/170 web unit tests passed. Exact build process exit is unrecorded after tool output truncation, and remains null in provenance.
- Full current matrix passed40pairs across EN/TH and Dark/Light:34byte-identical,6with max channel delta1 over11–45pixels. All80PNG hashes verified; original unmasked tolerance unchanged.
- Current UI compatibility passed16language/theme/width combinations, navigation/filter/data readiness/headings/backdrop, legacy/popup, empty/unavailable/recovery; no page errors. Both capture/UI subprocesses and their enclosing session56304 were observed exit0.
- Nine original-source reports and the eight-page viewer now reference this build; all80 PNG hashes and report candidate/source hashes were checked. Release identity: `redesign-visual-fidelity-v1.85.50` on the isolated redesign branch.

This establishes an incremental implementation checkpoint. Whole-goal99–100% concept approval, vertical sidebar cadence/QuickStats, remaining source paint/icons, named approved baseline/SSIM, performance, manual accessibility and final desktop/recovery/release gates remain open. The earlier badge failure's precise cause is not established.

## Historical attempts and retained evidence

The following sections preserve earlier builds and provisional states; they do not supersede the current status above.

# Build50 validation in progress

Build and170 web unit tests passed (session56498). UI regression passed (session39002, exit0), including16 language/theme/width combinations, legacy navigation, popup preference and empty/unavailable/recovery cases. Projects one-pair smoke passed (90950). Focused Models repeat passed byte-identical (69859).

The original full40-pair run failed (37746, exit1). Both Models images have35 changed pixels, all in the sidebar; six badge-edge pixels exceed the unchanged10-level limit. Models content has zero differing pixels. Badge count/interior and visible bounds are identical. Rounded-edge raster variation is a leading diagnosis; its precise mechanism is unproven.

Full replay65842 retains sidebar DOM paint inputs before each canonical screenshot, checks them independently between passes, and preserves the original unmasked pixel limits. It also failed (exit1) on Live TH/Dark: the same35 sidebar pixels, maxdelta28, with independently equal DOM paint inputs. The precise paint mechanism is still unproven. Candidate captures in this folder belong to the first full run's first pass, not the replay and not an approved baseline.

[Eight-page source comparison](reference-review.html), [first-pass image hashes](candidate-capture-index.json), [native primitive measurements](native-primitive-review.json), [failed full run](failed-full-matrix.log), [UI pass](ui.log), [changes and remaining scope](SOURCE-CHANGES.md).

Original99–100% likeness, reviewer-approved baseline, remaining source geometry/artwork and final release/accessibility/performance/desktop/recovery gates remain open. No50 commit/tag has been published yet.

## Current paint hypothesis check

The native20×18px badge radius changed from999px to9px, which is mathematically equivalent after radius clamping. The web rebuild passed; focused original Live TH/Dark check38810 passed byte-identical (exit0) with unchanged whole-image pixel limits. A counterfactual fresh-renderer probe is being prepared to compare original999px and explicit9px paint. One focused passing pair does not prove the full raster failure fixed; counterfactual and complete matrix evidence remain pending. Current build differs from the first-pass images in this viewer. [Retained replay failure](replay-failure/diagnosis.json).

Current explicit-radius build also passed170 web unit tests (58650, exit0). This is a required unit gate, not proof of full raster repeatability. The first post-paint counterfactual (8 fresh renderers per radius, two frames each) did not reproduce variation; both9px and999px matched the preserved canonical badge. Before-first-paint and viewport-history controls are pending.

## Current composition implementation (supersedes the viewer's first-pass build)

Overview now renders spatial progress gradients and a restrained lower globe limb. Models applies the measured inset-spacing correction. Live uses an intrinsic native summary, full metadata row,104px painted graph height, reference typography/blue body text and compact actual tick labels. The197px native panel and all real values remain. Build79634 passed; web unit run49696 passed170 tests before the final summary heading margin-only correction.

The79634 composition check failed on viewport-space top618.75/bottom722.75. An independent fresh-document diagnostic on the same build measured canvas621.75–725.75 and panel197px. The source assertion now measures from the document origin to account for restored scrolling; the EN/dark rerun passed3pairs byte-identical (17110, observed exit0). No production CSS translation was added based on this discrepancy. [Diagnostic artifacts](composition-diagnostics/provenance.json).

The completed [badge controls](badge-controls/badge-probe-report.md) used56 fresh browser processes and112 whole-page captures. Both9px and999px controls matched;50% ellipse and limited resize-history controls did not reproduce the historical failure. Radius equivalence is confirmed in these controls, and a causal repair remains unproven. Full current-build repeatability and original-source review remain required.

Fresh Models source measurements confirm distribution370–516, trend528–720, effort731–920 and outer rail930. Source effort bottom is919 (1px residual). Current Overview measurements confirm the top ring hue repair, but the lower limb overlay misses some bright bitmap ridge pixels. A further scoped lower-limb correction is pending.

Width8 lower-limb correction passed a focused Overview pair byte-identical (85342, exit0), but original-source inspection found a visible right-endpoint notch. A24SVGpx opacity feather at both limb endpoints is now implemented, with a fresh probe pending. This demonstrates why repeatability alone is not visual acceptance. Final source build and full matrix must include the feather.

The final canonical72%monthly capture confirms both endpoint notches are removed. Ridge attenuation and bottom ring body RGB91,156,255 are retained (source91,156,254). Broader glow/geometry remains open. Full run66418 stopped at a browser test closure serialization error (`__name`); the helper was repaired without app edits, and focused Live baseline/diagnostic/empty/API/keyboard/responsive/containment checks passed (36039, exit0). Complete matrix rerun is pending.

The post-feather full matrix86777 completed all four first-pass language/theme sets but failed repeated Models on24sidebarpixels (0maincontentchanged);6badgeedges still exceeded10, max28. The process handle was missing on continuation, so exact process exit is unrecorded; terminal assertion log and absence of a success manifest are retained in final-matrix-failure/.

A reviewed SVGroundedrect now paints the badge behind its existing real count text. Native20x18/radius9 and compact18x14/radius7, link label, aria-hidden/nonfocusable decoration and actualriskcount4 were independently checked at1672/900/390 (81269, exit0). Nativebadgebitmap is byte-identical to the prior CSScanonical (0changedpixels). Build+170webtests passed (11819, exit0). This is a paint-path alternative, not a proven cause/fix of the historical intermittency. Newfullmatrix+finalUI54220 is running with finalindexae04a4274e9c97b1e37b7ec9596af0d5913489605d276ae9fdd90842aace9aac.


## Source sidebar candidate (current frozen build)

The same-geometry SVG full matrix54220 failed Models TH/dark:24 changed sidebar pixels, max channel delta28; no main-content pixels changed. It did not eliminate observed intermittency. Exact process exit1 was recorded; UI was skipped in that sequence. Evidence is retained in svg-matrix-failure/.

Native sidebar now moves icons+6px and labels+8px (+5px on Overview), matching the measured source ink positions. Its real-risk badge is21x21 with a decorative radial highlight and a21px circle. Compact390/900 remains18x14 with flat paint. Actual count4 and its accessible enclosing-link count were observed in all three probe widths; decoration is hidden and nonfocusable. No vertical cadence, Quick Stats or footer change is included yet.

Current production index SHA256:ebd7e3f68172b25fcfaff66924d0580dc59b8493d929bbc25edd168894edde1a. Build completed and170 web unit tests passed in terminal logs; exact process exit for that build/probe is unavailable after tool output truncation and is recorded as null. Full40-pair raster gate and UI gate are running sequentially, with separate actual exit records; UI runs even if raster fails. No new version is published, and 99–100% acceptance remains open.


Independent native Models pixel audit confirms21x21 painted badge bounds x178..198, equal to original source, and label/icon horizontal alignment within1–2px. Orange-mask median source247,159,67 versus current248,163,63. Vertical rows remain4–12px too high; source rim/halo and icon path silhouettes remain different. Source3 versus actual4 is intentionally retained. See source-sidebar-review/REVIEW.md and hash-bound measurements. No whole-image likeness percentage is claimed.


Current frozen source-sidebar build passed the complete40-pair matrix (capture subprocess observed exit0, session56304).34pairs are byte-identical;6others differ by at most1 channel level across11–45pixels, within the original10/.00005 unmasked tolerance. All80 PNG hashes matched the manifest. This is observed current-build repeatability, not proof of the old raster failure's cause or 99–100% source acceptance. Current UI compatibility is running next; publication remains conditional on its result and source report rebinding.
