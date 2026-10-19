# v1.85.86 validation

**Validated bounded visual correction. Original all-eight visual and release acceptance remain open.**

Removed only the repeated regular dot layer from the native dark single-project Runtime Map backdrop. The existing atmosphere SVG and two lighting gradients remain. Source-relative asset URL, actual topology, records, node/edge identities, widths, event motion and data are preserved. Four CSS declarations changed; no JavaScript, dependencies or schema changes.

## Current evidence

- Production web build exits0; existing large-chunk advisory remains. Current web227 tests pass. The full531 repository run before this CSS edit used85's unchanged source; it is not a current86 full-repository run.
- Current compiled index: `8479d47a868523dd72ef9c32626150c84539bd1939b72b5ee55e8f5c740b33da`.
- Four compiled before/after cases retain identical facts, all captured foreground node geometry and edge data/paths. Native dark removes only the fourth background layer. Compact, mobile and native light are pixel-exact before/after.
- Native dark has2630 changed pixels. Eleven lie exactly at x1535, the DOM rectangle's right boundary; all changes lie inside inclusive map bounds and none beyond the separately recorded2px paint margin. The complete unmasked pixel count is retained; the rectangle classifications are diagnostics, not acceptance masks.
- Original runtime-layout gate passes all4 EN/TH dark/light pairs byte-identically, unchanged max-channel10/fraction0.00005 criteria and no masks. Includes actual API edge identity/count, screen-space endpoints after resize/internal scrolling, keyboard project detail, empty/restore and Source-estimated card bounds. This is repeatability and behavior evidence, not whole-screen similarity.
- Independent source/trial reviews confirm preserved relative imported asset path and three entries in every background list. The same-render trial retains full main text/markup and all1102 measured boxes; condensed invariant record and executable reproduction are retained.

## Review and reproduce

[Original/previous/current images](review.html), [compiled comparison](checks/comparison.json), [runtime gate](checks/runtime-layout.json), [independent source review](source-review.md), [previous all-eight review](../redesign-v1.85.85/review.html).

Build and tests: `npm.cmd run build -w @quotapulse/web`, `npm.cmd run test -w @quotapulse/web`. Clear QUOTAPULSE_CAPTURE_LANGUAGE/THEME, set QUOTAPULSE_CAPTURE_SCOPE=runtime-layout and run `node --import tsx scripts/check-stable-captures.mts` sequentially in the isolated worktree. Fixtures are synthetic in-memory DB through real APIs with readers off; no user database mutations.

For archived .mts reproduction, copy scripts into tmp/ before execution. map86-capture before needs matching frozen85 dist in tmp/map86-dist85; final uses current packages/web/dist. Archived map86-trial defaults to matching frozen85 dist in tmp/map86-dist85 (override QUOTAPULSE_MAP86_TRIAL_WEBROOT) and applies CSS only in its test page. This explicit prior-build parameter was added to the reproduction copy after execution; original execution served identical hash-bound85 bytes from packages/web/dist. compare86.py reads the before/final capture directories. No Concept Preview mode is added.

## Remaining original goal

This map backdrop correction does not clear85's unresolved Models/Projects canonical repeat failures. Current86 full40, remaining Source artwork/typography/content layout acceptance, performance, current review package/notices, actual original-checkout/assets rollback and final release acceptance remain open. Native11-stage evidence is85's bounded historical result with documented eventual-latest/first-frame/resize limits. Do not infer99-100% visual fidelity or whole-goal completion.
