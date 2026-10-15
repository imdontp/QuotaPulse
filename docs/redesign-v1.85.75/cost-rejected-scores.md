# Cost surface trial evaluation 75

## Decision

Reject all three candidates and preserve the current baseline. These trials produced evidence against the proposed annular gradients; they do not establish that the remaining surface gap is solved.

## Evidence and method

Read the actual DOM trial geometry and compared `tmp/art75-trials2/cost-{baseline,radial-soft,radial-broad,radial-directional}.png` with the immutable source Cost image. Actual current center is (1323.0625, 218.890625), from the 184px DOM rectangle; source center is an offline saturated-edge fit (1322.4, 219.6), with uncertainty. Independent source and current x/y registration shifts of -1, 0, +1 yield 81 paired comparisons.

At radii 70, 73, 76, 79, 82, 85 and 88px, sample matched OpenAI, Anthropic, DeepSeek and unknown/gray segment windows. Normalize each RGB radial profile by its own radius 79px body baseline. This isolates radial surface shape from categorical color and recorded share differences. Source Google is omitted because it is absent in the actual fixture. Hole/text, main rims and seams are excluded. Scores are mean absolute normalized radial error, lower is better; this is not a whole-app likeness percentage.

| Candidate | Nominal error | Mean over 81 registrations | Registrations improved |
| --- | ---: | ---: | ---: |
| Baseline | 0.02549 | 0.02683 | — |
| Soft radial | 0.06022 | 0.05732 | 0 / 81 |
| Broad radial | 0.07687 | 0.07901 | 0 / 81 |
| Radial plus directional | 0.04833 | 0.04866 | 0 / 81 |

All proposals worsen the pooled score in every registration. None improves every registration for any individual matched provider. Inspect `tmp/cost75-trials-montage.png`: the candidates add a pronounced inward bevel/depression to already illuminated inner rims. The Source mid-body is flatter than these candidates and has a gentler outer rise. The existing blue radial profile already follows the Source fairly closely; adding white light alters its low red channel disproportionately.

The independent gray body patch [1296,137,1314,146) has Source mean RGB (80.71,95.22,115.36), baseline (80.04,92.14,111.14), soft radial (79.99,91.93,110.55), broad radial (79.47,91.27,109.68), and directional (87.21,99.25,117.64). The radial candidates move average tone farther away; directional overshoots. Increased variance alone is insufficient to accept a surface treatment.

All three trial changes are confined to the annular art: zero changed pixels within radius 63px (hole/text) and outside radius 94px (surrounding content). This only supports trial isolation; it does not prove zero/light/keyboard or production acceptance.

## What remains

The earlier small gray patch legitimately showed a flatter current surface, but this does not justify broad interior light/shade. If another trial is pursued, focus on a mild outer-body light rise and provider-colored light rather than brightening the entire inner band. That is an unexecuted hypothesis. Preserve actual shares, sorting, facts, primary edges, zero state and light state. Do not adopt any candidate merely because it adds depth.

Detailed hashes, raw profiles, registration scores and changed-pixel counts are in `tmp/cost75-scores.json`. No source file edits, browser runs or builds were performed by this evaluation.
