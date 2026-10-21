# Source95 measured visual priorities: Models, Projects, History

Read-only audit,2026-10-20. Actually viewed all six images: original `C:/Users/TH12367283/Downloads/quotapulse_build_blueprint/refs/{models,projects,history}.png` and corresponding `docs/redesign-v1.85.94/after/*.png`. Both sets are1672x941; coordinates below are approximate raster observations in CSS pixels at DPR1 (about2-4px reading uncertainty), not browser DOM measurements. Original ZIP screen contracts and OVR011/012/015/016/018/019/022 govern substitutions. No source edits/browser/build/Git. This audit identifies actionable differences; it does not measure an overall likeness percentage.

## Ranked smallest factual-safe repairs

### 1. History summary row consumes about12px extra height and pushes the table down

- **Image evidence:** timeline begins at approximately(240,143) in both. Original metric cards occupy y195..260 (~65px); current y194..272 (~78px). Original timeline ends y453; current y463. Original table heading y522; current y534. Thus the main composition is roughly11-12px lower after the summary despite the same upper anchor.
- **Concrete contributor:** current Calls card displays actual79calls plus “43 Usage records ·17 Distinct sessions”; the latter wraps to two lines beside the large icon. These facts must remain. Original has a smaller, single-line footnote. Additional safe fields explain the content, but do not require this particular restricted text column.
- **Source:** `packages/web/src/redesign/history.css` desktop `.qp-history-summary article:nth-child(2)>small { grid-column:2; grid-row:3; }` and icon spanning three rows. Current summary min-height67 permits intrinsic growth.
- **Minimal candidate:** allow the second card's supplemental record/session metadata to span the full card width, or use a compact full-width secondary line below the value/icon. Keep exact Calls/records/distinct-session semantics, all pricing coverage/native cost information, and categorical effort. Check the row returns toward67px without clipping or collapsing long Thai text. Let the timeline/table move naturally; do not apply a negative transform to conceal content growth.
- **Acceptance:** fresh canonical screenshot measures summary/table anchors against original, then native EN/TH/light/dark/narrow checks confirm all metadata remains readable. Different chart points/scale remain real.

### 2. Models comparison uses smaller text but taller rows than the original

- **Image evidence:** original selected row roughly y386..421 (~35px); subsequent row pitch ~36-38px. Current selected row y383..423 (~40px), with following rows around424..464 and466..505 (~41px pitch). Current row labels/numbers are visibly more compressed than original despite that extra vertical space. Fewer actual model/provider pairs explain the large blank area, not the row typography/pitch mismatch.
- **Source:** `packages/web/src/redesign/models.css` desktop table font-size11px; desktop td padding7px vertically; `.qp-model-row-trend` height26px. The trend sets a minimum row box near26+14+border=41px. Original comparison labels are visually about12px.
- **Minimal candidate:** at canonical desktop, test12px table type with5px vertical cell padding (26+10+border≈37px). Keep all recorded-provider versus maker columns, Calls, distinct sessions, cache share, price coverage and API value; preserve horizontal scrolling and button focus rings. Do not shrink the number of factual columns, create extra fake rows or stretch the six actual rows to fill the comparison panel.
- **Acceptance:** measure row baselines/type size and selected-row outline, preserve exact typed pair behavior and180/700 effects, verify long provider/model names and900/1280 overflow. This is a geometry/type candidate, not a font-family diagnosis from a screenshot.

### 3. History Close control remains a conspicuous text button instead of reference X artwork

- **Image evidence:** original rail has a small X around(1640,84), approximately14x14. Current rail shows a “Close” bordered button around(1589,74)..(1648,105), approximately59x32. This changes the heading's visual balance independently of safe content replacement.
- **Source:** `packages/web/src/sections/history.tsx`, `.qp-history-detail-heading` renders `<Button onClick={closeRail}>{t('history.close')}</Button>`; `history.css` lays out the heading.
- **Minimal candidate:** use the existing local X icon around16px in a compact icon button with translated `aria-label={t('history.close')}`. Preserve a usable native hit target, focus-visible outline, close handler, scoped Escape and exact/fallback opener restoration. The reference's glyph size is not a reason to make a14px mouse target. Limit to redesign heading; retain legacy behavior.
- **Acceptance:** initial rail remains non-blocking and stable, actual native click/keyboard close works, focus restoration checks pass, and glyph position/heading spacing is checked against the source. OVR018 changes content, not this close affordance.

### 4. Projects Top Consuming header is missing its reference flame and heading spacing

- **Image evidence:** reference flame around(1143,721)..(1164,743), heading starts~1175,726. Current Top consuming heading starts~1141,761 and has no artwork. Its lower panel is also ~35px lower (current panel y743 versus reference708), but truthful dual monetary bases and additional metadata/actions affect overall rail height; do not blindly shift that whole panel upward or remove facts.
- **Source:** `packages/web/src/redesign/projects.tsx` `.qp-project-top h3` renders text only; `projects.css` h3 font-size13px and native top-panel padding14px.
- **Minimal candidate:** restore a decorative existing Flame icon with warm red/orange glow, `aria-hidden`, and flex heading gap around10px; use the original heading's approximately14px rhythm. Keep ranking by real scoped tokens and actual top-list selection. Treat larger vertical compression as a separate measured layout change only after accounting for required native/API cost split and extra real detail metadata.
- **Acceptance:** flame/heading alignment matches source art without implying risk/status or adding a product action; rank values and click identity remain untouched. Check the icon/title fit long Thai text.

### 5. Models summary replaces source's distinctive cube/play artwork with generic layers/users

- **Image evidence:** original first summary glyph is a luminous cube inside~50px plate at(264,143); current is stacked layers at the same region. Original third card has a blue/violet outlined play triangle around(799,155); current has a users glyph. Fourth original is a stacked gold cylinder; current Coins glyph differs. Plate/layout alignment is already close, so changing data is unnecessary to recover these recognizable shapes.
- **Source:** `packages/web/src/redesign/models.tsx:203-206` uses Layers, Database, Users, Coins. `.qp-model-summary-icon` and data-tone rules in `models.css` already provide measured50px plates and blue/orange/violet materials.
- **Minimal candidate:** retain every truthful label/count and existing recorded sparklines, but restore local decorative Box/cube for the pair-count card, outlined triangle for distinct sessions and cylinder/database outline for monetary card if applying the original icon vocabulary. Keep `aria-hidden` and actual text semantics; do not add playback or status behavior. Original Sessions card itself uses the triangle, so no new lifecycle assertion is implied by matching that decoration.
- **Acceptance:** same card geometry/facts and native behavior; compare stroke/glow and silhouette at the original canonical coordinates. Coordinate markup ownership with the Models presence worker; do not duplicate rendering state.

## Differences deliberately excluded from “defects”

- Original Models12 rows/721M conflicting totals versus current6 exact model+recorded-provider groups, current real distinct counts and reported/API split: OVR015/016/017/022 and screen contracts require truth. Never fabricate rows, market descriptions, active badges, benchmark speed/quality or context capacity. Large empty comparison space is not fixed by fake data.
- Original Projects team/archive/budget/new-project/star/capability descriptions versus actual discovery, recent/unassigned/harness filters, share of scoped usage, read-only Details, real paths and dual money bases: OVR011/012/017. Recreating excluded controls would be a regression. Current flat-then-spike trends and tiny shares for one-token projects must stay factual.
- History status, numeric effort, prompt/response/raw JSON, bulk checkbox workflow and illustrated chart curves are intentionally replaced by call/aggregate kind, categorical effort, safe metadata/CSV and actual observations under OVR018/019/022. Current43records/79calls must not be replaced by original2847requests/18.4Mtokens.
- Original extra project semantic icons (megaphone/flask/briefcase) do not justify inventing project categories from names. Generic metadata identity icons are a safer mapping unless a truthful decorative mapping is deliberately specified.
- Donut having four token components rather than original two is truthful; do not collapse cached input/cache write into fake fresh input. Its position/halo can be measured separately, but changing slices purely for resemblance is excluded.

## Existing32/40-pixel controls are a separate unresolved limit

Read `docs/redesign-v1.85.94/evidence/unchanged-page-controls.json` and checkpoint94 validation:

- Models93->94 control is non-byte-exact:32changed pixels, maximum channel delta35, bounding box[30,338,50,353].
- Projects93->94 control is non-byte-exact:40changed pixels, maximum channel delta35, bounding box[30,191,594,338].
- Five other resting controls are byte exact; these comparisons are previous implementation versus current implementation, explicitly not original concept parity. No masks/tolerance were applied.

Those coordinates/deltas do not identify a cause. This read-only audit does not attribute them to font rasterization, animation, clipping, browser nondeterminism or the new History repair, and does not declare them resolved. Preserve original red evidence and its capture configuration. The five ranked repairs concern plainly visible original-vs-current differences; they neither excuse these controls nor derive a percentage from unlike datasets.

## Proposed execution order

History compact truthful summary and close artwork first; Models row typography/pitch second; restore Projects flame/Models decorative silhouettes without competing with presence-helper ownership. Capture the actual fixed index and compare original+OVR per region. Recheck actual interactions/focus/narrow/Thai before accepting new implementation baselines. Final human99-100% likeness acceptance remains open.
