# Cost83 independent code review

## Scope and verdict

**Approve** the additional bounded Cost unit-amount fit fix and canonical regression assertions. No blocking or important finding in the inspected source change. This is not full-goal visual approval or release certification.

Applied review-code-changes skill (already loaded). Read-only inspection of cost.css and the Cost block in check-stable-captures.mts, with current Cost formatting/markup and diagnostic/final artifacts. No app edits, builds, browser runs, Git mutations or subagents. Root owns exclusive full40 process23279; this review does not assert its eventual result.

## Correctness and scope

- cost.css155 adds a bounded20..24px fluid font for the last Cost summary amount at widths>=1500; the specific Thai production selector uses16..22px for its longer localized USD prefix. Earlier lower-width styles remain in force. It changes neither actual currency formatting nor precision, amount/basis calculation, token denominator, card width, API, schema, settings or actions.
- The amount's source at cost.tsx130 is Intl.NumberFormat with maximumFractionDigits6; markup174 uses the actual total/actual priced tokens. Full text is retained and existing overflow-wrap behavior remains available for unforeseen larger values. No clipping/ellipsis/forced nowrap hides data.
- Actual original measurements in current-fit.json prove20 cases: EN/TH x dark/light x1500/1536/1586/1672/1920. All heights are at most lineHeight+1; scrollWidths fit widths within rounding allowance. Texts remain $0.000025 and US$0.000025. This is this actual fixture, not proof all possible amounts/currencies fit on one line.
- Final original measurements precede temporary diagnostic CSS overrides in the probe. Earlier diagnosis shows the44px native icon grid reduced the text track144.5px vs156.5px under36px icons, explaining Thai1672 failure. Broader width probes exposed EN1500. Neither diagnostic altered-source candidate is mistaken for the final original layout.
- Canonical Cost block runs both independent passes after identical font warm order. Resize loop checks1500/1536/1586/1920 for unchanged text, one-line height, horizontal scroll fit and document overflow, then restores1672x941 before reference geometry and screenshot. Original raster tolerance/masks remain unchanged. No app facts or capture baseline are replaced by this test.

## Validation inspected

- current-fit.json productionIndexSha25606eb52b8e2b4b20ccd40a74f59caf4d618a5a23e4f0a8dab1ac75c58855d5a1e independently matches current dist index bytes.
- source83-build-exit.txt and source83-repo-test-exit.txt both0. Root reports527unit/History5/current8native green; this review does not rerun them or claim they prove every layout/state.
- Full40-final remains root's separate active browser job at review time. Approval is of source correctness with bounded final fit evidence, not a fabricated full40 pass.

## Optional regression strengthening and limits

The canonical native1672 check before the loop validates one-line height only; horizontal clipping at1672 is currently supported by the independent20-case artifact rather than that particular permanent assertion. Optionally include1672 in the loop (or reuse the same full-fit assertion before it) so future changes at that width also have direct horizontal coverage. This is not a current defect: current1672 EN/TH dark/light original measurements fit.

The fixture is USD with six fraction digits, not arbitrary-sized values/THB/zoom/OS text scaling. The CSS preserves readable fallback wrapping and actual format, so do not claim a universal one-line guarantee. Separate manual visual hierarchy/a11y/source acceptance remains outstanding under the full blueprint. No new scope is introduced by this local fix.

## Reviewed LF source hashes

- packages/web/src/redesign/cost.css: `0b15a5af0e6afffb8373bddae2e24fd62f6e3e7faeaba448d8ac1caebd8dfbdc`
- scripts/check-stable-captures.mts: `dc8264583c1843d978969bbdf2217b658db2f8512eeae514cc20d4e4f8518538`
