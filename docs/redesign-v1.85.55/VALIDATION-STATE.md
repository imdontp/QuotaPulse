# Native page headings v1.85.55

Validated current-build implementation; full concept and release acceptance remain open.

Projects, History, Providers and Cost headings now use measured native dark (>=1536px) size, weight, tracking and placement with the already bundled Geist/Noto fonts. Existing line heights are held fixed. Exact English copy is Providers & Subscriptions and Cost Overview; Thai Cost heading is ภาพรวมต้นทุน. English Cost navigation is Cost Analysis, including palette and accessible context. Routes, real monetary semantics, filters and all nine destinations are preserved.

Final build/native session88037 and final gates session46272 terminated with exit0. Final native EN-dark captures cover all eight main pages at reference dimensions; TH-dark covers four changed pages and1280/900/390 compact containment; TH-light covers the same four pages. UI compatibility and full40 EN/TH dark/light repeated-capture cases passed under the original unmasked tolerance. 36 of40 are byte-identical; all80 PNG hashes and native build bindings were verified. [Capture manifest](capture-verification.json) records each residual. The earlier170-unit pass belongs to initial candidate09ee4044 and predates CSS-only refinements; no final-build unit-suite result is claimed.

See [all-eight comparison viewer](reference-review.html), [title measurements](comparison/measurements.json), [review](REVIEW.md) and [build provenance](build-provenance.json).

Projects title bounds match the source shared ROI. History's far edge is two pixels narrower, Providers one narrower, Cost one wider. Positions and heights agree in those ROIs, with small remaining ink-density differences. These are localized raster diagnostics, not a likeness percentage. Providers/Cost old copy differs, so their before widths/densities are not exact-string comparisons. Decorative icon/glow, subtitles and remaining full-frame art/layout remain visibly different. Captures use deterministic synthetic HTTP/database fixtures to verify real application paths; source concept amounts and invented projection series were not inserted into the app.

Light/compact title CSS remains scoped out; the catalog wording intentionally applies across themes/widths and accessibility surfaces. No new dependency, query, computation or interactive control was introduced. Earlier source52 full40 results are superseded for current repeatability by this build's own recorded full40.

Remaining: source artwork/glow, main-page panel/typography/layout details and sidebar residuals across eight pages; approved-baseline/source SSIM and factual override review; manual accessibility/performance and current desktop/recovery/package gates. Full source and release acceptance are unproven.

Reproduction: archived helpers/runners expect to be copied to worktree tmp; relative imports and outputs resolve there. Run the final build/native runner and then the final gates runner. Existing tracked scripts/check-stable-captures.mts and scripts/check-ui.mjs are unchanged. The repeat manifest verifies80 original capture files; this checkpoint archives native reference-sized frames and the manifest rather than duplicating every repeated capture PNG.
