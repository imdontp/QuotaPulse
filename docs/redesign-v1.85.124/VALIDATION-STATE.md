# Reference action and risk density124

Status: **Partially validated for the full redesign**. The two changes pass their scoped checks. The complete redesign and99–100% visual acceptance remain open.

## Changed

- Projects' real Refresh action now uses the reference primary plate at native widths: x1506/y78,147×42px in the1672px frame. Its measured blue/violet fill, rounded edge and glow replace the small outlined action. Refresh semantics, localized accessible name, disabled state and keyboard operation remain. Native styling starts at1536px; smaller layouts retain their existing action composition.
- Native Alerts risk rows shrink from64.5px to48.796875px, using36px icon frames, a shorter rendering of the same32-unit sparkline vectors and tighter padding. All four actual fixture risks are fully visible, replacing three complete rows and a clipped fourth. The232px list frame is retained, so rules and other page regions do not move. Larger lists keep scrolling.
- Risk navigation now shows the reference-like View plate/chevron. Full owner/reader meaning remains in its accessible name and title; exact owner/window hrefs are unchanged. Narrow layouts retain an inline action with at least28px height. No data is hidden, no fake fifth risk is added and no automatic mitigation is introduced.

## Validation

Final TypeScript/Vite web build passes with the existing legacy chunk warning. Compiled index SHA256: `f07fd15bfef89b60e59dcca679d930f0957c54be64e10333fc63650ab53fcb43`.

- Native Chrome155 without renderer flags:32 cases, two pages × EN/TH × dark/light ×390/1280/1536/1672. All native risk rows fit at1536/1672 in both languages/themes, with child facts contained. Raw API percentages, full navigation labels, minimum target sizes, owner/window keyboard navigation, current-page overflow, action geometry and focus checks pass. No browser/HTTP errors or forbidden requests.
- One actual manual Refresh runs against the owned in-memory fixture's empty-reader scheduler. The POST is held briefly to observe the disabled state, then continues to the real daemon handler. Opacity0.55, unchanged bounds, enabled recovery and one POST are verified. A transaction rollback restores exact source/session/usage/quota facts. No customer database, profile, readers or account probe is used. This is not real collector or physical Electron validation.
- Original Alerts gate passes four byte-identical pairs, retaining risk API/filter/search/sort, forecast, history, thresholds, guidance, empty/stress, complete data and keyboard/narrow assertions. It now also checks complete default native rows and navigation names.
- Original Projects gate passes four pairs: three exact, EN-light differs by8 pixels/max1 within the unchanged tolerance. Existing project discovery/identity, data, selection/search, axes, chart inspection, keyboard and narrow checks remain.
- Native before/after canonical frames immediately repeat exactly. All main-region and heading geometry is unchanged. Risk identities, levels, description/owner/value/age text, hrefs and complete SVG markup are identical. Only their intended rendering density changes. [Analysis](evidence/analysis.json).
- Six sampled primary-fill pixels match the reference within one RGB channel level; two are exact. This validates those sampled fills, not the entire plate's typography, border, glow or whole page.

Pixel accounting is unmasked. Alerts has145905 changed pixels entirely inside the declared risk-list region. Projects has14198 changes;255 pixels/max1 lie at y58–59 above the declared action region. They remain in the analysis and raw images; no cause or harmlessness claim is made. Existing header/raster controls and final visual acceptance remain open.

The first Projects position assertion failed at viewport y72 after an earlier keyboard/resize check. Diagnostics proved scrollY6, so document y was78. The check now restores scroll-to-top before comparing the reference viewport, matching the canonical capture protocol. Product geometry and tolerances were not changed to address that failure; its raw logs are retained.

## Delivery and remaining scope

[Review viewer](review.html) contains current Projects/Alerts, their previous app123 frames and original references. The [previous all-eight viewer](../redesign-v1.85.123/review.html) remains explicitly versioned123; its other six pages are not relabelled as newly captured124 evidence.

No updated desktop ZIP, signed release or installation is produced. ZIP121 still contains app120. Remaining work includes the Live session-table composition/data review recorded in123, final all-eight material/type/art/control acceptance, header/raster controls, current native/settings/error/motion/resource matrix and the full approved20-row requirement audit. This checkpoint does not close any whole requirement row.
