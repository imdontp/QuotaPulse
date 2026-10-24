# Models reference input/output ring v1.85.133

[Open original / before / current comparison](review.html). Bounded Models change validated; full redesign and 99–100% visual acceptance remain incomplete.

## Reference authority and implementation

The approved v1.1 Models contract retains the detail donut and scoped token/cache facts; unlisted reference composition remains authoritative. Original models.png uses two input/output sectors. The previous implementation used four sectors and four legend rows. The current ring restores two blue/purple sectors, two percentage/value rows, a small total caption, the reference-sized dots and measured wide-screen placement. This is native SVG/code artwork, with no new dependency or raster asset.

Input sums fresh input, cache reads and cache writes. Output retains its separate recorded value. The full three-part input breakdown remains behind an actionable native disclosure, with exact localized counts and a note about stored totals. Nothing is removed from the API or reclassified by provider/model. Existing model selection and scope guards are unchanged; the existing finite selection outline remains. Ring interpolation itself is still an open motion requirement; no new animation loop, timer or polling was added.

Sectors describe the component total. When it reconciles with the stored total, the center says Total Tokens. When it differs, the center says Component total and the disclosure/accessible region retain both actual totals. No unknown remainder is invented. A genuine zero has a neutral ring and undefined percentage shares; a positive stored total with no component breakdown shows unavailable values. Invalid/negative/nonfinite components are unavailable. Reconciliation tolerates floating arithmetic noise; regression coverage keeps a one-token difference at 274 million visible. Tiny positive sectors receive no minimum angular floor and cannot be erased by their decorative gap.

## Verification

- Final TypeScript/production build and 341/341 web tests passed, including six new accounting/zero/missing/tiny/precision regressions.
- 8 actual Chrome cases cover EN/TH, dark/light and 390/1672. Each compares the exact Models API response with input/output values, percentages and arcs, verifies local unique gradient IDs, keyboard open/close of all three cache fields, no overlap with the ring, child containment and no page overflow/errors/forbidden writes.
- 12 edge cases cover real API fixture groups in desktop EN/dark and narrow TH/light: stored 777 versus component 60, true zero, positive stored total without components, input-only, output-only and one input token out of 100 million. No synthetic data is shipped in the UI or inserted into a customer database.
- Maintained Models gate now asserts the selected model/provider pair's component values and keyboard disclosure. All four EN/TH × dark/light distinct-document repeat pairs passed byte exactly under the unchanged gate, with no screenshot masks or relaxed tolerance.
- All eight source-sized before/current frames repeat exactly within their contexts; seven other pages are byte unchanged. Main region geometry is unchanged. The 21,329 changed pixels in Models are within its distribution artwork/legend and surrounding glow. See whole-frame analysis.json rather than a masked similarity score.
- Diagnostic color threshold localization finds the current colored ring envelope within 1 px of the reference's four bounds and identical heading glyph row bounds. This is NOT a 99% shape, color, whole-panel or whole-page score. Actual data ratios/numbers differ from concept data, as required by the accepted consistency override.

## Retained implementation/harness corrections

The first build resolved a .ts helper instead of a same-basename .tsx component; the panel now has its own distinct filename. The initial tiny-arc test used exact floating equality; it now tests a tight numerical tolerance while retaining strict no-floor behavior. A preceding-build capture received 403 because the harness passed a Windows root with forward slashes to the strict containment comparison; resolving the harness path fixed that case. The production guard was not changed or bypassed. The first edge fixture attempted null token fields, which correctly violated SQLite's non-null schema; the fixture now expresses a zero component aggregate with a positive stored total. Original failed logs and the 403 diagnosis are retained.

## Remaining work and delivery

The full blueprint trace/accepted gap ledger remain authoritative. Overall material/type/control fidelity, motion interpolation, full all-page repeat stability, real-reader/customer acceptance, physical desktop behavior, performance and human approval remain open. This checkpoint is browser/source evidence, not a fresh Electron or ZIP run. Latest runnable ZIP is review132 built from source131 and excludes this 133 change. Main is unchanged; source/branch/tag remain isolated.
