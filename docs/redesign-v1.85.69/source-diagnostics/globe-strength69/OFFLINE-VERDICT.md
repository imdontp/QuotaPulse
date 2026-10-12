# Expanded strength69 offline verdict

Recommend **lower-black-100 (#010913,opacity1)** as the best tested full-artwork candidate at current source alignment; supersedes prior055 recommendation. This is not merely the darkest option: it has lowest lower, annulus, interior-limb, main-progress and full-artwork MAE, while meridian stays practically unchanged. It still does not reproduce the concept exactly. No app/browser/build/Git changes.

## Geometry and measurement scope

All5trial CTMs/centers identical to frozen68; center734.546871/243, scale1.025. Source raster has no exactCTM and its bright-ridge circle fit is irregular(residual4.45px); retain previous±2px identical-source-translation sensitivity rather than claiming perfectregistration. Protected quota/state/geometry retained in diagnosticverification, errors/forbidden empty. Use offline-region-analysis.json for exactregions/all25shiftgains.

## Full tested range

| Candidate | Lower MAE | Annulus MAE | Interior limb MAE | Full art MAE |
|---|---:|---:|---:|---:|
| Baseline |48.972|58.280|25.096|30.702545|
| black055 |37.860|42.669|23.742|29.674082|
| black070 |34.735|38.270|23.363|29.476619|
| black085 |31.810|34.158|22.990|29.346195|
| black100 |29.756|31.348|22.688|29.314165|

FullartROI x600..874/y110..389 includes entire globe/rings and all side tradeoffs; unchanged factual label differences affect absoluteMAE but cancel candidate ranking because labels areidentical. Sourcevalues are not copied. InteriorROI x680..797/y336..349:100 improves2.408 instead of crushing texture. LowerROI median changes46/82/179→31/50/132, still above source12/28/115; no medians suggest overshoot. Annulus55/106/213→33/58/128. Viewed055/070/085/100lowercrops:100best reduces pale moat while vivid outerblue/texture persist.

For every identical±2source translation,100 improves lowerMAE14.547..19.608 and annulus19.329..27.701. Fullartgain stayspositive.806..1.484;085has best worst-casefullartgain.857(min) versus100.806, so source-registration ambiguity matters. Exactalignment100vs085fullartadvantage only.032channelMAE; do not present a universally unique optimum across possible registration/scoring priorities.

## Side tradeoffs / invariants

MainprogressROI x680..797/y369..375 baseline39.692→10039.510, maxchangedchannel4; actual dash/paths/percentage intact. MeridianROI x840..863/y240..243 baseline29.264→10029.243, maxchannel3. Topright completelybyteidentical, so separatetoprightgap remains open.

RightlowerROI x840..863/y245..267 has localoptimum055(MAE27.452), baseline30.533,07027.947,08528.704,10029.499. Thus100still improves currentalignmentversusbaseline, but gives up2.047MAEversus055 and is notbest there. Under±2shift,100rightlowerMAEgain spans-4.301..3.524: some registrations worsen. If root treats rightloweras protectedpixelregion rather than currentalignment artworktradeoff, reject wholelowerhalf100 and use narrowbottomarc; do not falselyreport rightcenter unchanged. Strongershade should not be chosen just because it is darker.

Changedwholeframepixels10031,639 bbox564,189..907,417 include many1–4channeldrop-shadow/compositingdifferences beyondstroke, as earlier trials. ProtectedDOMgeometry is unchanged, notrenderedpixelidentity. Initial055screenshot differs in smallquantization compared to prior11trial055(max2vs4 inprogress); readmatchingtrialbaselineforproof.

## Root action

Adopt exact diagnostic100shade only after checking rightlowervisual tradeoff, or constrain bottomarc if thatside changeunacceptable. Preserve quota0/unknown/100dash/mask, observeddata/labels, anchorgeometry and existingprogressgradient. Build/native/scopedOverviewcaptures and comparechangedregions. Retain both055and085evidence so a future narrowedarc orsourcebaselineacceptance canchoose moreprecisely. Neither fullartMAE nor repeats prove99–100%visualgoalcompletion.
