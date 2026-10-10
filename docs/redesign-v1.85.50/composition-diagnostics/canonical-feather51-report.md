# Final canonical Overview globe measurements

Actual canonical `screens/stable-captures/overview-en-dark.png`, native1586x992, timestamp2026-10-10 01:44:49.146104+07, length884694, SHA256 `e02622e256f9f16b05cc9595fa2d6941d71eb82651b87fddffb8cc79de54cf97`. Actual frozen distindex SHA256 `8e081b56bc2bcdea1a420d0dbc5b033f590e28d2d267c25690ae9720eb8a34c1`.

Visible canonical state is72% Monthly used,721M Recorded tokens · This month, selected OpenAI monthly72% window; runway4d7h/reset6d2h. This resolves the quick visual probe's83%5h/Today difference. No fullmatrix/UI gate result is inferred from this artifact.

## Same-state endpoint and ridge result

Right limb endpoint mean luma atx847..850,y242→243: old width8 hardcap151.25→101.45; final canonical151.25→151.46. Left atx618..621: old179.34→104.82; final179.34→175.78. The former rectangular endpoint notches are removed in the same72%monthly state. Source transitions at these coordinates are132.42→127.55(right) and150.49→146.24(left); the final limb is still generally brighter, but it has continuous shading rather than the introduced cut.

Fixed baked-ridge samples(final/source local maxima) are97.63/99.06 atx710,86.90/71.78 atx735,93.06/87.23 atx760. Prior same-state hardcap97.42/85.97/93.06. The feather preserves the bottom attenuation with small raster/glow differences. Reference side ridge maxima occur at slightly different y positions; fixed-coordinate source pixels should not be substituted for local maxima when discussing ridge brightness.

Bottom progress core(735,373) finalRGB91,156,255 versus source91,156,254; at375 final91,156,255 versus source91,153,254. Broad bottom-ring ROI luma75.11 versus source91.55 remains an explicit geometry/glow difference. Top cyan and right violet joins remain visually continuous; the bottom blue quadrant join has no visible seam in the actual crop.

Targeted verdict: the new paint no longer has the introduced endpoint artifact; it is appropriate to continue the full strict matrix. Remaining globe surface texture, brighter center/right limb, ambient orbital geometry and glow differences stay open. This report supports neither universal99%likeness nor whole-project readiness.

Raw measurements `canonical-feather51-measurements.json`,2x crop `canonical-feather-globe51.png`, endpoint comparison crops `feather-canonical-right51.png` and others in this directory. No app edits, own browser, or build by this agent.
