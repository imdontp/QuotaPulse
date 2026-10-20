# Checkpoint v1.85.94 — History selected-record rail

**Validated bounded change; the full redesign goal remains active.** Parent: `4766c45b15cc66c42f12d546b6c44970cd4bf817`, isolated `design/redesign-foundation` worktree and existing origin. No main checkout or user database changes.

## Requirement and implementation

The original `screens/history.md:9-15` and `refs/history.png` specify a selected detail rail beside the History table. The inherited redesign opened a native modal automatically, making the table inert despite its transparent backdrop. Earlier gallery captures closed it with Escape, omitting the original selected-detail composition. That inherited behavior was not an approved replacement for the original requirement.

Redesign now renders a named semantic aside. At desktop it occupies the existing right 288px rail with a 296px reservation; below1280 it flows after the table. Initial selection uses the first accepted real record without focus, scroll or animation. Background filters and pagination remain operable. Explicit selection reveals an offscreen narrow rail; Close and Escape inside the rail restore a visible connected opener, table or actual page fallback. Related-session navigation retains the selected record's scope. The legacy route retains its native modal. Existing allowlisted metadata, accepted identity, query guards, pricing/grain and full-range export remain intact.

Changed-row and selected-detail emphasis uses the existing finite180/700ms outline player so the actual selected gradient cannot hide it. No new endpoint, dependency, fake telemetry or prompt/raw-event content was added.

## Evidence

Built web index SHA256: `ef62666d2072a35741f3bd170adfafe73b86ec6ae5dd12732dfcdecb45baf893`.

- Final web build exit0; a second build after all source was frozen reproduced the same index and all74 inventory hashes; existing large-chunk warning remains. Final web regression **318/318**, exit0. Owner's additional18 focused tests and TypeScript check passed; these are attributed in the independent review.
- [Compiled native verification](evidence/native-final.json): four exact finite-timeline stages,12 History lifecycle stages, three Alerts lifecycle stages, and25 rail checks. The rail checks cover EN/TH × light/dark ×390/900/1279/1280/1440/1672, plus native legacy dialog compatibility. All24 initial entries recorded main scroll0, no rail focus steal, no modal top layer or page overflow. Real background input and row interactions succeed without forced clicks. Native Escape restores the exact visible desktop opener; narrow close uses the visible fallback.
- Existing pause, reduced-motion restoration, offscreen restoration, held real response crossing eligibility loss and active-effect unmount checks pass. Four native timelines retain the original near-full-duration sampling checks; this is ordinary Chrome, not packaged Electron performance evidence.
- [History data checks](evidence/history-data.json): actual HTTP/in-memory SQLite with53 records, pagination while rail open, safe aggregate metadata/clipboard allowlist, whole-range CSV, literal search, pause and held late response, retained error/export disabled/recovery, language/theme/currency and390/900/1440 layout checks. This is the exact History-only prefix of the existing Vite/API E2E, **not a claimed full multi-page E2E run**. Replay archive: `evidence/history94-data.mts.gz` (extract to root/tmp).
- [Independent source review](evidence/independent-review.md) found no concrete source blocker. Final browser results supersede its pending-run note; remaining long-metadata/retained-selection presentation limits remain applicable.
- [Fresh all-eight review](review.html) uses the final compiled index and freshly verified original reference hashes. History now stays open as a rail in its default screenshot; it is no longer closed to create the gallery frame. All-eight font/sidebar geometry checks pass. The capture script inherited93's temporary output label; the index-verified94 output was renamed before packaging and its replay script now writes the94 directory. Committed93 artifacts are preserved.
- [Seven resting controls versus93](evidence/unchanged-page-controls.json): five byte-exact. Models differs32 pixels/max35; Projects40 pixels/max35. No tolerance or masks applied, no causal fix or overall visual pass inferred. Historical raster findings remain open.

The first browser attempt used a broad `dialog` count that included the unrelated closed command palette. The selector was corrected to the History-labelled dialog; native `:modal`, real background access and legacy modal checks remain. Raw harness-red log/JSON/PNG are archived. No application change was made to pass that selector correction.

## Limits and continuation

The root inspected the fresh History frame against the original image: the selected right rail and usable table composition are restored. Numeric content, safe fields and chart observations remain truthful to the fixture/API and approved overrides. This establishes the repaired structure, **not99–100% overall likeness**. Original/current comparison still shows work for the full visual, behavior, native and release requirements. See [required work](NEXT-REQUIRED-WORK.md). No final native package, rollback or whole-goal completion is claimed.

[Final independent coherence review](evidence/final-coherence-review.md) checked the52 artifacts available before its own report and final rebuild logs were added.

Source fingerprints, built-web inventory and artifact hashes bind this checkpoint's actual files. Synthetic isolated databases only; no customer or user source collection.
