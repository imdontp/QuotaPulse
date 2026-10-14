import type { ReactNode } from 'react';
import { Activity, ArrowRight, ArrowUpRight, CircleGauge, GitBranch, RefreshCw, Sparkles } from 'lucide-react';
import type { RedesignTranslate } from './shell';

export interface OverviewInitialState {
  kind: 'loading' | 'error';
  label: string;
  detail?: string;
  retryLabel: string;
  retrying: boolean;
  onRetry: () => void;
}

/** Static layout slots, never an empty usage/quota snapshot or observed records. */
function Slots({ count = 3 }: { count?: number }) {
  return <div className="qp-initial-slots" aria-hidden="true">{Array.from({ length: count }, (_, index) => <span key={index}/>)}</div>;
}

export function OverviewPendingRegions({ state, t, periodControl, historyHref }: {
  state: OverviewInitialState;
  t: RedesignTranslate;
  periodControl?: ReactNode;
  historyHref: string;
}) {
  const busy = state.kind === 'loading';
  const region = { 'data-overview-initial-state': state.kind, 'aria-busy': busy } as const;
  return <>
    <div className="qp-hero-grid">
      <section className="qp-panel qp-hero" data-loading-region="core" aria-label={t('redesign.core')} {...region}>
        <div className="qp-section-heading"><div className="qp-hero-heading-copy"><h2><Activity size={18} aria-hidden="true"/><span className="qp-overview-heading-title">{t('redesign.core')}</span></h2><small className="qp-hero-tagline">{t('redesign.coreSubtitle')}</small></div>{periodControl}</div>
        <div className="qp-core-grid">
          <div className="qp-metrics">{(['redesign.tokenUsage', 'redesign.averageTokenPace', 'redesign.knownCost', 'redesign.cacheSaving'] as const).map(label => <div className="qp-metric-rail" key={label}><i className="qp-metric-rail-icon" aria-hidden="true"/><div className="qp-metric-rail-copy"><span className="qp-metric-rail-label">{t(label)}</span><Slots count={2}/></div></div>)}</div>
          <div className="qp-pulse qp-initial-core"><div className="qp-initial-core-frame" aria-hidden="true"/><div className="qp-initial-status"><p role="status">{state.label}</p>{state.kind === 'error' && <>{state.detail && <p className="qp-footnote">{state.detail}</p>}<button onClick={state.onRetry} disabled={state.retrying}><RefreshCw size={14} aria-hidden="true"/>{state.retryLabel}</button></>}</div></div>
          <section className="qp-top-models" aria-label={t('redesign.topModelsByTokens')}><h3>{t('redesign.topModelsByTokens')}</h3><div className="qp-top-model-list">{Array.from({ length: 5 }, (_, index) => <div className="qp-initial-model-row" key={index} aria-hidden="true"><span className="qp-initial-model-identity"><i/><span/></span><span className="qp-initial-model-share"/><span className="qp-initial-model-bar"/></div>)}</div></section>
        </div>
        <div className="qp-hero-notes"><p className="qp-footnote">{t('redesign.scope')}</p></div>
      </section>
      <section className="qp-panel qp-quotas" data-loading-region="quotas" aria-label={t('redesign.windows')} {...region}>
        <div className="qp-quotas-heading"><h2><CircleGauge size={18} aria-hidden="true"/>{t('redesign.windows')}</h2><a className="qp-quota-manage" href="#providers">{t('redesign.manage')} <ArrowRight size={14} aria-hidden="true"/></a></div>
        <div className="qp-initial-quota-space"><Slots count={6}/></div>
      </section>
    </div>
    <section className="qp-panel qp-runtime" id="runtime" data-loading-region="runtime" aria-label={t('redesign.liveRuntimeMap')} {...region}>
      <div className="qp-section-heading"><div className="qp-runtime-heading-main"><h2><GitBranch size={18} aria-hidden="true"/><span className="qp-overview-heading-title">{t('redesign.liveRuntimeMap')}</span></h2><p>{t('redesign.connections')}</p></div></div>
      <div className="qp-map-scroll"><div className="qp-map qp-initial-map" aria-hidden="true">{(['redesign.runtimeProjectHeading','redesign.runtimeHarnessHeading','redesign.runtimeProviderHeading','redesign.runtimeModelHeading'] as const).map(label => <div className="qp-map-column" key={label}><h3>{t(label)}</h3><Slots/></div>)}</div></div>
      <div className="qp-footnote" aria-hidden="true"><Slots count={1}/></div>
    </section>
    <div className="qp-bottom-grid">
      <section className="qp-panel qp-runway" data-loading-region="runway" aria-label={t('redesign.runway')} {...region}><div className="qp-runway-heading"><h2><CircleGauge size={18} aria-hidden="true"/><span className="qp-overview-heading-title">{t('redesign.runway')}</span></h2><span className="qp-runway-subtitle">{t('redesign.runwaySubtitle')}</span></div><Slots/></section>
      <section className="qp-panel qp-insights" data-loading-region="insights" aria-label={t('redesign.insights')} {...region}><div className="qp-insights-heading"><h2><Sparkles size={18} aria-hidden="true"/><span className="qp-overview-heading-title">{t('redesign.insights')}</span></h2><span className="qp-insights-subtitle">{t('redesign.insightsSubtitle')}</span></div><div className="qp-insight-grid">{Array.from({length:4}, (_, index) => <div className="qp-insight-card" key={index} aria-hidden="true"><Slots count={2}/></div>)}</div></section>
    </div>
    <section className="qp-panel qp-activity" data-loading-region="activity" aria-label={t('redesign.liveActivity')} {...region}>
      <div className="qp-section-heading"><h2><Activity size={18} aria-hidden="true"/>{t('redesign.liveActivity')}<small className="qp-activity-chart-label">{t('redesign.activityWindow')}</small></h2><div className="qp-activity-actions"><a href={historyHref}>{t('redesign.viewAllActivity')} <ArrowUpRight size={14} aria-hidden="true"/></a></div></div>
      <div className="qp-activity-list" aria-hidden="true">{Array.from({length:4}, (_, index) => <div key={index}><Slots count={2}/></div>)}</div>
    </section>
  </>;
}
