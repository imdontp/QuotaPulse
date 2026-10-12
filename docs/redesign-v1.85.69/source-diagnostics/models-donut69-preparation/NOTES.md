# Bounded69 Models donut palette preparation

Offline only. Source/current crops and3x3 raw pixels/hash provenance are archived; no authoritative source, browser, tests or services changed. Current image is67 unchanged Models, index88edb8dc8ec17f96c7face5327ac3892953eb2bb227cd68848f4620ac3acbcad. Root should rebind to current68 asset/image hashes before implementation.

## Source semantics and paint

Original printed legend explicitly labels cyan/blue Input Tokens68%189M and violet Output Tokens32%89M. This establishes two input/output color families; source does not separately label cached input/cache write. Their proposed blue-family assignments are design choices, not inferred reference facts. Real production current distribution is fresh input#2bb8ef, cached input#775cf6, cache-write#ad6be8, output#18cfa9.

Reference filled-sector3x3 medians: input-right RGB3/177/252 (#03b1fc); input-bottom-left58/125/253 (#3a7dfd); input legend1/149/251 (#0195fb); output-left120/50/251 (#7832fb). Output legend116/53/251 independently confirms violet. Samples exclude rim, sector boundaries, labels, dark center and glow; the reference remains a gradient/art image, so these are representative interior tones rather than universal flat colors. Detailed coordinate boxes/raw pixels/min/max are in samples-and-proposal.json.

## Minimal proposed change (two files)

models.tsx: replace only four color strings with var(--qp-model-fresh-input,#2bb8ef), var(--qp-model-cached-input,#775cf6), var(--qp-model-cache-write,#ad6be8), var(--qp-model-output,#18cfa9). Keep field values, array ordering, total, all start/end percentage expressions, zero components, spans, legend rows and formatted labels unchanged. Each legend i already consumes the same part.color as the conic gradient; no duplicate color mapping needed.

models.css: set scoped variables only inside existing native dark composition:

```css
@media(min-width:1536px) {
 .qp-redesign[data-testid=production-models][data-theme=dark] .qp-model-distribution {
  --qp-model-fresh-input:#03b1fc;
  --qp-model-cached-input:#3a7dfd;
  --qp-model-cache-write:#0195fb;
  --qp-model-output:#7832fb;
 }
}
```

No geometry, conic angles, rings/inner-hole shadows, legend spacing, source totals, inactive state or other chart colors change. In light theme or below1536px variables are absent, so exact original four colors remain through fallback. Zero cache-write still occupies zero angle and retains its fact/legend entry. All-zero totals keep current Unknown fallback and must not paint a ring. Changing palette cannot fabricate an observed context or price.

## Required validation after root applies/finalizes68

- Freeze new build; API-match all four values, distributionTotal and every conic segment angle before/after.
- Verify same input/cache/output order and legend computed backgrounds match each part token.
- Test nonzero cache-write fixture so third input shade is actually distinguishable; retain categorical text/numeric legend and focus semantics rather than color-only meaning.
- Capture native EN/TH dark and light plus1536/1280/900/390; verify only native dark colors differ, no geometry/overflow/contrast or actual route behavior regression.
- Check zero-sized component and all-zero no-ring behavior. Rerun current Models workflow/native gates, relevant web build/tests; no baseline masks/tolerance change.
- Compare source/current filled-sector palette and overall donut, not whole-image % similarity. A flat four-sector gradient is still distinct from source smoothly lit two-sector ring; do not claim exact artwork match from sampled color reuse.

## Explicit limits

Source source-ring center estimated1572.5/451.5; current67 painted center appears further right. This palette-only proposal deliberately does not alter placement/radii; fresh DOM/source measurements would be required for a separate geometry change. Source278M totals and68/32 proportions must not replace actual values. Keep all four factual components even though source has two legend rows.
