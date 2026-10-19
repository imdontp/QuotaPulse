# Motion89 contract audit — original blueprint and current source

Status: offline source audit and candidate patches only. No production source changes, browser, build or Git operations. Frozen checkpoint88 source/build remains untouched. This is not runtime certification.

## Authority read directly

`docs/quotapulse_build_blueprint_v1.1.zip` member `quotapulse_build_blueprint/03_DESIGN_SYSTEM_AND_MOTION.md` contains the Motion contract table:

| Element | Required trigger/duration | Required stop/fallback |
|---|---|---|
| Minute chart | New snapshot; changed points180ms; stable axes | No whole-history replay; pause freezes snapshot; reduced immediate |
| Runway | Valid new forecast; marker420ms | Reset replaces period; stale freezes with label |
| Tables/detail | New record/selection; transition180ms and one-shot emphasis700ms | Stable identity, no loop, reduced no movement |
| Alerts | Newly derived risk or history record; one entrance180ms | No endless warning flash; reduced static labelled severity |

Same original explicitly requires existing `lib/motion.ts`, `index.css`, primitives and refresh controller, existing easing, visibility/intersection stop, listener cleanup and page-wide SSE. Raster concepts do not prove dynamic behavior.

## Traced implementation and shared layers

- `lib/motion.ts`: DURATION.fast180,slow420,deliberate700; EASE.motion/entrance/exit; useMotionPref handles reduced movement. Important integration units: `dur()` returns milliseconds; Motion React transitions need `/1000`. Existing `reveal()` currently returns raw millisecond duration; do not copy that into a new Motion React call or broaden this audit into an unrelated app-wide change.
- `index.css`: matching --motion-* and --ease-*; global reduced clamp only reduces an animation already attached. `.value-moved` is1100ms with useChangePulse's threshold/cooldown, not the required700ms event emphasis. No target component imports/applies it.
- `lib/use-live.ts`: one RefreshController already owns shared SSE, visibility-aware refresh and accepted snapshots. Do not add subscriptions, ingest triggers or polling to animate.
- `RedesignShell`: renders ordinary div/main/children; no automatic AnimatePresence, motion wrapper or child record/selection observer. Generic `ui/table.tsx` TableRow adds hover `transition-colors` only. `ui/card.tsx` optional interactive variant has hover/press transitions; not data-driven transitions. Native History dialog does not inherit an animated dialog primitive.
- `use-runtime-motion.ts` and `overview.tsx` RuntimeMap: actual per-event700ms once SMIL, demand gate, cancellation and existing region visibility handling. This is a different contract, already implemented; do not duplicate or replace the gate.
- `overview.tsx` Pulse and `overview.css`: 420ms progress transition plus gated visibility/reduced ambient logic exist. Their existence does not animate Runway marker.
- `activity-sparkline.tsx`: native canvas redraw on supplied real points, visibility/intersection/resize/theme/DPR cleanup, no180ms point transition. These existing observers are not an unnoticed minute animation implementation.

## Requirement findings

### Minute chart — explicit motion missing

`redesign/live-token-flow.tsx` renders current polygon/polyline/circle coordinates directly; no motion import/effect/interpolator/SMIL/transition. `live-token-flow.css` includes light filter suppression, no point animation. Three traces preserve missing breakdowns and actual bucket values. `live.tsx` already freezes accepted data while paused and guards in-flight responses; keep this behavior. `history-timeline.tsx` and `ActivitySparkline` are also immediate, not a shared point-motion wrapper. Current code proves data correctness/immediate updates, not180ms new-snapshot motion.

Patch target: `live-token-flow.tsx` plus one bounded reusable animation helper at existing motion boundary, not a new graph/stream engine. Transition only common real `(series,bucket-start)` coordinates whose values changed; first render, changed scope/axes topology, new bucket or missing-to-recorded must snap instead of manufacturing a prior reading. Existing axes labels/grid stay outside animation. If a new maximum changes the numeric axis domain, snap that reframe (no axis tween), then animate only eligible points in a common domain. Decide/verify this fallback explicitly instead of replaying the whole polyline.

### Runway —420ms and stale freeze missing

`overview.tsx:376-416` computes marker from runwayState and directly writes fill width/risk left/marker left. `overview.css:814-855` defines material/position, no transition on those changing properties. No motion parent. On stale, runwayState becomes unavailable and rendering replaces the whole track with a labelled message; it does not retain/freeze the last valid marker. Thus stale text exists but full freeze-with-label requirement is not yet implemented.

Patch target: QuotaRunway retains a last valid **presentation** for exact quota owner/window/reset period only, never publishes it as a fresh forecast. New valid accepted forecast in same period animates420ms; key uses actual reading identity/timestamp/forecast fields, not `now`, because shell/parent clock rerenders otherwise animate constantly. Reset/owner/window changes discard old marker before commit and snap into new period. Stale same-period keeps old position as static explicitly stale presentation with existing stale label; missing/unsupported/no-reset states must not invent projection. Visible accessible forecast text/data attributes remain honest about fresh vs stale.

### Tables/detail — hover exists, record/selection emphasis missing

History `sections/history.tsx:213` stable event_id rows are plain TableRow, selected attribute changes immediately; detail is native dialog with direct children/focus logic. Models table likewise direct tr; Live session/feed and Projects selection/details are ordinary keyed elements. No imports/use of useMotionPref/useChangePulse or generic event animation on these paths. A generic hover transition cannot prove new-record180ms+700ms selection emphasis.

Patch scope must cover blueprint table/detail regions, not silently certify all tables after changing only History. Start existing History event identity/selection as an integration pilot; then Models exact typed tuple, Live actual event/session identities, Projects exact selected key and provider/cost details where applicable. Do not recreate DOM keys, close dialogs or lose focus to restart an animation.

### Alerts — newly derived entrance missing

`alerts.tsx:173` risk li keyed by risk.key, `:216` event li keyed by event.id; both plain elements. Imported ForecastOrbArt is static decorative SVG, QuotaChart is ordinary observed SVG. `alerts.css` defines severity/material, not event entrance. Shared shell/primitives do not inject it.

Patch trigger: first accepted snapshot establishes baseline; newly observed alert event must be newer than accepted baseline cursor and part of an accepted fresh API snapshot, not revealed by showAll/filter. Risk key plus actual severity/threshold derivation fingerprint identifies new derivation, not age/countdown text. Filter/sort/locale/theme/refresh with same facts never replay. Reduced mode retains severity label with no movement.

## Concrete candidate files

- `tmp/motion89-candidate-patches.md`: exact integration hunks and lifecycle contract to implement after checkpoint88; deliberately not auto-applied.
- `tmp/motion89-minute-plan.ts` and `.test.ts`: executable pure candidate selectors for actual changed common buckets and new valid same-period forecast. Not wired app code; passing these is only predicate evidence, not runtime motion proof.

## Required runtime evidence before acceptance

1. Actual API/SSE fixture: initial snapshot no animation; one changed minute point180ms; identical snapshot none; added/missing bucket never synthesizes prior observation; axes and full data table remain factual. Pause while animation active cancels and freezes; resume does not replay hidden snapshots.
2. Same owner/window/reset forecast20→35%420ms only when a newly accepted valid forecast arrives; clock tick none; reset replaces immediately; stale freezes labelled and has zero active animations.
3. Actual inserted record has180ms transition and700ms once emphasis, existing IDs/selection/detail focus retained; keyboard selection same behavior; reorder/filter/page change no false new event. Mutable aggregate content is not a new call.
4. Actual newly detected risk/history event180ms once; unchanged risk, showAll/filter and old history expansion none; static accessible severity in reduced.
5. Document hidden, region offscreen, reduced toggle, pause, route removal and unmount immediately cancel animation handles and release observers/listeners; restoration displays latest truth without queue replay. No setInterval/rAF loop, new SSE or API requests for motion. Browser animation handle durations inspect actual milliseconds, not CSS string presence.
6. Finished/reduced screenshots retain canonical source facts/geometry and original strict raster gates. Native/light/Thai/mobile overflow and keyboard focus unchanged. Current static tests/full40 do not substitute for event lifecycle evidence.

Verdict: four explicit contract rows are incomplete in current implementation; existing shared tokens and Pulse/Runtime machinery reduce implementation work but do not prove these are already attached. Prioritize this work over runtime bar paint candidate. Whole-goal motion acceptance remains open.

## Offline validation provenance

Original ZIP03 member SHA256: `a52795d2b0e200624fae73b8a774fbcf5fd683fed16def4a66be0f2a819e5d89`. Candidate predicate command `node --import tsx --test tmp/motion89-minute-plan.test.ts` passed2/2, including missing/new/removed buckets and same-period/reset/stale/clock-only forecast conditions. These are offline candidate tests only; no app wiring or dynamic browser verification is claimed.
