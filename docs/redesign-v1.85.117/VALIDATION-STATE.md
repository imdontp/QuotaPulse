# Projects recorded-value axes v1.85.117

Status: partially validated for the whole redesign. This checkpoint adds actual quantity/date axes to the selected-project graph and brings its plot composition closer to the original Projects reference. It does not establish whole-page 99–100% acceptance.

## Implementation

- New [ProjectTrend](../../packages/web/src/redesign/project-trend.tsx) wraps the existing recorded-value plot. Its five quantity ticks use that plot's actual maximum and quarter intervals. Date ticks sample actual bucket indices, retaining full timestamps in titles and ISO attributes; intraday buckets show time and scopes spanning years include the year. A zero-only scale has one zero label. Compact screens retain endpoint labels.
- The plot itself still uses the shared ObservedTrend component. Before/after comparison preserves all 30 bucket timestamps, values, normalized circle coordinates and polyline coordinates, plus the complete accessible chart label. No source curve is copied, smoothed or invented.
- The native plot moves from x1149.688 to1193.688 and narrows478.297 to434.297px, reserving44px for its quantity scale. Height76px and vertical position are unchanged. This follows the reference plot's approximate x1195–1628 extent.
- The keyboard-operable complete-data disclosure moves beside the native heading when closed. Its table still expands in normal flow. The previous generic scale caption stays available to assistive readers; the new visible axes supply its visual context. All unknown/native/calculated pricing coverage remains visible.
- The canonical rail ends at y935.359 instead of937.359 and stays inside941px. Narrow layouts retain normal flow. No API, database, period, sorting, search or selection calculation changes.

## Validation

Fresh web TypeScript/Vite build passes, retaining the existing large legacy App chunk warning. The existing Projects EN/TH × dark/light gate passes four pairs: three exact, one within the original unmasked raster tolerance. Added assertions compare quantity ticks and localized labels to the real API-derived plot maximum, and each date tick to its actual plotted bucket/ISO/title. Existing checks cover exact bucket data and proportional points, zero/tiny data, full chart-data keyboard access, sorting, search, stable project identities, selection, detail navigation and390/900/1280 overflow.

The canonical immediate repeat is exact. [Unmasked before/after analysis](evidence/analysis.json) also records unplanned controls: header167 pixels/max1, sidebar756/max1, heading/toolbar2327/max1 and cards9848/max2. These are retained differences; no compositor, gradient or raster cause is inferred. No threshold was relaxed, and these controls are not presented as exact.

Current compiled index SHA256: `b7e9f8f1c3421227e87dda5e736b6fb59c3690700a445324446b080d538f34cc`. [Gate report](evidence/projects-stable.json), [original/current comparison](review.html).

## Open scope

The broader [20-row trace](../redesign-v1.85.109/REQUIREMENT-TRACE.md), all-eight source acceptance, complete current native/settings/error/motion/resource matrix and retained raster/Thai-dark Models ring failures remain open. The previous actual two-version rollback/655-test evidence belongs to product114 in checkpoint115; it was not rerun against117. This checkpoint produces no updated desktop ZIP. Product data and semantic substitutions can differ from concept numbers; this is not whole-image equality.
