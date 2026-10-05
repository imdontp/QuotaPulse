import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { Activity, ArrowUpRight, BarChart3, BellRing, Box, CircleGauge, GitBranch, Layers, Monitor, Moon, Radio, Settings, Sun, House, Folder, History, MoreHorizontal } from 'lucide-react';
import type { MessageKey } from '@/i18n/en';
import { CommandPalette } from '@/components/command-palette';
import { useT } from '@/i18n';
import { DaemonConnection, QuickStats } from './quick-stats';
import './overview.css';

export type RedesignTranslate = (key: Extract<MessageKey, `redesign.${string}`>) => string;
type Page = 'overview' | 'live' | 'projects' | 'providers' | 'models' | 'cost' | 'alerts' | 'history' | 'settings';

const NAV = [
  { id: 'overview', href: '#overview', label: 'redesign.overview', icon: House },
  { id: 'live', href: '#live', label: 'redesign.live', icon: Activity },
  { id: 'projects', href: '#projects', label: 'redesign.project', icon: Folder },
  { id: 'providers', href: '#providers', label: 'redesign.provider', icon: Radio },
  { id: 'models', href: '#models', label: 'redesign.models', icon: Box },
  { id: 'cost', href: '#cost', label: 'redesign.cost', icon: BarChart3 },
  { id: 'history', href: '#history', label: 'redesign.history', icon: History },
  { id: 'alerts', href: '#alerts', label: 'redesign.alerts', icon: BellRing },
  { id: 'settings', href: '#settings', label: 'redesign.settings', icon: Settings },
] as const;
const PRIMARY_NAV = NAV.filter(item => !['providers', 'cost', 'settings'].includes(item.id));
const MORE_NAV = NAV.filter(item => ['providers', 'cost', 'settings'].includes(item.id));

function RedesignNavigator() {
  const t = useT();
  return <CommandPalette items={NAV.map(({ id, label }) => ({ id, label: t(label) }))} onSelect={id => {
    const destination = NAV.find(item => item.id === id);
    if (destination) location.hash = destination.href.slice(1);
  }}/>;
}

export function RedesignShell({ active, preview = false, theme, language, onTheme, onLanguage, t, rootRef, testId, children, overlay }: {
  active: Page;
  preview?: boolean;
  theme: 'dark' | 'light';
  language: 'en' | 'th';
  onTheme: () => void;
  onLanguage: () => void;
  t: RedesignTranslate;
  rootRef?: RefObject<HTMLDivElement>;
  testId: string;
  children: ReactNode;
  overlay?: ReactNode;
}) {
  const [clock, setClock] = useState(() => Date.now());
  const [alertCount, setAlertCount] = useState<number | null>(null);
  const localizedAlertCount = alertCount === null ? null : new Intl.NumberFormat(language === 'th' ? 'th-TH' : 'en-US').format(alertCount);
  const alertCountBadge = alertCount !== null && alertCount > 0 ? (alertCount > 99 ? '99+' : String(alertCount)) : null;
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (!preview) window.qpDashboard?.ready(); }, [preview]);
  useEffect(() => { if (!preview) document.documentElement.lang = language; }, [language, preview]);
  return <div ref={rootRef} className="qp-redesign" data-theme={theme} lang={language} data-testid={testId}>
    <a className="qp-skip" href={`#${active}`} onClick={event => { event.preventDefault(); document.getElementById(active)?.focus(); }}>{t('redesign.skipContent')}</a>
    <header className="qp-topbar">
      <a className="qp-brand" href="#overview" aria-label="QuotaPulse"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M1 22h6l3-10 4 22 5-31 5 34 4-25 4 16 3-8h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg><span>Quota<strong>Pulse</strong><small>AI RUNTIME MISSION CONTROL</small></span></a>
      <div className="qp-topbar-body">
        <div className="qp-topbar-context">
          {!preview && <DaemonConnection/>}
          <span className="qp-preview-badge" data-page={active}>{t(preview ? 'redesign.preview' : NAV.find(item => item.id === active)!.label)}</span>
          {!preview && <span className="qp-workspace-context"><span className="qp-workspace-label">{t('redesign.workspace')}</span><span className="qp-machine-scope"><Monitor size={14} aria-hidden="true"/><span>{t('redesign.machineScope')}</span></span></span>}
        </div>
        <div className="qp-topbar-actions">
          {!preview && <RedesignNavigator/>}
          <div className="qp-header-clock">
            <time dateTime={new Date(clock).toISOString()}>{new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(clock)}</time>
            <time dateTime={new Date(clock).toISOString()}>{new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(clock)}</time>
          </div>
          <div className="qp-tools">
            <button onClick={onTheme} aria-label={t('redesign.theme')} title={t('redesign.theme')}>{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button>
            <button onClick={onLanguage} aria-label={t('redesign.language')} title={t('redesign.language')}><span aria-hidden="true">{language === 'en' ? 'ไทย' : 'EN'}</span></button>
          </div>
        </div>
      </div>
    </header>
    <aside className="qp-sidebar">
      <nav aria-label={t('redesign.navigation')}>
        {preview ? <>
          <a href="#overview" className="qp-nav-active" aria-label={t('redesign.overview')}><CircleGauge/><span>{t('redesign.overview')}</span></a>
          <a href="#runtime" aria-label={t('redesign.runtime')}><GitBranch/><span>{t('redesign.runtime')}</span></a>
          <a href="#model-usage" aria-label={t('redesign.models')}><Layers/><span>{t('redesign.models')}</span></a>
        </> : <>
          {PRIMARY_NAV.map(({ id, href, label, icon: Icon }) => {
            const hasAlertCount = id === 'alerts' && alertCountBadge !== null && localizedAlertCount !== null;
            const accessibleLabel = hasAlertCount ? `${t(label)} · ${t('redesign.currentQuotaRisks')}: ${localizedAlertCount}` : t(label);
            return <a key={id} href={href} aria-label={accessibleLabel} title={hasAlertCount ? accessibleLabel : undefined} aria-current={id === active ? 'page' : undefined} className={id === active ? 'qp-nav-active' : undefined} data-alert-count={hasAlertCount ? alertCountBadge : undefined}><Icon/><span>{t(label)}</span>{hasAlertCount && <span className="qp-nav-count" aria-hidden="true">{alertCountBadge}</span>}</a>;
          })}
          <details className="qp-nav-more" open={MORE_NAV.some(item => item.id === active)}>
            <summary aria-label={t('redesign.more')}><MoreHorizontal aria-hidden="true"/><span>{t('redesign.more')}</span></summary>
            {MORE_NAV.map(({ id, href, label, icon: Icon }) => <a key={id} href={href} aria-label={t(label)} aria-current={id === active ? 'page' : undefined} className={id === active ? 'qp-nav-active' : undefined}><Icon/><span>{t(label)}</span></a>)}
          </details>
        </>}
      </nav>
      {!preview && <QuickStats t={t} language={language} onAlertCountChange={setAlertCount}/>}
      {!preview && <div className="qp-sidebar-brand"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M1 22h6l3-10 4 22 5-31 5 34 4-25 4 16 3-8h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg><span>{t('redesign.keepFlowing')}<small>QuotaPulse</small></span></div>}
      {preview && <a className="qp-exit" href="./#overview" aria-label={t('redesign.dashboard')}><ArrowUpRight/><span>{t('redesign.dashboard')}</span></a>}
    </aside>
    <div className="qp-workspace">
      <main id={active} aria-label={t(NAV.find(item => item.id === active)!.label)} tabIndex={-1}>{children}</main>
    </div>
    {overlay}
  </div>;
}
