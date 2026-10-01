import type { ReactNode, RefObject } from 'react';
import { Activity, ArrowUpRight, BarChart3, BellRing, Box, CircleGauge, GitBranch, Layers, MessagesSquare, Moon, Radio, Settings, Sun } from 'lucide-react';
import type { MessageKey } from '@/i18n/en';
import './overview.css';

export type RedesignTranslate = (key: Extract<MessageKey, `redesign.${string}`>) => string;
type Page = 'overview' | 'live' | 'projects' | 'providers' | 'models' | 'cost';

const NAV = [
  { id: 'overview', href: '#overview', label: 'redesign.overview', icon: CircleGauge },
  { id: 'live', href: '#live?mode=redesign', label: 'redesign.live', icon: Activity },
  { id: 'projects', href: '#projects', label: 'redesign.project', icon: Box },
  { id: 'providers', href: '#providers', label: 'redesign.provider', icon: Radio },
  { id: 'models', href: '#models', label: 'redesign.models', icon: Layers },
  { id: 'cost', href: '#cost', label: 'redesign.cost', icon: BarChart3 },
  { id: 'history', href: '#history', label: 'redesign.history', icon: MessagesSquare },
  { id: 'alerts', href: '#alerts', label: 'redesign.alerts', icon: BellRing },
  { id: 'settings', href: '#settings', label: 'redesign.settings', icon: Settings },
] as const;

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
  return <div ref={rootRef} className="qp-redesign" data-theme={theme} lang={language} data-testid={testId}>
    <aside className="qp-sidebar">
      <a className="qp-brand" href="#overview" aria-label="QuotaPulse"><Activity/><span>QuotaPulse<small>MISSION CONTROL</small></span></a>
      <nav aria-label={t('redesign.overview')}>
        {preview ? <>
          <a href="#overview" className="qp-nav-active" aria-label={t('redesign.overview')}><CircleGauge/><span>{t('redesign.overview')}</span></a>
          <a href="#runtime" aria-label={t('redesign.runtime')}><GitBranch/><span>{t('redesign.runtime')}</span></a>
          <a href="#model-usage" aria-label={t('redesign.models')}><Layers/><span>{t('redesign.models')}</span></a>
        </> : NAV.map(({ id, href, label, icon: Icon }) => <a key={id} href={href} aria-label={t(label)} className={id === active ? 'qp-nav-active' : undefined}><Icon/><span>{t(label)}</span></a>)}
      </nav>
      {preview && <a className="qp-exit" href="./#overview" aria-label={t('redesign.dashboard')}><ArrowUpRight/><span>{t('redesign.dashboard')}</span></a>}
    </aside>
    <div className="qp-workspace">
      <header className="qp-topbar"><span className="qp-preview-badge">{t(preview ? 'redesign.preview' : active === 'overview' ? 'redesign.overview' : active === 'live' ? 'redesign.live' : active === 'providers' ? 'redesign.provider' : active === 'models' ? 'redesign.models' : active === 'cost' ? 'redesign.cost' : 'redesign.project')}</span><div className="qp-tools"><button onClick={onLanguage} aria-label={t('redesign.language')}>{language === 'en' ? 'ไทย' : 'EN'}</button><button onClick={onTheme} aria-label={t('redesign.theme')}>{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button></div></header>
      <main id={active}>{children}</main>
    </div>
    {overlay}
  </div>;
}
