# Current Source fidelity priorities — checkpoint 81 audit / checkpoint 82 candidates

Read-only comparison completed across all eight original refs against `docs/redesign-v1.85.81/after/*.png`; all pairs share dimensions (Overview 1586×992, others 1672×941). Diagnostic montages `tmp/source82-a.png`, `tmp/source82-b.png` show Source at left and current at right. These are visual observations, not a similarity percentage or accepted baseline.

Authority: directly read `11_REFERENCE_OVERRIDES.md` inside `docs/quotapulse_build_blueprint_v1.1.zip`, plus source-inspected `docs/redesign-v1.85.43/OVERRIDE-COVERAGE.md`. OVR-001 requires all nine destinations; OVR-007 preserves genuine forecast; OVR-011/012 replace project authored facts; OVR-017 separates known/native/API values; OVR-022 forbids copying factual curves. Static artwork remains eligible for repair.

## Top 3 remaining static gaps outside root's Overview node / flow work

1. **Alerts forecast exterior atmosphere.** Source `alerts.png` approximately [1224,115,1650,330] has a fine electric-blue particle/grid field outside the Earth and narrow ring marks; current same region is nearly plain dark beyond its orb outlines. Source atmosphere continues behind the genuine forecast text, without requiring Source numbers. `tmp/source82-alerts-crop.png` is Source/current at native scale. Proposed files: `alerts.css`, `forecast-orb-art.tsx` or dedicated background SVG. Preserve actual days/reset/unknown and no extra metric-coded progress. Root has assigned independent implementation.

2. **Cost metric plate size and paint.** Source first plate approximately [262,143,306,187] = 44×44; current [263,144,299,180] = 36×36. Four Source plates are green / blue / violet / amber. Current all backgrounds are identical RGB(13,38,55), because nth-child changes only foreground. Representative Source background samples: first (270,155) RGB(2,56,53); blue (514,153) about(6,34,82); violet (751,153) about(32,18,80); amber (990,153) about(38,33,31). Source first label begins x318; current x306, independent of factual replacement wording. Native diagnostic `tmp/source82-summary.png`. **Implemented bounded candidate only in `cost.css`: production dark >=1536px, 44px icon/grid column, column gap10px (up from6) shifts label/amount +12px, icon left−1 aligns plate x262, 12px corners and Source-sampled tone gradients.** Icon body remains real Wallet/BarChart/TrendingUp/Database. No trend/value/unknown changes. Source label size/vertical alignment and glyph glow remain separate open details. Source shows 4 trends, but actual missing projections and sparse curve remain data facts; do not invent them.

3. **Projects identity cube / selected card light energy.** Source selected card [243,207,707,464] has a bright ~30px neon cube with halo inside the 54px plate; current plate uses a thin 24px Lucide Box without equivalent bloom, and Source edge glows more strongly at lower corners. Native comparison `tmp/source82-projects-crop.png`. `projects.tsx` uses Box for actual QuotaPulse identity and Folder otherwise; `projects.css:369` explicitly fixes heading SVG24px. Proposed repair: dedicated decorative Source cube artwork or scoped Box stroke/glow at the existing 54px plate, with selected rim/corner light refined separately. Preserve project identities, real Last observed, usage-share denominators, absent budgets and sparse chart; do not restore Source fake Active or description. This is next-work evidence, not implemented in this task.

## Excluded differences / caution

- More expansion and displaced QuickStats on Cost/Providers partly reflect approved same-nine-route navigation; do not revert to Source screen-specific missing links.
- Providers four versus eight cards, Models six versus twelve rows, absent benchmark/context metadata, real token curves and unavailable projections are factual/OVR differences rather than decoration regressions.
- Current History defaults unselected while Source includes a detail rail. Compare a selected actual record before attributing that to static layout.
- Alerts existing Earth/ring implementation is already closer than earlier checkpoints. The specific remaining candidate is exterior field and halo, not replacement of valid data or a claim the entire forecast component is incorrect.

## Validation status

Cost change is **partially validated by source inspection only**. No browser/build/Git run by this agent. Root owns integrated build, compiled native Cost capture, metric/control boxes, Thai/light/compact preservation, and final acceptance. No app source outside `packages/web/src/redesign/cost.css` edited. Diagnostic crops were generated from existing source/capture images only.

## Follow-up implementation — selected Projects cube

Root authorized `projects.css` only. Source/current within the existing identity plate [263,225,313,273], cyan mask G>150/B>190/G>1.5R: Source253 pixels, bbox[275,235,299,262]; current149 pixels, bbox[277,237,296,258]. At G>190 Source186/current117. These are descriptive glyph-support counts, not an acceptance score. Existing 24px Lucide SVG produces a ~20×22px actual path; 30px SVG targets ~25×28px Source path. Added native production-dark >=1536 rule only for selected-card `.lucide-box`, with 30px SVG and restrained blue/cyan drop shadows. Existing 54px plate, heading/card layout, title/facts and other identity glyphs remain unchanged. No translation/rim/cardpaint change. Root must inspect compiled raster and confirm fixed plate/card/text bounds; no browser/build/Git run by agent.
