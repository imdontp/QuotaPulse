# Screen Contract - Models

Concept: [original image](../refs/models.png), 1672 x 941, DPR 1.
Overrides: OVR-001..003, OVR-015..016, OVR-022..023; see [exact replacements](../11_REFERENCE_OVERRIDES.md).
Sources/field mappings: [API contract](../12_API_AND_FIELD_CONTRACTS.md).

## Composition, meaning and actions

Keep summary cards, comparison table, detail rail/donut/trend and provider distribution.
Comparison distinguishes model+recorded-provider identity; vendor maker remains separate.
Tokens, calls, coverage, cache proportion and categorized effort come from scoped facts.
Replace speed with calls and quality with priced-call coverage. Context capacity is
exact provider/model catalog data with origin/date; observed windows are labelled
separately. Missing context stays unavailable. Performance block becomes categorical
effort distribution; no benchmark or numeric effort score is fabricated.
Row selects detail; provider/vendor/period/metric filters and sort use stable keys and
consistent scope; vendor footer applies vendor filter. Distinct session count is queried
at the displayed grouping level. Do not sum session counts across overlapping model rows.

## Shared acceptance

Use [data semantics](../02_DATA_SEMANTICS.md), [motion](../03_DESIGN_SYSTEM_AND_MOTION.md)
and [tests](../05_TEST_AND_VISUAL_PARITY.md). Preserve scope in drill-down URLs.
Support loading, empty, stale, unavailable, partial/estimated pricing and retry without
unexpected layout shifts. All visible controls have keyboard/focus and error behavior.
No fixture values enter production. Static preview alone is not implementation completion.
Record a measured screenshot baseline only after reviewing concept + overrides together.
