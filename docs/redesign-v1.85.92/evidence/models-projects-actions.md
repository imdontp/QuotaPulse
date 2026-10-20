# Generic motion92: Models and Projects interaction map

Status: read-only proposal against current application source; no app edits, build, browser or Git operations. Phase91 published parent checkpoint: `62d14c132def282fe1bc1636e5dd6c3deb7775cd`. Implementation recommendation: Models first; validate that bounded pattern before applying it to Projects.

## Authority and existing primitive

Original `docs/quotapulse_build_blueprint_v1.1.zip`, member `quotapulse_build_blueprint/03_DESIGN_SYSTEM_AND_MOTION.md`, requires new record/selection transitions180ms and one-shot emphasis700ms, stable identity, no loop, reduced static. Visibility/intersection stop work and unmount releases listeners; page-wide SSE remains unchanged.

Current History has an actual finite DOM runner (`history-motion.ts`: `playHistoryTransitions`, `historyElementVisible`) using shared `DURATION.fast`, `DURATION.deliberate`, `EASE.motion`. It animates opacity and background over final factual DOM; completion/cancel removes listeners and releases native handles/observer targets. History retains its record-specific preceding accepted-page identity semantics in `newHistoryPresences`, and user intent is separate from automatic selection. Root has validated native durations, duplicate-refresh survival, pause/offscreen/restoration and unmount. Those results prove History, not unimplemented Models/Projects.

Reuse the finite runner/visibility code after a neutral extraction (suggested `redesign/observed-transition.ts`), retaining History exports as aliases to avoid changing History callsites/test API. Keep History identity and baseline logic in its own files. A small new selection hook should coordinate exact user intent and accepted data, rather than attach generic mount animations. No CSS changes or new wrapper boxes are necessary for the first Models scope.

## Models: actual current behavior

Files: `redesign/models.tsx`, `model-selection.ts`, `model-row-trends.ts`, `model-comparison-page.ts`.

- Comparison row's existing native button explicitly invokes `update({ model: group.model, selectedProvider: group.provider })`. Pointer and native keyboard activation share this handler.
- Exact pair identity is existing `modelPairKey(group) = JSON.stringify([model, provider])`. Null, empty string and ordinary strings remain distinct; provider is recorded routing provider, not vendor. Existing `identityKey(group)` and React row key remain intact.
- Selected group comes from `selectModelGroup(visible, route.model, route.selectedProvider)`, with fallback to the first ranked visible group. Initial/deep-link selection and fallback after search/sort/filter are automatic presentations and should remain static.
- Existing row selector `tr[data-model-pair-key]` already exposes the exact tuple. Row button has `aria-pressed`; retain it and DOM identity/focus.
- `requestKey` covers range/from/to/source/provider/vendor, excluding selected pair. Choosing another pair does not fetch a replacement comparison dataset.
- The selected summary/distribution contain actual already accepted aggregate facts immediately. Trend/effort/context are fetched by existing cancellable `api.modelDetail(data.scope, {model, provider})`.
- `detailKey = JSON.stringify([data?.scope, selected && identityKey(selected)])`. Only `detailSnapshot.key === detailKey` is presented as matching detail. Accepted `data` references also refresh that exact detail; cancelled old requests cannot replace it.
- Existing `.qp-model-detail` is an aside containing four real panel sections. It is not a native modal; adding dialog/focus behavior would invent an action.
- Comparison pages20 retain sidebar selection when selected pair is off the manually chosen page. Paging must not restart selection motion or jump back.
- Provider distribution buttons change filter scope, not exact detail selection. Search, metric sort, provider/vendor/range filters, manual paging, effort pagination, locale/theme, retries, and ordinary SSE do not create a new explicit selection intent.
- Existing History link navigates with actual resolved scope/model/provider constraints; preserve it without synthetic interaction.

### Smallest Models implementation

1. Add explicit user selection intent `{serial, pairKey, context}` in the existing row button handler, only when it selects a genuinely different effective pair. Do not put an intent in general `update()` because filters also call it.
2. Animate only the actual selected visible row immediately:180ms settle and700ms emphasis, preserving its final selected tint and focus.
3. Track one pending detail intent for that exact selected pair and accepted requested scope. Initial/autoselected/deep-linked detail has no intent. A request key alone is insufficient; accepted detail must match the selected `detailKey`.
4. When matching selected detail is actually accepted, animate the existing detail region once. Preferred target: existing real panel sections in `.qp-model-detail` (or one explicitly chosen existing detail box), avoiding a new wrapper or a display:contents observation target. The visual scope must be explicit in the evidence; animating only a heading cannot certify the whole detail.
5. While waiting, keep honest existing pending/error UI. Do not animate the pending placeholder as proof of accepted fetched detail, retain a different pair's chart, or start a new fetch for motion.
6. Consume the pending intent on scope/selected identity replacement, error/cancellation, reduced preference, hidden/offscreen interval, route removal or unmount. Retry or restoration is a static presentation; it must not resurrect a consumed selection event.
7. Duplicate accepted data for the same selection/context must neither start another animation nor cancel an already running700ms emphasis. Effect cleanup must not be tied to each `data`/presentation object identity (the prior Runway90 premature-cancel pitfall).
8. Same selected row clicked again is a no-op for motion. Selection can be made again after selecting another pair; each genuine user identity change may receive one new transition.

A rapid A→B selection keeps at most the latest pending B intent. A late accepted A response must not animate B or resurrect A. If an accepted base snapshot changes the actual detail scope while a request is pending, retire the old exact-scope intent; do not relabel it as a fresh user event. This is a presentation intent, not ingest-time or model-capability telemetry.

### Proposed first implementation files

- NEW `redesign/observed-transition.ts`: neutral finite runner + clipping/viewport visibility, moved without behavior change from History.
- `redesign/history-motion.ts`: preserve exported aliases for existing consumers/tests; keep History record identity/presence logic.
- NEW `redesign/use-selection-motion.ts` plus a small pure intent/acceptance predicate helper if needed: at most one pending selection, real region observers, shared motion preference, native finite handles, deterministic cancellation.
- `redesign/models.tsx`: native row handler intent, existing exact row attributes, refs to actual detail boxes, matching accepted-detail integration.
- NEW focused tests for exact identities, initial/no-op/automatic selection, pending A/B races, accepted scope mismatch, duplicate refresh, failure/restore/unmount consumption. Existing History tests remain a regression gate after neutral extraction.

No API/schema/i18n/dependencies, polling/SSE, fake curves, geometry or broad CSS changes required for this first scope.

## Projects: actual current behavior (follow after Models validation)

File: `redesign/projects.tsx`.

- Project identity is the actual group key, `string | null`. Preserve `JSON.stringify(group.key)` so null and empty string remain distinct. Existing React card and ranking row keys already use that typed representation.
- Both `.qp-project-card` buttons and `.qp-project-top` ranking buttons invoke `update({ project: group.key, offset: 0 })`; both are real local selected-project actions and native keyboard accessible.
- The current selected group is `visible.find(group => group.key === route.project) ?? visible[0]`. Initial/default/search/sort/filter fallback is automatic and remains static.
- Existing `.qp-project-detail-tabs` buttons select actual `overview`, `sessions`, `usage`, `details` detail tabs and reset offset0.
- Existing `.qp-project-detail-link` inside overview selects `details` too. Include this existing action; do not introduce a new control.
- Existing `.qp-project-detail` is a real aside, not a dialog. Preserve it and focus on the activated native button. Top-ranked selection may occur while the card is offscreen; animate only actual visible opener/card and detail, not an offscreen duplicate.
- Request context is range/from/to/source/harness; search/tab/sort additionally change the visible project collection and default selection. Reset baseline when those presentation dependencies replace context.
- `detailScope` uses accepted dataset scope plus exact `project` or `projectMissing`; existing `detailKey` includes detailScope, session offset and accepted `data.now`. Older detail requests cancel; mismatching old snapshots are hidden.
- Overview metrics/money and detailed source/model metadata already derive from accepted groups/rows. Sessions, usage records, trend and observed paths depend on matching `api.projectDetail`.
- Sessions pagination changes offset20 and is a static page replacement, not a new selected project or user record.
- Actual sessions use `sessionKey`; actual recent usage uses `eventId` with recorded timestamp/harness/provider/model. They are not model/project aggregate group identities. Keep their grain/timestamps intact.
- Related History links navigate to exact accepted project/source/harness/range/session constraints. They are navigation, not a new local detail action.

### Subsequent Projects integration

Reuse the validated selection hook with typed project identity and actual selected detail tab. Card/top-row selection gets one immediate visible180/700 response. A changed tab is a new explicit detail identity; repeated active tab is static. For fetched-dependent tab content, await only the matching accepted detail snapshot before the detail transition. Overview/metadata portions that already contain accepted facts need no fabricated loading delay. Keep semantic context separate from `data.now` refresh identity to avoid animation on every accepted refresh; use exact request matching only to authorize an actual pending intent.

Proposed later files: `projects.tsx`, existing reusable hook/helper tests, and a focused Projects test. No Projects code edits are proposed before Models pattern proves correct in browser.

## Focused Models browser scenarios before accepting the first implementation

1. Initial normal/deep-linked pair renders actual current facts with0 effects. Include null-provider and empty-name pairs to prove exact typed identity.
2. Pointer then keyboard selection of a different visible pair: selected row gets exact180/700ms once; accepted matching detail gets the explicitly documented region's180/700ms once. Inspect actual native currentTime and visible intermediate opacity/tint, not only option strings.
3. Hold real selected-detail B API response while selecting B: row responds, fetched detail remains honest pending. Release B: only matching accepted B content animates once; old A content never appears as B.
4. Hold A, choose B, deliver B then late A: no stale facts or late selection animation; B remains selected. Retry/failure consumes intent and does not replay it on later success.
5. During a700ms emphasis, deliver identical real accepted base/detail snapshots and a busy-state rerender; it reaches its full native duration without restart or premature cancellation.
6. Repeated same-row click, sorting/search, provider/vendor/range filtering, comparison/effort paging and locale/theme changes: no false explicit-selection entrance. Full data totals and comparison paging remain intact.
7. Reduced motion keeps static selected state. Toggle reduced during an active effect: immediate cancellation. New selection while reduced stays factual/static; restoring movement does not replay it.
8. Real document hidden or actual region offscreen during an active/pending selection cancels/consumes it. Deliver a held real API response across eligibility loss and restoration: no queued replay; next genuinely new visible user selection works.
9. Route removal/unmount during active and pending work: handles idle, detached targets, released observers/listeners, no late effects. Retain exact pointer/keyboard opener focus during accepted refreshes.
10. Finished/reduced canonical screenshots keep previous factual data/geometry and Thai/light/mobile overflow/keyboard behavior. This scope alone does not prove all table/detail contracts elsewhere.

## Explicit limits

This proposal closes selected-detail behavior first. It does not claim aggregate comparison groups are newly ingested calls, does not add per-model/project fake activity, and does not certify all Projects sessions/usage new-presence transitions before those paths are implemented and tested. Any later observed-presence animations should reuse History's bounded preceding accepted-page semantics, with context replacement seeding and no promise of an infinite lifetime identity ledger.


## Implemented92 scope update (supersedes neutral extraction proposal)

Parent authorized Models first and explicitly deferred a shared neutral extraction. Actual implementation directly imports the existing finite History runner/visibility functions. Added only `model-selection-motion.ts`, `use-model-selection-motion.ts`, their focused test, and integration in `models.tsx`. Parent then identified opaque row gradients/panel backgrounds hiding the background pulse; approved one optional `outline` emphasis mode on `playHistoryTransitions`, with existing History/Live default background mode unchanged. Models uses180ms opacity plus700ms explicit solid2px inset outline (offset-2px, accent-to-transparent, fillnone) on the actual selected row and the actual accepted `.qp-model-detail` aside. Resting paint/geometry remains unchanged.

The new exact row has existing `data-model-pair-key`; the detail aside has `data-model-selection-detail` with the exact typed pair. Only explicit changed row intents can start them. Matching accepted detail authorization is separate from the immediate row response, so held/foreign/pending data cannot start the detail effect. Context/error/hidden/offscreen/reduced cancellation consumes the pending intent. Duplicate/busy rerenders do not have per-observation cleanup that truncates700ms.

Targeted22tests passed (10new Models motion/native-runner tests,3existing pair-selection tests,9History player/presence regressions); final web TypeScript noEmit passed. Root still owns actual compiled browser effect/paint/lifecycle evidence and release claims. Projects remains unimplemented by this agent in92.
