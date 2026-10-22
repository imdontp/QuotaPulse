# Models factual axes and shared plot frame v1.85.118

Status: partially validated. Models now has real quantity/date axes and a plot composition closer to its reference. The original Models repeatability gate remains RED; this is not a whole-design or release acceptance result.

## Product change

The Projects axis implementation becomes shared [ObservedTrendAxes](../../packages/web/src/redesign/observed-trend-axes.tsx) with [shared styles](../../packages/web/src/redesign/observed-trend-axes.css). Projects uses the same five date ticks and44px scale gutter. Models uses three actual bucket date ticks and a30px gutter to fit its narrower rail; its quantity ticks follow the selected Tokens/Calls series. The existing API-value comparison route retains its existing token-trend semantics and label.

Models' native plot starts at x1329.906 instead of1299.906 and has309.094px width instead of339.094, following the approximate source plot x1330–1634. Its SVG box moves down12px and changes112→100px high; removal of old8px SVG padding makes the shared axes align with actual plotted coordinates. The full-data action moves beside the native heading when closed; its table expands in normal flow and the generic scale caption remains accessible.

The new component keeps the original recorded-value plot, exact bucket identities, raw values, normalized point/polyline coordinates and accessible plot label. No benchmark, context claim, active status or source-shaped activity is introduced. Zero-only scale behavior, exact timestamp titles, intraday time and cross-year labels are retained from the Projects implementation; they are not all separately exercised by this matrix.

## Current evidence

- Fresh web TypeScript/Vite build passes. The existing large legacy App chunk warning remains.
- Canonical before/after compares the same isolated synthetic records through the actual API and compiled UI. Both Models and Projects retain all30 point identities/values/normalized coordinates and polylines. Projects' complete recorded axes and geometry are equal, and its full before/after PNG is byte-identical. Both canonical immediate repeats are exact.
- Models native header, sidebar and upper detail are byte-identical before/after. Its primary control has24 changed pixels/max1 near the rail boundary; this is retained as an unplanned control, with no cause inferred.
- Models' original full gate completes first-pass functional checks for EN/TH × dark/light. These include API-backed Tokens/Calls/API-value route data, proportional plots, exact chart-data tables, quantity/date tick assertions, keyboard access, selection/filtering and390/900/1280 overflow. The run then fails its first repeat (EN dark):161 changed pixels, max34, against unchanged unmasked tolerances. This is a failed full gate, not a four-pair success.
- Of those161 pixels,155 lie in the recorded ring region and6 outside it. Ring DOM geometry and recorded paint inputs are equal. Its pattern resembles retained earlier ring failures; the causal rendering mechanism is unproven. Raw first/repeat images, paint records and the failure log are preserved.
- Projects' current full gate passes all four pairs after the shared-component refactor: two exact and two within the unchanged unmasked tolerance. Selection, sorting, search, full-data keyboard access and narrow layouts pass. Results are recorded in [its report](evidence/projects-stable.json).

[Unmasked analysis](evidence/analysis.json), [current ring failure](evidence/ring-failure.json), [original/current comparisons](review.html). Production index SHA256: `7fd17908ed839a482165537ddb90a70ed08e979e52092d905a765af7783c23cc`.

## Remaining scope

The [20-row trace](../redesign-v1.85.109/REQUIREMENT-TRACE.md), complete all-eight source acceptance, current native/settings/error/motion/resource matrix and retained raster/ring failures remain open. Root suite655 and actual two-version rollback belong to product114/checkpoint115 and are not presented as rerun against118. No current desktop ZIP is produced here. The renamed former project-trend.tsx implementation is preserved in tag117; its historical source/evidence hashes are not rewritten.
