# 07 - Gap Ledger

Use this file as the controlled backlog for differences between concept and production.

## Status values

- OPEN
- IN_PROGRESS
- BLOCKED_DATA
- BLOCKED_POLICY
- ACCEPTED_EXCEPTION
- CLOSED

## Severity

- P0: breaks data truth, privacy, security, or primary layout
- P1: major visual/interaction mismatch
- P2: noticeable visual mismatch
- P3: polish/micro-detail

## Ledger

| ID | Screen | Severity | Type | Reference expectation | Current behavior | Reason | Decision/fix | Status |
|---|---|---:|---|---|---|---|---|---|
| GAP-001 | History | P0 | privacy | Prompt & Response panel in concept | Product is metadata-only | Concept conflicts with privacy contract | Keep same panel geometry; show event metadata instead | BLOCKED_POLICY |
| GAP-002 | Providers | P0 | security | Connect Provider/API key action | Web UI must not store credentials | Existing architecture auto-detects and helper readers sanitize quota | Replace semantics with Detect/Manage/Diagnostics while preserving visual placement | BLOCKED_POLICY |
| GAP-003 | Models | P1 | data | Quality Score and task benchmark bars | No trusted canonical benchmark source | Would be fabricated | Hide/replace until benchmark source/version contract exists | BLOCKED_DATA |
| GAP-004 | Models | P1 | data | Context size and avg speed | Not canonical across current data | Source semantics incomplete | Add only after instrumentation contract | BLOCKED_DATA |
| GAP-005 | Overview | P1 | data | Productive hours / ROI | No value model | Cannot infer business value from tokens | Replace with cache savings/API value or define explicit user value model | BLOCKED_DATA |
| GAP-006 | Cost | P0 | semantics | Spend terminology | Subscription metrics are often API-equivalent value | Misleading label | Use API-equivalent value; show native spend separately when trustworthy | OPEN |
| GAP-007 | Overview/Providers | P0 | semantics | Token numerator/denominator shown as quota | Provider often exposes only percent + reset | Cannot infer token cap | Use provider percentage or user-defined budget; never fake cap | OPEN |
| GAP-008 | Projects | P1 | product | New Project button | Projects currently discovered from usage metadata | Creation semantics undefined | Disable until user-defined project model exists | BLOCKED_DATA |
| GAP-009 | Alerts | P0 | control | Auto mitigation / provider switching | No safe control plane | Would act outside monitor role | Advisory only until explicit integration + approval workflow | BLOCKED_POLICY |

Add rows during each phase. Never silently resolve a conflict by changing the design or data meaning.
