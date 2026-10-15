# Frozen PulseAmbient evaluation mask

Selected from Source69 and baseline77 only, before opening any candidate image. `pulse78-mask.json` declares fixed include rectangles, union orbital/metric exclusions and 2px boundary erosion. `pulse78-mask.png` is the full 1586x992 binary mask. Reproduction: `python tmp/pulse78-mask-build.py`. Inspected source and baseline overlays in `tmp/pulse78-inspect/`.

The mask contains 5,408 pixels. At the predeclared B>90, B-R>35, B-G>5 threshold it includes 654 Source support pixels (220 left,434 right) and 425 baseline pixels (150 left,275 right). Counts are denominators, not likeness or amplitude scores. Orbit crossings and the existing orange metric trace are excluded symmetrically, with the same mask for every image. No candidate-derived segmentation may alter exclusions.

Scoring: `python tmp/pulse78-score-mask.py` processes baseline plus the first three candidates. Optional arguments are candidate stems under `tmp/pulse78-trials/`; include baseline in later runs. It writes `tmp/pulse78-masked-scores.json`. Source support is frozen; metrics report source recall within1/2/3px, bidirectional support distance, conservative symmetric p95, RGB MAE, and threshold sensitivity at80/90/110. All nine integer dx/dy combinations in -1,0,1 use the same masks. Empty support fails. Fixed source recall is required because a darker/erased candidate can otherwise improve pixel error.

## First three trials

All three are rejected under the predeclared gates; actual initial-montage inspection agrees that the broad sinusoidal field remains unlike Source.

| Candidate | Left MAE | Right MAE | Left source recall2 | Right source recall2 |
|---|---:|---:|---:|---:|
| Baseline |10.191|21.250|0.3045|0.5346|
| Tone only |10.863|22.681|0.3091|0.5599|
| Registration only |11.858|19.076|0.1909|0.1152|
| Irregularity only |10.367|21.937|0.2591|0.4631|

Numbers above are nominal registration at threshold90. Tone worsens MAE in both wings for all9 registrations; p95 worsens in8/9 left and6/9 right. Registration improves right MAE for9/9 but loses source recall for9/9 in both wings; right symmetric p95 worsens9/9. Irregularity worsens MAE and source recall in both wings9/9. Registration demonstrates why pixel error alone is unsafe for selection.

The masks are conservative and small. Context inspection must still protect required filaments outside the included windows, factual paint and orbit geometry. A directly Source-traced static path candidate is an unexecuted next hypothesis. Freeze these masks and evaluate it separately; do not select by its name or assumed provenance.
