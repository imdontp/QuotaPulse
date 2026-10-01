import { useEffect, useState } from 'react';
import { api, type Overview } from '@/api';
import { useI18n, useT } from '@/i18n';
import { useLiveRefresh, useRefreshStatus } from '@/lib/use-live';
import { useTheme } from '@/lib/use-theme';
import { HistorySection } from '@/sections/history';
import { SettingsSection } from '@/sections/settings';
import { HealthSection } from '@/sections/health';
import { RedesignShell } from './shell';

function readDiagnostics() { return new URLSearchParams(location.hash.split('?')[1] ?? '').get('section') === 'diagnostics'; }

/** Preserve existing functional controls and readers inside the common navigation. */
export function ProductionUtilityPage({ page }: { page: 'history' | 'settings' }) {
  const t = useT();
  const { lang, setLang } = useI18n();
  const [theme, toggleTheme] = useTheme();
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
  return <RedesignShell active={page} theme={theme} language={lang} onTheme={toggleTheme} onLanguage={() => setLang(lang === 'en' ? 'th' : 'en')} t={t} testId={`production-${page}`}>
    <h1 className="text-xl font-semibold">{t(page === 'history' ? 'history.title' : 'settings.pageTitle')}</h1>
    {error && <p role="status">{t('app.couldNotLoad')}: {error}</p>}
    {page === 'history' ? <HistorySection sources={overview?.sources ?? []}/> : <>
      <nav className="flex gap-4" aria-label={t('settings.pageTitle')}>
        <a href="#settings" aria-current={!diagnostics ? 'page' : undefined}>{t('settings.pageTitle')}</a>
        <a href="#settings?section=diagnostics" aria-current={diagnostics ? 'page' : undefined}>{t('tab.health')}</a>
      </nav>
      {diagnostics ? <HealthSection/> : <SettingsSection subscriptions={overview?.subscriptions ?? []} onPricingUpdated={() => void refresh.refreshNow()}/>}
    </>}
  </RedesignShell>;
}
