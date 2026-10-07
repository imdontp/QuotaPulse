# Shared shell and recorded Models histories v1.85.26

## Scope

Continue the supplied eight-page concept with actual application facts. This
checkpoint restores source typography/wordmark rhythm and adds the previously
missing Models summary/provider histories using real API aggregates. Whole-design
99–100% acceptance and the final40pair matrix remain open.

Changes stay in the isolated `design/redesign-foundation` worktree with the
original QuotaPulse origin. No dependencies, migrations, user database, old
branch or popup features are changed. Unrelated `.zed/` remains excluded.

## Implemented

- Generic wordmark starts at x81 instead of x74: gap19px. Tagline is11px with
  line-height1.1 inside the original60px header. Existing source-specific
  Overview wordmark sizing remains. Desktop navigation is14px; QuickStats
  title14px/500 and descriptions12px. Dark active icons use blue with a4px glow.
  Existing routes, More, machine scope, daemon state and local preferences remain.
- Optional `/api/models?detailed=1&trends=1` adds two scoped aggregate queries in
  the same transaction as existing totals. At most30 elapsed bins contain actual
  token/call/API-value/priced-call counts, distinct sessions and model/route pairs
  per bin, plus nullable provider token series. The default response is unchanged.
- Models uses its existing one/two requests for unfiltered/filtered scope; no
  per-provider request fanout. All four summary sparklines and provider sparklines
  use these recorded series. The provider footer now follows current filtered
  groups, preserving null and empty-string provider identities separately.
- Count bins with no recorded usage can show0; price without coverage remains
  unknown. Recorded zero price remains0 and partial known price retains pricing
  coverage. Sessions and pairs per bin are explicitly labelled; neither series
  can be summed into the distinct range total.
- Shared ObservedTrend supports nullable gaps at the original full time-domain
  indices and one global scale. It draws no connection through unknown bins.
  Numeric callers retain their coordinates and single-run SVG ordering.
- The complete Models bucket table includes counts, known prices, priced/total
  calls and every displayed provider series in a keyboard-accessible disclosure.
  Native summary106px, comparison575px and provider90px regions remain.

## Validation so far

| Check | Evidence |
| --- | --- |
| Web build | Session93108 exited0. Existing532.87kB bundle advisory remains. |
| Web tests | Session91725 exited0:158 pass, zero failed/skipped. Includes gap, known zero, per-bin identities and scoped-provider transforms. |
| Daemon tests | Final agent run after pair counts: model-trends/project-trends/detailed-aggregates3/3 pass; daemon noEmit typecheck pass. Synthetic in-memory database. |
| Shared shell production captures | Four Providers language/theme runs exited0, four byte-identical pairs. Header60px, brand containment, routes, focus, contrast and390/900/1280 gates pass. These captures precede final Models integration; CSS remains unchanged. |
| Final Models production captures | Four independent en/th × dark/light runs exited0:four byte-identical pairs, no masks. New gates compare every drawn summary/provider sample with independently queried API bins and check complete keyboard bucket disclosure. Existing money, ratio, native geometry and responsive gates remain intact. |
| Cost numeric chart regression | Chunk c39d1c exited0:one en/dark pair within existing raster tolerance, no masks. Axes, proportional tiny/zero values, native frames and overflow checks pass. |
| Overview source header regression | Session34692 exited0: one byte-identical en/dark pair, no masks; source-specific header, real quota/graph, responsive and overflow checks pass. |
| Full authenticated workflow | Session73046 failed at the inherited exact old heading Model usage. Only that expectation is updated to the current source Models title, retaining exact:true. Full rerun60760 exited0: all eight page workflows,16 responsive combinations with nine destinations, occupied layouts and route compatibility pass. Fresh workflow artifacts are included. |

Final production index SHA-256:
`e85bb3d299df0876f851c0fd095151690f16b9750678ded094bcf5bec551de1a`.

## Source measurements

Models in both languages/themes: comparison y259–834 and provider footer
y846–936, selected panel y72–356, token distribution y366–513 and donut116px.
See four models-*-regions.json and models-*-verification.json artifacts. These
are region measurements and repeatability checks, not image-similarity scores.

Measured shell at1672px: wordmark x81, tagline11px, navigation14px/400,
QuickStats title14px/500 and labels12px/400, active icon23px with blue4px glow.
Header remains60px across tested responsive widths. The original production
navigation/More substitution is retained; it changes sidebar occupancy relative
to the concept and is not silently counted as pixel equality.

Increasing the tagline initially produced header height60.234375, failing the
original strict60px gate. Explicit line-height1.1 resolves that real geometry
failure without relaxing the gate. Models spark heights28px and wide-value
support avoid changing its original106px summary rhythm.

## Remaining goal

Native globe rings/surface, provider card/bar lighting, page-specific typography
and illustrations still require direct source review. Current fixture histories
are sparse; the application does not invent curves to match concept values.
Null/empty provider labels remain visually Unspecified despite separate stored
identities; further clarity can accompany exact missing-provider filtering.

Finish same-build eight-page source/override review, fresh final40pair matrix,
current performance/release compatibility and manual accessibility evidence.
See [original remaining goal audit](../redesign-v1.85.24/REMAINING-GOAL-AUDIT.md).
No approved visual baseline or99–100% likeness is claimed here.
