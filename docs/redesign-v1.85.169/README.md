# Measured Alerts section typography and eight-page inventory / source169

Five English dark desktop Alerts section headings now use independently measured scales rather than the common 16px/600 treatment. Existing production meanings and wording remain. All heading line-box heights are unchanged; responsive Thai/light/smaller-screen treatments retain their current sizing. No data query, action, notification semantics or motion behavior changes.

| Heading role | Size / weight | Same-literal reference probe, binary ink IoU before → chosen |
|---|---|---|
| Observed quota chart |15.5px /550|0.323 →0.600|
| Current risks |14.5px /600|0.286 →0.620|
| Fixed threshold table |14px /550|0.251 →0.667|
| Recommended actions |14px /500|0.277 →0.625|
| Threshold event history |12px /500|0.188 →0.568|

The probe renders each original literal heading with the bundled Geist font, compares thresholded glyph ink inside documented original-image regions, and permits translation only. It does not stretch text, mask regions or replace production labels with concept claims. Scores describe local font-candidate measurement, not application similarity, SSIM, exact font identification or approval. The forecast heading had a weaker best match (0.418); it remains unchanged pending better evidence. Original refs are reused from source156; the original PNGs remain untouched.

The [inventory and remaining acceptance work](INVENTORY.md) maps all eight screens to their art, controls and motion implementation. Compressed raw DOM inventories record rendered geometry, fonts, paint, visible controls, artwork elements and static reduced-motion animation state. These are a current-state catalogue, not behavioral acceptance for every listed element.

Validation: production build,375 web unit tests and the complete HTTP/in-memory SQLite dashboard integration, including144 responsive route cases, passed. All eight canonical capture/repeat pairs match exactly. Six complete frames are unchanged from source168. Alerts has14,289 changed pixels from the five headings and their intrinsic inline reflow; every heading line-box height is unchanged. History initially has107 cross-context differences (maximum channel delta4). A fresh context of the same source169 build differs by525 pixels, including the native record-kind select's glyphs (maximum delta231), despite matching computed font and select geometry. A fresh delivered-source166 capture matches its older baseline exactly. The transient select paint cause is unresolved; it is not classified as harmless noise or fixed. Complete unmasked comparisons are retained. No image was masked or silently rebased.

Capture helper failures are retained: TypeScript's injected `__name` helper was absent in the browser serialization; using a plain browser JavaScript expression fixed that helper, followed by correcting its route variable name. Initial sandboxed build/unit attempts could not spawn workers (`EPERM`); the scoped reruns passed. No production fix is attributed to those harness/environment errors.

Main commands: `npm.cmd run build -w @quotapulse/web`, `npm.cmd test -w @quotapulse/web`, `node --import tsx scripts/check-history.mts`. Frozen measurement/capture helpers and checksums accompany the evidence. No new worktree, dependency or native runtime copy was created. Native review167 still contains source166 and excludes source168/169. Full concept acceptance, a named approved visual baseline, real-motion/performance and physical desktop/two-version rollback acceptance remain open; the overall goal is active.
