# Native Models sidebar source review

Read-only PNG/CSS/TSX review. Both images are1672x941. Full image hashes and row bounds are in `measurements.json`; enlarged crops are retained beside this report. Bounds are inclusive painted pixel bounds, not DOM boxes.

| Item | Original source | Current capture |
| --- | --- | --- |
| Orange badge bounds |178..198,338..358|178..198,326..346|
| Visible badge size |21x21|21x21|
| Orange-mask median RGB |247,159,67|248,163,63|
| Overview label bounds |66..124,105..115|66..123,101..110|
| Live label bounds |66..89,153..162|66..89,147..156|
| Projects label bounds |66..115,199..211|66..116,193..204|
| Models label bounds |66..110,246..256|67..112,239..248|
| History label bounds |66..109,294..306|66..109,285..296|
| Alerts label bounds |66..101,343..352|65..101,331..340|

Horizontal label alignment is now close: all six bright glyph left bounds are within1px and label right bounds within2px. The active Models glyph begins1px to the right and is2px wider; this is a font/paint difference rather than a large positioning error. Icon bright bounds generally begin within1–2px of the source; the active Models cube starts atx31 in both. Published Lucide path silhouettes still differ from source outlines, notably the bell and History arrow. Do not infer exact icon likeness from matching bounding boxes.

The badge now matches source horizontal position and21px visible diameter. Its lighter orange body is much closer than the former flat#ed8a36 capsule: current orange-mask median differs by(+1,+4,-4). Source retains a visible bright rim/highlight and soft dark surrounding halo that the current smooth radial fill does not fully reproduce. Source digit3 versus current4 is actual-data variation and should remain unchanged. Text darkness/weight cannot be concluded from unequal digits alone.

Vertical navigation remains visibly earlier than the source. Label top offsets current minus source are−4,−6,−6,−7,−9,−12px from Overview through Alerts; the badge is exactly12px too high. The increasing offset indicates both a starting offset and row pitch difference, not a badge-only displacement. Source labels imply approximately47–49px pitch while current labels use46px pitch. A badge-only top adjustment would misalign it with its own Alerts row.

Current native CSS explicitly scopes production min1536px navigation padding-left16/right14/gap14 (Overview right13/gap11) and badge21x21/radius10.5. The SVG's radial gradient is top-left oriented(cx35%,cy25%,r85%) with#ffb65a→#f8a33e→#f39a38 stops. This matches the intended brighter top-left orange family. Smaller-width paint/position was not assessed in this request.

Measurement method: orange bounds useR>180,75<G<230,B<125 withinx145..209/y310..364. Label/icon bright bounds use meanRGB>105 in fixed per-row regions. These thresholds exclude most glow but are sensitive to font antialiasing; full crops support interpretation. No browser/build/app/Git changes occurred.

Hashes:

- Original source:`b055379b1469f65bcf85819a1b1e32ff431e72f4f0c7d4b23192d53212f83d2c`
- Current capture:`a1fb483a1fdf9d3b50158994aec5a1dac22af5f0f8cd7bdd680470d62938813f`
