# Source90 visual priorities — original refs versus checkpoint88

Read-only audit, 2026-10-20. Inspected original `Downloads/quotapulse_build_blueprint/refs/{overview,live,models}.png` and `docs/redesign-v1.85.88/after/{overview,live,models}.png` with `view_image`, plus current production CSS/TSX. No browser, build, Git mutation or application source edit. Original/after dimensions match: Overview 1586×992; Live and Models 1672×941. Coordinates below use each original image's native pixels, origin top-left; rectangles are approximate visual bounds unless stated as sampled pixels.

These are concrete remaining presentation differences, not a whole-project likeness score. Checkpoint88 captures are historical; root's current89 ready screens must be recaptured before accepting a patch. Scope/loading fixes in89 do not themselves prove any visual priority below resolved.

## 1. Overview Runtime model-share tracks start too far right and their paint is too cyan

**Evidence.** In the original Runtime first model row (approximately x1246–1544, y526–565), the first share track runs approximately x1393–1497 at y545. In after88 it runs approximately x1428–1495 at the same y. Consequently the same displayed 38% fill has roughly 40px of visual length in Source versus roughly 25px after88. Model text/icon placement is already much closer than the track placement. This is a geometry difference despite the same percentage; changing the recorded share is unnecessary.

Pixel reads at y545 confirm the Source has blue/violet fill where after88 still has panel background:

| Position | Original RGB | After88 RGB |
| --- | --- | --- |
| (1395,545) | 69,103,250 | 7,18,33 |
| (1400,545) | 69,104,250 | 8,18,33 |
| (1420,545) | 91,113,249 | 8,18,32 |
| (1433,545) | 26,38,71 | 79,182,254 |
| (1444,545) | 21,32,51 | 130,144,251 |

The latter samples are at different relative positions along the two fills, so they support the observed displacement and hue difference; they are not same-relative-stop gradient targets.

**Current owner.** `overview.css:734–737`: share width38%, track height6px, fill `linear-gradient(90deg,var(--qp-accent),var(--qp-series))`. `runtime-flow-reference.css` changes edge filaments only; it does not change share bars. Current `overview.tsx` computes real share and puts it into fill width.

**Minimal candidate.** Native dark production Overview only, trial increasing model `.qp-node-share` from38% to approximately50–51% and using a blue-to-violet fill rather than the current cyan-heavy leading stop. Preserve actual percentage/inline width, model text, title, tokens, node boxes and graph identities. Inspect long model labels after taking the extra35px from the label flex region. Do not apply unmeasured widths to compact/light screens.

**Acceptance evidence.** Same real data before/after: track x start approaches Source, 38/24/18/11% stay proportional and unchanged, all node outer boxes/edges unchanged, long names still accessible, light/compact unchanged. This is the highest-confidence small visual repair among this audit's candidates.

## 2. Live and Models table headings lack Source's distinct blue inset band

**Evidence.** Original Live has a rounded inset blue header strip approximately [249,270,1264,301]; after88's observed-sessions header at approximately [249,271,1265,301] largely blends into the dark panel. Models has the same issue in approximately [246,348,1257,386]. Panel/table positions already align closely, making the missing surface contrast visible independently of differing factual column names.

Median RGB over fixed small header regions (all source/after pixels, including any text, median reduces sparse text influence):

| Region | Original median | After88 median |
| --- | --- | --- |
| Live [650,272,690,298] | 10,22,42 | 7,16,28 |
| Models [650,350,690,379] | 9,18,34 | 7,16,28 |

This is a paint/surface discrepancy, not justification to restore fake session statuses, capability scores or old column labels. Live's current actual-data table must keep its approved columns and coverage semantics.

**Current owner.** `live.css:128` gives sticky headers `background:var(--qp-panel)`; native1280+ overrides sizes/weights/colors at323–351 but do not add the original blue header surface. `models.css:42–44,164,206` sets typography and borders with no corresponding inset header paint.

**Minimal candidate.** Native dark production Live/Models only: add the measured darker-blue inset header surface, subtle top/bottom border and rounded first/last header corners without changing padding, row heights, column widths or sticky behavior. Prefer a table-row-coherent surface; do not repeat a full-width gradient independently in every cell. Validate actual light/overflow/sticky behavior. Trial header paint before moving text or changing content.

**Acceptance evidence.** Fixed Source header ROIs move toward Source hue/luminance; table geometry, data, sort/search controls and accessible column labels remain unchanged. Screenshots of scrolling long tables must prove sticky headings retain their band.

## 3. Models per-row histories use visibly heavier strokes than the original small sparklines

**Evidence.** Original Models Trend column approximately [1150,386,1248,833] uses fine luminous colored filaments. After88 column approximately [1158,389,1254,620] uses broad bright horizontal baselines and steep right-end spikes. The spike/zero structure is real fixture history and must remain. The roughly2px baseline thickness is a separate presentation difference that can be reduced without inventing curves. The current varied palette is already present; the inherited claim that all rows remain blue is false for after88/current CSS.

**Current owner.** `models.css:277–298` owns96×26px per-row charts and exact-pair decorative tones, including light contrast variants. `models.tsx` renders `ObservedTrend` with `grid={false}` and `area={false}`. `observed-trend.tsx` shares a `strokeWidth="2"` non-scaling polyline across chart sizes and adds a glow filter. Global edits to that component would affect unrelated factual charts.

**Minimal candidate.** Scope a CSS trial to native dark `.qp-model-row-trend .qp-observed-line`, e.g. stroke-width1–1.25px, retaining the existing gradient/palette, actual point coordinates, circles/data attributes, runs/gaps, title/accessible label and zero/missing semantics. Compare glow falloff too; no interpolated smoothing, invented observation points or copied Source curves. This candidate is lower priority than the first two because different real histories inherently dominate shape comparison.

**Acceptance evidence.** Same API responses and same SVG point strings/values before/after; only stroke footprint changes. Include a dense real-history case as well as sparse/zero histories. Do not cite the fixture's six rows versus Source's twelve as a defect or add fake rows to fill the table.

## Boundaries

- Real graph topology/provider names, session identities, token values, record-grain exclusions, API price coverage, missing forecasts and data-driven history shapes remain authoritative.
- Source Live has performance/status fields unavailable under the approved observed-data contract; this audit proposes surface treatment, not false telemetry.
- Current Models exact-pair palette already varies; any next palette change needs actual relative-stop comparison, not the earlier uniform-blue assumption.
- No candidate above is implemented or browser-validated by this audit. None establishes99–100% acceptance across eight screens.
