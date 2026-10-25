# Source143 — navigation during loading and occupied Cost layout

[Reference comparison](review.html) · [Occupied Cost EN/dark](images/occupied/cost-occupied-en-dark.png) · [Retained palette observation](images/palette-retained-vite.png)

Validated bounded fixes; full redesign/visual/native release acceptance remains partial. Parent `d956d9865347ec9379c9e01e582d6850232d38f6`; production index `fe8a649c287962fb33a67b296a21f880f7cafe95cfcb8fbceb0ee8da3ea7bfe1`.

The combined source142 suite exposed a real palette lifetime defect, not a slow Cost API. An eager loading shell and resolved page each mounted their own navigation state. Opening the palette before module resolution could lose its query and close it when the temporary shell disappeared, leaving focus on BODY and no Cost request. The same route chain passed16 times when waiting for populated Overview. A deliberately held real module established the cause: selection before release works; release with an open query loses it. Shared React session state now lives above the replaced route boundary and retains open/query/keyboard index; stale disconnected dialog close events cannot erase it. Legacy/preview instances retain local state outside this provider. No timers, storage, API or visual controls were added for this fix.

Occupied Cost had a separate geometry failure: eight ranked model rows made the middle row315.39px tall and lower panels ended946.77px beyond the941px reference viewport. A browser-only control proved table height caused the growth. Normal desktop CSS now caps the existing focusable model-table viewport at230px, restoring the302px middle row; all eight rows remain available. Four actual source cases pass with65.40 API value, eight models, six projects and ten sessions unchanged. End/Home checks verify keyboard access to the last ranked model. Lower-panel bottoms are933.375px in English and931px in Thai. Responsive overflow, long Thai identities and exact History scopes also pass. No fixture was packaged into the application.

## Evidence

Web build and351 tests pass with zero failed/skipped/cancelled. The same deterministic Vite module-hold reproduction passes after the fix. The original navigation sequence passes16 cycles with original and populated readiness alternated. The maintained production route checker passes24 palette cases: retained query/focus across all nine routes in EN/dark/wide and TH/light/narrow, plus keyboard selected-index retention, closing before resolution, and selecting before resolution in both languages.

Full route lifecycle205-case verification: `True`. This includes18 cold route loads,160 rejected-import/loading/error/reload cases, preserved preferences, legacy/popup entries and the24 palette cases. It is browser/fixture evidence with test-only GPU/color flags, not native desktop or performance acceptance.

The full maintained History/Overview/Projects/Live/Providers/Models/Cost/Alerts integration passes, including16 sets of nine-route language/theme/width checks, authenticated HTTP/SQLite, matching export/paging, pause/in-flight protection, exact scopes, weighted price bases, source/owner states, occupied layouts and Alerts. Readiness selectors now wait for actual project/provider/model/cost data rather than matching loading placeholders; all data and geometry assertions remain. Earlier failed runs are retained.

All eight canonical final within-context capture pairs are exact. Seven before/after frames match source142 byte-for-byte. Providers retains105 differing global-header pixels, maximum channel delta4, bounds `[955,12,1362,46]`; the cause remains unestablished and full exact raster approval stays open. No image mask or tolerance adjustment was used. The successful sparse Cost frame remains unchanged; the bounded table affects occupied datasets.

## Remaining scope

This is not 99–100% reference approval or full blueprint completion. Native/physical/performance, customer/account/all-provider acceptance, installer migration/rollback and remaining original-reference review remain open. The newest runnable ZIP is still [review141/source140](../redesign-v1.85.141/README.md), which excludes History142 and these143 fixes. New executable packaging must bind this source after commit. Main and prior archives are preserved. Accepted scope and overrides remain in the [v1.1 ledger](../redesign-v1.85.109/authority/07-GAP-LEDGER-v1.1.md) and [full trace](../redesign-v1.85.109/REQUIREMENT-TRACE.md).
