# Controlled title trial68

Current unchanged production index: `88edb8dc8ec17f96c7face5327ac3892953eb2bb227cd68848f4620ac3acbcad`. Browser `154.0.8037.98`, EN/dark,1672x941,DPR1,Asia/Bangkok,fixed clock2025-05-17T13:42Z. Isolated synthetic SQLite and real API;11 inline DOM variants. Process54825 terminal exit0; browser/daemon closed in finally. No authoritative app/source/dist/Git edits.

## Verdict

Reject all tested overrides as a source-fidelity repair. Smaller glyph-box errors did not improve actual same-text raster ink alignment. Keep current67 CSS. A number matching only the outside glyph bounds is insufficient when intervening letters move away from source. No numeric source font weight is inferred.

|Page/trial|Same-coordinate alpha MAE|Best +/-2px translation MAE|Ink ratio|Glyph edge deltas x/y/w/h|
|---|---:|---:|---:|---|
|models / baseline|0.0902|0.0902|0.946|-1/1/3/0|
|models / tracking-minus045|0.1807|0.1219|0.943|-1/1/0/0|
|models / translate-y5|0.0954|0.0902|0.946|-1/0/3/0|
|models / tracking-minus045-y5|0.1732|0.1219|0.943|-1/0/0/0|
|projects / baseline|0.1217|0.1217|0.902|1/1/-2/-2|
|projects / size26|0.1713|0.1273|0.967|1/0/2/-1|
|projects / size26-tracking-minus095|0.1445|0.1233|0.970|1/0/1/-1|
|projects / size26-tracking-minus105|0.1392|0.1289|0.966|1/0/0/-1|
|projects / size265|0.2201|0.1469|1.010|1/1/4/-1|
|projects / size265-tracking-minus105|0.1879|0.1389|1.014|1/1/2/-1|
|projects / size265-tracking-minus120|0.1634|0.1353|1.015|1/1/1/-1|

## Findings

- Models tracking-.45 fixes thresholded width73->70 but nearly doubles coordinate alpha error .0902->.1807; even allowing measured translations gives .1219 versus baseline .0902. Its subtitle shifts left3.59375px. Adding y5 corrects the thresholded top position but still gives .1732 error; y5 alone gives .0954 versus baseline .0902. Size22/weight325 remain fixed in every Models variant.
- Projects size26/tracking-1.05 fixes width84->86 and improves height22->23, but error increases .1217->.1392. Best alignment .1289 still trails baseline. Size26.5 approaches total source ink while shifting glyph contours more; every tested26.5 variant is worse. Subtitle/card/icon geometry stays unchanged. Weight300 and27.5px line box remain fixed.
- Crops visibly show reference soft bright fringe/glow and different letter shapes. Geometry alone cannot identify the correct weight or justify globally thickening titles. Reference Projects thresholded glyph height24 includes its fringe; trial nominal font enlargement did not reproduce that fringe.

## Method / limits

Crops isolate Models x287..370/y88..112 and Projects x300..403/y79..109, removing icons/subtitles. Neutral RGB pixels(max-min<80) are normalized between median background and95th percentile bright foreground. Opacity>.2/.5/.8 separates fringe/core and yields bounds/pixel counts. Alpha MAE compares same coordinates; bounded translations distinguish placement from shape. No glyph resizing, chart/text masks, threshold loosening or approved-baseline similarity claims. Diagnostic normalization is not a calibrated font-weight detector or full-page SSIM. Candidate and source hashes, browser/build, actual geometry and results are recorded in verification.json and measurements.json.

Original PNG sources remain byte-identical.4x crops are explanatory read-only evidence derivatives, not product assets. Root may pursue a separate controlled text-color/glow/font-shape trial if justified; these size/tracking changes are not recommended.
