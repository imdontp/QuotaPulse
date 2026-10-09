import { useEffect, useState } from 'react';
import { api, type Overview } from '@/api';
import { useI18n, useT } from '@/i18n';
import { useLiveRefresh, useRefreshStatus } from '@/lib/use-live';
import { useTheme } from '@/lib/use-theme';
import { HistorySection } from '@/sections/history';
import { SettingsSection } from '@/sections/settings';
import { HealthSection } from '@/sections/health';
import type { UsageEventScope } from '@/lib/usage-events';
import { RedesignShell } from './shell';
import { Settings } from 'lucide-react';
import './settings.css';

function readDiagnostics() { return new URLSearchParams(location.hash.split('?')[1] ?? '').get('section') === 'diagnostics'; }

/** Preserve existing functional controls and readers inside the common navigation. */
export function ProductionUtilityPage({ page }: { page: 'history' | 'settings' }) {
  const t = useT();
  const { lang, setLang } = useI18n();
  const [theme, toggleTheme] = useTheme();
  const [historyPaused, setHistoryPaused] = useState(false);
  const [historyScope, setHistoryScope] = useState<UsageEventScope | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState(readDiagnostics);
  const refresh = useRefreshStatus();
  useEffect(() => {
    const sync = () => setDiagnostics(readDiagnostics());
    addEventListener('hashchange', sync);
    return () => removeEventListener('hashchange', sync);
  }, []);
  useLiveRefresh(async () => {
    try { setOverview(await api.overview()); setError(null); }
    catch (cause) { setError(String(cause)); throw cause; }
  }, []);
  return <RedesignShell quickStatsPaused={page === 'history' && historyPaused} quickStatsScope={page === 'history' ? historyScope : undefined} active={page} theme={theme} language={lang} onTheme={toggleTheme} onLanguage={() => setLang(lang === 'en' ? 'th' : 'en')} t={t} testId={`production-${page}`}>
    {page === 'settings' && <header className="qp-settings-heading"><i aria-hidden="true"><Settings size={26}/></i><div><h1>{t('settings.pageTitle')}</h1><p>{t('settings.pageBlurb')}</p></div></header>}
    {error && <p role="status">{t('app.couldNotLoad')}: {error}</p>}
    {page === 'history' ? <HistorySection onPauseChange={setHistoryPaused} onScopeChange={setHistoryScope} redesign sources={overview?.sources ?? []} harnesses={overview?.harnesses ?? []}/> : <>
      <nav className="qp-settings-nav" aria-label={t('settings.pageTitle')}>
        <a href="#settings" aria-current={!diagnostics ? 'page' : undefined}>{t('settings.pageTitle')}</a>
        <a href="#settings?section=diagnostics" aria-current={diagnostics ? 'page' : undefined}>{t('tab.health')}</a>
      </nav>
      {diagnostics ? <HealthSection/> : <SettingsSection redesign subscriptions={overview?.subscriptions ?? []} onPricingUpdated={() => void refresh.refreshNow()}/>}
    </>}
  </RedesignShell>;
}
