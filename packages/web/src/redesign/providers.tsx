import { useEffect, useState, type CSSProperties } from 'react';
import { Activity, Cloud, RefreshCw, ShieldCheck } from 'lucide-react';
import { HarnessIcon } from '@/components/harness-icon';
import { VendorIcon } from '@/components/vendor-icon';
import { isExpired, primaryLimits, windowRank, type WindowReadings } from '@/format';
import { api, type AccountState, type Limit, type Overview, type QuotaFreshness, type SourceStatus, type SubscriptionStatus } from '@/api';
import { useI18n, useT } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { useLiveRefresh, useRefreshStatus } from '@/lib/use-live';
import { useTheme } from '@/lib/use-theme';
import { RedesignShell } from './shell';
import './providers.css';
import { SectionMark } from './section-mark';

interface OwnerCard {
  key: string;
  title: string;
  state: AccountState;
  subscription: SubscriptionStatus | null;
  sources: SourceStatus[];
  linked: string[];
  readings: Array<WindowReadings<Limit>>;
  hidden: boolean;
}
function routeState() {
  const params = new URLSearchParams(location.hash.split('?')[1] ?? '');
  const source = Number(params.get('source') ?? params.get('source_id'));
  return { owner: params.get('owner'), window: params.get('window'), section: params.get('section'), source: Number.isSafeInteger(source) && source > 0 ? source : null };
}
function ownerKey(limit: Limit) { return limit.subscription_key ?? limit.account_key ?? `source:${limit.source_id}`; }

export function ProductionProviders() {
  const t = useT();
  const f = useFormat();
  const { lang, setLang } = useI18n();
  const [theme, toggleTheme] = useTheme();
  const [route, setRoute] = useState(routeState);
  const [inspectorOpen, setInspectorOpen] = useState(Boolean(route.owner || route.source));
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useRefreshStatus();
  useEffect(() => {
    const sync = () => { if (location.hash.slice(1).split('?')[0] === 'providers') { const next = routeState(); setRoute(next); if (next.owner || next.source) setInspectorOpen(true); } };
    addEventListener('hashchange', sync);
    return () => removeEventListener('hashchange', sync);
  }, []);
  const update = (patch: Partial<typeof route>) => {
    const next = { ...route, ...patch };
    if (patch.owner || patch.source) setInspectorOpen(true);
    const params = new URLSearchParams();
    if (next.owner) params.set('owner', next.owner);
    if (next.window) params.set('window', next.window);
    if (next.section) params.set('section', next.section);
    if (next.source) params.set('source', String(next.source));
    history.replaceState(null, '', `${location.pathname}${location.search}#providers${params.size ? `?${params}` : ''}`);
    setRoute(next);
  };
  useLiveRefresh(async () => {
    try { setOverview(await api.overview()); setError(null); }
    catch (cause) { setError(String(cause)); throw cause; }
  }, []);
  const now = overview?.now ?? Date.now();
  const allReadings = overview ? primaryLimits(overview.limits, now) : [];
  const cards: OwnerCard[] = overview ? [
    ...overview.subscriptions.map(subscription => {
      const key = subscription.subscription_key;
      return { key, title: subscription.subscription_display_name, state: subscription.state,
        subscription, sources: overview.sourceStatus.filter(source => source.account_key === key || source.account_key === subscription.account_key),
        linked: [...new Set(subscription.owners.map(owner => `${owner.harness}/${owner.profile}`))],
        readings: allReadings.filter(({ primary }) => ownerKey(primary) === key),
        hidden: overview.settings.hidden_subscriptions.includes(key) };
    }),
    ...overview.sourceStatus.filter(source => source.account_key === null).map(source => ({
      key: `source:${source.source_id}`, title: source.display_name, state: source.account_state,
      subscription: null, sources: [source], linked: [`${source.harness}/${source.profile}`],
      readings: allReadings.filter(({ primary }) => ownerKey(primary) === `source:${source.source_id}`), hidden: false,
    })),
  ] : [];
  const selected = cards.find(card => card.key === route.owner) ?? cards.find(card => card.sources.some(source => source.source_id === route.source)) ?? cards[0];
  const loaded = overview !== null;
  useEffect(() => {
    if (loaded && route.section === 'quotas') document.getElementById('provider-quotas')?.scrollIntoView({ block: 'start' });
  }, [loaded, route.section]);
  const kinds = [...new Set(allReadings.map(({ primary }) => primary.window_kind))].sort((a, b) => windowRank(a) - windowRank(b));
  const kind = route.window && kinds.includes(route.window) ? route.window : kinds.includes('monthly') ? 'monthly' : kinds[0];
  const comparable = cards.map(card => ({ card, reading: card.readings.find(({ primary }) => primary.window_kind === kind)?.primary })).filter(({ reading }) =>
    reading && reading.used_percent !== null && !isExpired(reading, now) && reading.last_seen_at <= now) as Array<{ card: OwnerCard; reading: Limit }>;
  const excluded = cards.length - comparable.length;
  const stateLabel = (state: AccountState) => t(state === 'active' ? 'redesign.providerActive' : state === 'stale' ? 'redesign.providerStale' : state === 'inactive' ? 'redesign.providerInactive' : state === 'waiting' ? 'redesign.providerWaiting' : 'redesign.providerUnavailable');
  const freshnessLabel = (freshness: QuotaFreshness) => t(({ live: 'redesign.providerFreshLive', recent: 'redesign.providerFreshRecent', stale: 'redesign.providerFreshStale', expired: 'redesign.providerFreshExpired', mixed: 'redesign.providerFreshMixed', unknown: 'redesign.providerFreshUnknown' } as const)[freshness]);
  const age = (at: number | null) => at === null || at > now ? t('redesign.unknownValue') : f.age((now - at) / 1000);
  const date = (at: number | null, futureAllowed = false) => at === null || !Number.isFinite(at) || (!futureAllowed && at > now) ? t('redesign.unknownValue') : f.clock(at);
  const used = (reading: Limit) => reading.used_percent === null || isExpired(reading, now) || reading.last_seen_at > now ? null : reading.used_percent;
  const manageHref = (card: OwnerCard) => card.subscription ? `#settings?subscription=${encodeURIComponent(card.key)}` : `#settings?section=diagnostics&source=${card.sources[0]?.source_id ?? ''}`;

  return <RedesignShell active="providers" theme={theme} language={lang} onTheme={toggleTheme} onLanguage={() => setLang(lang === 'en' ? 'th' : 'en')} t={t} testId="production-providers">
    <header className="qp-provider-header"><div><h1><span className="qp-provider-heading-icon" aria-hidden="true"><Cloud size={26}/></span>{t('redesign.providerHeading')}</h1><p>{t('redesign.providerSubtitle')}</p></div><button onClick={() => void refresh.refreshNow()} disabled={refresh.refreshing}><RefreshCw size={16}/>{t('app.refreshNow')}</button></header>
    {error && <p className="qp-provider-error" role="status">{t('redesign.staleSnapshot')} · {error}</p>}
    {!overview ? <p className="qp-panel" role="status">{error ?? t('app.loading')}</p> : cards.length === 0 ? <p className="qp-panel">{t('redesign.providerNoAccounts')}</p> : <>
      <section className="qp-provider-grid" aria-label={t('redesign.providerHeading')}>{cards.map(card => <article key={card.key} className="qp-panel qp-provider-card" data-vendor={card.subscription?.provider ?? card.sources[0]?.vendor ?? 'unknown'} data-has-quota={card.readings.length > 0} data-selected={selected?.key === card.key}>
        <div className="qp-provider-card-head"><button aria-pressed={selected?.key === card.key} onClick={() => update({ owner: card.key })}><span className="qp-provider-icon" aria-hidden="true"><VendorIcon vendor={card.subscription?.provider ?? card.sources[0]?.vendor ?? 'unknown'}/></span><span>{card.title}</span></button><span className="qp-provider-state" data-state={card.sources.length > 0 && card.sources.every(source => !source.enabled) ? 'inactive' : card.state}>{card.sources.length > 0 && card.sources.every(source => !source.enabled) ? t('redesign.providerInactive') : stateLabel(card.state)}</span></div>
        <p className="qp-provider-linked">{t('redesign.providerLinked')}: {card.linked.join(', ') || t('redesign.unknownValue')}</p>
        {card.hidden && <p className="qp-provider-hidden">{t('redesign.providerHidden')}</p>}
        <div className="qp-provider-windows">{card.readings.length === 0 ? <p>{t('redesign.providerNoQuota')}</p> : card.readings.map(({ primary }) => {
          const value = used(primary);
          return <div key={primary.window_kind} data-window-kind={primary.window_kind} title={`${primary.origin} · ${age(primary.observed_at)} · ${date(primary.resets_at, true)}`}><span>{f.window(primary.window_kind)}</span><strong>{value === null ? t('redesign.providerUnavailable') : f.pct(value)}</strong><span className="qp-bar"><span style={{ width: `${value ?? 0}%` }}/></span><small>{value === null ? t(isExpired(primary, now) ? 'redesign.providerExpired' : 'redesign.providerNoQuota') : `${t('redesign.providerReset')}: ${f.countdown(primary.resets_at, now)}`}</small></div>;
        })}</div>
        <footer><span>{card.sources.length} {t('redesign.providerReader')}</span><a href={manageHref(card)}>{card.subscription ? t('redesign.providerManage') : t('redesign.providerDiagnostics')}</a></footer>
      </article>)}</section>
      {selected && <details className="qp-provider-inspector" open={inspectorOpen} onToggle={event => setInspectorOpen(event.currentTarget.open)}><summary>{t('redesign.providerDetails')}: {selected.title}</summary><section className="qp-panel qp-provider-detail" aria-label={t('redesign.providerDetails')}><div className="qp-provider-section-head"><h2>{t('redesign.providerDetails')}: {selected.title}</h2><a href={manageHref(selected)}>{selected.subscription ? t('redesign.providerManage') : t('redesign.providerDiagnostics')}</a></div>
        <p>{t('redesign.providerLinked')}: {selected.linked.join(', ') || t('redesign.unknownValue')}</p>
        {selected.readings.length === 0 ? <p>{t('redesign.providerNoQuota')}</p> : <div className="qp-provider-detail-windows">{selected.readings.map(({ primary, superseded }) => <div key={primary.window_kind}><h3>{f.window(primary.window_kind)} · {used(primary) === null ? t('redesign.providerUnavailable') : f.pct(used(primary))}</h3><dl><dt>{t('redesign.providerOrigin')}</dt><dd>{primary.origin}</dd><dt>{t('redesign.providerObserved')}</dt><dd>{date(primary.observed_at)} · {age(primary.observed_at)}</dd><dt>{t('redesign.providerConfirmed')}</dt><dd>{date(primary.last_seen_at)} · {age(primary.last_seen_at)}</dd><dt>{t('redesign.providerReset')}</dt><dd>{date(primary.resets_at, true)}</dd></dl>{superseded.length > 0 && <details><summary>{t('redesign.providerOtherReaders')} ({superseded.length})</summary><ul>{superseded.map(reader => <li key={`${reader.source_id}-${reader.origin}`}>{reader.display_name} · {reader.origin} · {date(reader.observed_at)}</li>)}</ul></details>}</div>)}</div>}
      </section></details>}
      <div className="qp-provider-bottom">
        <section id="provider-quotas" className="qp-panel qp-provider-comparison"><div className="qp-provider-section-head"><h2><SectionMark icon={<Activity/>}/>{t('redesign.providerComparison')}</h2>{kinds.length > 0 && <label>{t('redesign.projectRange')}<select value={kind} onChange={event => update({ window: event.target.value })}>{kinds.map(value => <option key={value} value={value}>{f.window(value)}</option>)}</select></label>}</div><p className="qp-footnote">{t('redesign.providerComparisonNote')}</p>
          {comparable.length === 0 ? <p>{t('redesign.providerNoComparison')}</p> : <div className="qp-provider-comparison-chart"><div className="qp-provider-axis" aria-hidden="true">{[100, 75, 50, 25, 0].map(value => <span key={value} style={{ top: `${100 - value}%` }}>{f.pct(value)}</span>)}</div><ol>{comparable.map(({ card, reading }) => <li key={card.key}><button aria-pressed={selected?.key === card.key} onClick={() => update({ owner: card.key })}><span aria-hidden="true"><VendorIcon vendor={card.subscription?.provider ?? card.sources[0]?.vendor ?? 'unknown'}/></span><span className="qp-provider-comparison-name">{card.title}</span></button><span className="qp-bar" aria-hidden="true" style={{ '--qp-quota-used': `${Math.max(0, Math.min(100, reading.used_percent ?? 0))}%` } as CSSProperties}><span/></span><strong style={{ '--qp-value-top': `${144 * (1 - Math.max(0, Math.min(100, reading.used_percent ?? 0)) / 100)}px` } as CSSProperties}>{f.pct(reading.used_percent)}</strong></li>)}</ol></div>}
          <p className="qp-footnote">{excluded} {t('redesign.providerExcluded')}</p>
        </section>
        <section className="qp-panel qp-provider-health"><h2><SectionMark icon={<ShieldCheck/>}/>{t('redesign.providerReaderHealth')}</h2><p className="qp-footnote">{t('redesign.providerReaderNote')}</p><div className="qp-provider-table"><table><thead><tr><th>{t('redesign.providerReader')}</th><th>{t('redesign.providerOwner')}</th><th>{t('redesign.providerState')}</th><th>{t('redesign.providerFreshness')}</th><th>{t('redesign.providerAge')}</th><th>{t('redesign.providerSamples')}</th></tr></thead><tbody>{overview.sourceStatus.map(source => <tr key={source.source_id}><td><span className="qp-provider-reader-identity"><HarnessIcon harness={source.harness} vendor={overview.harnesses.find(harness => harness.harness === source.harness)?.vendor}/>{source.display_name}</span><small>{source.harness}/{source.profile}</small></td><td>{cards.find(card => card.sources.some(item => item.source_id === source.source_id))?.title ?? t('redesign.unknownValue')}</td><td>{source.enabled ? stateLabel(source.account_state) : t('redesign.providerInactive')}</td><td><span className="qp-provider-freshness" data-freshness={source.telemetry.freshness}>{freshnessLabel(source.telemetry.freshness)}</span></td><td>{age(source.last_limit_at)}</td><td>{source.limit_samples}</td></tr>)}</tbody></table></div></section>
      </div>
    </>}
  </RedesignShell>;
}
