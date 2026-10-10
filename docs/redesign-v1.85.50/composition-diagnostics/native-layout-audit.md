# Native 51 read-only layout audit

Evidence: tmp/live-geometry50/geometry.json timestamp2026-10-09T18:30:18.151076Z; freshly replaced screens/reference-composition/models-en-dark.png timestamp2026-10-09T18:33:41.258543Z; original docs/redesign-v1.85.43/refs/models.png. Models screenshot freshness was checked before measurement: the earlier09:17:49Z image was rejected as old evidence. No browser/app/build/Git changes performed.

## Models fresh capture

Horizontal border row means measured over x1320..1499 distinguish panel borders from fill, avoiding rounded-corner uncertainty. Current/original coordinates:

| Boundary | Current51 | Original43 | Difference |
|---|---:|---:|---:|
| Distribution top | 370 | 370 | 0 |
| Distribution bottom | 516 | 516 | 0 |
| Trend top | 528 | 528 | 0 |
| Trend bottom | 720 | 719..720 | 0..1 |
| Effort top | 731 | 731 | 0 |
| Effort bottom | 920 | 919 | 1 |
| Outer rail bottom | 930 | 930 | 0 |

The substantive5/4/9px top offsets from native50 are resolved. Outer rail bottom now matches the original; the remaining1px effort bottom difference does not justify reducing its factual content box. Native image still visibly includes all four token components, Total274.0M, recorded trend value range, start/end times, chart-data disclosure, unspecified effort tokens/calls, and two unknown context facts. This is an EN/dark visual check, not proof of every variant/disclosure keyboard behavior. Source confirms trend SVG remains112px; pixel-only audit does not replace DOM dimension checks.

## Live recorded geometry

Trend y564.75,height197,bottom761.75; intrinsic rows24/14/126/12,gap0,padding10/10/9. Full note602.75..613.75 (11px). Plot621.75..739.75 (118px), canvas621.75..725.75 (104px). These match source622/726 within0.25px. Summary580.75..734.75 (154px), values590.75..708.75 (118px), actual interval710.75..734.75 (24px), disclosure739.75..751.75 (12px). The disclosure has exactly5px clearance below the summary. Native values rows38/30/30 with10px gaps, plus heading2px margin/24px height, retain the154px budget even though these internal choices differ from the initial candidate.

Prior failing CTM618.75..722.75 is uniformly3px above this recorded canvas. scrollY3 would explain both endpoints; the JSON has no scroll field, so root cause is not proven by this file alone. Document-coordinate CTM+scrollX/Y comparison is appropriate for document-coordinate original targets, preserves existing tolerance, and requires no app change. Check a recorded scroll value/reset if claiming the exact cause. Feed list y809.25 is recorded, but its enclosing panel top is not; do not cite that list coordinate as a feed-section top772 check.

Verdict: fresh EN/dark Models composition confirms intended spacing coordinates. Recorded Live baseline confirms the197px panel and new104px plotting/154px summary/disclosure budgets. Full frozen capture matrix, repeatability, both languages/themes, no-note/unknown/growth variants and keyboard-expanded data validation remain root-owned gates; this independent audit does not claim they passed.
