# Proposed Models capacity66 slice (not applied or executed)

Prepared against the current actual source while root65 build/capture gates are frozen. Only this note and the proposed patch were written; authoritative source, tests, dist and Git were untouched.

## Proposed six files

- packages/daemon/src/api/model-detail.ts
- packages/daemon/test/model-catalog-context.test.ts (new)
- packages/web/src/api.ts
- packages/web/src/redesign/models.tsx
- packages/web/src/i18n/en.ts
- packages/web/src/i18n/th.ts

## Contract and semantics

Blueprint v1.1 screens/models.md and12 require exact provider/model catalog capacity, origin/date, separately labelled observed context. price primary key(provider,model) already provides one exact row; no schema/loader change needed. Query it inside the existing detail transaction with parameters and no lowercasing, trimming, alias, suffix removal, price-provider inference or vendor fallback. Native monetary basis does not preclude known catalog metadata. Missing or empty recorded model/provider never picks a catalog row, even if a malformed empty-key price row exists.

catalogContext is an additive server field, null when absent or nonpositive/fractional/unsafe capacity. Client type is optional and display falls back to Unknown for old daemons without the field. Valid capacity with missing provenance shows Unknown provenance rather than invented metadata. loadedAt means local catalog load/update time, not publication date. It is checked as a nonnegative safe integer within Date range. Existing observedContext is unchanged. Only window/origin/loadedAt leave the daemon; no catalog path/raw JSON. The current loader writes a fixed models.dev origin. Do not use PriceResolver (it performs forbidden fuzzy/cross-provider pricing fallback). Origin strings are rendered through React text.

The UI adds provenance only when capacity is known, as a small line below capacity. It uses localized full date/time to retain year and time. Missing capacity keeps the current single Unknown slot. Check native rail sizing before accepting the additional line.

Effort identity uses JSON.stringify(row.effort); NULL maps to existing Unspecified, empty string to new localized Empty category. Literal null, case and spaces remain unmodified. There is no new effort filter/pagination or numeric effort score.

## Proposed executable API coverage

New daemon test uses in-memory DB with disabled-reader Scheduler, Fastify injection only. Covers two providers/same model; native facts; observed-vs-catalog distinct values; six exact effort categories; null/empty model/provider singly and together; alias/suffix/prefix/case/space near-matches rejected; null/zero/negative/fractional/unsafe/text capacity; positive integer1 accepted; missing provenance; metadata shape/private-path exclusion;401; conflicting identity400; legacy models defaults preserved.

No tests have been run by this agent. Apply only after root65 gates are authoritatively terminal, then review the diff.

## Root validation commands

- node --import tsx --test packages/daemon/test/model-catalog-context.test.ts packages/daemon/test/detailed-aggregates.test.ts
- npm run build -w @quotapulse/daemon
- npm run build -w @quotapulse/web
- npm run test -w @quotapulse/web
- QUOTAPULSE_CAPTURE_SCOPE=models; npm run test:stable (set/reset via PowerShell env)
- npm run test:ui; npm test at the next integration checkpoint

## Required real UI checks for this slice

Extend an isolated Models browser probe after build: seed exact same-model/two-route capacities128000/64000, observed10000, six effort categories NULL/empty/literal-null/space/case. Select each row and assert its exact capacity, models.dev provenance and loaded time, observed10000 retained, six distinct effort DOM entries and localized labels in en/th. Capture1672 dark plus narrow390/900/1280 and light. Intercept actual model-detail response once to omit catalogContext entirely; assert Unknown without errors (prior-daemon compatibility). Also serve explicit null capacity and switch quickly across selected providers to verify stale detail response cannot leak capacity. Existing cancellation/detailKey logic should remain untouched. Verify rail contains the provenance line and no horizontal overflow or hidden key facts. Do not compare arbitrary production values to reference numbers or add fixture mode.

## Risks / follow-up

- The local load timestamp is not historical catalog publication/effective date; this is explicit in API comment/label.
- loader conflict-upsert currently does not update origin; normal loader sets fixed models.dev, but a manually inserted different origin can persist. This slice exposes existing metadata honestly rather than changing ingestion.
- loader only inserts catalog entries with a cost object; capacity-only catalog entries are not currently in price. This bounded proposal uses existing stored facts and does not add a separate catalog subsystem.
- Exact-only semantics intentionally keep openai-codex unavailable even if openai has a row. Do not silently broaden matching for convenience.
- Native layout/provenance line and client old-response behavior require browser proof; proposed API green results cannot prove them.
- Patch is a proposal, not validation or99-100% reference acceptance.
