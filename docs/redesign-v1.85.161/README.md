# Actual Cost summary charts / source161

[Original / source160 / current gallery](review.html) · [Current Cost](after/cost.png) · [Native-basis fixture](images/en-dark-1672-native.png) · [Thai mobile fixture](images/th-light-390-api.png) · [Targeted blueprint audit](audit.md) · [Latest native ZIP review156](../redesign-v1.85.156/README.md)

Cost now has three real summary sparklines: known value by recorded interval, cumulative known value per elapsed24h, and cumulative known value per1K priced tokens. The latter two fill the reference's blue/cyan chart slots using actual selected-basis facts. They are explicitly labelled cumulative. The projected-month card remains Unknown with its existing reason; no missing forecast or concept curve is fabricated. Reference color sampling records the representative blue/cyan accents and nearest original pixels rather than asserting an exact match to every glow pixel.

An interval containing calls with no price is now a gap in the amount sparkline. A truly priced zero and a reporting interval with no calls remain zero. Cumulative monetary averages retain known-value lower bounds and call-weighted coverage. Per1K uses only the cumulative priced-token denominator, not all tokens or a mean of bucket ratios; its priced-subset quotient has no misleading+ suffix. Native/API facts stay separate. The final interval ends at the exact selected exclusive bound. Partial periods shorter than24h have no daily average. Ranges extending beyond the API snapshot have no elapsed average and explain why. A complete elapsed range with no calls has a zero average; no priced-token denominator stays Unknown.

Point titles use the current currency, exact covered-call counts and localized dates. Their numeric descriptions are also bound to the SVG's aria-describedby. The existing ObservedTrend defaults and other callers retain their formatting. No new request, dependency, schema, reader, credential, execution control, pet or popup behavior is added.

## Validation

Validated: production build;363 web tests including10 new calculation tests;24 compiled monetary cases; full existing dashboard integration including144 responsive cases; and the existing legacy/UI suite, including popup/hidden-subscription compatibility. Final integration ran with frozen source and no HMR updates. The focused cases cover EN/TH, dark/light,390/900/1280/1672 widths, USD/THB at37.25, API/native values, a partial final interval, unknown versus priced-zero samples, separate bases, exact cumulative denominators, accessible descriptions, four future and four empty-range checks. They use owned in-memory SQLite and real local HTTP, with no external request or customer data.

The controlled fixture has1100 tokens and15 weighted calls: API values2+6+0 with500 priced tokens and6 priced calls; native value4 with400 priced tokens and4 priced calls; five unpriced calls. API cumulative daily values are2,1,8/3,8/3.5 and per1K values20,20,20,16. The native amount has one known point, cumulative daily4/3 then4/3.5, and per1K10 then10. Future-selected time does not dilute an elapsed average. Zero-usage periods do not turn into missing-price periods.

The original compiled source160 reproduces the unpriced-interval defect as actual[2,0,6,0] versus expected[2,6,0]; its failed log and full frame are retained. A developmental integration run with live module reloads recorded useI18n provider errors. A separate legacy/UI attempt timed out on its initial10-second page load. Both failures remain in evidence; the same unrelaxed assertions pass in the final frozen runs. No production causal fix is claimed for those development/startup failures.

All eight current canonical within-context pairs are byte-identical. Cost changes are confined to502,236–1171,294 in the new summary charts. Five other full frames are byte-identical to source160. History and Providers each retain105 unexplained global-search-header pixels with maximum channel delta4; those full frames and differences remain unmasked. Earlier candidate reports are historical, not replacement baselines. No99–100% approval or whole-image similarity percentage is claimed.

```powershell
npm.cmd run build -w @quotapulse/web
npm.cmd run test -w @quotapulse/web
node --import tsx scripts/check-cost-summary-trends.mts
node --import tsx scripts/check-history.mts
npm.cmd run test:ui
```

Review156 remains the latest runnable native ZIP, containing source155 and excluding source157–161 changes. No native packaging, physical tray/monitor, broad performance/customer-provider or two-version migration/rollback acceptance was rerun here. Main and unrelated work are preserved; the full project remains open.
