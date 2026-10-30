# Cost chart bucket alignment and Runtime Map probe

[Compare Cost with the concept](review.html). The current image uses a fixed, isolated synthetic database with 16 additional historical records so both chart series have visible variation. The screenshot is English/dark at 1672 × 941 with reduced motion; its amounts and timeline are fixture values, not customer data.

The Cost chart previously placed bars with flex gaps while the token line used evenly divided bucket centers. The original compiled-browser check measured up to 1.890625px of horizontal disagreement for the same bucket. The bar slots now divide the same plot width evenly; spacing is inside each slot. Neither series values, range, y-scales nor tooltip semantics were changed. The varied fixture measured a maximum 0.015625px difference between bar and token-dot centers.

The web build passed. Cost's four English/Thai and dark/light browser pairs passed byte-for-byte without masks, including API-derived values, tooltips and keyboard interaction. The long-range suite passed 32 cases with 161–240 buckets, and a separate 40-case browser check covered 1, 2, 60, 61 and 240 buckets at 390px and 1672px in both languages/themes; its maximum line-to-bar offset was 0.46875px. The varied concept-sized screenshot repeated byte-identically. The evidence archive retains the failing before-check, successful runs, fixture driver and verification.

The Runtime Map issue recorded in [checkpoint205](../redesign-v1.85.205/README.md) did not reproduce in 500 additional synthetic rapid close/select transitions. This stress probe does not reproduce the original keyboard sequence exactly and does not establish its cause or a fix. The earlier 600 alternate keyboard opens and full reruns also passed; the original intermittent symptom remains unresolved.

Review206 predates this change. Real-provider behavior, physical desktop/tray testing, cross-schema migration, production performance and overall concept acceptance remain open.
