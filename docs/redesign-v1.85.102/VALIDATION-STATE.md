# Projects palette checkpoint v1.85.102

Status: validated for this bounded palette change; full dashboard concept acceptance remains open.

## Change

Stable project identities now select cyan, violet, blue, orange or neutral decorative tones. QuotaPulse retains cyan and unassigned projects use neutral. Other identities use an FNV hash; colors have no status, archive, budget or category meaning. Sorting and filtering do not assign new colors. Cards, selected borders, icon plates, facts and sparklines share the identity accent; the selected detail matches the card. The previously measured cyan icon plate and selected rim are preserved. Real data, route behavior and pricing semantics are unchanged.

The stable-capture shell assertion was stale: it expected all three secondary routes inside an automatically open More. The implemented checkpoint101 behavior instead exposes the selected secondary route separately and keeps More collapsed with the other two. The assertion now checks that contract and still requires all nine links. The first attempted matrix run failed on that stale expectation; after the test correction the complete matrix passed. A capture-helper attempt also failed because its contrast parser did not expand #fff; that helper was corrected without a production change.

## Validation

- TypeScript/Vite build exit 0. Existing bundle-size warning remains.
- Projects stable browser gate exit 0: EN/TH × dark/light, four repeat pairs, API-matched values, stable colors through sorting, keyboard selection/detail, search empty/restore, breakdown tables and 390/900/1280 overflow checks; Settings shell access also exercised.
- Three matrix pairs byte-identical; Thai dark has 8 differing pixels, max channel delta 2, within the pre-existing unmasked raster tolerance (max delta10, max fraction0.00005). This is repeatability evidence, not concept similarity.
- Additional EN canonical captures at original 1672×941: both themes have byte-identical immediate repeats. All five tones were selected by keyboard in each theme and checked against the detail's computed icon color. No browser errors or external/write requests.
- All ten computed accent colors exceed 4.5:1 against their solid panel token; minimum is 5.90:1 (dark violet). This checks these color pairs only, not all text, gradients, rendered pixels or accessibility requirements.
- Additional captures check no horizontal overflow at 390/900/1280 in both themes. The full repository tests and native motion gate were not repeated for this CSS/identity palette change; checkpoint101 evidence remains historical.

Use [the local image viewer](review.html) for original / checkpoint101 / current dark, current light, and EN/TH matrix captures. All displayed numbers are from isolated synthetic test databases; the application continues to read real data normally. Images are review candidates, not approved baselines.

## Remaining work

Full all-eight reference fidelity, artwork/type/layout review and user visual acceptance remain open. Real data differences must remain truthful. The seven-pixel Providers corner control and historical rendering diagnostics in [checkpoint101](../redesign-v1.85.101/VALIDATION-STATE.md) are not resolved by this palette change. Full native packaging/performance/rollback gates remain open. Ranking-rail icons still use the existing global accent; extending identity colors there is a follow-up, not validated by this checkpoint.

## Reproduction

Build: npm run build -w @quotapulse/web. Matrix: set QUOTAPULSE_CAPTURE_SCOPE=projects and run node --import tsx scripts/check-stable-captures.mts. Unset capture language/theme filters for all four cases. The archived capture-palette102.mts.gz can be extracted to tmp/capture-palette102.mts and run with node --import tsx; it uses local port7816 and an isolated in-memory fixture. The matrix uses port7804. Source LF fingerprints and compiled index hash are recorded in evidence/source-fingerprints.json; raw logs and exact harness sources are gzipped.
