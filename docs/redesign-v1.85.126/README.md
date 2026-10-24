# Live session composition v1.85.126

Validated for this change; overall redesign incomplete. Parent: dd8820bef7dc7c72e89fb44b65829f335ead4053. Compiled web index SHA256: `f4bb27f20a4451d2a70b016af0f773fe6b8516efe69688839170b027f6cd88b3`.

## Change

The real Live table now has nine columns: session, project, harness, provider, model, recorded input/output tokens, recorded total, source last-seen time and recorded calls. This replaces the previous five-column metadata table with the reference's richer horizontal composition. Provider/model icons use recorded identities; multi-identity sessions display distinct counts instead of claiming one provider/model. Missing identities remain unknown; partial known/unknown data is marked with + ? and exact unknown record counts. No lifecycle, runtime or session sparkline was fabricated. GAP-011/012 substitutions remain authoritative.

The daemon derives all added fields from the same usageWhere scope as totals/paging, with bounded per-session output. Input includes fresh + cached + cache-write tokens under the canonical database convention; output remains separate, and recorded total is retained independently. Compact visible token quantities have exact accessible/title values; the existing keyboard session dialog now includes full input/output, total, calls and identity facts. Source metadata remains available and the session action retains its original identity.

## Visual evidence

[Open comparison](review.html). The original ref is hash-checked. Before/final use the same isolated synthetic fixture and 1672 × 941 native Chrome viewport. All ten returned rows are 30px high; eight complete rows fit the original 270px table region at 1672px. The table fits horizontally at both 1536 and 1672; narrow screens retain a keyboard-scrollable table.

65879 pixels changed, all within the table region [249,271,1018,270]; zero outside it. Main region geometry is unchanged and both before/final repeat captures are byte-identical. This bounded comparison is not a whole-screen concept similarity score. Actual data, counts and accepted substitutions differ from the concept.

## Validation

- Web and daemon builds passed. Current daemon 123/123 and web 335/335 tests passed (458 total; no failures/skips/cancellations). Tray tests were not rerun for this web/query change.
- Added API regression covers mixed and fully unknown identities, partial known/unknown metadata, filtered scopes, excluded timestamps, cached/cache-write input, pagination and empty results. Existing HTTP scope/auth validations remain.
- Sixteen final native Chrome cases: EN/TH × dark/light × 390/1280/1536/1672; every returned row matches real API identity counts and full token/call values, no page overflow, source-width table fit, eight complete rows, keyboard horizontal scroll, session detail and focus restoration. These are browser checks, not new Electron production-main evidence.
- Existing Live gate: four repeat pairs, all byte-identical; unchanged tolerances and no masks. Includes recorded feed/chart/matrix facts, paging, filters, scrolling, pause/resume, stale requests, failure recovery and narrow layouts.

## Diagnoses retained

The first candidate required 960px where the 1536 viewport provided 926px, and large exact numbers wrapped. The table now has a 900px minimum with compact display and exact detail. Initial screenshot is omitted; its failing native log is retained. The first established gate also caught source text being included in the session action identity. Source text was returned to a sibling element, preserving the existing action identity; the assertion was retained. No screenshot tolerance was changed.

## Limits and next work

This checkpoint does not update the ZIP: [review125](../redesign-v1.85.125/README.md) remains product source124. New Electron/full customer-data, quota-reader, physical desktop/performance and current installation/rollback acceptance remain open. The [v1.1 ledger](../redesign-v1.85.109/authority/07-GAP-LEDGER-v1.1.md), full blueprint trace and all-eight visual scope remain in force. Remaining material/type/art/control work, other page states and human 99–100% acceptance are incomplete. No new pet redesign or fake concept data.
