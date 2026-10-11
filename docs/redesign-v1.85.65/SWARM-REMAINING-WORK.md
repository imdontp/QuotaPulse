# Current source and blueprint audit

Read-only swarm review at checkpoint65, with actual current files and original eight reference PNGs. This is a remaining-work audit, not final visual acceptance or an independent review of the complete65 patch.

## Source review: source65_remaining_review

1. Cost bars still use a cyan-to-muted-violet ramp (`packages/web/src/redesign/cost.css:25`). Reference bars descend to deep blue with bright edges and a restrained halo. Measured samples compare each bar's own normalized height, preserving factual differences. A proposed native-dark CSS patch is prepared under `proposed66/`; it has not been applied or browser-validated.
2. History unselected table paint is brighter/grayer than the reference in x900–1050/y585–885. Review native row/card backgrounds and subtle stripes while preserving selected rows and boundaries (`packages/web/src/redesign/history.css`). No patch applied.
3. Projects/Providers/History title ink appears thin. This is a visual hypothesis requiring matching-text crop/stem measurements before choosing a new weight; current line-box geometry alone does not settle it. No unsupported numeric font-weight target is asserted.

## Blueprint audit: blueprint65_completion_audit

1. Models currently always displays unknown catalog capacity. The revised blueprint requires exact catalog capacity with provenance/date separate from observed context. `model-detail.ts` currently returns observed context only; `price` already stores exact `(provider,model)` context capacity, origin and local load time. A proposed additive exact-pair API/UI patch with meaningful tests is prepared under `proposed66/`. It is not applied or validated. No aliases, maker inference, fuzzy pricing lookup or cross-provider fallback may supply capacity. Local load time must not be presented as publication date. The existing loader's capacity-only-entry and conflict-origin limitations are documented in the proposal.
2. Models effort rendering uses `row.effort ?? 'null'` as a key and a truthy display fallback, colliding NULL with literal null and conflating empty strings. The capacity proposal also preserves exact category identities and distinct localized missing/empty labels.
3. Measure hidden/offscreen work and enforce the required suppression: `activity-sparkline.tsx` draws on mount/resize/theme/DPR without visibility/intersection guards; the shell clock ticks while hidden. Instrument actual paints, commits, queries and repeated navigation before claiming a measured failure or CPU gain. Overview core/map already has visibility handling; preserve it.
4. Final current-build full regression, actual hang/popup recovery, package/install and matching-assets rollback, manual accessibility, all-eight concept/override review, named approved baseline/reviewer/commit and subsequent SSIM >= .985 remain unproven. Consolidate one RC evidence index when those requirements are actually met.

Scoped QuickStats, generation guards, pause snapshots and scope-preserving destinations already exist and have meaningful dedicated checks; do not reopen them from stale Pending43 ledger wording. Categorical effort pagination is a potential measured performance hardening change, not an explicit missing NEW_READ contract.

Root verified the relevant current Models effort rendering and model-detail/catalog source boundaries. Proposed changes remain separated from checkpoint65 source, tests and dist. Current65 gates were kept frozen until their terminal success. The full goal remains open.
