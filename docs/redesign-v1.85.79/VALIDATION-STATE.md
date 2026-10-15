# v1.85.79 — Dashboard API loading and recovery

## Status

Validated bounded implementation. Overall eight-reference likeness, blueprint and release acceptance remain open. Base891bf99, isolated branch design/redesign-foundation; intended tag redesign-visual-fidelity-v1.85.79. No dependencies, database migration, live database changes or new pet work.

## Changes

Seven dashboard routes now reserve their actual main/rail composition while the first API snapshot is unknown or failed: Live metrics/sessions/flow/feed/advisories/matrix; Projects card grid/detail/top rail; Models summary/comparison/providers/detail; Providers account grid/inspector/comparison/health; Cost four summary cards/providers/trend/models/projects/sessions/insights; History summary/chart/records/detail rail; Alerts summary/chart/risks/rules/forecast/guidance/history. Slots carry no fabricated names, values, quota readings or chart points. Real empty states render only after an accepted response.

Headers and applicable filters remain usable. Live search/session controls retain the actual DOM during pending/error transitions. Models controls remain outside its primary-data condition. Query-only local retry generations re-run guarded loaders; Projects and Models detail effects have independent retry generations so a failed fixed custom scope really refetches. Alerts history retry explicitly bypasses its bounded cache.

Scope-aware failures use existing request keys and epochs; Projects client-only sort/tab changes preserve genuine errors. Live unchanged filter/search actions return before invalidating an in-flight request. Same-scope accepted facts remain during background failure. Alerts retains history only for the same source/origin/last-seen/reset reader and shows a stale warning. Pausing before the first Live/History response reserves neutral content with aria-busy=false; resume loads actual data.

Cold errors show localized status and real Retry, without raw API paths in the new status UI. The status area reserves the Retry footprint from the loading state. Decorative rows make room for that status; narrow Cost status belongs in its provider region instead of a small metric card. Existing background-error diagnostic banners are preserved.

## Current validation

- Production build exit0 (actual npm exit recorded); existing >500kB advisory remains.
- Full repository integration tests:509 passed,0 failed (daemon106, web205, tray198), on final source.
- Permanent browser gate: `node --import tsx scripts/check-dashboard-loading.mts`, exit0.
- 28 primary cases = seven routes × four paired configurations: EN/dark1586, TH/dark390, EN/light390, TH/light1586. Each holds the actual primary request, verifies neutral named/busy regions, injects503, uses keyboard Enter on Retry, requires another query and real loaded content, then fails an online background refresh and verifies accepted content remains. This is a paired matrix, not all eight possible language/theme/width combinations.
- Across all28 cases, loading-to-error x/y/width/height deltas are exactly0px; gate allows at most2px. This measures state stability, not equality to every loaded-data height or to Source pixels.
- Six separate EN detail cases (Projects/Models/Alerts × dark1586/light390) hold/fail/retry a fixed custom scope, require a new identical-endpoint query and preserve primary facts. Two EN/dark/native cold pause/resume cases reject the response while paused and recover after resume. These do not prove every detail identity/race or language combination.
- Gate also checks actual Live input DOM/focus retention, unchanged filter/search preservation and Projects client-only sort after initial failure. No uncaught browser errors, non-GET requests or external requests occurred. No ingest is used by these retries. Ordinary existing Refresh now actions retain their prior behavior.
- Final native EN/dark captures for all eight dashboard pages and existing responsive assertions pass. Seven loaded pages equal78 pixel-for-pixel; History differs4 pixels/max channel delta2 at bounds[29,478,1032,695], including sidebar/table antialias pixels. Cause not established; no full zero-pixel claim. This is preservation, not original Source acceptance.
- Current loading manifest, native geometry and built index hashes agree; source LF/built asset hashes are in build-provenance.json.

## Retained failures and corrected causes

1. Initial build rejected two widened string arrays used as translation keys; literal tuples fix the types. Final build passes.
2. First browser harness incorrectly waited for a fixture JSON body marker. ApiError intentionally formats HTTP status+path without reading that body; the error screenshot and api.ts support the cause. The probe now waits for the actual503/path banner.
3. Root initially moved status out of Live/Models metric cards without successfully attaching it at the destination (a fragment closing token truncated an automated edit). The next browser run failed on the missing Retry, and independent review confirmed it. Both destinations now explicitly render status; the original recovery cases pass.
4. The initial passing behavior matrix still measured loading/error shifts up to52px. These results and Cost screenshots are retained in diagnostics/pre-reserve-*. Static status space, fewer neutral rows where status is present, and relocating narrow Cost status remove the shifts. The strengthened same reproduction now measures0px for every region in all28 cases.

## Review and limits

Swarm implementation and cross-review covered all seventeen source/test files. Important findings about Live persistent controls/no-op updates, Projects stale error clearing, missing Retry placement, and independent detail retry were corrected before final validation. See CODE-REVIEW.md.

The original full40 canonical matrix is a separate integration run; no success is claimed for it in this checkpoint. The generic non-Overview lazy-module fallback remains and is separate from these route API reservations. Pending-to-loaded heights depend on real unknown data; this gate does not claim zero layout shift for every response, exact Source skeletons, persistent shell DOM across route-module replacement, or all A→B→A/detail race cases. Models/Providers primary unmount guards largely retain existing behavior; no cross-instance mutation was established. History keeps prior accepted table/summary during replacement scope queries and reports unknown applied scope to the shell. Existing selected History row persistence and related-session link scope semantics remain a separate known limitation.

Remaining whole-goal work includes original-reference artwork/detail acceptance across all eight pages, complete actions/states, minute/chart/runway/table/alert motion contracts and first-resume freshness, high-cardinality/performance, production-equivalent Electron lifecycle, package/rollback and manual accessibility/user acceptance. No99–100% whole-app likeness or release completion is claimed.
