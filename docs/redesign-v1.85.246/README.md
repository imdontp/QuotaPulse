# Models token distribution ring

The Models input/output ring now runs cyan toward the upper right and blue toward the lower left, following the reference's color direction. The dark theme also has a stronger static halo. The arc sizes, sector boundaries, values, selection, accessibility text and motion logic remain based on the same recorded input/output components; no observations or values were added. The gradient direction applies to both themes, while the halo change is dark-only.

[Compare the reference, before and after](review.html). In the unmasked English/dark synthetic capture at 1672×941, 9,716 pixels changed: 9,713 within the recorded ring region and three elsewhere. Median RGB samples in `analysis.json` document the direction change; the reference and fixture contain different input/output shares, so these samples are not a whole-image similarity score. The after capture repeated byte-for-byte. `capture-verification.json` and `stable-verification.json` record the same compiled index hash.

The web build and 382 web tests passed, including distribution behavior for zero, invalid, tiny, single-sided and non-reconciling components. The compiled Models browser suite passed English/Thai × dark/light, API-matched selected model and input/output components, keyboard disclosure/selection, proportional boundary values and responsive checks; four repeat pairs passed the existing unmasked tolerance, three byte-identical. The eight screenshots in `theme-captures.tar.gz` were checked against the manifest hashes. The build retains the existing Vite large-chunk warning.

These fixture and headless-browser checks do not establish whole-page or 99–100% visual acceptance, real-provider behavior or physical display performance. Review243 predates this change.
