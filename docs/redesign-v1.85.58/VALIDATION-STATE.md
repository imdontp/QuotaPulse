# Projects card rhythm v1.85.58

Validated scoped implementation. Full concept and release acceptance remain open.

Native dark Projects now aligns token content and its thicker cyan/blue share bar with the reference, shortens the observed sparkline, and aligns the three fact columns and divider. At the 1672px reference width, the five fixture card frames remain 258px high. At 1536px, Thai dark cards may expand to 266.78px to fit content. Minimum fact-column widths preserve readable labels in narrower right cards; rows can grow with real text. Counts, costs, metadata, observation points, scoped-share semantics, selection and controls are unchanged.

Final web build/native check session57939 passed. Session91387 passed TH dark/light native and compact checks, all-eight EN-dark native captures, and the original four Projects repeated pairs. All four pairs are byte-identical, with eight hashes verified and unchanged unmasked tolerance. Final EN session2840 additionally passed the 1536px breakpoint and 1280/900/390 checks; TH dark/light also passed those widths. A sandbox Chrome launch failure preceded the successful approved isolated rerun and is retained separately.

The [all-eight comparison viewer](reference-review.html), [card comparison](comparison/selected-card.png), [geometry/provenance](build-provenance.json) and [containment](label-containment.json) bind the current build. Captures use deterministic synthetic fixtures through real app code, not a Concept Preview mode. Source-only project descriptions, budgets, percentages and fabricated amounts were not copied. Source comparisons retain their different factual text and chart shapes; no 99–100% or source SSIM result is claimed.

Current full40/UI/unit/Electron/release checks were not rerun for this scoped CSS change. Checkpoint55's broader pass remains historical evidence for its own build. Remaining work includes Runtime Map typography/alignment, cost/model table details, residual artwork/sidebar differences, source acceptance, manual accessibility and current packaging/recovery gates. Main worktree and unrelated .zed files remain untouched.
