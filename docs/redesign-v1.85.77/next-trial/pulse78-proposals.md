# PulseAmbient trials for checkpoint 78

These are unexecuted proposals, not approved visual gains. Inspected the actual Source69 and current75 Overview images and enlarged wing crops in `tmp/pulse78-inspect/`. No application code, browser, build or native run was changed or started.

The enlarged crops qualify the prior finding: Source dotted/orbital curves contribute to the broad envelope in `[500,180,560,320)`. Earlier bright-pixel counts and envelope spans therefore cannot establish a PulseAmbient amplitude defect. Source's unoccluded filaments are brighter, less uniformly sinusoidal, and cross lower in the left wing. The JSON provides exact isolated experiments rather than an assumed replacement.

1. **Tone only:** multiply the six wave opacities by 1.2, preserving values below 1, and reduce only the wave soft-glow blur from 1.6 to 1.25 SVG units. Preserve existing gradient colors, geometry and junction paint.
2. **Registration only:** translate only the six-wave group and the existing four-junction group by `(0,16)` SVG units. Root box, stars, atmosphere, globe and orbit geometry remain fixed.
3. **Irregularity only:** add a bounded secondary harmonic with a smooth endpoint envelope. Exact per-wave coefficients, phases, formula and analytic derivative for the existing 64 cubic segments are in the JSON. Existing junctions stay on their modified paths; no junctions or particles are added.
4. **Conditional combination:** combine only isolated changes supported by trial evidence. Skip if none improves. Record the chosen IDs explicitly.

Primary measurement windows are left `[500,235,560,285)` and right `[920,200,978,310)` at 1586x992. Secondary left `[465,205,560,300)` has more exclusions. Manually mask orbital ridges, metric paint and core paint in both Source/current, using their union with at least 3px dilation. Use unchanged global panel anchors with paired +/-1px registration; do not align the wings independently for the main score. Compare masked pixel error, filament position and ridge-normal brightness/width. Whole-context crops contain changed facts and must not receive a raw likeness score.

All proposals keep actual data, quota progress, orbit timing, existing decorative star count, static accessibility behavior, light opacity and narrow-screen hiding intact. Any paint spill into factual/core content or a gain caused by asymmetric masks rejects a candidate. Detailed definitions and current baseline parameters are in `tmp/pulse78-proposals.json`.
