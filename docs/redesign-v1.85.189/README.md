# Source189 — Alerts forecast title

The English dark desktop forecast heading uses a measured 14.5px / 450-weight Geist style. Its line height and bottom padding preserve the prior 20.8px outer height. This brings the same literal title closer to the supplied Alerts reference while preserving the real forecast, controls and data. Thai, light and smaller viewports retain their previous styling.

[View the eight-page comparison](review.html). The Alerts screenshot is newly captured from the compiled candidate with an isolated synthetic API fixture. Overview is reused from source188 and the other six screenshots from source186; those seven pages were not recaptured for this checkpoint. Real data changes the values and chart shapes. This is not an approved baseline or a whole-page similarity score.

The selected font and position were explored against a fixed 193×35 title region and selected on that same reference; they are not independent acceptance evidence. In this local region, mean absolute RGB difference fell from 34.07 to 18.24. At 1672×941, 1,611 changed pixels were confined to the title region; major page regions kept their geometry and the screenshot repeated byte-for-byte within its browser context.

A previous one-pixel transform variant changed 44,694 pixels outside the heading by up to four channel levels in a same-context A/B/A test, despite unchanged geometry and text. A line-height/padding variant retained the same outer heading height and changed no outside pixels in the equivalent test; it was selected for the compiled version. The exact renderer mechanism is unproven.

The review187 ZIP predates this change and the source188 Overview artwork. Full concept approval, physical desktop and customer-reader validation, performance, and cross-version upgrade/rollback remain open.

Validation: web build and all 376 web tests passed. The Alerts gate passed four English/Thai and dark/light pairs byte-for-byte without masks under the existing tolerance, including risk, history and responsive interactions. The gallery passed eight tabs, 16 local images and keyboard navigation. The compiled checkout passed a 16-capture Electron probe in English/dark and Thai/light, verifying the heading styles and layout after restart with a synthetic profile. The native probe used offscreen windows and does not verify the packaged release or a physical display.
