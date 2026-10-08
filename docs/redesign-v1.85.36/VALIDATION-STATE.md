# Alerts primitives and Cost provider presentation v1.85.36

Continue the original eight-page real-data source goal after 3ced395/v1.85.35.
Original Alerts source SHA-256:
`f2d05a17e7613035e2a41302baf6a8792ed519de66af0ab159dd56842062f104`.
Original Cost source SHA-256:
`f90cf0c904c8dcc7872032207ba4aebf849d9f891809e66884c4c7bf5689f88a`.

## Changes

Place actual summary values above their labels as in the source. Use blue for
monitored windows/fixed thresholds/coverage, and the highest actual active-risk
severity for the current-risk icon/value (critical red, warning amber, otherwise
blue). Existing sorted QuotaRiskModel and count remain authoritative; color
does not fabricate a risk. Enlarge icon plates to44px and add restrained dark
glow. Retain every actual label/threshold/freshness fact and responsive columns.

Replace the dark heading icon's solid blue tile with the source's glowing bell
treatment. Refine static decorative forecast colors with pink/violet/cyan/teal,
thin inner edge and colored halo; the real day count, facts and warning condition
remain untouched. Decorative pseudo-elements do not intercept input or animate.

An intermediate source review found native gap shorthand placed values too
close to the larger icon plates. Final native tile padding4px15px and gap2px20px
restore separation without hiding text. Source/card geometry remains reviewable.

Independent source review also found excessive bright plate outlines and overly
cyan fixed-threshold/coverage values. Final dark styling glows only the icon
paths at2px and uses deeper blue for those two metrics. Light styling retains
the existing theme colors. No animation or polling change is introduced.

Cost now overlays static decorative inner/outer sector edges and radial seams
derived from the exact actual provider amount shares. It suppresses edges for
nonpositive totals and seams for a single positive provider. The original conic
gradient, factual provider ordering, CostValue and percentages remain unchanged.
One rounded legend enclosure uses contiguous minimum33px rows/dividers, centered
alignment and natural wrapping. Spacious native padding/column gap moves the
ring and legend horizontally toward source. No synthetic fifth provider,
dependency or unsupported cost projection is added.

## Validation

Initial build22120 and scoped check31917 exited0 (four byte-identical pairs),
but predate the final icon/value spacing correction. They are intermediate
evidence, not the attached final candidate.

Build72289 and check78816 exited0 (four identical Alerts pairs), but predate the
final source glow/blue correction and Cost changes. They are intermediate only.

Final combined production build31441 exited0;2980 modules and existing532.91kB
App advisory. Frozen index SHA-256:
`629a66a8e94f557732a0305d67f8ef8879ee2ad1c54f0a28b19f0ee4492d2274`.
Final scoped Alerts7768 exited0: four byte-identical pairs. Final scoped Cost54805
exited0: four pairs, three byte-identical; en/light has51 differing raster pixels
with maximum channel delta2, within the unchanged recorded tolerance. No masks
or tolerance changes. All attached captures/manifests use the frozen hash above.

Independent final Alerts review found no summary text/icon/fact/warning clipping
in en/dark or th/light. Restrained stroke glow and deeper threshold/coverage blue
are closer to source. The orb still has a broader outer rim/smoother center than
the original artwork; this is an open source difference, not visual acceptance.

Measured native Cost provider panel x1206.0625/y72/453.9375x259, bottom331;
donut x1231.0625/y124.890625/184x184; legend x1435.0625/y149.890625,
211.9375x134 with33px first row. Four factual providers remain four rows; the
source's five-row count is not fabricated. Lower panels bottom931. Source ring
top is approximately128, and electric gradient lighting is still stronger in
source. Final measurements and independent source review are attached/described.

Full workflow39921 exited1 at a stale exact heading expectation from before
v1.85.35 (`Alerts and quota guard`). The production title intentionally matches
source (`Alerts & Quota Guard`). Only that exact expectation was corrected;
no timeout/selection/behavior gate was weakened. Workflow97199 passed all16
responsive combinations, then exited1 because its occupied Alerts check still
aligned the inset heading (y84) to forecast (y72). Original source aligns the
enclosing heading/summary panel at y72. The guard now compares that panel to
forecast, retains the exact equality and adds heading/summary containment checks.
Final workflow66313 exited0 on this candidate: all16 language/theme/width
combinations across nine destinations, all final functional/occupied/compatibility
checks across the eight pages, and the added known-zero decorative-edge gate.
Fresh workflow/Cost route/occupied Alerts reports are attached. Browser, Vite,
daemon and database teardown completed. Final index hash remains unchanged and
diff whitespace passes. These checks do not replace the final source acceptance,
whole-release/performance/manual-accessibility gates.

New Cost checks compare decorative outer-edge fractions and seam counts to the
actual API provider amounts. Full workflow also verifies known zero has no
colored decorative edges. Existing actual monetary/native/API/unknown/weighted
coverage and responsive/keyboard gates remain required.

## Remaining original goal

The attached production images are review candidates rather than approved
baselines. No claim of99-100% whole-source likeness is made. Remaining source
repairs and full acceptance/release gates are listed in NEXT-SOURCE-REPAIRS.md.
The final checkpoint includes both Alerts and Cost repairs on one frozen build.
