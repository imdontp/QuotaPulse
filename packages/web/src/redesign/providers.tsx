import { useEffect, useState } from 'react';
import { Cloud, RefreshCw } from 'lucide-react';
import { isExpired, primaryLimits, windowRank, type WindowReadings } from '@/format';
import { api, type AccountState, type Limit, type Overview, type QuotaFreshness, type SourceStatus, type SubscriptionStatus } from '@/api';
import { useI18n, useT } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { useLiveRefresh, useRefreshStatus } from '@/lib/use-live';
import { useTheme } from '@/lib/use-theme';
import { RedesignShell } from './shell';
import './providers.css';

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
  return { owner: params.get('owner'), window: params.get('window') };
}
function ownerKey(limit: Limit) { return limit.subscription_key ?? limit.account_key ?? `source:${limit.source_id}`; }

export function ProductionProviders() {
  const t = useT();
  const f = useFormat();
  const { lang, setLang } = useI18n();
  const [theme, toggleTheme] = useTheme();
  const [route, setRoute] = useState(routeState);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useRefreshStatus();
  useEffect(() => {
    const sync = () => { if (location.hash.slice(1).split('?')[0] === 'providers') setRoute(routeState()); };
    addEventListener('hashchange', sync);
    return () => removeEventListener('hashchange', sync);
  }, []);
  const update = (patch: Partial<typeof route>) => {
    const next = { ...route, ...patch };
    const params = new URLSearchParams();
    if (next.owner) params.set('owner', next.owner);
    if (next.window) params.set('window', next.window);
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
  const selected = cards.find(card => card.key === route.owner) ?? cards[0];
  const kinds = [...new Set(allReadings.map(({ primary }) => primary.window_kind))].sort((a, b) => windowRank(a) - windowRank(b));
  const kind = route.window && kinds.includes(route.window) ? route.window : kinds[0];
  const comparable = cards.map(card => ({ card, reading: card.readings.find(({ primary }) => primary.window_kind === kind)?.primary })).filter(({ reading }) =>
    reading && reading.used_percent !== null && !isExpired(reading, now) && reading.last_seen_at <= now) as Array<{ card: OwnerCard; reading: Limit }>;
  const excluded = cards.length - comparable.length;
  const stateLabel = (state: AccountState) => t(state === 'active' ? 'redesign.providerActive' : state === 'stale' ? 'redesign.providerStale' : state === 'inactive' ? 'redesign.providerInactive' : state === 'waiting' ? 'redesign.providerWaiting' : 'redesign.providerUnavailable');
  const freshnessLabel = (freshness: QuotaFreshness) => t(({ live: 'redesign.providerFreshLive', recent: 'redesign.providerFreshRecent', stale: 'redesign.providerFreshStale', expired: 'redesign.providerFreshExpired', mixed: 'redesign.providerFreshMixed', unknown: 'redesign.providerFreshUnknown' } as const)[freshness]);
  const age = (at: number | null) => at === null || at > now ? t('redesign.unknownValue') : f.age((now - at) / 1000);
  const date = (at: number | null) => at === null || at > now ? t('redesign.unknownValue') : f.clock(at);
  const used = (reading: Limit) => reading.used_percent === null || isExpired(reading, now) || reading.last_seen_at > now ? null : reading.used_percent;
  const manageHref = (card: OwnerCard) => card.subscription ? `#settings?subscription=${encodeURIComponent(card.key)}` : `#health?source_id=${card.sources[0]?.source_id ?? ''}`;

  return <RedesignShell active="providers" theme={theme} language={lang} onTheme={toggleTheme} onLanguage={() => setLang(lang === 'en' ? 'th' : 'en')} t={t} testId="production-providers">
    <header className="qp-provider-header"><div><h1><Cloud size={24}/>{t('redesign.providerHeading')}</h1><p>{t('redesign.providerSubtitle')}</p></div><button onClick={() => void refresh.refreshNow()} disabled={refresh.refreshing}><RefreshCw size={16}/>{t('app.refreshNow')}</button></header>
    {error && <p className="qp-provider-error" role="status">{t('redesign.staleSnapshot')} · {error}</p>}
    {!overview ? <p className="qp-panel" role="status">{error ?? t('app.loading')}</p> : cards.length === 0 ? <p className="qp-panel">{t('redesign.providerNoAccounts')}</p> : <>
      <section className="qp-provider-grid" aria-label={t('redesign.providerHeading')}>{cards.map(card => <article key={card.key} className="qp-panel qp-provider-card" data-selected={selected?.key === card.key}>
        <div className="qp-provider-card-head"><button onClick={() => update({ owner: card.key })}><Cloud size={19}/><span>{card.title}</span></button><span className="qp-provider-state">{card.sources.length > 0 && card.sources.every(source => !source.enabled) ? t('redesign.providerInactive') : stateLabel(card.state)}</span></div>
        <p className="qp-provider-linked">{t('redesign.providerLinked')}: {card.linked.join(', ') || t('redesign.unknownValue')}</p>
        {card.hidden && <p className="qp-provider-hidden">{t('redesign.providerHidden')}</p>}
        <div className="qp-provider-windows">{card.readings.length === 0 ? <p>{t('redesign.providerNoQuota')}</p> : card.readings.map(({ primary }) => {
          const value = used(primary);
          return <div key={primary.window_kind} title={`${primary.origin} · ${age(primary.observed_at)} · ${date(primary.resets_at)}`}><span>{f.window(primary.window_kind)}</span><strong>{value === null ? t('redesign.providerUnavailable') : f.pct(value)}</strong><span className="qp-bar"><span style={{ width: `${value ?? 0}%` }}/></span><small>{value === null ? t(isExpired(primary, now) ? 'redesign.providerExpired' : 'redesign.providerNoQuota') : `${t('redesign.providerReset')}: ${f.countdown(primary.resets_at, now)}`}</small></div>;
        })}</div>
        <footer><span>{card.sources.length} {t('redesign.providerReader')}</span><a href={manageHref(card)}>{card.subscription ? t('redesign.providerManage') : t('redesign.providerDiagnostics')}</a></footer>
      </article>)}</section>
      {selected && <section className="qp-panel qp-provider-detail" aria-label={t('redesign.providerDetails')}><div className="qp-provider-section-head"><h2>{t('redesign.providerDetails')}: {selected.title}</h2><a href={manageHref(selected)}>{selected.subscription ? t('redesign.providerManage') : t('redesign.providerDiagnostics')}</a></div>
        <p>{t('redesign.providerLinked')}: {selected.linked.join(', ') || t('redesign.unknownValue')}</p>
        {selected.readings.length === 0 ? <p>{t('redesign.providerNoQuota')}</p> : <div className="qp-provider-detail-windows">{selected.readings.map(({ primary, superseded }) => <div key={primary.window_kind}><h3>{f.window(primary.window_kind)} · {used(primary) === null ? t('redesign.providerUnavailable') : f.pct(used(primary))}</h3><dl><dt>{t('redesign.providerOrigin')}</dt><dd>{primary.origin}</dd><dt>{t('redesign.providerObserved')}</dt><dd>{date(primary.observed_at)} · {age(primary.observed_at)}</dd><dt>{t('redesign.providerConfirmed')}</dt><dd>{date(primary.last_seen_at)} · {age(primary.last_seen_at)}</dd><dt>{t('redesign.providerReset')}</dt><dd>{date(primary.resets_at)}</dd></dl>{superseded.length > 0 && <details><summary>{t('redesign.providerOtherReaders')} ({superseded.length})</summary><ul>{superseded.map(reader => <li key={`${reader.source_id}-${reader.origin}`}>{reader.display_name} · {reader.origin} · {date(reader.observed_at)}</li>)}</ul></details>}</div>)}</div>}
      </section>}
      <div className="qp-provider-bottom">
        <section className="qp-panel qp-provider-comparison"><div className="qp-provider-section-head"><h2>{t('redesign.providerComparison')}</h2>{kinds.length > 0 && <label>{t('redesign.projectRange')}<select value={kind} onChange={event => update({ window: event.target.value })}>{kinds.map(value => <option key={value} value={value}>{f.window(value)}</option>)}</select></label>}</div><p className="qp-footnote">{t('redesign.providerComparisonNote')}</p>
          {comparable.length === 0 ? <p>{t('redesign.providerNoComparison')}</p> : <ol>{comparable.map(({ card, reading }) => <li key={card.key}><span>{card.title}</span><span className="qp-bar"><span style={{ width: `${Math.max(0, Math.min(100, reading.used_percent ?? 0))}%` }}/></span><strong>{f.pct(reading.used_percent)}</strong></li>)}</ol>}
          <p className="qp-footnote">{excluded} {t('redesign.providerExcluded')}</p>
        </section>
        <section className="qp-panel qp-provider-health"><h2>{t('redesign.providerReaderHealth')}</h2><p className="qp-footnote">{t('redesign.providerReaderNote')}</p><div className="qp-provider-table"><table><thead><tr><th>{t('redesign.providerReader')}</th><th>{t('redesign.providerOwner')}</th><th>{t('redesign.providerState')}</th><th>{t('redesign.providerFreshness')}</th><th>{t('redesign.providerAge')}</th><th>{t('redesign.providerSamples')}</th></tr></thead><tbody>{overview.sourceStatus.map(source => <tr key={source.source_id}><td>{source.display_name}<small>{source.harness}/{source.profile}</small></td><td>{cards.find(card => card.sources.some(item => item.source_id === source.source_id))?.title ?? t('redesign.unknownValue')}</td><td>{source.enabled ? stateLabel(source.account_state) : t('redesign.providerInactive')}</td><td>{freshnessLabel(source.telemetry.freshness)}</td><td>{age(source.last_limit_at)}</td><td>{source.limit_samples}</td></tr>)}</tbody></table></div></section>
      </div>
    </>}
  </RedesignShell>;
}
