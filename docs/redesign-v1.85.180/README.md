# History summary / source180

[Eight-screen concept/current gallery](review.html): the History image is newly captured with an owned synthetic dataset; seven other application images and all eight original references are reused. The running application displays actual collected values.

For English/dark desktop widths of at least 1660px, the four summary cards occupy a narrower strip closer to the original reference. Compact visible labels preserve the distinction between estimated/calculated API value and native cost. Full descriptions remain accessible to assistive technology and via tooltips. Other languages, themes and narrower widths keep the existing presentation. Values and calculations are unchanged.

The production web build passed. At 1672×941 the four cards measure about 230×67px, and the screenshot repeated byte-for-byte. Comparing separate captures of the previous review179 bundle and this build yielded 66,201 changed pixels; 418 pixels also changed in chart rows 485–494, so this comparison does not establish that differences are confined to the cards. No whole-screen similarity or acceptance score is claimed.

The authenticated HTTP and in-memory SQLite integration passed, including 144 responsive page cases. A focused 20-case language, theme, width and currency matrix passed. Large synthetic prices and call counts remain readable and wrap without clipping; the existing History table requires keyboard-accessible horizontal scrolling for these extreme values in both the previous review179 bundle and this build (1124px client / 1169px content).

The latest runnable review179 ZIP predates source180 and does not contain this change. Native packaging, actual customer-provider data and full concept acceptance remain open.
