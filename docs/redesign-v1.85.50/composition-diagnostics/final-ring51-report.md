# Fresh width8 / blue-junction capture

Actual screenshot `screens/overview-layout/overview-en-dark.png`, timestamp2026-10-10 01:39:25.223041+07, SHA2562ac647023d4d7181bd4bdb7be3bc2cea7e916957cbd1158458d6794194f92b03. Actual distindex SHA2567f43f09a51ebf5064913a9604131f92f20672c278e0172202beeff262b09e4a3.

Bottom baked-ridge fixed pixels now measure97.42 (710,354),85.97 (735,357),93.06 (760,353), improved from157.50/136.39/151.16. Compare the reference's local ridge maxima99.06/71.78/87.23, at slightly different y coordinates for side ridges. Earlier wide344..365 peak search now picks the brighter exterior SVG halo after ridge darkening; that broad search must not be interpreted as a failure to shade the baked ridge.

Bottom core(735,373) is RGB91,156,255; reference91,156,254. At375 current91,156,255 vs reference91,153,254. Junction color now matches the measured core closely. Ring-bottom broad ROI mean luma75.11 versus reference91.55 remains lower because stroke/glow coverage and geometry differ; do not describe the whole ring as matching on this single pixel.

## Visible endpoint artifact needs correction

The lower semicircle's horizontal cap produces a rectangular dim notch on the middle-right bitmap limb. Atx847..850 mean luma drops151.25 at y242 to101.45 at243; reference132.42→127.55. Prior width4 cap produced131.15 at243. Native crop22x25 enlarged nearest-neighbor in `width8-right-endpoint51.png` shows the discontinuity clearly. The width8 modification reaches the ridge as intended but increases this existing abrupt cap artifact.

Do not treat the globe paint as ready for full matrix until that local artifact is addressed. Exact candidate, not applied:

```tsx
<linearGradient id={`${id}-bottom-limb-fade`} gradientUnits="userSpaceOnUse" x1="180" y1="160" x2="180" y2="184">
  <stop stopColor="#010913" stopOpacity="0"/>
  <stop offset="1" stopColor="#010913"/>
</linearGradient>
```

Use this gradient as the existing shade path's stroke; retain r114,width8,opacity.45 and clip. Both endpoints start at SVGy160, so gradient alpha0 removes the cap discontinuity. Shade reaches its full value by y184; the measured bottom ridges near SVGy268..271 retain full attenuation. This is a conditional candidate; fresh capture should show a continuous right/left limb rather than asserting the issue is fixed from code alone.

No source/dist edits, own browser, or build. Artifacts `final-ring51-measurements.json`, `final-ring51-globe-crop.png`, `check-final-ridge51.py` and three right-endpoint comparison crops are local diagnostic evidence, not fullgate results.
