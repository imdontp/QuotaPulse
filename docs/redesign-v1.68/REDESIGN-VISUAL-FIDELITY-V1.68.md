# QuotaPulse dashboard fidelity candidate v1.68

## Changes

- Align the production shell's top row more closely with the Dashboard reference: keep the header at 60px, show the connection state beside the brand, display `All Systems Operational` only while the daemon is live, and group `Workspace` with the truthful `This machine` scope.
- Change the command-palette trigger label to `Search anything...`; keep its existing keyboard-first page search and screen-reader dialog behavior.
- Move Theme ahead of Language and style both controls as the reference's circular icon/avatar pair. Keep the language action visible as `ไทย`/`EN` inside the round mark so the control remains discoverable and Thai glyph coverage stays exercised.
- Hide route-name duplication from the desktop global header; each page keeps its own heading. Keep narrow-view layout responsive.
- Update browser automation selectors to target the actual Theme and Language actions after reordering controls. Extend the shell gate to assert status copy, workspace scope, search label, accessible action names and the 60px header.

The real application continues to read daemon/API data. The reference fixture remains synthetic and in-memory; it does not write concept values to a user database.

## Validation

- Production web build passed; the existing Vite warning for the 532.87 kB `App` chunk remains.
- Web unit tests: **137 passed**.
- Focused Overview production-browser gate: **4 pairs, all byte-identical** across English/Thai and dark/light.
- Full production-browser gate: **40 pairs / 80 screenshots** across Overview, Live, Projects, Providers, Models, Cost, History, selected History detail, Alerts and Settings. **39 pairs are byte-identical**. `alerts-th-light.png` differs by 5 pixels at maximum channel delta 1, within the unchanged delta-2 / 0.0001-pixel-fraction tolerance. No masks were used.
- The gate also verified API-backed tables, keyboard/focus behavior, 390/900/1280px overflow, bilingual fonts and local-only requests. History showed 41 API-matched records with five full rows in the viewport.
- Fixed review clock: 2025-05-17 20:42 Asia/Bangkok. Source hashes are in [reference-hashes.json](reference-hashes.json). Open [the side-by-side/overlay viewer](reference-review.html) to compare the refs and captures; v1.67 is available as the previous version.

The requested **99-100% source-image likeness is not yet achieved**. The header now follows the source hierarchy more closely, but `This machine` remains the accurate local scope instead of the concept's selectable `QuotaPulse (Personal)` workspace. The Overview's four real-data metric labels/values, map glow, and some card details still differ. Several secondary pages also use account/quota data where the reference depicts provider API keys and forecast/action content that this daemon does not supply. Those differences remain visible in the viewer; production fields have not been fabricated to hide them.

## Local review package

- Windows review ZIP: `tmp/review-bundles/QuotaPulse-v1.68-wJdt3v.zip`
- SHA-256: `daa4af30be18b762e8e31079e2a613e3ffd67ea4331957c3dabb253db03b9156`
- Archive verification passed for all **3,135 files**; ZIP size is 201,573,829 bytes. It contains no application profile and requires external Node ABI 127 (Node 22.13.1 built it). Readers/probes are disabled, so a new install starts with empty usage.
- Build and archive manifests are in [bundle-build.json](bundle-build.json) and [archive-verification.json](archive-verification.json). This is an unsigned local review build, not a production installer.

## Next fidelity pass

Continue on the Overview's metric rail and remaining card treatment using fields the daemon already exposes. Measure each source region and map only supported data; present unavailable values honestly when a concept metric has no reliable production source. Keep the shell's workspace scope explicit and exclude pet/popup redesign.