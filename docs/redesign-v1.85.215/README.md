# History retained selection

History keeps the selected record and its related-record scope when pagination or a new query replaces the displayed results. Previously the detail rail did not explain why its record was missing from the page. A localized status now appears when the selected event is absent from the displayed snapshot. It disappears when the event is present or another visible record is selected. The retained related-session link still uses the selected snapshot's scope; when that same event is accepted again its scope can be refreshed.

The production web build and 380 web tests passed. Eight compiled-browser cases used an isolated in-memory database and the actual API, exercising pagination, source changes, related links and selection replacement across English/Thai, dark/light and 390/1672px viewports. All eight History capture pairs were byte-identical, and `npm run test:ui` passed including the legacy and popup checks. The [example](history-retained-selection.png) uses synthetic data; it does not establish reference-image fidelity.

The review211 ZIP predates this change. Whole-dashboard concept fidelity, real provider data, physical tray/display behavior, cross-schema migration, production performance and the previously intermittent Runtime Map issue remain open.
