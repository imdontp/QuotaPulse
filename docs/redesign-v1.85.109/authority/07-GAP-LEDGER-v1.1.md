# 07 - Gap Ledger

Decision status: ACCEPTED / NEEDS_DECISION. Execution: PLANNED / IN_PROGRESS / IMPLEMENTED /
VERIFIED / DEFERRED. ACCEPTED means the revision chose a behavior; VERIFIED requires actual
implementation evidence. No new screen/API is implemented in this package.
P0 = truth/privacy/security or broken compatibility; P1 = required behavior/major composition;
P2 = secondary fidelity; P3 = polish. An accepted replacement is not a hidden test failure.

| ID | Scope | Priority | Decision (see matching override/contract) | Decision | Execution | Phase |
|---|---|---|---|---|---|---|
| GAP-001 | History | P0 | Metadata detail replaces Prompt & Response | ACCEPTED | PLANNED | 7 |
| GAP-002 | Providers | P0 | Refresh/diagnostics replace credential capture | ACCEPTED | PLANNED | 5 |
| GAP-003 | Models | P1 | Coverage and effort distribution replace quality benchmarks | ACCEPTED | PLANNED | 6 |
| GAP-004 | Models | P1 | Calls replace speed; context only with exact provenance | ACCEPTED | PLANNED | 1A,6 |
| GAP-005 | Overview | P0 | Cache savings replace ROI/productivity claims | ACCEPTED | PLANNED | 2 |
| GAP-006 | Cost | P0 | Separate native and computed/estimated monetary bases | ACCEPTED | PLANNED | 1A,6 |
| GAP-007 | Quota | P0 | Provider percentage only; safe pace in percentage points/hour | ACCEPTED | PLANNED | 2,5,8 |
| GAP-008 | Projects | P1 | Discover projects; refresh and usage-share bars; no authoring | ACCEPTED | PLANNED | 4 |
| GAP-009 | Alerts | P0 | Advisory navigation replaces execution controls | ACCEPTED | PLANNED | 8 |
| GAP-010 | All | P1 | Common navigation; original pixels are not a whole-screen gate | ACCEPTED | PLANNED | 1 |
| GAP-011 | Live | P0 | Call-grain recorded minute chart; aggregate coverage separately | ACCEPTED | PLANNED | 1A,3 |
| GAP-012 | Live | P0 | Recency/source states replace unproved lifecycle states | ACCEPTED | PLANNED | 3 |
| GAP-013 | Queries | P1 | Add filters, paging, distinct counts and matching exports | ACCEPTED | PLANNED | 1A,4,7 |
| GAP-014 | Providers | P0 | Reader health, not provider latency or billing truth | ACCEPTED | PLANNED | 5 |
| GAP-015 | Alerts | P1 | Read-only 50/80/95 thresholds; current risks separate from history | ACCEPTED | PLANNED | 8 |
| GAP-016 | Quota | P1 | Add owner/window history read API | ACCEPTED | PLANNED | 1A,8 |
| GAP-017 | Desktop | P0 | Preserve ?mode=popup, settings and route aliases | ACCEPTED | PLANNED | 1,9 |
| GAP-018 | Fixtures | P1 | One consistent dataset; Models concept 721M vs 797M is not copied | ACCEPTED | PLANNED | 1 |
| GAP-019 | Models | P0 | Categorical effort, never fabricated average score | ACCEPTED | PLANNED | 6,7 |
| GAP-020 | All | P1 | Preserve Thai/light/narrow behavior and reduced motion from foundation | ACCEPTED | PLANNED | 1,9 |
| FUT-001 | Product | P1 | Budgets, project authoring/archive/team/workspace management | ACCEPTED | DEFERRED | future |
| FUT-002 | Alerts | P1 | Editable rules, external delivery and automatic mitigation | ACCEPTED | DEFERRED | future |
| FUT-003 | Telemetry | P1 | True running/queued/failed streaming and benchmark integrations | ACCEPTED | DEFERRED | future |

Decision basis: the user accepted the reviewed revision scope and retained original images
with explicit overrides. Visual baseline approval remains a future concrete screenshot gate,
not an assertion that these layouts or proposed read APIs have already passed review/tests.
