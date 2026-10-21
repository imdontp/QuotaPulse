# Typography checkpoint v1.85.106

Status: partially validated. Build and focused layout checks pass. Strict raster control remains RED; full dashboard visual acceptance is open.

## Changes justified against original reference text

Six native dark desktop font weights change, with existing font sizes, tracking, line heights, colors, transforms and real data preserved. No new data, features, dependencies or screenshot assets enter production.

| Text | Previous weight | Current weight | Local alpha MAE before / after | Local raw RGB MAE before / after |
|---|---:|---:|---:|---:|
| Live Runtime Map |275|325|.120185 / .086057|28.033 / 21.100|
| Pulse Insights |400|450|.125054 / .094176|29.809 / 23.083|
| Live Monitoring |300|350|.107519 / .073334|28.191 / 20.715|
| Projects |300|400|.107071 / .094451|28.277 / 25.157|
| History & Logs |350|450|.132901 / .056184|32.975 / 15.252|
| Alerts & Quota Guard |400|375|.068928 / .057425|17.803 / 15.424|

These are same-text, fixed-rectangle diagnostic errors, not whole-page likeness percentages. Median background /95th-percentile neutral foreground normalization estimates alpha; raw RGB counts every local pixel. Each actual rebuilt crop is byte-identical to its selected previous-build DOM trial, so retained trial scores apply to the final source. All six also improve bounded +/-2px translation error. Ten weight/fringe candidates were measured across eleven text targets; Core, Runway, Models, Providers and Cost are deliberately unchanged because no sufficiently supported weight repair emerged. Earlier size/tracking trials in tmp/title-trial68 were rejected and not reintroduced.

Variable-font weight changes intrinsic text widths. Runtime and Insights h2/title widths grow about1.16/1.31px; Live h1 grows1.78px. Existing inline flex flow moves adjacent captions/controls. Origins, line boxes, nonweight heading styles and all main panel/shell/QuickStats rectangles remain unchanged. Each of the4110 changed inline-flow pixels exactly reproduces its selected previous-build trial inside its actual heading row. This is disclosed flow, not an assertion that every descendant stayed fixed. Whole Runtime row RGB MAE8.473 ->7.098; Live row14.983 ->13.601. Different truthful Live subtitle text prevents interpreting these row diagnostics as complete text equivalence.

## Validation

- npm run build -w @quotapulse/web passes TypeScript and Vite; existing large-chunk warning remains.
- All eight canonical EN dark pages captured from current compiled source. Immediate repeat pairs are byte-identical; no browser errors or forbidden external/write requests. Overview1586x992; other seven1672x941; Chrome155.0.8059.80. Deterministic capture arguments are retained in capture-current.json.
- Native Chrome without renderer flags:140 changed-heading cases = five routes x two languages x two themes x seven widths390/900/1280/1536/1586/1672/1920. Real localized title ranges stay within viewport; no document horizontal overflow. At each native dark viewport, actual main-region rectangles equal a same-data previous-weight inline baseline. This checks containment/layout, not complete interaction, clipping/accessibility certification or performance.
- All eight current-v105 main regions, sidebar, QuickStats and navigation geometry match. Heading origins/heights and nonweight styles match; intended intrinsic widths are recorded explicitly.
- Full repository, legacy, keyboard, native motion/performance/package/rollback gates were not repeated for six weight declarations; previous build evidence remains historical.

An initial control assumed every heading width would remain equal; that assertion was invalid for variable fonts. Its failure log is retained. The corrected control permits only measured edited-heading width changes while requiring unchanged origins/heights and surrounding panel geometry. It still exits1 on unexplained raster differences.

## Retained strict controls RED

The before baseline is a fresh capture of unchanged source105/index12d5022d, taken before editing. It matches published105 images on six routes; History and Providers already differ from the published captures. The viewer stores the exact recapture baseline used by these controls. These same-build cross-capture differences remain unexplained and are not attributed to the six weight changes.

Every pixel is counted, with no masks or tolerance. The original strict comparison classifies only six tight title rectangles as intended; its RED result is retained. A separate attribution checks heading-row pixels against the selected previous-build trials; it does not remove or relabel the strict result as PASS.

After exact inline-flow attribution: Overview,Live,Projects,Models,Alerts,Providers have zero unexplained pixels. History has147 unexplained pixels (123 shared header,24 sidebar); Cost has2 sidebar pixels/maxdelta2. Original before/after color samples are retained. Causes and harmlessness are unproven. Functional checks and stable immediate repeats do not clear these or earlier rendering diagnostics.

## Review and continuation

[All-eight original/105/current viewer](review.html) includes side-by-side, overlay and unmasked difference. Enlarged text/row inspections and Thai narrow/native screenshots are linked. The user requested the real app; only validation fixtures use synthetic data.

Continue remaining typography, art/material/layout differences, Projects ranking-rail colors, Cost chart vertical alignment, historical raster controls, actual tested-host/build identification, native/package/performance/rollback and full original requirement trace. [Full obligations](../redesign-v1.85.95/NEXT-REQUIRED-WORK.md). This checkpoint does not establish99-100% concept fidelity or user visual acceptance. Main branch and user databases are untouched.

## Reproduction

Extract archived harnesses to tmp to preserve relative imports. Build the web workspace. Run capture-type106-after.mts and check-type106-matrix.mts sequentially using node --import tsx (isolated port7816). The strict control additionally needs retained tmp/type106-probe and tmp/type106-trials previous-build images; selected diagnostics/trial JSON, current screenshots, raw logs and source hashes are packaged here. Archived trial JSON contains immutable PNG hashes; historical trial images remain ignored local diagnostics. check-type106-controls.mts correctly exits1 for RED. attribute-type106-flow.mts provides separate exact-trial attribution and retains unexplained pixels.
