# Independent Runtime inspector93 source review

Verdict: **No concrete source blocker identified; conditional on root's actual compiled native interaction gate.** Label: **Reviewed only**. This reviewer performed no app edits, tests/build/browser or Git operations.

Reviewed: `overview.tsx`, `runtime-inspector-motion.ts`, `use-runtime-inspector-motion.ts`, `runtime-inspector-motion.test.ts`. Traced production's accepted map context/retained graph inputs, actual RuntimeData buttons, native dialog effects, shared finite outline player and original ZIP03 generic180/700ms table/detail contract.

## Source binding (LF SHA256)

- overview.tsx: `ea05159c632d011e4f3ac80c40d27d099037a45baa1b107b48a38e397e4ac396`
- runtime-inspector-motion.ts: `13eb1b24eac0ab0c06330f3e00eb3858872be04a8096b84eb5875bb513d2c2e7`
- use-runtime-inspector-motion.ts: `5bc2a1c76c27ca1d0bd6008a7a3647228d043f67bb9858a8cb4d87f92ab06aaf`
- runtime-inspector-motion.test.ts: `342cf51506e20b4cb229d0f4568fe8f9947537a6d78cf8477eaf4cc399eec1d7`

These fingerprints bind inspection, not a built/versioned runtime. Root must refresh evidence if source changes.

## Current-context detail and pending rendering

`runtimeInspectorContext` combines the semantic production route key (`runwayScopeKey={routeKey}`) with the actual selected Runtime project. The real UI uses null/undefined for All; exact empty project remains a distinct JSON-tagged context. Scope/key strings are not trimmed, case-folded or compared through localized labels. Rolling clocks/graph object references are excluded from selection identity, preventing clock-driven emphasis replay.

Selection stores dimension, exact key, context and explicit serial. `currentRuntimeInspection` rejects an unavailable or foreign-context selection before rendering detail. `inspectionAvailable` rejects initial-region and changed-map-context pending states. Production only passes a scoped Runtime graph when its accepted map context matches; a foreign old Runtime graph cannot authorize a new context's detail. The guarded detail lookup then requires the actual selected dimension/key in the current accepted Runtime nodes. The only zero-valued fallback is the existing explicitly enabled harness metadata fallback (`emptyHarnessNode`), not a fabricated observed call or edge.

The dialog child render is gated by both currentSelection and actual detail. A changed context or absent node removes old facts immediately; a layout effect closes/clears the invalid selection before a painted retained modal can present them as belonging to the replacement context. `inspect` itself also refuses a currently unavailable map.

Same-context background refresh may retain an actual prior accepted graph. Its modal can remain readable with the existing stale-snapshot label; `startable` is false while status/graph readiness is unsettled. A new selection in that state consumes a static intent rather than replaying when ready. A stale/error status disables/cancels effects. This is distinct from foreign-context pending data, which is not rendered as current detail at all.

## Actual actions and opener identity

Visible Runtime map node buttons pass their actual native currentTarget, exact dimension and exact node key. Existing RuntimeData table buttons call the same selection handler; the section's click-capture records the native `.qp-runtime-nodes button` before that handler runs. Native keyboard click activation follows the same capture path. The existing data-table disclosure remains native; no new inspector action was invented.

The opener gains only a nonvisual exact `data-runtime-inspector-key` attribute. Identity is JSON[dimension,key], retaining null, empty, case and dimension distinctions. One selection is stored; no backlog/listener/polling/API request is added.

## Native opening, close and focus

The parent's existing showModal effect remains before the motion hook's selection effect, so the actual native dialog is open before testing its detail target geometry. The hook does not open, close, rekey or focus the dialog. The close button keeps native autoFocus. Native onClose clears selection and restores focus independently from effect completion.

A connected opener with layout rects receives focus with preventScroll; detached or display-hidden openers fall back to the existing Runtime options summary or main. If selection context changed, restoration deliberately does not use an old-context opener. Both fallback target types are existing keyboard-focusable elements. The source test covers connected, detached, hidden and missing targets. Root must still verify real Escape/keyboard behavior and a removed/hidden opener rather than infer native focus from the helper test.

## Finite lifetime, duplicate data and eligibility

`runtimeInspectorDecision` requires a changed exact identity and strictly newer explicit serial in the same context. Initial state, repeated selected identity and ordinary duplicate graph/clock updates produce no new effect or cancellation. Close consumes a null identity; a later explicit reopen can animate as a new action. `startable=false` consumes a new serial without queuing later work; an unchanged already-running selection is not cancelled merely because refresh became pending.

There is no effect cleanup tied to each detail/graph/clock object. Dependency values are stable selection/context/status primitives. This avoids the earlier premature700ms cleanup defect. Context/key replacement, stale/disabled state, native close or unmount cancels; the immediate document/media listener consumes the latest serial and cancels on hidden/reduced loss. Restoring eligibility without a genuinely new selection cannot replay that consumed intent.

Before starting, the hook checks the actual opener against its real Runtime scroll/chart-data clip and actual detail grid against the open dialog. Each active target is observed by the existing finite player, so native offscreen loss cancels its handles; there is no asynchronous accepted-detail queue to resurrect later. Empty/hidden targets cannot be treated as a pending delayed reveal.

The shared runner uses180ms readable opacity plus700ms explicit2px solid inset outline with fillnone. Outline is above existing opaque surfaces and restores final paint without box geometry changes. The actual animated detail target is the real four-metric `.qp-detail-grid`, not the entire modal header/coverage/footer; gate evidence should identify that exact scope.

## Graph/activity boundary

The inspector adapter reads accepted Runtime nodes and records explicit user selections only. It does not write graph nodes, edges, tokens, sessions, activity times or Runtime motion batches, and does not call the event-particle gate. Current `useRuntimeMotion` remains the owner of observed call/aggregate effects in RuntimeMap. No inspector helper introduces a timer/frame loop, extra SSE, request or decorative flow. Inspection refs/attributes and actual user action handlers do not change the observed graph's values or edge/particle paths.

## Inspected tests and root acceptance conditions

The seven focused tests cover typed dimension/key/context identity, render-time current/pending rejection, explicit versus duplicate/no-op serials, pending refresh consumption without truncation, context/disabled/close/reopen and connected/hidden/detached focus fallback. They were inspected, not run by this reviewer; they do not execute React's modal/commit/IO behavior.

Root should prove on the actual compiled index:

1. Visible node and disclosed RuntimeData button each open the actual correct modal through pointer/keyboard; initial/disclosure-only/no-op state has no false entrance.
2. Actual opener and selected metric grid receive exact180/700ms once, with visible native outline interpolation and readable facts.
3. Duplicate accepted graph/clock render while700ms runs reaches full lifetime without restart/cancellation or focus loss.
4. Changed Runtime project/range/source context and pending foreign graph never show old modal facts; removed selected node closes immediately. Same-context retained refreshing facts are explicitly labelled and do not later replay an old static intent.
5. Escape/native close restore exact surviving opener; removed/hidden/foreign-context opener uses the existing summary/main fallback.
6. Reduced/hidden/offscreen/unmount cancel finite native handles, release observers/listeners and do not replay on restoration. Actual graph/edge/activity selectors remain unchanged apart from inspector attributes.

No concrete blocker was found in the inspected source paths. Native timing, visibility and focus remain actual-browser gates rather than conclusions inferred from these pure helpers.
