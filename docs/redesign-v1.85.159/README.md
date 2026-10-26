# Cost reference calendar / source159

[Original / source158 / current gallery](review.html) · [Current Cost](after/cost.png) · [Open Thai mobile controls](images/th-light-390.png) · [Latest runnable ZIP review156](../redesign-v1.85.156/README.md)

The Cost header now uses the existing calendar capsule shared with History, matching the reference placement and235px wide dark date plate. Period, monetary basis and chart interval remain editable inside its nonmodal panel. Custom From/To fields are now available on Cost. The closed caption uses the actual resolved API dates, or a localized preset while its new request is pending. All time remains All time. Source scope, basis and bucket survive edits and History links. Native and API monetary amounts stay separate; no report, billing, projection, budget or concept data is fabricated.

Choosing a preset clears obsolete hidden custom bounds. Choosing Custom then seeds the currently resolved period rather than an older custom range. Date controls reuse the shared inclusive-end display and next-local-midnight query logic, including DST and cleared-field guards. Optional Period/month wording overrides preserve the original shared defaults for History and legacy mode. No dependency, provider reader, database migration, pet or popup behavior is added.

## Validation and diagnosis

Validated: production build;353 web tests;20 compiled Cost cases;42 shared calendar cases;16 compiled History picker cases; full dashboard integration with144 responsive cases. Cost covers EN/TH, dark/light,390/900/1280/1672 widths, exact151-token scoped records, native0.25 versus API0.00, preserved hourly bucket/source, custom edits, pending captions, preset-to-Custom seeding, all-time default, keyboard/open/Escape/focus/Tab/outside dismissal and viewport containment. Four New York DST cases verify23-hour spring and25-hour fall days. Tests use owned synthetic in-memory databases and real local HTTP, not customer data.

The first integration failed when a later Cost route tried to read the now-hidden Period control. Both relevant driver paths now open the real disclosure first; labels, values, assertions and timeouts are unchanged. An initial focused driver filled a date with its existing value, generating no change event; its distinct replacement date and exact exclusive-end assertion are retained. Restricted process startup failed with EPERM; the same authorized local test was rerun with process permission.

The first canonical comparison also caught a real CSS regression: importing the shared picker from Cost moved its stylesheet before History's equal-specificity rule, reducing History action buttons from35px to32px. A History-scoped selector now preserves35px independently of import order. The new behavioral geometry assertion fails32 versus35 against the earlier compiled build and passes after correction. The full History frame is compared unmasked against the historical source158 baseline. First-failure logs and before-fix images remain in evidence; no screenshot masking or tolerance relaxation was used.

Eight canonical current pairs are byte-identical within each context. Full-frame comparison results, including any remaining unrelated render differences, are in[evidence/comparison.json](evidence/comparison.json). Original reference dimensions and hashes are retained. Consistent QA values differ from the concept; this evidence does not establish99–100% fidelity or whole-blueprint acceptance. Historical Providers105-pixel and Models3-pixel variance investigations remain open even if a current pair is exact.

```powershell
npm.cmd run build -w @quotapulse/web
npm.cmd run test -w @quotapulse/web
node --import tsx scripts/check-cost-range-picker.mts
node --import tsx scripts/check-usage-calendar.mts
node --import tsx scripts/check-history-range-picker.mts
node --import tsx scripts/check-history.mts
```

Review156 remains the latest runnable native ZIP and contains source155. It excludes source157 project chips, source158 ratio paint/precision and source159 calendar controls. Native packaging, physical tray/monitors, performance, customer/provider acceptance and two-version migration/rollback were not rerun here. Remaining visual, motion and blueprint obligations still require the full audit. Main and unrelated work are preserved.
