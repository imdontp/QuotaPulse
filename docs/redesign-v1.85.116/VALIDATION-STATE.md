# Overview quota composition v1.85.116

Status: partially validated for the full redesign. This checkpoint adjusts the native Overview quota rail toward the original reference; it does not establish 99–100% visual acceptance.

## Changed

At viewport widths of at least 1536px, the quota label column is 90px and the reset column is 68px. The remaining width belongs to the usage bar. At the reference viewport, its start moves from x1332.781 to x1336.094 and its width increases from 132.609 to 142.906px. This follows the reference's approximate x1336–1479 bar extent. Reset values have a distinct vertical divider and larger text; window labels increase from 11 to 12px, while percentages reduce from 15 to 14px.

The compact layout remains below this breakpoint. All real percentages, unknown/stale states, risk labels, accessibility text, reset timestamps and selection handlers are retained. No quota capacity or consumption amount is inferred from a percentage. The reference's absolute quota counts remain unavailable unless provided by the underlying source.

## Validation

- Fresh web TypeScript/Vite build passes; the existing large legacy App chunk warning remains.
- Before/after captures use the same isolated synthetic database through the actual API and compiled UI. All five rows retain identical owner/window/text/accessibility/selection/staleness/fill facts and row bounds. Shell, main regions and heading geometry are equal.
- Exactly 12,746 pixels change, all within the quota rows. The immediate repeat is byte-identical. No tolerance or mask was added.
- Existing Overview EN/TH × dark/light gate passes all four pairs with its original tolerances: one pair is byte-identical; the other three remain within the recorded unmasked raster tolerance. Checks include quota ownership/grouping, selection, history access, keyboard operation and 390/900/1280 overflow. Detailed results are in [the gate report](evidence/overview-stable.json).

Compare the [original concept, previous product and current capture](review.html). The real-version four-stage upgrade/rollback and 655-test result belong to [checkpoint 115](../redesign-v1.85.115/VALIDATION-STATE.md), whose product source is 114; they are not claimed as freshly executed against 116. No updated desktop ZIP is produced by this CSS checkpoint.

## Remaining

The broader [20-row trace](../redesign-v1.85.109/REQUIREMENT-TRACE.md), all-eight visual acceptance, current full native UI/settings/error/motion/resource coverage and historical raster/Thai-dark Models ring failures remain open. API-backed real data can differ from concept numbers and recorded activity; this comparison does not claim whole-page pixel equality.
