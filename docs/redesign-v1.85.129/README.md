# Models summary and provider identity v1.85.129

[Open before / current / original review](review.html). Full redesign remains incomplete; this is not99–100% visual acceptance.

## Implemented from the supplied reference

- Models now shows the number of distinct named recorded providers below the model/route count. Null and empty provider groups are excluded from that count and shown with a separate +? disclosure, including the actual number of affected pairs. This is scoped source data, not a catalogue claim or invented four-provider constant.
- The token summary now shows recorded input and output beneath the total, matching the reference's information placement. Input combines fresh input, cache reads and cache writes; the tooltip explains components and possible stored-total differences. Compact values retain exact localized counts in their titles. Total remains the independently recorded total, even when components do not reconcile. Calls remain available in the comparison and detail.
- Anthropic recorded-provider fields use a native SVG company AI mark based on the supplied reference. Claude model and subscription/product marks retain their original star. This applies to Overview runtime/activity, Live provider fields, Projects provider fields, Models provider comparison/distribution, History provider cells/detail and Cost provider cells. Other identities retain the existing VendorIcon exactly; no alias/prefix guessing, vendor/model reassignment or data rewriting. Original shared VendorIcon/HarnessIcon files are unchanged. No Pet, backend or new dependency changes.

## Verification

- TypeScript/production build passed.335/335 web tests passed.
-48 actual Chrome cases: six affected routes, EN/TH, dark/light,390/1672. Models summary is independently reconciled with the API URL actually requested by the UI. The comparison keeps the provider company mark separate from the model artwork. Summary content fits its cards, and pages have no horizontal overflow, browser errors or forbidden writes. These are Chrome browser tests, not a physical desktop/Electron acceptance run.
-12 additional390px scenarios cover each language/theme with null and empty provider identities, an Anthropic filter, and a scope with no events. The fixture intentionally contains stored totals777/888 that differ from their components; the app keeps the recorded total and the real input/output values. Synthetic rows exist only in this owned in-memory QA database and are not shipped.
- Final Models distinct-document repeat gate passed all four language/theme pairs under its existing tolerance; exact-pair count is recorded in summary.json. This also exercises source-backed summary/history charts, keyboard model selection, complete table data, unknown/zero/tiny ratio boundaries and390/900/1280 overflow.
- The first four-context attempt timed out waiting for the Thai dark trend before its functional assertions. The isolated Thai dark reproduction passed exactly, and the final complete run passed. Cause is NOT established; a source-equivalent rebuild overlapped the first run. No timeout increase, rendering workaround or relaxed tolerance was introduced. The harness now records DOM/pending-request/screenshot diagnostics if page readiness fails again. The failed initial log is retained.
- All eight source-sized pages repeat byte exactly within their own contexts, and main region geometry is unchanged. See analysis.json for every before/current pixel delta. Providers has105 header pixels/max4 different from128 despite no Providers source change; this remains an observed difference without a cause/resolution claim. No diagnostic masks were used to pass tests.

## Still outstanding

The full all-page distinct-document gate is not proven green:128 Providers/History header-repeat failures remain unresolved. Global visual fidelity, remaining card/ring/material/control comparisons, physical desktop/real-reader acceptance and a ZIP that includes126–129 remain work. The runnable review125 ZIP is still based on source124. Main remains unchanged; source and tag are isolated on design/redesign-foundation.
