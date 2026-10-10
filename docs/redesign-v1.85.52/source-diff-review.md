# Actionable Code Review Report — current six-file candidate52

## Scope and goal

Read-only review against checkpoint51 HEAD `a9cd137bf3106a95189126d24317af1296a1e2cd`: `overview.css`, `quick-stats.tsx`, `projects.tsx`, `i18n/en.ts`, plus new `assets/native-active-rim.png` and `assets/native-active-rim.svg`. Reviewed source, asset bytes/decoded metadata, rasterization provenance/generator and built CSS. No browser, source/dist/Git or service mutation performed. This supersedes the earlier vector/aligned candidate reviews for current source acceptance; historical failed matrices remain separate.

Current index observed directly: `a7cb8c83cef42ceb390b6031e4a7938e3b51f94dee375aa451690f19deb90916`.

## Verdict

**Approve with conditions.** No blocking or important correctness, accessibility, real-data, relative-asset-path or intrinsic-layout defect found. Current focused/native/scoped/UI/full40 gates remain required. Pre-rasterizing this decorative path does not establish a confirmed renderer root cause or full stability by itself.

## Asset and paint review

- The PNG is valid8×46 RGBA,377bytes, alpha range0..255. SHA256 `8966cded741f9d391779453d60b447ea9eb90bf605ab0c18a94b3ea384bf67d1` matches `tmp/native-rim52-provenance.json`. The retained SVG string matches provenance exactly after removing its final newline; SVG SHA256 is `4fbf8b471c761081d72aec78718ccceaead75abc7bd98edf4faad65a2effcbf7`.
- Retained SVG contains only the original literal curved path, no script/external reference/text/ID. `tmp/rasterize-native-rim52.mjs` decodes that exact SVG, draws it to an8×46 canvas once and writes PNG+SVG+provenance. This is transparent decorative artwork, with no embedded data or screenshot masking.
- `overview.css` now uses `url("./assets/native-active-rim.png")`. The current Vite output `dist/assets/shell-C9g8suPh.css` contains the PNG as an inline `data:image/png;base64` URL. Thus the relative source path is correctly resolved and the current build introduces no runtime external asset request or file-origin path dependency. Asset SHA checks should be retained in archival.
- Models-specific half-pixel top/bottom override is removed. Native pseudo retains `inset:-1px auto -1px -1px`, width8, pointer-eventsnone, empty content and100% background sizing. Link dimensions/hit area/focus outline/aria-current/active border and background remain. Compact/preview styling remains outside this production1536px selector.
- The PNG's intrinsic height46 is still adapted to the actual CSS pseudo-element size and position. Therefore resampling and fractional coordinate compositing remain possible; this review does not claim a universal1:1 raster alignment or that image substitution guarantees the original full-sequence gate will pass.

## Other source changes

- Native stat column gap12 generally/10 Overview shifts count/label bearing by1px compared with the preceding candidate. Explicit icon/count/label columns and intrinsic card growth remain. Fresh Thai wrapping/large-count containment remains a gate condition; no new text clipping is introduced.
- Overview footer gap6 changes decorative/text bearing by4px relative to the general native10px gap. Actual package version/text, fixed icon size, footer growth and sidebar scrolling remain.
- `projects.tsx:184`, `:198`: only exact actual project key `QuotaPulse` uses decorative Box in card and detail; null/empty/case variants and other real projects retain Folder. Displayed name, project identity, filtering, selection, counts, trends and pricing coverage are unchanged. Parent marks remain aria-hidden and existing SVG sizing applies.
- `i18n/en.ts:31`: `Active Sessions` is a capitalization change. Existing recent-session observation-window title/note and actual count remain; no new live-process status claim.
- `quick-stats.tsx:22`, `:80`: native marks remain hidden/nonfocusable decoration. Actual hrefs/disabled state/counts, scope/generation/pause guards, risk callback, stale state and localized formatting are unchanged. Below1536px the new mark stays hidden and legacy mark remains; <=1100 card/footer behavior remains. Dark surface/text rules stay theme-scoped.

## Validation and historical limits

Current `tmp/reference-52-raster-build.log` reports successful build in28.06s; `tmp/reference-52-raster-unit.log` reports170/170 tests, zero failures. Root reports session82911 terminal0. This reviewer read retained logs and current index, without running these commands.

New session31387 is running focused Models checks followed by native/scoped/UI/full40. No outcome is assumed. Earlier failed initial TH/dark matrix, later EN/dark vector matrix and half-pixel-aligned TH/dark focused failure remain authoritative historical evidence. The aligned candidate failed12pixels/max20 after its EN pass; therefore the half-pixel adjustment is not labelled a validated fix. The PNG candidate is not labelled Fixed until the original strict unmasked gate passes; a pass would measure repeatability rather than prove a particular browser raster mechanism.

Manual accessibility, extreme-count/Thai containment, named approved reference baseline/SSIM and final desktop/package/recovery acceptance remain separate. Bind current archival hashes to ALL SIX files and current a7cb8c83... index. Earlier two/four-file frozen snapshots and prior indexes are historical.

## Recommended next actions

1. Finish current-build focus/native/scoped/UI/full40 checks and retain exact terminal outcomes/failure pixels.
2. Bind provenance to all six source/assets; retain generator, original SVG and PNG hash; preserve earlier failed candidates separately.
3. Continue measured source parity and release checks without claiming confirmed raster root cause or complete likeness.
