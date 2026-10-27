# Projects header separator / source175

[Eight-screen concept/current gallery](review.html) reuses the seven unchanged source173 images and all eight original references; the Projects image comes from this build. Data in the gallery is an owned synthetic fixture. The application uses collected facts.

At the canonical 1672 × 941 English/dark viewport, the concept has a horizontal one-pixel separator below the Projects header. A desktop-only, noninteractive CSS pseudo-element restores that separator without changing content or layout. The reference line has image texture, so this is a measured approximation, not a claim of exact color.

Validation: fresh web build passed; compiled Chrome capture used the same local HTTP fixture, viewport, timezone and reduced-motion settings as source173. Repeat captures were byte-identical, no page overflow or browser/request errors occurred, and all measured main regions were unchanged. The only screenshot pixels changed from source173 are the 1,446 pixels at x=226..1671, y=139. On this row mean absolute channel error against the original changed from 13.88 to 5.16; this one-row measurement is not a whole-screen similarity score.

The gallery passed eight tabs and 16 local images with arrow/Home/End keyboard navigation, no page errors and no external requests. The seven previous page images are reused from the previously verified source173 captures; they were not recaptured for this CSS-only change.

The review174 ZIP contains source173, so it does not include this source175 CSS change. Full visual acceptance and native/performance/upgrade gates remain open. No real account, customer log or user database was used for this capture.
