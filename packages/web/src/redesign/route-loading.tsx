import { Component, type ComponentProps, type ReactNode } from 'react';
import { useI18n, useT } from '@/i18n';
import { useTheme } from '@/lib/use-theme';
import { RedesignShell } from './shell';
import { OverviewPendingRegions } from './overview-pending';
import { RoutePendingRegions } from './route-pending';
import './route-loading.css';

type Page = ComponentProps<typeof RedesignShell>['active'];

/** Eager chrome for a deferred route module, without a fabricated data snapshot. */
export function RouteLoadingShell({ page, failed = false }: { page: Page; failed?: boolean }) {
  const t = useT();
  const { lang, setLang } = useI18n();
  const [theme, toggleTheme] = useTheme();
  const retry = () => location.reload();
  const state = {
    kind: failed ? 'error' as const : 'loading' as const,
    label: t(failed ? 'app.couldNotLoad' : 'app.loading'),
    retryLabel: t('app.retry'), retrying: false, onRetry: retry,
  };
  return <RedesignShell active={page} theme={theme} language={lang} onTheme={toggleTheme}
    onLanguage={() => setLang(lang === 'en' ? 'th' : 'en')} t={t}
    quickStatsScope={null} testId={`production-${page}`}>
    <div className="qp-route-load" data-route-load-state={state.kind} aria-busy={!failed}>
      {page === 'overview' ? <OverviewPendingRegions state={state} t={t} historyHref="#history"/> : <RoutePendingRegions page={page} state={state} t={t}/>}
    </div>
  </RedesignShell>;
}

/** Recover route import/render failures; Suspense alone only handles pending imports. */
export class RouteLoadBoundary extends Component<{ page: Page; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <RouteLoadingShell page={this.props.page} failed/> : this.props.children;
  }
}
