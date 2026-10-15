# Independent frozen-mask trace evaluation

Recommendation: accept `source-traced-refined` as a bounded decorative geometry improvement, subject to root implementation and behavior validation. Reject `source-traced-geometry` because its right wing fails the predeclared source recall/distance gates. This is not a whole-screen or whole-app completion verdict.

Used the same `pulse78-mask.png`, include regions, union exclusions, 2px erosion, threshold sensitivity and nine paired registrations declared before viewing trial images. No mask adjustments were made for either trace. Raw scores: `tmp/pulse78-traces-masked-scores.json`; reproducible comparison: `python tmp/pulse78-compare-traces.py`.

| Candidate / wing | RGB MAE | Source recall within2px | Symmetric mean distance | Symmetric p95 |
|---|---:|---:|---:|---:|
| Baseline left |10.191|0.3045|12.811|43.000|
| First trace left |6.517|0.6318|1.774|6.617|
| Refined left |6.517|0.6318|1.774|6.617|
| Baseline right |21.250|0.5346|2.863|9.450|
| First trace right |20.859|0.4217|2.641|10.050|
| Refined right |17.170|0.8088|0.879|3.606|

Nominal registration and threshold90 are shown above. The refined trace improves MAE, source recall2 and p95 in both wings for all9 paired registrations and all3 thresholds80/90/110. First-trace right recall passes only2/9 registrations at threshold80 and1/9 at90/110; its p95 also fails the consistency gate.

Viewed actual Source, first-trace and refined-trace enlarged context crops in `tmp/pulse78-inspect/{source,trace-first,trace-refined}-wings.png`. The refined right upper crest and crossing match Source more closely, and the first trace's erroneous low horizontal/diagonal arc is removed. The left crossing band is substantially closer than the original broad sine field. Six adjacent filaments still look softer/more parallel than Source's finer luminous surface, and Source dotted atmosphere/glint geometry remains different. These are practical limits of this accepted scope.

Root's `tmp/pulse78-refined/verification.json` records unchanged factual text and surrounding DOM boxes for baseline/refined. This independently supports layout isolation, but does not replace source-diff review, event motion checks or light/Thai/narrow validation. No application source edits, browser/build/native runs or Git mutations were performed by this evaluation.
