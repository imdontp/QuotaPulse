# Escape focus observation

## Observed failure

Full workflow2267 exited1 at check-history.mts's responsive en/light/900 case.
The native detail dialog was hidden; the immediate row-focus assertion was false.
Earlier five responsive cases passed. Teardown closed all workflow services.

## Targeted evidence

Local synthetic diagnostic on ports7806/7807 (tmp/history-focus-diagnostic.mts)
visited Overview then History at900x1000/en/light and exercised automatic detail
selection followed by Escape. Two logs completed40 and30 cycles respectively;
both report0 immediate misses. The original transient failure is not reproduced
by these70 scoped cycles; do not assert a proven persistent application defect.

The30-cycle event trace records native cancel, dialog open-attribute removal,
native close, React's focus call, and row focusin in that order. The selected-row
button remains connected and identical throughout; final row focus is true.
Thus the hidden-dialog observation is weaker than completion of the async close
callback. An early assertion is a bounded leading explanation of the transient
full-workflow failure, rather than proof of a disconnected focus target.

Agent process handles4273/50968 were unavailable after credit errors. Diagnostic
summary logs and Models success manifest were inspected directly, and ports
7800/7801/7804/7806/7807 had no listeners before starting the workflow rerun.
Missing handles are not reported as exit0.

## Correction and verification

The responsive workflow now waits at most2000ms for the exact expected row-focus
state after dialog hidden. The original Boolean equality assertion remains.
No arbitrary sleep, alternate focus target, assertion removal or application
callback change is introduced. A focus that never returns still fails.

Original full workflow rerun99026 exited0, including the formerly failing
en/light/900 case and all16 responsive combinations/nine destinations.
The final authenticated page workflows, occupied layouts and route compatibility
also pass; teardown closed browser/Vite/daemon/database. Fresh workflow artifacts
are included. [Diagnostic event evidence](focus-diagnostic-evidence.json) records
the70-cycle results and representative event ordering without full HTML traces.
The bounded expected-state correction is validated; the original transient
timing condition remains unreproduced by the smaller diagnostic.
