# Consolidated Alerts and Live source repair

## Alerts

- Real All/Critical/Warning/Notice/Stale risk filters with counts and aria-pressed. Metadata search and Severity/Last observed sort do not change global current-risk counts or threshold-event history.
- Separate reason, owner/window, historical sparkline, current used percentage and original owner/detail action columns. Reader advisories remain explicitly identified within the same bounded keyboard-scrollable list.
- A shared canonical owner/window cache serves selected chart and up to five other row histories: at most six keys per batch, in-flight deduplication and60s TTL. Existing visible-page refresh coordinates reads; no per-record timer or request effect.
- Generation is invalidated when requested signatures change. Cached ready forecasts require current reading freshness and matching source/origin/last-seen/reset metadata. Reset/hour boundaries invalidate cache freshness immediately.
- Row graphs draw at most256 latest actual samples, preserving null/reset gaps. Accessible source, exact ISO sample range, freshness and displayed/total counts remain available. Unknown-only suffixes show Unknown, without fabricated zero points or an empty-history claim. Full selected sample history remains accessible through the main chart.

## Live

- Desktop plot region118px gives104px actual canvas, restoring the original plotting prominence. Latest recorded Total is first and24px; compact actual values retain precise amounts in title/aria and unchanged raw metadata/table.
- Latest recorded minute, interval, partial-minute disclosure, unknown gaps and three-series scales retain their meaning.
- Desktop footer packs the full breakdown note, visible aggregate/unknown counts and chart-data action into the existing approximately197px panel. Exact per-source exclusions are available inside its keyboard chart-data disclosure; empty chart retains inline facts.
- Original28px section mark retained. Initial24px override failed the independent source gate and was removed; that gate was preserved.

## Evidence and remaining work

Full473 source tests passed before the final CSS-only28px restoration. The final production build, five controlled browser cases and authenticated16×9 responsive workflow passed. The final40-pair capture passed:37 byte-identical and3 within unchanged raster tolerance; all80 PNG hashes independently verified. Nine production routes with5,000 synthetic records passed authenticated summary, precise numeric accessibility and no external/write requests. The old runtime assertion expected unabridged visible History text; it now checks compact display plus exact title/aria and API totals.

Controlled probes are separate from canonical source captures. Repeatability, source diagnostics and these implementation checks do not approve99–100% likeness.

Remaining: original-source geometry/artwork differences across eight pages, approved implementation baseline and final accessibility/desktop/performance/release gates. Six bounded history keys and256 bounded row primitives do not bound backend response payload or the complete selected history; large-history query/response performance remains a required measured review.
