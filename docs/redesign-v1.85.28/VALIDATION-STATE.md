# Models enclosing frame and comparison inset v1.85.28

## Scope

Follow the original Models source after the read-only audit recorded in
[next source repairs](../redesign-v1.85.27/NEXT-SOURCE-REPAIRS.md).
Changes remain on the separate redesign branch after5ce74b0/v1.85.27.

Source `refs/models.png` SHA-256:
`b055379b1469f65bcf85819a1b1e32ff431e72f4f0c7d4b23192d53212f83d2c`.

## Changes

- Wrap the actual heading/status/summary in one grid preserving12px gaps.
  Native desktop decoration supplies the missing outer frame around heading
  and metrics. It grows with real content rather than fixing a stale/error
  height, has no pointer events and adds no assistive-technology content.
- Reduce native comparison horizontal padding to8px and set heading font to18px.
  Preserve575px comparison,90px provider footer and all existing API-backed
  columns, filters, disclosures, selection and detail semantics.
- Both English and Thai pair-history labels explicitly explain non-additivity,
  matching the existing per-bucket session disclosure. No aggregation changes.

## Validation

| Check | Result |
| --- | --- |
| Production web build | Session20418 exited0;2980 modules. Existing532.87kB main App advisory remains. |
| Diff review | Changes limited to Models layout/CSS and two translated labels; no API, dependency or migration changes. |
| Models en/th dark/light production captures | Session78600 exited0:four pairs, Thai dark/light byte-identical; en/dark10 changed pixels,max delta1 and en/light14 changed pixels,max delta4 within unchanged tolerance, no masks. API-backed chart bins, complete keyboard bucket disclosure, non-additive labels, selection/currency and390/900/1280 overflow checks pass. |

Production index SHA-256:
`011d23607cf9c8f4762e90901368d103838996eaf75e701b597fee736eec62f2`.

The v1.85.26 web158 tests/backend/full-workflow passes and v1.85.27 Overview/
Providers captures belong to their recorded builds. They are not reported as
fresh runs on this candidate. Current targeted browser validation must prove
the preserved y259 comparison and y846 provider footer, actual plotted bins,
keyboard disclosure, selection/currency and responsive overflow behavior.

All four variants preserve comparison y259-834,height575 and provider footer
y846-936,height90. See the fresh capture manifest and measured-region JSON.
`git diff --check` passes. Validation is scoped to this layout/label change;
the final release matrix/workflow is not claimed for this build.

Fresh en/dark direct source review observes the enclosing perimeter at roughly
x236,y72 to1269,y248 versus source236,72 to1268,248. Comparison table starts
x247 versus source approximately245. These are source/capture region estimates,
not whole-image scores. The remaining comparison icon/title starts about7-9px
below source; selected row starts432 versus source386. Existing top padding and
the truthful visible priced-call coverage note need a further hierarchy review;
preserve the coverage disclosure rather than silently dropping its facts.
Next measured desktop repairs are8px header inline padding (icon/title currently
x238/x280 versus source approximately247/289) and10px comparison block padding,
retaining the575px outer frame. Do not compress or remove the coverage note.

## Remaining original goal

Whole-image source acceptance is open. History subtitle/timeline and selected
outline, Providers heading/profile placement, globe texture/star accents and
other source style gaps remain in the original ledger. Complete the final
eight-page source/override review,40pair matrix, current performance and release
compatibility/manual accessibility evidence before calling the whole redesign
complete. No99-100% likeness is claimed from repeat captures.
