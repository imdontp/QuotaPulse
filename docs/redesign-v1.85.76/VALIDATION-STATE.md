# v1.85.76 — Exact Runtime Map project selection

## Status and change

Validated scoped behavior fix on `design/redesign-foundation`, based on `f09459f`; intended tag `redesign-visual-fidelity-v1.85.76`. Full source and release acceptance remain open.

The initial automatic selection now uses a unique Symbol, preventing collision with a recorded project named `auto`. The All state is explicitly null rather than any falsy value. Native select option values losslessly encode project strings, separating a real empty string from All while retaining quotes, literal `null`, surrounding spaces and Unicode. Empty option text uses the existing localized Empty name label. API query encoding, global Overview period/source, graph snapshot guards and fixture restoration are retained.

## Reproduction and validation

- Before75 production build: seven selection transitions, three observable mismatches. Empty, auto, and the return to empty showed all six project identities instead of their one requested identity. Literal null, quoted, Unicode and All cases passed. This is retained in `before/verification.json`, not inferred from code alone.
- Current production web build: exit0; existing large-chunk advisory remains.
- Current web tests:205 passed, zero failures.
- Current isolated local API/browser probe:28 transitions, zero mismatches; EN/TH at1672/390. Exact API query identities and rendered project identities were checked, including All then empty. It uses a synthetic in-memory database, not live user records.
- Current canonical Overview gate: four EN/TH dark/light pairs, 4 exactly equal; all within original maxChannelDelta10 / maxChangedPixelFraction0.00005 tolerance, no masks. The new permanent regression executes seven exact-identity transitions per language/theme and restores mutated fixture sessions. Existing period, quota, keyboard, model navigation and graph checks remain enabled.
- An initial canonical run failed because its prior assertion expected the raw native option value `QuotaPulse`. The displayed name and selected project were unchanged; the assertion now expects the encoded option value. The failed log is preserved in `diagnostics/old-value-assertion.log`; no semantic expectation or tolerance was relaxed.
- Current verification artifacts bind index SHA `d566cf0ac1d9182ede9d8ec91482c131096147be05488b5b7dec40eb3c526e20`. Working/staged artifact and source hashes are checked before commit.
- The current canonical EN/dark capture differs from the75 native-harness image by5352 pixels within [295,92,1155,436]. These use different capture procedures; cause is not established and no zero-pixel appearance-preservation claim is made for76. Current same-harness repeats are all exact. See overview-diff.json.
- Review is by the implementing agent; no independent review is claimed for76. See CODE-REVIEW.md.

## Review and remaining work

[Current Overview and special-identity fixtures](review.html). [Checkpoint75 eight-page source comparison](../redesign-v1.85.75/review.html) remains the most recent all-eight capture; it is historical75, not a current76 all-eight run. No current full40, complete-repository, native package/lifecycle or user acceptance result is claimed.

The existing missing-project/null graph node remains visible within All; no separate missing-project filter was added. Blank project node presentation outside the selector is unchanged. First-post-resume motion conservatism, other seven loading/lazy-chunk states, whole-source visual/state/action acceptance, performance/high-cardinality, production-equivalent desktop lifecycle, packaging/rollback and manual accessibility/user acceptance remain open. This checkpoint does not establish99–100% whole-source likeness or completion of the overall goal.
