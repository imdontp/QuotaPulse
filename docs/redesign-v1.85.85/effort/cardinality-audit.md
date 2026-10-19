# Effort cardinality evidence audit — checkpoint 85

## Verdict

The concern is **reachable and measured with synthetic supported ingestion**. It is a hardening gap, not evidence that current user data is pathological, that the app crashes, or that a numerical performance target is missed. No implementation changes made.

## Actual requirement

Approved v1.1 archive `11_REFERENCE_OVERRIDES.md` OVR-016 and OVR-019 require categorical effort distributions. `05_TEST_AND_VISUAL_PARITY.md:47–51` requires query plans, large fixture histories, measured CPU/render work, and identifying actual indexing/virtualization needs. It does **not** prescribe a numerical category cap or mandatory virtual-list library. Prior audit N14/G83-EFFORT are derived concerns, not original blueprint requirements.

## Causal path

- `adapters/claude-code.ts:248`: `effort: r.effort ?? null`, no enum normalization.
- `adapters/codex.ts:174,181,232`: arbitrary truthy turn_context effort / thread_settings reasoning_effort forwarded; initial cursor seed uses asText. Codex path source traced, not experimentally exercised.
- `ingest/sink.ts:315`: preserves effort strings. `db/schema.ts:79`: unconstrained nullable TEXT.
- `api/history-summary.ts:22–24` and `model-detail.ts:17–19`: GROUP BY effort, `.all`, no category limit. HTTP handlers return these results without category clipping.
- `history-timeline.tsx:46`: maps every category to an li. `history.css:45` **does** cap visible list height at 70px with scrolling; this is not a bound on element creation.
- `models.tsx:181`: maps every category to li/span/strong/span/span, five elements per category; no effort-specific max-height in models.css.

## Reproduction

Run `node --import tsx tmp/effort85-audit.mts` (requires normal esbuild child execution; first sandbox attempt failed EPERM before running).

Real Claude adapter reads generated metadata-only JSONL into real DbSink and fresh in-memory SQLite schema, then executes actual API functions. Only tmp fixture files written; no user DB, network, browser, build or Git mutations.

| Category count | History rows / bytes | Model detail rows / bytes | History query ms | Model detail query ms |
|---|---:|---:|---:|---:|
| 6 | 6 / 765 | 6 / 565 | 1.502 | 1.146 |
| 100 | 100 / 5,953 | 100 / 6,868 | 1.027 | 0.795 |
| 20,000 | 20,000 / 1,100,475 | 20,000 / 1,340,174 | 48.715 | 49.212 |

These are single local timing observations, not accepted budgets. Payload numbers cover actual function JSON results, excluding HTTP wrapper. Fixtures hold 3 tokens/1 call per category, including distinct NULL, empty string and custom effort names. All categories and exact totals retained; both time series remain one point. At 20k categories the UI source creates 20k History li and 100k Models effort elements; this is source-derived counting, **not observed browser DOM/CPU**.

EXPLAIN shows `idx_usage_source_ts` used, followed by temporary B-trees for GROUP BY and ORDER BY. The mechanism is category enumeration and transport, not missing source/time filtering or accidental per-event JS scanning. Arbitrary category richness is synthetic; supported input formats admit it, but current real upstream enums/prevalence were not assumed or investigated online.

## Minimal truthful correction

1. Bound actual rendered effort rows with reusable accessible pagination or virtualization. Preserve the complete underlying response and full-scope totals/shares. All categories remain reachable; NULL and empty labels remain distinct; ordinary small distributions retain their current concept layout.
2. If bounding payloads is required, introduce additive opt-in category pages plus full-scope category count/totals, stable exact-key ordering and validated limits. Do not silently truncate old endpoints, merge categories to Other, guess a fixed enum, normalize stored facts, or calculate shares using only the visible page. SQL LIMIT does not eliminate aggregate scan work.
3. Check `detailed-aggregates.ts` model grouping by effort and Models parent aggregation separately: detail-list paging alone does not bound every model-category response.
4. Verify actual browser DOM/CPU, page switching/keyboard, small-category screenshot parity, refresh/range scope, null/empty/custom identities, last page and total/export consistency. No broad performance readiness claim follows from this probe.

Machine-readable results, exact normalized source hashes, limitations, and requirement provenance: `tmp/effort85-audit.json`. Raw probe observations: `tmp/effort85-probe-results.json`.
