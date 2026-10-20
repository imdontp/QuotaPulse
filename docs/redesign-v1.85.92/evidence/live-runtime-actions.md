# Generic motion92 — actual Live / Runtime / Providers / Cost actions

Read-only source assessment recorded2026-10-20. Checkpoint91 is reported by the coordinator as pushed and remotely verified at `62d14c132def282fe1bc1636e5dd6c3deb7775cd`; this report does not independently repeat that Git verification. No application source changes, browser execution, build or Git mutation were performed for this assessment.

## Authority and proposed next scope

Original blueprint `03_DESIGN_SYSTEM_AND_MOTION.md` defines Tables/detail: new record/selection,180ms transition and700ms one-shot emphasis; stable identity, no loop, reduced motion without movement. This is a presentation contract for supported real actions, not authorization to invent telemetry or new product actions.

The next bounded implementation should cover **Live's observed session rows, recorded usage feed, and existing session detail dialog**. Overview Runtime inspection and Providers selection are supported follow-on surfaces. Cost has no existing local selected/detail modal and does not need a new one to satisfy the motion contract.

## Actual source and typed identities

### Live

Sources: `packages/web/src/redesign/live.tsx`, `live.css`; `packages/web/src/api.ts` (`LiveSessionsResponse`); `packages/web/src/lib/usage-events.ts` (`UsageEventRow`, `UsageEventScope`).

- `Snapshot` holds `key:string`, `route:LiveRoute`, `overview`, `scope:UsageEventScope`, `trend`, `feed:UsageEventsResponse`, `matrix`, and `sessions:LiveSessionsResponse`.
- Session rows carry `sessionKey:number`, `nativeSessionId:string`, `project:string|null`, `cwd:string|null`, `gitBranch:string|null`, `lastSeenAt:number|null`, `harness:string`, `sourceName:string`, `records:number`, `calls:number`, `tokens:number`, `lastObservedAt:number`.
- **Session row identity is `sessionKey`**, the actual internal database session key. Do not use localized name, row index, nativeSessionId alone, tokens or timestamps as the row identity. The response does not expose a source_id field for each session; do not fabricate one.
- **Usage feed identity can reuse History's exact tuple** `[event_id:number, source_id:number, session_key:number|null, timestamp_ms:number]`. `UsageEventRow.grain` remains factual `call | session_aggregate | unknown`; a new displayed aggregate is not an invented call/stream event.
- Existing feed is read-only text/amount rows with an Open History link and8-row pagination. There is no feed-specific local detail action.
- Sessions have10-row pagination. Clicking a native-session-id button captures `event.currentTarget` in `returnFocus`, stores the actual session row in `selectedSession`, and opens the native `<dialog>` through existing `showModal()` effect.
- Native dialog contains the selected observed row's session id, project, source/observation times, token total and cwd, plus the existing scoped History link. No latency, queue state, completion/failure telemetry or provider capability should be added.

**Context and acceptance:** `dataKey=JSON.stringify(route)` currently binds search `q`, provider, model, sessions mode and session/feed offsets. Request key+epoch+mounted+paused checks reject stale responses. Scope is the accepted overview's last30minutes with exact nonempty selected provider/model/search filters. The shared controller owns refresh/SSE; motion must consume accepted snapshots only.

An independent feed context may be `[q, provider, model, feedOffset]`, and session context `[q, provider, model, sessions, sessionOffset]`; using the existing complete accepted route key is the smallest conservative option and seeds both regions on any route change. Do not put rolling from/to wall-clock bounds in the stable context for every ordinary refresh.

`display = paused ? snapshot : current ?? (error ? snapshot : null)` and `frozen = paused || retained data from another current key` already distinguish paused/retained display. Motion must obey that display contract, never describe retained rows as fresh current-scope observations. Resume must seed rather than replay a paused backlog. An ordinary accepted page presence means newly presented data, not proof of recent ingestion.

**Focus:** preserve native showModal/inert behavior, close-button autofocus, Escape, and `onClose` restoration of the exact captured opener. If an accepted refresh removes that opener, guard `isConnected` and return focus to an appropriate existing session/table/main fallback rather than attempt to focus a detached node. Opening/closing effects must not be driven by motion completion. Current selectedSession is an observed snapshot captured on click; changing automatic detail-refresh semantics is outside this bounded motion task.

### Overview Runtime inspector

Sources: `packages/web/src/redesign/overview.tsx` (`RuntimeMap`, `Overview`), `runtime-data.tsx`, `production.tsx` scoped graph/motion integration.

- Node buttons and the existing RuntimeData inspector call `onInspect(dimension:Dimension,key:string|null)`.
- Supported dimensions are project, harness, provider and model. Exact null, empty string and case-sensitive values must remain distinct; displayed unknown/empty labels are not identities.
- `Overview.selection` is `{dimension:Dimension,key:string|null}|null`. Detail looks up the selected identity in the accepted runtimeNodes; it shows factual tokens/sessions/call-record/aggregate counts and the existing scoped links.
- Suggested complete motion context is `[accepted route scope, selected Runtime project, dimension, exact key]`. Selected Runtime project UI null means All; exact empty project remains distinct. Use the existing scoped graph context/readiness, not global fallback data.
- Existing native `<dialog>` uses `showModal()`, close-button autofocus and browser Escape; onClose clears selection. Initial pending page closes the dialog and clears selection. There is not yet an explicit user selection serial or saved opener for this inspector; adding one must preserve native behavior for both node and RuntimeData openers.
- Existing700ms Runtime observed-call particles/node highlights are separate from generic explicit selection emphasis. Do not replay particles or turn aggregate updates into edges when a modal opens.
- Pending or failed new graph context must not animate global/foreign topology. Same-context retained scoped data remains visibly labelled; an unrelated refresh cannot retrigger a selected-detail entrance.

### Providers

Source: `packages/web/src/redesign/providers.tsx`, `providers.css`.

- `OwnerCard.key:string` is a subscription's `subscription_key`, or `source:<source_id>` for a source without account metadata. Selection falls back to the first actual card when no route owner/source matches.
- Existing card heading buttons and comparison-chart buttons call `update({owner:card.key})`. That updates the route and opens the inspector (`inspectorOpen=true`).
- Inspector is native controlled `<details open={inspectorOpen}>` with a normal summary and `onToggle`; not a modal. It contains observed windows, source origins/times/reset values, superseded-reader disclosures and existing Manage/Diagnostics links.
- Suggested identity/context is `[selected card.key, selected window if relevant]`; an explicit selection serial distinguishes an actual user action from rerendered/retained owner data. Initial first-card fallback and deep-link loading should be static baselines.
- Native `<details>` toggle/focus and keyboard activation remain intact. Animate the actual newly selected card/visible inspector content once; do not add a modal, fake connection actions, or animate every overview refresh.

### Cost

Source: `packages/web/src/redesign/cost.tsx`, `cost.css`.

- Actual controls change scope/range, custom from/to, sourceId, basis (`api | native`) and bucket. Accepted data is bound to key+epoch; stale request results are rejected and errors are visibly scoped.
- Cost model rows have exact `[model:string|null,provider:string|null]` identities. Existing model History links are emitted only under the current supported nonempty model/provider condition.
- Project row identity is exact null versus string (`null` / `str:<project>` in current keys); History links use `project_missing=1` for null and exact project string otherwise, including an empty string.
- Session rows use `sessionKey:number` and link to History with `session_id`.
- Current chart-data disclosure is native `<details>`. Other actions are existing navigation links, refresh and controls.
- **There is no Cost local selected-row/detail modal. Do not invent one.** Any later table-presence motion should consume already accepted costAnalysis data and preserve pricing coverage, unknown/null values, basis distinctions and exact links. Scope/basis switches seed new baselines, not animate an unrelated old dataset.

## Reusable finite patterns

- Shared vocabulary already exists in `lib/motion.ts`: DURATION.fast180ms, DURATION.deliberate700ms, EASE.motion/entrance. Native Web Animations use milliseconds directly. No new duration scale, dependency, SSE listener, interval, polling mechanism or animation loop is required.
- `history-motion.ts` provides a generic DOM-target player despite its History-specific name: `playHistoryTransitions(targets,reduced)` applies180ms readable opacity settle and700ms finite background emphasis, iterations1/fill none, then cancels/cleans effects. It observes target intersection and exposes cancellation. `historyElementVisible` supports viewport plus an explicit clip container.
- `use-history-motion.ts` demonstrates accepted snapshot identity vs retained reference, preceding accepted-page comparison, context seeding, explicit selectionSerial, hidden/reduced cancellation, static restoration, and preserving the parent's native dialog opening/focus effect.
- Alerts91 uses a different newly-derived-risk entrance contract (180ms only) with request-start eligibility epochs. That ledger is not a substitute for Live record-presence/selection semantics, but its epoch provenance and cancellation ownership are useful patterns.
- Smallest reuse: a Live-local adapter can call the existing generic DOM player without changing shared History behavior. A separately reviewed naming/extraction refactor is optional; it must preserve History91 actual native timeline/focus/lifecycle checks. Do not build another animation engine merely to avoid the existing helper's name.
- Motion lifetime must follow its own accepted presence/selection, not every parent snapshot-object change. A duplicate response or unrelated chart/clock render must not truncate180/700ms effects or restart them indefinitely.

## Bounded Live implementation proposal

1. Own `live.tsx`, scoped `live.css`, one Live-specific adapter/helper/hook and focused tests. Reuse shared constants and the existing finite player; no API/schema/model telemetry changes.
2. Track accepted displayed session/feed identities under a stable canonical context. Initial/context/page/filter/pause-resume catch-up snapshots seed. Ordinary same-context new presences may enter once; duplicate/reordered/retained snapshots do not restart effects.
3. Track explicit user session selection through a serial independent of refresh. Animate the actual opener row and visible existing dialog detail content, leaving native focus/close handling in charge.
4. Gate on visible document, actual section/row intersection and clipping, not just DOM existence. Consume offscreen/hidden batches without queueing; reject or conservatively seed held requests crossing eligibility loss. Reduced motion keeps immediately readable data/static selection, without movement or delayed presentation.
5. Cancel native effects on hidden/reduced/offscreen/pause/context loss, removal and unmount. Cancellation restores truthful base styles, retains no replay backlog and removes bookkeeping. Late completion from an older effect must not cancel a newer effect on the same node.

## Focused actual native acceptance scenarios

- **Initial:** real synthetic daemon API renders sessions/feed; no initial180/700 entrance and automatic facts remain readable.
- **New observed presence:** add one real session or usage event through the fixture/real API. Assert exact row key, untouched facts and native180/700 timing/one iteration/fill none, including intermediate visual values and full lifetime.
- **Duplicate during effect:** hold and release a real identical response during an explicit selection/presence. Existing effects finish their intended lifetime; no restart or truncation from unrelated data-object replacement.
- **Exact identities:** duplicate nativeSessionId across different sessionKeys; feed source/session/timestamp identities; null/empty model/provider/project remain distinct. No localized labels or row indices act as keys.
- **Scope/page:** search/provider/model/session-mode/pagination changes seed context. A delayed previous-context response cannot replace current displayed facts or release old motion.
- **Pause/resume/error retention:** pause freezes accepted facts and cancels motion; updates while paused do not replay on resume. Failed new scope retains only correctly labelled existing data per current app contract, with no new entrance or false current-scope implication.
- **Selection/focus:** keyboard opens existing native dialog; close button receives focus; Escape closes; exact opener regains focus when connected. If actual refresh removes opener, a deliberate existing fallback receives focus. No motion callback steals focus or navigates.
- **Clipping/lifecycle:** actual scroll out of the table's clipping area, document hide when available, reduced preference and route unmount cancel active effects. Restore has no queued replay; a genuinely fresh later accepted presence can animate once.
- **Held eligibility:** hold a real response, cause actual IO loss/return, then release. No hidden backlog is promoted; later fresh request remains functional.
- **Static state:** reduced motion retains severity/record-grain labels, selection and exact values immediately; no fake counters/curves/statuses are introduced.

These are proposed verification requirements, not executed evidence for phase92. Full eight-screen concept fidelity and release acceptance remain broader than this bounded motion proposal.
