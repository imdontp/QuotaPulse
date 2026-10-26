# Bounded Cost timeline / source162

[Canonical Cost](cost-canonical.png) · [Long-range Cost](cost-long-range.png) · [Original Cost concept](../redesign-v1.85.161/refs/cost.png) · [Delivery evidence](delivery.json)

Long explicit Cost ranges now render at most 240 intervals. The daemon accepts optional `max_buckets` (integer 1–1000) and aggregates complete adjacent requested intervals; totals, rankings, source/date scope and monetary bases remain unchanged. Prior clients omitting the option retain their original response shape and interval cardinality. The browser also bounds materialization for older server responses, sums every supplied fact and discloses the actual coarser interval in both the chart and its accessible data table. Narrowing the range restores the original interval. Dense bars no longer enforce a two-pixel minimum that overflows their plot.

Validated: 703 repository tests (134 daemon, 371 web, 198 tray), both builds, 13 new boundary tests, 32 API/native browser cases across EN/TH, dark/light and 390/900/1280/1672 widths, 24 compiled monetary-summary regression cases, full dashboard integration and the legacy/UI suite. The focused checks reconcile amount, tokens and weighted calls with exact selected-scope totals, keyboard Home/End/Escape, accessible interval disclosure, short-range restoration and matching History navigation. Date-limit cases allocate only 240 dense slots. These checks bound response/render cardinality; they are not broad throughput/CPU/customer-scale performance certification.

The retained older review156/source155 build reproduced 482 dense slots for the explicit hourly scope. Its failed check and full screenshot remain in evidence. Copied text evidence normalizes line endings and trailing whitespace; original logs remain in local tmp. Earlier driver/instrumentation and ENOSPC attempts remain there too; successful final checks do not establish a production causal fix for those environmental failures.

All eight current canonical repeat pairs match byte-for-byte. Canonical Cost is unchanged from source161, as are five other full frames. History differs in 418 filter-text pixels (maximum channel delta 231); Providers retains 105 unexplained search-header pixels (maximum delta 4). The unmasked comparison is retained in evidence. No new approved baseline, whole-screen similarity percentage or 99–100% visual acceptance is asserted.

Commands:

```powershell
node --import tsx scripts/check-cost-resolution.mts
node --import tsx scripts/check-cost-summary-trends.mts
node --import tsx scripts/check-history.mts
npm.cmd run test:ui
```

This completes the bounded Cost materialization item from source161's audit, within GAP-006/018/020. Those gaps remain open at full-project scope. Remaining work includes the full art/typography/control/motion inventory against all eight original concepts and explicit overrides, named visual acceptance, current native review delivery, performance evidence, desktop/monitor and customer/provider checks, and current RC/two-version rollback acceptance. Monthly projection eligibility remains unverified and its safe Unknown state is retained.

Workspace consolidation retired historical validation checkouts; all source tags remain available. Continue in the existing `design/redesign-foundation` worktree. Retained native ZIPs are centralized under the repository root's `tmp/releases`; review156/source155 predates source157–162. No new native artifact is claimed by this source checkpoint.
