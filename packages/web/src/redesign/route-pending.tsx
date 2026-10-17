import type { ReactNode } from 'react';
import type { useT } from '@/i18n';
import { InitialRegion, type InitialRegionState } from './initial-region';

type Translate = ReturnType<typeof useT>;
type Label = Parameters<Translate>[0];
export type PendingPage = 'live' | 'projects' | 'providers' | 'models' | 'cost' | 'history' | 'alerts' | 'settings';

const headings = {
  live: 'redesign.liveHeading', projects: 'redesign.projectHeading', providers: 'redesign.providerHeading',
  models: 'redesign.modelsHeading', cost: 'redesign.costHeading', history: 'redesign.history',
  alerts: 'redesign.alertHeading', settings: 'settings.pageTitle',
} as const;

/** Eager geometry only. These slots describe regions, never observed entities or values. */
export function RoutePendingRegions({ page, state, t }: { page: PendingPage; state: InitialRegionState; t: Translate }) {
  const region = (id: string, label: Label, size = '', status = false, slots = 3) =>
    <InitialRegion key={id} id={id} label={t(label)} state={state}
      className={`qp-route-pending-region ${size}`} status={status} slots={slots}/>;
  const summary = (prefix: string, labels: readonly Label[]) =>
    <div className="qp-route-pending-summary">{labels.map((label, index) => region(`${prefix}-${index}`, label, 'qp-route-pending-metric', false, 1))}</div>;
  const header = <header className="qp-route-pending-heading"><h1>{t(headings[page])}</h1></header>;
  const layout = (main: ReactNode, rail: ReactNode) => <div className="qp-route-pending-layout">
    <div className="qp-route-pending-main">{main}</div><aside className="qp-route-pending-rail">{rail}</aside>
  </div>;

  const params = new URLSearchParams(location.hash.split('?')[1] ?? '');
  const source = Number(params.get('source') ?? params.get('source_id'));
  const inspectorOpen = Boolean(params.get('owner') || (Number.isSafeInteger(source) && source > 0));
  let content: ReactNode;
  switch (page) {
    case 'live':
      content = <><section className="qp-panel qp-route-pending-top">{header}{summary('live-metric', ['redesign.liveRecentSessions', 'redesign.liveReportingSources', 'redesign.liveStaleSources', 'redesign.liveReaderErrors'])}</section>
        {layout(<>{region('live-sessions', 'redesign.liveSessionTable', 'qp-route-pending-sessions', true, 5)}{region('live-flow', 'redesign.liveChart', 'qp-route-pending-flow', false, 4)}{region('live-feed', 'redesign.liveFeed', 'qp-route-pending-feed', false, 4)}</>,
          <>{region('live-advisories', 'redesign.liveAdvisory', 'qp-route-pending-advisories')}{region('live-matrix', 'redesign.liveMatrix', 'qp-route-pending-matrix', false, 6)}</>)}</>;
      break;
    case 'projects':
      content = <>{header}{layout(<div className="qp-route-pending-cards">{Array.from({ length: 4 }, (_, index) => region(`project-card-${index}`, 'redesign.projectHeading', 'qp-route-pending-project', index === 0, 5))}</div>,
        <>{region('project-details', 'redesign.projectDetails', 'qp-route-pending-project-detail', false, 8)}{region('project-top', 'redesign.projectTop', 'qp-route-pending-project-top', false, 4)}</>)}</>;
      break;
    case 'providers':
      content = <>{header}<div className="qp-route-pending-provider-cards">{Array.from({ length: 4 }, (_, index) => region(`providers-card-${index}`, 'redesign.providerHeading', 'qp-route-pending-provider', index === 0))}</div>
        {region('providers-inspector', 'redesign.providerDetails', `qp-route-pending-inspector${inspectorOpen ? ' qp-route-pending-inspector-open' : ''}`, false, inspectorOpen ? 3 : 0)}
        <div className="qp-route-pending-pair">{region('providers-comparison', 'redesign.providerComparison', 'qp-route-pending-comparison')}{region('providers-health', 'redesign.providerReaderHealth', 'qp-route-pending-health', false, 5)}</div></>;
      break;
    case 'models':
      content = <>{header}{layout(<>{summary('models-summary', ['redesign.modelsCount', 'redesign.modelsTokens', 'redesign.modelsSessions', 'redesign.modelsValue'])}{region('models-comparison', 'redesign.modelsCompare', 'qp-route-pending-model-table', true, 8)}{region('models-providers', 'redesign.modelsProviderDistribution', 'qp-route-pending-model-providers', false, 2)}</>,
        <>{(['redesign.modelsDetails', 'redesign.modelsDistribution', 'redesign.modelsTrend', 'redesign.modelsEffort'] as const).map((label, index) => region(`models-detail-${index}`, label, `qp-route-pending-model-detail-${index}`))}</>)}</>;
      break;
    case 'cost':
      content = <><div className="qp-route-pending-cost-top"><section className="qp-panel qp-route-pending-top">{header}{summary('cost-summary', ['redesign.costTotal', 'redesign.costDaily', 'redesign.costProjection', 'redesign.costPerThousand'])}</section>{region('cost-providers', 'redesign.costProviders', 'qp-route-pending-cost-providers', true)}</div>
        <div className="qp-route-pending-cost-upper">{region('cost-trend', 'redesign.costTrend', 'qp-route-pending-cost-chart')}{region('cost-models', 'redesign.costModels', 'qp-route-pending-cost-chart')}</div>
        <div className="qp-route-pending-cost-lower">{region('cost-projects', 'redesign.costProjects', 'qp-route-pending-cost-table')}{region('cost-sessions', 'redesign.costSessions', 'qp-route-pending-cost-table')}{region('cost-insights', 'redesign.costInsights', 'qp-route-pending-cost-table')}</div></>;
      break;
    case 'history':
      content = <>{header}{layout(<><section className="qp-panel qp-route-pending-history-timeline">{summary('history-summary', ['col.total', 'col.calls', 'history.apiTotal', 'history.effortDistribution'])}{region('history-timeline', 'history.timeline', 'qp-route-pending-history-plot', true)}</section>{region('history-records', 'history.records', 'qp-route-pending-history-records', false, 6)}</>,
        region('history-detail', 'history.detail', 'qp-route-pending-history-detail', false, 6))}</>;
      break;
    case 'alerts':
      content = <>{layout(<><section className="qp-panel qp-route-pending-top">{header}{summary('alert-summary', ['redesign.alertCurrent', 'redesign.alertMonitored', 'redesign.alertRules', 'redesign.alertCoverage'])}</section>{region('alert-chart', 'redesign.alertRiskChart', 'qp-route-pending-alert-chart', true, 5)}{region('alert-risks', 'redesign.alertRisks', 'qp-route-pending-alert-risks', false, 5)}{region('alert-rules', 'redesign.alertThresholdTable', 'qp-route-pending-alert-rules')}</>,
        <>{region('alert-forecast', 'redesign.alertForecastPanel', 'qp-route-pending-alert-forecast', false, 6)}{region('alert-guidance', 'redesign.alertGuidance', 'qp-route-pending-alert-guidance', false, 6)}{region('alert-events', 'redesign.alertHistory', 'qp-route-pending-alert-events')}</>)}</>;
      break;
    case 'settings':
      content = <>{header}<nav className="qp-route-pending-settings-nav" aria-label={t('settings.pageTitle')}>
        <a href="#settings" aria-current={params.get('section') !== 'diagnostics' ? 'page' : undefined}>{t('settings.pageTitle')}</a>
        <a href="#settings?section=diagnostics" aria-current={params.get('section') === 'diagnostics' ? 'page' : undefined}>{t('tab.health')}</a>
      </nav>{params.get('section') === 'diagnostics'
        ? <div className="qp-route-pending-main">{region('settings-adapters', 'health.adapters', 'qp-route-pending-health', true, 5)}{region('settings-coverage', 'health.coverage', 'qp-route-pending-health', false, 5)}</div>
        : <div className="qp-route-pending-settings-grid">{(['settings.display', 'settings.windowSize', 'settings.subscriptions', 'settings.notifications', 'settings.pricing', 'settings.runtime'] as const).map((label, index) => region(`settings-section-${index}`, label, 'qp-route-pending-settings-section', index === 0, 5))}</div>}</>;
  }
  return <div className={`qp-route-pending qp-route-pending-${page}`} data-route-pending={page}>{content}</div>;
}
