# Models reference ratio bars / source158

[Original / source157 / current gallery](review.html) · [Current Models](after/models.png) · [Tiny/zero/unknown fixture](images/en-dark-1672.png) · [Latest runnable ZIP review156](../redesign-v1.85.156/README.md)

At the original wide dark viewport, cache read share now uses an80×6px blue/violet track with the reference gradient direction and restrained edge/halo. Pricing Coverage uses an inline percentage with a50×6px green track in the accepted replacement for the concept's quality-score slot. Representative original cache/green pixels inform the paint, with full samples retained. The label and tooltip still describe recorded pricing coverage, not model quality. No benchmark, speed, lifecycle state or new data is invented. Light/narrow layouts keep their prior track dimensions and paint.

The original ratios are unchanged: cached input divided by fresh/cached/cache-write input, and native/computed/estimated priced calls divided by all recorded calls. Numeric data attributes retain exact raw percentages. Zero values have zero fill and no halo. Unknown denominators retain the existing dash with no track. Tiny positive values below1% now keep up to three significant digits in both table and selected details;1/1000000 renders0.0001% rather than a rounded zero. Common percentages retain the existing display format. The coverage grid allows its numeric label's natural width so precision does not overlap the track. No minimum fill is imposed.

## Verification

The production build passes. Sixteen compiled cases cover EN/TH, dark/light and390/900/1280/1672 widths using real HTTP and an owned in-memory DB. The Partial fixture has two records but10 weighted calls, of which4 are priced, so coverage is40%, not a record-based50%. Its fresh140/cached40/cache-write20 tokens produce20% cache share. Other groups cover0%,100%, unknown zero-call/input denominators and tiny0.0001% cache/coverage. Raw ratios and CSSOM serialization match exact independent expected values; geometric extents allow only the browser's1/64px quantization, while zero/full extents are exact. Tiny table and selected-detail labels agree. Keyboard selection, exact model/provider History links and page overflow also pass. No assertion or tolerance was relaxed after a failure.

All353 web tests and the full unchanged dashboard integration pass, including144 responsive cases and at most one SSE listener after navigation. Canonical before measurement recorded six37px model rows. All six remain37px and all reference-width columns fit without horizontal scrolling after the larger bars. The selected-model detail, chart, summaries, table structure and control behavior remain stable.

All eight current canonical within-context pairs are byte-identical. The historical source157 full baseline is indexdff79e4a60341cab38504dd5664ccbd8a69c6d3be35410b656c70609c98ad040. A separate measured-before Models capture uses that same index; it is not a new run relabeled against the updated source. Models changes are confined to842,394–1060,605 in the ratio cells and their glow. Six other full frames are byte-identical. Providers again has105 unexplained global-header pixels with maximum channel delta4, preserved unmasked; that historical rendering gate stays open.

```powershell
npm.cmd run build -w @quotapulse/web
npm.cmd run test -w @quotapulse/web
node --import tsx scripts/check-model-ratio-bars.mts
node --import tsx scripts/check-history.mts
```

The gallery retains complete frames and the SHA-verified original Models reference. Actual product/consistent QA values differ from the concept, and no99–100% approval or similarity percentage is claimed. Review156 remains the latest native ZIP, containing source155; it does not include source157 chips or source158 ratio paint/precision. No native/ZIP, physical tray/monitor, performance or migration/rollback acceptance was rerun here. Remaining visual/control/motion, customer/provider and desktop requirements still need the full blueprint audit. Main and unrelated work remain preserved.
