# Per-reference selected navigation paint / source160

[Eight-page original / source159 / current gallery](review.html) · [Paint measurements](evidence/all-reference-paint.json) · [Full-frame differences](evidence/comparison.json) · [Latest native ZIP review156](../redesign-v1.85.156/README.md)

The selected sidebar row now uses the measured navy falloff from its own original reference. Overview, Live, Projects, Models, History, Alerts, Providers and Cost each supply four fitted sRGB gradient stops. A transparent1px border preserves the existing space while the existing rasterized decorative rim supplies the bright left edge. The former full cyan outline and common gray/violet right side no longer override those per-page paints. Changes apply only to the dark production dashboard at widths1536px and above. Existing narrow/light/preview styles and unreferenced Settings fallbacks retain their earlier rules. Navigation order, the accepted More grouping, labels, icons, focus outline, link targets, alert count and all data stay unchanged. No dependency or new product behavior is added.

The original reference hashes are checked against the canonical manifest. Each fit uses24 fixed blank-strip pixels at three offsets near the row's top and eight horizontal positions, avoiding text. Four horizontal stops are fitted at0/20/45/100% using ordinary least squares, rounded to8-bit RGB. Exact coordinates, original pixels, source hashes and fit output are retained. A separate fixed ten-pixel strip per page checks the resulting compiled paint. All eight improve their mean absolute channel error; this is a local paint diagnostic and is not a whole-screen similarity percentage or99–100% approval. The initial single Projects palette slightly worsened several other pages; its measurements are retained, and it was replaced before delivery.

## Validation

Validated: production build;353 web tests; full existing dashboard integration including144 responsive cases, at most one SSE listener after navigation and clean browser/Vite/daemon/DB teardown. The final integration ran with frozen source and no HMR updates. No new test mirrors this cosmetic implementation; existing behavioral checks cover the shared navigation. Eight current canonical within-context pairs are byte-identical at their original reference dimensions. Compiled CSSOM confirms each active row's actual paint, preserved dimensions and current-page link.

Seven full frames differ from source159 only within the existing selected navigation rectangle: their content, charts, tables, headers and other sidebar regions are pixel-exact. The final History capture has523 additional pixels outside that rectangle around the global search field and filter icons. Those differences remain unmasked and the corresponding visual gate remains open.

A same-page diagnostic captures current paint A, previous source159 paint, then current paint B without changing the compiled source or underlying data. Current A/B are byte-identical. All three retain105 pixels outside the row versus the historical source159 frame; reverting the navigation paint does not remove them. This falsifies the new palette as the sole cause of that diagnostic's extra pixels. It does not explain the full523-pixel canonical variance or retrospectively resolve older Providers105/Models3 rendering differences. CSSOM/geometry and the complete diagnostic frames are retained. No source correction for an unproven cause, screenshot mask, tolerance relaxation or silent replacement of the canonical frame is used.

```powershell
npm.cmd run build -w @quotapulse/web
npm.cmd run test -w @quotapulse/web
node --import tsx scripts/check-history.mts
```

Source160 changes one CSS file. This improves the shared navigation's reference appearance; it does not complete the original blueprint's remaining art, typography, control, motion, native, performance or migration acceptance. Consistent synthetic QA values differ from the concept; production still displays actual data. Main and unrelated user work are preserved.

Review156 remains the latest runnable ZIP and contains source155. It excludes source157–160 changes. No native/ZIP, physical tray/monitor, customer/provider or two-version migration/rollback acceptance was rerun here.
