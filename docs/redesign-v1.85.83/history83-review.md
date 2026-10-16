# History83 independent code review

## Scope and verdict

**Approve** this bounded History state and shared route encoder change. No blocking or important source finding remains from the inspected diff. This is not whole-redesign acceptance or release certification.

Applied review-code-changes skill. Read-only review; no browser, build, source/dependency/Git mutation. Reviewed the six requested files against HEAD9e54fd6, traced accepted API snapshots, row selection, related-session navigation, close, range/source edits, request guards and clipboard allowlist.

## Evidence and reasoning

- history.tsx101-118 preserves existing mounted/paused/key/epoch guard before snapshot and selection writes. Selection updates are functional, so an intervening explicit close remains null. Initial first-row selection is still once per mount, preserving existing behavior. No additional asynchronous boundary was introduced between guard and accepted state writes.
- history-selection.ts10 atomically refreshes the existing global event_id row and accepted scope. If absent, the original row+origin scope is retained together. This corrects both stale aggregate details and construction of links from a newer unrelated scope. Explicit row click stores that displayed snapshot scope. onClose sets null; ordinary refresh does not choose a different event or reopen it.
- Related-session href uses the selected origin's range/source/filters and overrides sessionId with its actual session_key. URLSearchParams preserves escaping; source_id becomes canonical source only for navigation. No new endpoint or raw record fields are exposed.
- Shared usageRouteHash reproduces previous usage/sessions encodings. session_id is added only to History and only for positive safe integers. HistorySection parses the URL with the same validation and passes it to the hook; actual range/source edits therefore retain the constraint. Existing filter-restoration effect remains unchanged.
- Clipboard copy retains the explicit metadata allowlist at history.tsx184. No dependency, daemon/query/schema, credential, prompt/response, popup or persisted preference change is introduced.
- Unit test file contains seven behavioral tests covering encoding/invalid values/other routes, identity refresh/reordering, absent-row origin, null/closed selection and exact related-session escaping/filter scope.

## Inspected validation

- source83-build-exit.txt and source83-repo-test-exit.txt both0. Logs show daemon106/web223/tray198 =527 tests, all failure counts0. Existing build chunk advisory remains; no claim of a new performance profile.
- tmp/history83-final/verification.json has five compiled application + isolated daemon/API/SSE checks. I read the harness and manifest and independently matched its index hash to the current dist index: 0e7be692b9e863868e7ec2ebeb0d7761ab669c9ce05cca4a6e4c84b7e50f437f.
- The browser checks cover first real selected row, actual synthetic aggregate revision updating table/detail/token/pricing/clipboard, closed detail staying closed after refresh, absent selection retaining origin, and related-session persistence through actual range/source controls. Clipboard is intercepted only at browser boundary. Scheduler notification is manually emitted; this does not prove ingestion/native delivery.
- Baseline82 detail timeout after API/table update is a meaningful regression described by root; I did not independently rerun it. Initial clipboard TS-helper failure is harness evidence, not an app defect.

## Validation limits

The five browser cases run EN/dark/native viewport, reduced motion, one aggregate identity and one absent-source transition. They are not exhaustive held-response A/B/A, every language/theme/width, clipboard-denial, Back/Forward or native lifecycle coverage. Pure state functions and preserved epoch guards support the reviewed mechanism; these narrower cases must not certify all History states. Root's separate current all-eight/visual run was active and was not accessed or duplicated by this reviewer. Retained absent records deliberately stay visible with their origin-scoped related link; no fabricated new-scope membership is asserted by this change.

## Reviewed source fingerprints

LF-normalized SHA256 below bind this report to the reviewed files. Re-review any later source change affecting the same behavior.

- packages/web/src/sections/history.tsx: `c83b9e984b834101e554c867ca19e7087e666826d3aa30b1b444b15573ffc73e`
- packages/web/src/components/usage-range.tsx: `b9ed2dc97baa5f824ebcfbe635f435cb42e48848f5787fa627e8106f52bdc5f9`
- packages/web/src/lib/usage-route.ts: `3feacce3a570b4796ea3ccde7b79b7546d7db26cf117a34aa5e06f435871272a`
- packages/web/src/redesign/history-selection.ts: `796386090e6b1f59253a9d490552c4e62be983858ce10aae23587776c05e2de1`
- packages/web/test/history-state.test.ts: `e2c29853fe64be3bb7e94479e553db321879a25ee9d4dd8721b3abc8afba96cd`
- scripts/check-history-selection.mts: `9069c8be97e7c933576114679a32eb9893fc46ec2e76c7ac119f7cf0510929fb`
