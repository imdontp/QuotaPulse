# Cost identity palette and legend columns v1.85.120

Status: partially validated for the full redesign. Cost's model share colors and provider legend composition now follow the reference more closely while retaining real monetary provenance and proportions. No whole-page99–100% acceptance is established.

## Changed

- Model share bars use the actual API model-maker identity, replacing a palette that cycled by row rank. OpenAI is blue, Anthropic violet, DeepSeek/Google cyan and unmapped makers neutral. The source RGB samples and coordinates are retained in [the analysis](evidence/analysis.json). Different recorded routes for the same maker retain their color when amount ranking changes. Color is decorative and does not assert a lifecycle or quality score.
- Dedicated darker hues are used in light theme. Project share paint retains its existing rules. No amount, width, ordering, filter or grouping calculation changes.
- Native provider legend rows have separate dot, name, amount and share columns. The duplicate decorative brand icon is removed from this legend, following the source composition. Provider identities, amount coverage marker, share and accessible separator remain. Narrow layouts wrap the amount/share group beneath the name; no fact is hidden to fit the panel.

Product changes: [cost.tsx](../../packages/web/src/redesign/cost.tsx), [cost.css](../../packages/web/src/redesign/cost.css). Existing real-data/API mechanisms and callbacks are retained.

## Validation

- Fresh web TypeScript/Vite build passes, retaining the existing large legacy App chunk warning.
- Existing Cost EN/TH × dark/light gate passes four byte-identical pairs with unchanged unmasked tolerances. Twelve scoped checks retain actual API/native bases, partial/unpriced/zero/tiny values, dual chart scales, bucket centers, full chart data, keyboard and390/900/1280 overflow. Added assertions match provider identity/amount/coverage/share and model-maker identity/colors to the actual API response across changed native/API rankings.
- Native Chrome without renderer flags passes28 cases: EN/TH × dark/light ×390/900/1280/1536/1586/1672/1920. Provider name/amount/share rectangles stay inside each row, and native columns do not overlap. Existing plot/context ordering, all-bucket disclosure, focus/open/close, expanded containment and viewport overflow checks remain enabled. The old matrix uses the current Date-only helper so real timers keep running.
- Canonical before/after preserves all six model row texts, share widths and row bounds, plus all four provider identities, monetary/share text, dot colors and row bounds. The immediate repeat is exact. There are4666 changed pixels;4664 are in the intended legend/share regions. Two sidebar pixels at(30,689) and(57,689) differ by at most2 channel levels. They remain recorded, with no raster-cause inference or mask.

Current compiled index SHA256: `2bbbad3034eabc907b040a7cb78054832ab81b577cf5fe44fa234f2a682826bd`. [Cost gate](evidence/cost-stable.json), [native28-case report](evidence/native-matrix.json), [reference/current viewer](review.html).

## Still open

Full [20-row trace](../redesign-v1.85.109/REQUIREMENT-TRACE.md), all-eight visual acceptance, current production native/settings/error/motion/resource matrix, retained raster controls and119's native Models Thai-light table pixels remain open. Models ring evidence belongs to119. The655-test suite and actual two-version rollback belong to product114/checkpoint115 and are not relabelled as current executions. No updated desktop ZIP is produced here.
