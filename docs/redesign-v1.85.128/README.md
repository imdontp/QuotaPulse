# Dashboard reference artwork v1.85.128

**Partially validated. Overall redesign and 99–100% reference fidelity are not achieved.**

[Open original / before / current comparison](review.html). Source build and evidence identifiers are in [summary.json](summary.json).

## Implementation

The dashboard now uses the reference-specific green Hermes, purple Codex, orange Claude Code and blue OpenCode badges, plus the white OpenCode Go subscription character on a purple plate. These are dashboard artwork reconstructed from the supplied concept, not a claim that they are official vendor logos. Original vendor/model marks and legacy fallback components are unchanged.

The four known harness IDs map exactly; unknown IDs retain the original fallback, without guessing from name prefixes. Subscription artwork selects the recorded OpenCode subscription identity. Existing names, source IDs, amounts, unknown/partial values and links remain real. The Pet and backend are unchanged. Six dashboard routes use the new marks; Models and Cost remain pixel identical in this canonical fixture. History integration is within its redesign branch.

SVG paths for Hermes, Codex, Claude Code and the subscription character come from thresholded contours of the supplied reference crops. Closed contour simplification uses 0.75 source-pixel tolerance and 0.18-pixel rounded corners. The blue OpenCode roundel is reconstructed with native SVG geometry; its diagnostic traced mask is not used in production. Initial pixel-grid contours were rejected after rendering the gallery. This remains an approximation requiring visual review, not measured 99% fidelity.

## Validation and remaining failures

- Production build, 335/335 web tests, 48 actual Chrome cases across six routes, EN/TH, dark/light and 390/1672 widths passed. Browser cases verify raw API harness identity, real values, unique gradients, decorative accessibility, no new focus stops, no page overflow and no forbidden writes. They use an isolated in-memory fixture, not customer data.
- Component gallery: 72 glyph instances at 8–44 px; six legacy fallback comparisons; 60 unique gradient IDs; no focus stops or browser errors.
- Eight source-sized pages repeat byte exactly within their own browser contexts. This is not the broader distinct-document repeat gate.
- The earlier full gate completed 36 first-pass page/language/theme captures, then failed on Providers (233 pixels, max channel delta20). The failure has 209 header and24 sidebar pixels, zero outside those regions. Its manifest excludes32 stale files. Only its failed pair is published here; the capture manifest records the40 fresh images, not72 purported fresh captures.
- Final scoped Providers and History repeat gates also FAILED: each125 pixels, max channel delta7. See scoped-repeat-failures.json for measured bounds and header/sidebar counts. No success manifest is claimed. No tolerance, screenshot mask, renderer flag or product workaround was added to force these gates green. Cause of the repeat variation is unresolved.

## Providers layout diagnosis

The20,356 changed pixels are confined to the subscription plate/glow (5,725), comparison artwork (285), and reader table (14,346). These regions are diagnostic only. In a same-document intervention, replacing just the four reader glyph DOMs with the original HarnessIcon output makes the health region pixel identical to the prior image. The new Hermes badge gives a16px identity line instead of14.84375px, increasing the first row from30.640625 to31.796875px and shifting subsequent rows1.15625px. The table remains readable; this is an explained layout consequence, not a claim that only glyph pixels changed. Main region geometry is unchanged across all eight pages. See the raw control measurements and retained control frame.

## Delivery limits

The latest runnable ZIP remains review125 built from source124; it does not include126–128. This checkpoint contains source and review evidence, not an updated application ZIP. Full visual parity, updated delivery, and the unresolved repeat gates remain work. Main is unchanged; this work is isolated on design/redesign-foundation.
