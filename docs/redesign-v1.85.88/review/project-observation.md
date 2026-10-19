# Selected-project Runtime observation89

## Verified behavior

Actual synthetic in-memory daemon API handlers, shared request/scope helpers and actual RuntimeMotionGate were used. Exact-source hashes and all request/response rows are in the JSON. No browser or app source changes.

| Scenario before one accepted refresh | Production observed project | Selected A graph records | Selected A signals | Exact-A API row + same gate |
|---|---|---:|---:|---:|
| A-only | A | 2 | 1 | 1 |
| A-then-newer-B | B | 2 | 0 | 1 |
| B-then-newer-A | A | 2 | 1 | 1 |
| two-new-A-coalesced | A | 3 | 1 | 1 |

Baseline includes known A and B calls through the same codex/openai/gpt-a edge. Initial frame seeds without replay. Every case uses identical visibility, intersection, reduced=false, eligibility epoch/since, graph-ready serial/context and logical now. Accepted rows are observed first with graph unavailable and then with matching ready A graph; repeated serial emits nothing.

## Interpretation

Current globally newest-per-harness observation collection can omit the newest selected-project call when another project has a newer same-harness call before an accepted refresh. Gate correctly rejects the foreign row and emits no selected-project signal; exact-project read returns the eligible A call and the same gate emits one signal.

This is a concrete scoped-observation mismatch worth fixing if map activity is intended to observe its selected project. It is not evidence that the gate should animate a foreign B call or that every ingested call needs presentation. The selected A graph includes the new A facts, yet observation sampling used for its motion was global. A bounded exact-project newest-per-harness read can retain the existing coalescing/no-replay contract while matching the visible graph scope. Keep global recent-activity rail sampling independent. Project switches must seed their observation baseline rather than replay prior project history. Exact empty string project must remain distinct from All.

## Limits

- Authority says new observed call on a known edge, not every ingested record. This demonstrates a scoped observation omission, not proof that every record must animate.
- No production React lifecycle, visual paint, SSE transport, timer expiry or native behavior was executed. Actual handlers, request encoders, scope helpers, eligibility class and gate were used.
- Production collection logic in this script is copied from inspected production.tsx because it is embedded in a React component, not exported. Source hashes bind the inspected implementation; no app module was changed.
- One newest row per harness intentionally coalesces multiple same-project calls; two-new-A case confirms one observed signal for the latest row, not a per-ingested-record queue.
