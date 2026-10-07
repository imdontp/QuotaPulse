# Native ring hierarchy and provider quota lighting v1.85.27

## Scope and source evidence

Continue real-data application fidelity on the isolated redesign branch, after
v1.85.26 (`a5122ab`). The original source images remain authoritative:

| Source | SHA-256 |
| --- | --- |
| refs/overview.png | 924849d96af48d5f0aae3ab330e01df929485020ef91e9c0516f1fd7cc0d96ce |
| refs/providers.png | 12b01fc5549c79cb3043619401b993d8ae265e3bcbde9ef8cf4efe0f3d2210a6 |

Read-only source review measured the Overview focal point at (734.55,243)
in the previous native capture. Its actual progress radius129 already matches
the source. The source outer hairline reaches approximately y82; previous
decorative dots reach y89. Source primary quota text is approximately y197-248
and MONTHLY USED y262-272; previous text is y194-245 and y268-277.
These are source-region estimates, not whole-image similarity scores.

## Changes

- Add an outer decorative radius157 hairline and top flare, reduce the
  radius137 auxiliary ring to1px/25% opacity. The actual quota progress radius,
  values, boundaries, selection and unknown/stale behavior remain intact.
- Sharpen the shared ring blur3 to1.8 and progress shadows8/16 to6/12px.
- At native desktop widths, set primary line-height1, move the state/support
  labels upward3/5px, and use pale blue for the dark-theme percentage. Preserve
  translated labels, actual recorded tokens, selected period and projection.
- At widths1500 and above, use provider window columns94px / flexible /56px.
  This targets the original first-card quota bar width143px (previous123px),
  without changing responsive layouts at smaller widths.
- Add compact dark-theme quota fill highlights: blue/violet by default and
  cyan/teal for the actual OpenCode owner. Add subtle comparison-bar lighting.
  Actual percentage widths/heights, zero/tiny/expired/unknown semantics remain.

## Validation

| Check | Result |
| --- | --- |
| Production web build | Session57125 exited0;2980 modules. Existing532.87kB main App advisory remains. |
| Diff whitespace | git diff --check passed. |
| Providers en/th dark/light production captures | Session62766 exited0:four pairs, all byte-identical, no masks. Existing API comparison/selection, zero/tiny/unknown/expired readings, native frames, focus and390/900/1280 responsive gates pass. Fresh capture manifest and measured regions are included. |
| Overview en/th dark/light production captures | Session2422 exited0:four pairs, three byte-identical; en/light9 changed pixels,max delta1 within unchanged tolerance, no masks. Actual quota boundaries/unknown/stale/expiry/runway, graph access, model rail/focus and390/900/1280 responsive gates pass. Fresh manifest and per-variant layout evidence included. |

Current production index SHA-256:
`77c3668fbd767047f7e9b4603c507ac3598c85d4df64bb2b7afd96790f587c6a`.

The previous v1.85.26 web158 tests, daemon tests/typecheck and full workflow pass
are recorded in their own report. They are not labelled as executions on this
new build. This bounded change has no new dependencies, migrations or API logic.

Fresh en/dark direct source review: Providers quota bar now starts x361 versus
source approximately360. Overview outer ring reaches approximately y82;
percentage paints y197-247 versus source197-248, state262-272 matches the source
estimate, and support285-294 versus source285-295. These are observed image
regions after the change; no whole-image acceptance percentage is inferred.
Read-only diff review found correct vendor/theme specificity, unchanged actual
quota progress and decorative SVG remaining hidden from assistive technology.

## Remaining original goal

Review fresh actual captures against the source after these repairs. Native
globe texture, decorative orbit/ambient details, remaining page typography and
illustrations still require review. Real-data and documented production
substitutions can differ in content; they do not exempt layout or visual styling.

Eight-page source/override acceptance, final40pair capture matrix, fresh current
performance/release compatibility, manual accessibility and the named approved
implementation baseline remain open. No99-100% likeness is claimed.
See [remaining goal audit](../redesign-v1.85.24/REMAINING-GOAL-AUDIT.md).
