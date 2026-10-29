# Live identity presentation / checkpoint199

[View the concept comparison](review.html). The Live image is newly captured from the current compiled candidate with isolated synthetic API records. The other seven images are retained from earlier checkpoints; this gallery is not whole-dashboard visual approval.

The observed sessions table now uses a distinct dark-theme text color for the actual known harness identity, while retaining its name and existing icon. Unknown harnesses keep the neutral text. The recorded activity feed now displays the model-maker mark from the API's `vendor` field when a nonempty model and known vendor exist; it does not replace the separate recorded provider route. The API derives `vendor` from its existing model/provider classification rules; it is not a separately recorded maker field. Empty or unknown identities do not acquire a model mark. The original text and accessible labeling remain present.

The web build and 376 web tests passed. The compiled API/browser regression passed eight cases (English/Thai, dark/light, 390/1672px), checking actual recorded identities and grains, long and null labels, a Claude model routed through OpenRouter, known and unknown model marks, named harnesses, exact tokens and narrow keyboard scrolling. The Live stable capture gate passed four language/theme pairs, all byte-identical within each pair, with no masks; it also exercised pause, stale-response handling and chart states.

In the fixed English/dark reference viewport, the before and after screenshots each repeated byte-for-byte. Their 5,100 changed pixels all fell within the session harness names or the feed model cells. The sampled session panel background was `#07101c`; the four specified harness colors have contrast ratios of 9.24:1 or higher against that sampled color. The gallery passed eight keyboard tab selections and loaded all 16 images. These measurements describe this fixture and do not establish a percentage similarity or cover every possible background.

The latest runnable review198 ZIP predates this change. Full concept parity, actual customer readers, native physical-monitor/tray behavior and performance remain open.
