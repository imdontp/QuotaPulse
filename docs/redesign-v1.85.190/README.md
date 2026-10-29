# JSONL ingest retry integrity / source190

A complete JSON line whose record handler throws is no longer mistaken for malformed JSON. The error propagates to the adapter's existing error handling instead of allowing its cursor to advance past the failed record. On a later successful pass, the normal deduplication keys prevent previously inserted usage from being duplicated.

Codex, Claude Code, and quota-event readers explicitly skip non-object JSON envelopes. The quota-event profile scan and window loop also ignore invalid non-object entries, so those inputs do not turn into permanent handler failures. Complete syntactically malformed lines retain the prior behavior: they are counted as parse errors and skipped; trailing incomplete lines remain unconsumed.

The original failure was reproduced with an injected handler error: the reader did not reject and the Codex cursor advanced to byte 1609 despite the failed record. Final regression tests use SQLite triggers to reject inserts during initial and incremental Codex ingest, Claude usage ingest, and a multi-window quota event. They check that the cursor stays at its previous position, the failure is recorded, a subsequent retry inserts the missing data without duplicates, and model and session cost metadata survive. Separate tests cover malformed JSON, trailing partial lines, handler propagation, and non-object envelopes across all three JSONL consumers.

Validation: the daemon TypeScript build and all 139 daemon tests passed, including eight focused JSONL and retry checks. Tests used owned temporary fixtures and synthetic data. No existing user database or harness log was modified.

This does not prove complete historical ingestion: already skipped records are not automatically restored, and complete malformed lines are still skipped. A persistent handler or database failure can stop progress for that file until it is resolved. Current ingestion metadata still cannot certify a complete, fresh month-to-date call-grain series, so the Cost projection remains unavailable under the blueprint's data rules. The review187 ZIP predates this change and the source188/189 visual changes.
