# Native History table density v1.85.31

## Scope

Continue the original eight-page, real-data reference goal after d106e49.
Only native desktop History table presentation changes: the scroller maximum
height increases from330px to366px and row action height decreases from26px
to24px. Cell padding,12px table text and content-driven row heights remain.
Long factual values can still grow rows; no records are dropped or invented.
Narrow/legacy layouts, selected-detail semantics and APIs are unchanged.

The source shows ten visible rows and a footer near935px. Before this repair,
the current fixture shows eight complete rows and footer bottom900px.
CSS arithmetic suggests ten typical33px rows fit the enlarged region and a
footer near936px. Fresh capture confirms the footer estimate; exact complete-row
measurement is nine rather than the estimated ten.

## Validation

Production build61084 exited0:2980 modules. The existing532.87kB main App
advisory remains. Candidate index SHA-256:
`cacb55da986591a43c8e718035abe1dcbd4cd182a3073f88b15ceb59fbeb25e2`.
Diff whitespace check passes. Scoped History production check30633 exited0:
eight pairs (four canonical and four selected), all byte-identical, no masks.
The manifest carries the exact candidate hash. All four language/theme variants
measure footer bottom936px, nine complete rows and43 API records, with successful
keyboard scrolling. Modal focus restoration and390/900/1280 overflow gates pass.
Port7804 is clear after completed teardown.

Fresh en/dark source review sees ten readable record texts, including tenth
timestamp/model/value/action, but the DOM complete-row count is nine: the last
row is partially clipped. Last-row text approximately879 versus source876 and
footer936 versus source approximately935 are region observations, not a whole
image likeness score. Selected outline and prior header/filter alignment remain.
The previous full authenticated workflow33512 passed on the v1.85.30 source;
it is not evidence of a full workflow rerun on this candidate.

Artifacts contain only actual review PNGs and the capture/detail manifests;
repeat/auxiliary screenshots are excluded. Captures use synthetic in-memory
data and are not approved visual baselines.

## Remaining goal

This bounded adjustment does not close source acceptance. The tenth complete
row, History detail-rail
hierarchy and other styling, globe particle texture, eight-page source/override
acceptance, final40pair matrix, current performance and release/recovery/manual
accessibility evidence remain open. Repeatability is not source likeness.
