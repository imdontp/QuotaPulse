# Projects ranking identity checkpoint v1.85.107

Status: partially validated. The bounded Projects checks pass; strict all-eight raster control remains RED and full concept acceptance remains open.

## Production change

Ranking rows now use the same existing stable project tone as their card/detail. A decorative24px identity plate replaces the bare16px folder. QuotaPulse uses the same Box identity as its card; other actual project identities keep Folder. No arbitrary work/category/state icons are inferred. The wrapper is aria-hidden; the actual project name remains the button accessible name. Selection callbacks, motion keys, ordering, filters and API values are unchanged.

Native dark icon/name anchors are independently estimated from the original reference: first icon plate x1177, name x1210. Actual x1177.688/name1210.688 are within1px; this checks horizontal anchors only. Reference first-row plate background samples are approximately RGB1-4/29-34/91-113. A source-sampled dark blue material replaces the initial muted cyan plate on QuotaPulse. Enlarged original/106/final107 inspection is linked below. Vertical panel position, row spacing, typography, non-QuotaPulse illustration differences and full page fidelity remain open.

The native dark cyan ranking bar now shares its existing card cyan-to-blue gradient. Other ranking bars keep the existing common data gradient; stable project identity colors apply to their icon plates. Quantities are still exact scoped recorded-token proportions, including tiny nonzero bars; there is no minimum visual data floor, quota denominator, budget or invented project state. No production images or new dependencies were added.

## Final-build validation

All final results match compiled index SHA256 6833dcb0c0d48c6d3420b35a6bed2ef22b9c0d6d7718fb797151af284ecb2ce6 and Chrome155.0.8059.80.

- npm run build -w @quotapulse/web passes TypeScript/Vite; pre-existing large-chunk warning remains.
- Existing Projects stable gate passes EN/TH x dark/light, four repeat pairs all byte-identical, no masks. It checks API-matched card data, true tiny proportions, sorting, selection/detail, empty search/restore, complete chart-data tables,390/900/1280 containment and Settings shell access. Full raw verifier JSON is archived.
- Additional ranking harness:20 keyboard selections, all five identity tones in four language/theme combinations. Each row order, token quantity and exact share width matches the actual isolated fixture API. Ranking icon tone/color and bar gradient match its card; selected detail matches. Decorative accessibility names stay equal to real project identities. Sorting retains rank order and colors; empty search removes rows and clearing restores them.
-24 focused layout cases = four locale/theme combinations x six widths390/900/1280/1536/1672/1920. No page horizontal overflow. Icon plates fit real buttons; button, bar and token rectangles do not overlap. Four canonical localized/theme capture pairs are immediately byte-identical. Responsive snapshots are after the interaction checks with Research Lab selected and recent sorting; they are not initial canonical states.
- Final all-eight EN dark captures use original canvases: Overview1586x992, other seven1672x941. All immediate repeats are byte-identical. Full main/sidebar/QuickStats/headings geometry is exactly equal to106, including Projects. No browser errors or forbidden external/write requests.

These captures/layout checks use the recorded deterministic renderer arguments. They are not a native performance, motion, complete accessibility or final packaged-host certification. No repository-wide, full native, packaging or rollback suite was rerun for this presentation change. One successful intermediate gate preceded the blue-material refinement; its logs remain historical, and the complete ranking and Projects gates were rerun on the final build.

## Strict all-eight raster control RED

Every pixel is counted, with no masks or tolerance. Projects has7153 changed pixels, all inside its five ranking rows plus6px CSS shadow extent; zero unexplained pixels outside. Overview,Live,Models,Alerts have zero changed pixels. History has24 sidebar pixels/maxdelta35, Providers10 sidebar pixels/maxdelta1, Cost2 sidebar pixels/maxdelta2. Raw before/after samples are retained; these are not attributed to the Projects source edit and causes/harmlessness remain unproven. The strict control exits1. Passing repeatability and functional/layout gates does not clear this or historical rendering evidence.

## Review and continuation

[All-eight original/106/current viewer](review.html) includes side-by-side, overlay and unmasked difference. See enlarged identity inspection and localized/light/compact snapshots. The fixture DB is synthetic/in-memory; production continues to display actual observed data.

Projects ranking identity colors now complete the specific follow-up from102. Other Projects typography/art/material/layout work remains. Next inspect Cost chart vertical alignment while preserving visible pricing coverage, then continue all-eight differences, historical raster diagnostics, actual tested-host/build identification, native/package/performance/rollback and original requirement trace. [Full obligations](../redesign-v1.85.95/NEXT-REQUIRED-WORK.md). No99-100% fidelity or user visual approval is claimed. Main and user data remain untouched.

## Reproduction

Build the web workspace. Set QUOTAPULSE_CAPTURE_SCOPE=projects and run node --import tsx scripts/check-stable-captures.mts (isolated port7804). Extract archived ranking .mts harnesses to tmp to preserve imports; capture-ranking107-after.mts and capture-ranking107-all8.mts use isolated port7816 and must run sequentially with each other. check-ranking107-controls.mts uses the retained106 images, current all-eight captures and current ranks-en-dark metadata; it correctly exits1 for RED. Hash manifest binds stored evidence and source LF fingerprints to this checkpoint.
