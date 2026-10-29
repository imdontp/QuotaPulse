# History record-type presentation / checkpoint195

[View the concept comparison](review.html). The History screenshot is from the current compiled candidate and an isolated synthetic API fixture. Seven other screenshots are retained from checkpoint193 and were not recaptured. This is an interim review, not a whole-screen similarity score or approval.

History rows now show their actual API record type in a colored badge: call, session aggregate, or unknown grain. The badge color is a category cue, not a success/failure state; the explicit localized text remains available. The legacy History rendering is unchanged. The canonical English/dark capture repeated byte-for-byte within its browser context.

The web build and all 376 web tests passed. The four-language/theme History gate passed after correcting its range-picker helper: eight capture pairs passed the existing unmasked tolerance, four byte-identical and four differing by at most 31 pixels and seven channel levels. In every locale/theme, the checked rows and badge text match the API records. A separate synthetic fixture exercised all three grains against the API at widths 390, 900, 1280, 1440, 1672 and 1920; every badge fit its cell. Tested badge text/background contrast was at least 5.40:1 in dark and 5.38:1 in light.

The original History gate failed because its timeline helper attempted to select a range inside the closed native details control. The same failure was reproduced using the unchanged web files extracted from review194. Updating the helper to open and close the picker through its summary made the unchanged build pass; the current candidate then passed the full gate. No product selector or threshold was weakened. Baseline logs and the focused probe are retained here.

Review194 does not contain this new History presentation. The remaining visual, physical/native, customer-reader, performance, and cross-version acceptance work remains open; the overall goal is active.
