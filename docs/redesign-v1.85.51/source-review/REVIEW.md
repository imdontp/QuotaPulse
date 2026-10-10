# Candidate51 original sidebar review

Read-only PNG/source/CSS review, bound to production index `59d998e03d16dcefac7d5a8d209b8a78c013d3f27906d5553656e16995a2b127`. `measurements.json` records hashes of each original and capture, the geometry JSON hash, actual DOM states, and measured painted bounds. No browsers, builds, app/dist edits, or Git mutations.

## Models native navigation

The former4–12px early vertical navigation is corrected. Inclusive painted orange badge bounds are **178..198,338..358 in both source and current**,21x21. Actual current DOM badge isx178/y338/21x21. Label bright-pixel top offsets current minus source are **+1,0,+2,+2,+2,0px** for Overview,Live,Projects,Models,History,Alerts. Icon bright-pixel top offsets are **0,0,+2,+2,+2,0px**. Label left edges remain within1px of source; icon left edges generally within1–2px. Models/Projects/History remain approximately2px lower and font/path raster differences remain visible. These painted bounds do not establish exact silhouette fidelity.

Badge circle size and position now agree. Source retains a brighter rim and surrounding halo; current SVG gradient is smooth and lacks that rim. Source digit3 versus current4 remains intentional actual-data variation. Lucide icon paths remain visually different in places, particularly History/bell; active nav border/glow also differs from source. No99–100% claim is justified.

## QuickStats/footer frame measurements

Source values below are strongest horizontal border paint rows in bounded windows, not exclusive DOM bottoms. Current values are DOM top/bottom; painted current bottom is generallyDOMbottom−1. Source textured/antialiased borders may occupy two rows.

| Page/state compared | Source Quick border y | Current Quick DOM y/bottom | Source footer border y | Current footer DOM y/bottom |
| --- | --- | --- | --- | --- |
| Overview/default |422/709|421/710|916/977|916/980|
| Live/default |442/732|442/734|870/929|870/929|
| Projects/default |408/706|408/707|864/926|864/929|
| Models/default |443/747–748|443/748|865/930|865/929|
| Providers/closed |444/748|444/749|861/926|861/929|
| Cost/closed |447/739|447/740|866/923|866/929|
| History/default |444/748|444/749|864/928|864/929|
| Alerts/default |416/703|416/705|861/927|861/929|

QuickStats frame tops are within1px and bottom paint generally within0–1px, with Alerts about1px longer. Footer tops agree; remaining painted bottom differences range0–5px, largestCost(currentpaint928 versus source923). Models footer currentpaint928 versus source930 is2px short. These are visible source gaps despite the geometry/overlap probe passing.

Matching the QuickStats frame does not match its interior: Models source heading bright bounds31..101,465..475 versus current25..100,461..471. Current heading is6px left and4px early, and appears heavier. Source icons use filled blue tiles/pictograms; current uses cyan outline icons. Source panel backdrop is darker with a faint textured atmosphere; current is flat and brighter. Footer first-line text also begins farther left in current; full measured bounds are in JSON. Footer pulse symbol/glow and actual app version text differ; retain the real version rather than copy sourcev0.3.0.

## Providers/Cost closed versus default-open

Providers/Cost closed screenshots prove the same production sidebar's closed card/footer geometry, not the initial state users see. Their actual default-openMore has QuickStatsDOM546..835 and footer873..937. Original PNGs instead contain a page-specific visible Providers or CostAnalysis row and noMore disclosure. OVR-001 retains all nine destinations throughMore; default expansion exposes the active destination. This is an approved navigation substitution. Do not describe closed-state source measurements as exact default screenshot fidelity, or collapseMore to hide the current page solely for a comparison.

## Method and limits

Models label/icon masks use meanRGB>105 within fixed row-specific regions; badge usesR>180,75<G<230,B<125. All measurements are inclusive painted pixel bounds, sensitive to antialiasing. Source horizontal card edges use row-averageRGB withinx55..174 and±8px of matching DOM boundaries; crops were inspected to support the edge selection. All eight original/current sidebar crops are retained with image hashes. Native EN/dark only; root's separate all-nine-links/open/closed/compact probe is not rerun or claimed by this review.
