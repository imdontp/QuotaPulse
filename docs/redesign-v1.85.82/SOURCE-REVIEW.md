# Independent review: Source fidelity changes 82

## Scope and verdict

Reviewed only, read-only source and image inspection. **Approve with conditions**: final current-source build, relevant tests and canonical repeated capture gate must pass before checkpoint publication. This is a bounded fidelity improvement, not proof of whole-goal 99–100% likeness.

Compared actual Downloads blueprint refs for Overview, Cost, Projects with compiled `tmp/source82-before` / `tmp/source82-final` images and their verification JSON. Inspected all 17 paired captures and all 17 factual text payloads. Both manifests contain 17 rows; factual text payloads match for every pair. Final manifest index SHA256 is `2745fb4d452476c930089630042f7afa93784ecee8948dc6b177e0f1d6a684dd`, errors and forbidden requests empty. This review did not launch a browser/build or independently reproduce the manifest producer.

## Findings

No material blocking source defect found.

The new primary-flow filters have higher CSS specificity than the generic idle/unknown `filter:none` rule. On initial inspection this appeared to reintroduce idle glow. Full data-path inspection shows `overview.tsx` constructs featuredFlowEdges exclusively from active runtime edges (line 246), so primary plus idle/unknown is currently impossible. This concern is withdrawn as a present defect. Optionally restrict primary selectors explicitly to active for defensive clarity; no rebuild is required solely for this optional change.

## Visual and behavior assessment

- Overview: Source rounded navy Project plate and blue clipboard-like glyph are visibly closer than the prior square purple-gray card. Fine resting flow lines better match Source filaments than prior broad ribbons. Actual project text, sessions, graph connections and API facts remain unchanged.
- Cost: 44px plates, semantic green/blue/purple/warm paint and text offsets move toward Source. Source glyph shapes and unavailable historical-chart artwork are not claimed identical.
- Projects: selected native cube now matches Source scale/glow more closely. The actual existing 54px plate, selected state, button and data semantics remain intact.
- SVG background is local, decorative, and replaces an existing aria-hidden icon only. Button accessible names and click behavior are retained.
- New visual selectors require production route, dark theme and width >=1536; multi-project Overview cards keep previous card style. Native flow treatment intentionally applies to all populated production Overview maps; compact/light/standalone preview retain fallback widths.
- Token share continues to determine monotonically increasing widths (0.7–1.85px); raw prior 1.2–4.4 stroke-width attribute is retained for fallback. The canonical test still asserts that raw token-share attribute and now independently reads computed width under the native-dark presentation contract. It has not simply skipped or relaxed width validation.

## Paired image evidence and limits

Overview compact/mobile/light are pixel identical; native changes are bounded to [248,526,1255,695]. Cost compact/mobile/light are pixel identical; native changes are bounded to [263,144,1164,192]. All five Alerts variants are pixel identical, consistent with the rejected draft being removed.

Projects includes unrelated small sidebar raster differences: compact 48 pixels, bbox [25,327,44,379], maximum channel delta 37; native light 32 pixels, bbox [30,323,50,338], maximum delta 28. Native dark includes the intended cube plus sidebar differences. The new CSS selectors cannot target the sidebar, but capture settling has not been causally established. Do not label all untouched Projects variants byte identical or explain these pixels as proven harmless.

Diagnostic visual comparison: `tmp/visual82-review-context.png` (crop montage only, no product asset modification).

## Remaining whole-goal work

Three changed areas look closer; they do not establish all eight refs, all field/action/state inventories, actual event motion, native window lifecycle, accessibility or final user acceptance. Uniform RuntimeMap background dots and broader art/icon/font/card differences remain visible; factual overrides explain some other Source differences. Repeated-capture stability measures repeatability, not Source acceptance. Maintain the active full objective.

## Follow-up: capture navigation limitation

Read-only inspection confirms `tmp/source82-capture.mts:163` creates one page per config, then lines 168–174 navigate Overview -> Alerts -> Cost -> Projects while preserving `/?visual82=<config>` and changing only the URL fragment. These are same-document SPA transitions. `waitUntil:domcontentloaded` does not establish an independent fresh document for each route. This limits explanations for small sidebar raster deltas; it does not prove a scope leak or paint-cache cause. Root is arranging targeted route-unique-query recaptures after the current exclusive browser process exits. Same-build repeated fresh captures and exact sidebar SVG/ancestor rect/style/markup snapshots are the next discriminating evidence.
