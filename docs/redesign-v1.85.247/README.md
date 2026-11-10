# Overview Pulse Core percentage

The large dark-theme percentage in Overview is now upright and heavier at the reference desktop width, matching the reference typography more closely. The selected quota value, smaller percent suffix, progress arc, live-observation rules and layout remain unchanged. The visual change applies at widths of at least 1536 px; other widths and the light theme retain their existing styling.

[Compare the reference and before/after screenshots](review.html). The before and after use the same isolated synthetic fixture, English/dark, 1586×992, DPR 1 and reduced motion; the reference shows a different quota. Both captures repeated byte-for-byte. The unmasked full-frame comparison changed 10,042 pixels within x=658–812, y=178–265, the central percentage. The before image matches the earlier gallery byte-for-byte. This is not a whole-page likeness score.

The web build and 382 web tests passed. The compiled Overview browser run produced a completed verification manifest for all four English/Thai and dark/light combinations; all four screenshot pairs were byte-identical. It tested selected quota values, 0%, 100%, 125% and unavailable, including that the percentage fits within the globe and does not overlap its caption, and preserved the progress-arc and unknown-state checks. Its manifest and the after capture have the same compiled index hash. The original terminal session handle was unavailable after the session resumed, so its terminal exit status could not be recovered; the manifest itself was produced at the end of the checks. The build retains the existing Vite large-chunk warning.

These are synthetic fixture and headless-browser checks, not live-provider, physical-display or whole-page visual acceptance. Review243 predates this change.
