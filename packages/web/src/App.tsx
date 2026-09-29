import { Fragment, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  BarChart3,
  BellRing,
  Menu,
  X,
  Gauge,
  HeartPulse,
  MessagesSquare,
  Moon,
  Radio,
  RefreshCw,
  Settings as SettingsIcon,
  Sun,
} from 'lucide-react';
import { api, type Overview } from '@/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SettingsMenu } from '@/components/settings-menu';
import { I18nProvider, useI18n, useT } from '@/i18n';
import { AmbientField, useAmbient } from '@/components/ambient-field';
import { AlertBell } from '@/components/alert-bell';
import { Hint, TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Empty, ErrorBox } from '@/components/primitives';
import { QuotaPulseMark, QuotaPulseWordmark } from '@/components/logo';
import { LiveSection } from '@/sections/live';
import { SourcesSection } from '@/sections/sources';
import { LimitsSection } from '@/sections/limits';
import { SessionsSection } from '@/sections/sessions';
import { HistorySection } from '@/sections/history';
import { HealthSection } from '@/sections/health';
import { useLiveRefresh, useRefreshStatus } from '@/lib/use-live';
import { useTheme } from '@/lib/use-theme';
import { CommandPalette } from '@/components/command-palette';
import { AlertsSection } from '@/sections/alerts';
import { PetPopup } from '@/components/pet-popup';
import { SettingsSection } from '@/sections/settings';
import { UsageSection } from '@/sections/usage';
import { loadWindowSize } from '@/lib/utils';

const TABS = [
  { id: 'live', key: 'tab.live', icon: Activity },
  { id: 'usage', key: 'tab.usage', icon: BarChart3 },
  { id: 'sessions', key: 'tab.sessions', icon: MessagesSquare },
  { id: 'history', key: 'history.title', icon: MessagesSquare },
  { id: 'limits', key: 'tab.limits', icon: Gauge },
  { id: 'alerts', key: 'tab.alerts', icon: BellRing },
  { id: 'sources', key: 'tab.sources', icon: Radio },
  { id: 'health', key: 'tab.health', icon: HeartPulse },
  { id: 'settings', key: 'tab.settings', icon: SettingsIcon },
] as const;

type TabId = (typeof TABS)[number]['id'];

const LEGACY_HASHES: Record<string, string> = {
  today: '#usage?range=today&view=summary',
  trend: '#usage?range=month&view=summary',
  cost: '#usage?range=all&view=cost',
  projects: '#usage?range=month&view=projects',
  models: '#usage?range=month&view=models',
};

function tabFromHash(): TabId {
  const raw = location.hash.slice(1).split('?')[0] ?? '';
  return (TABS.some((tab) => tab.id === raw) ? raw : raw in LEGACY_HASHES ? 'usage' : 'live') as TabId;
}

/**
 * The sidebar collapses to icons below this width. The tray and Gallery windows share a
 * compact native size, while this breakpoint also keeps narrower browser windows usable.
 * Kept in JS as well as CSS
 * because the collapsed rail needs tooltips, and a tooltip cannot be turned on by a media
 * query alone.
 */
const WIDE = '(min-width: 900px)';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia?.(query).matches ?? true);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
}

function Dashboard() {
  const t = useT();
  const { lang, syncHiddenSubscriptions, hiddenSubscriptions } = useI18n();
  const [tab, setTabState] = useState<TabId>(tabFromHash);
  const [ov, setOv] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [theme, toggleTheme] = useTheme();
  const reduced = useReducedMotion();
  const collapsed = !useMediaQuery(WIDE);
  const refreshStatus = useRefreshStatus();
  const ovRef = useRef<Overview | null>(null);
  const drawer = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const isMobile = !useMediaQuery('(min-width: 640px)');
  /*
   * One backdrop for the whole dashboard, derived from data the dashboard already has. It
   * sits behind every tab rather than only Live, so the mood is a property of the machine
   * rather than of whichever page happens to be open -- and it costs one gradient, no frame
   * loop, and no second copy of the aurora. See `lib/ambient.ts` for what it is allowed to
   * say, and why the rules are tested rather than trusted.
   */
  const ambient = useAmbient(ov, hiddenSubscriptions);
  const navigateUsage = (view: 'summary' | 'cost' | 'projects' | 'models' = 'summary') => {
    const current = new URLSearchParams(location.hash.includes('?') ? location.hash.split('?')[1] : '');
    current.set('range', current.get('range') ?? 'today');
    current.set('view', view);
    location.hash = 'usage?' + current.toString();
    setTabState('usage');
    drawer.current?.close();
  };
  const setTab = (next: TabId) => {
    if (next === 'usage') {
      navigateUsage();
      return;
    }
    if (location.hash !== '#' + next) location.hash = next;
    setTabState(next);
    drawer.current?.close();
  };

  useEffect(() => {
    window.qpDashboard?.ready();
  }, []);

  useEffect(() => {
    // Apply custom window size if running in a standalone window context
    // This only works for popup windows or windows opened with window.open()
    // due to browser security restrictions
    try {
      const windowSize = loadWindowSize();
      // Check if we're in a window that can be resized (not a normal tab)
      if (window.opener || window.location.search.includes('mode=popup')) {
        window.resizeTo(windowSize.width, windowSize.height);
      }
    } catch {
      // Silently fail if resizeTo is not allowed
    }
  }, []);

  useEffect(() => {
    if (ov) syncHiddenSubscriptions(ov.settings.hidden_subscriptions, ov.settings.updated_at);
  }, [ov, syncHiddenSubscriptions]);

  useEffect(() => { if (!isMobile) drawer.current?.close(); }, [isMobile]);

  useLiveRefresh(() =>
    api
      .overview()
      .then((o) => {
        ovRef.current = o;
        setOv(o);
        setErr(null);
      })
      .catch((e) => {
        // Once the shell has data, a transient background failure belongs in the
        // connection status rather than replacing the dashboard with an error box.
        if (!ovRef.current) setErr(String(e));
        throw e;
      }),
    [],
  );

  useEffect(() => {
    const sync = () => {
      const raw = location.hash.slice(1).split('?')[0] ?? '';
      const legacy = LEGACY_HASHES[raw];
      if (legacy) history.replaceState(null, '', legacy);
      const next = tabFromHash();
      setTabState(next);
      drawer.current?.close();
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  /*
   * Chrome picks its line-breaking dictionary from <html lang>. Thai has no spaces
   * between words, so under lang="en" it breaks at arbitrary points mid-word. This also
   * drives font fallback and what a screen reader announces.
   */
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const statusLabel = {
    connecting: t('app.refreshConnecting'),
    live: t('app.refreshLive'),
    reconnecting: t('app.refreshReconnecting'),
    stale: t('app.refreshStale'),
    unavailable: t('app.refreshUnavailable'),
  }[refreshStatus.state];
  const lastSuccess = refreshStatus.lastSuccessAt
    ? new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(refreshStatus.lastSuccessAt)
    : null;
  const statusTitle = lastSuccess
    ? `${statusLabel} · ${t('app.lastRefresh', { time: lastSuccess })}`
    : statusLabel;
  const statusTone =
    refreshStatus.state === 'live'
      ? 'border-ok/30 bg-ok/8 text-ok'
      : refreshStatus.state === 'reconnecting' || refreshStatus.state === 'stale'
        ? 'border-warn/30 bg-warn/8 text-warn'
        : refreshStatus.state === 'unavailable'
          ? 'border-crit/30 bg-crit/8 text-crit'
          : 'text-muted-foreground border-border';
  const statusColor =
    refreshStatus.state === 'live'
      ? 'var(--ok)'
      : refreshStatus.state === 'reconnecting' || refreshStatus.state === 'stale'
        ? 'var(--warn)'
        : refreshStatus.state === 'unavailable'
          ? 'var(--crit)'
          : 'var(--muted-foreground)';

  return (
    <TooltipProvider>
      {/* orientation drives Radix's roving focus: up/down rather than left/right. */}
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TabId)}
        orientation="vertical"
        className="dashboard-shell flex min-h-screen"
      >
        <AmbientField ambient={ambient} />
        <dialog ref={drawer} aria-label={t('nav.open')} className="nav-drawer bg-card text-foreground" onClose={() => menuButton.current?.focus()} onClick={event => { if (event.target === event.currentTarget) drawer.current?.close(); }}>
          <div className="flex items-center justify-between border-b p-5"><QuotaPulseWordmark /><Button size="icon" onClick={() => drawer.current?.close()} aria-label={t('nav.close')}><X className="size-4" /></Button></div>
          <nav className="space-y-1 p-3">{TABS.map(tb => <button key={tb.id} onClick={() => setTab(tb.id)} aria-current={tab === tb.id ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm ${tab === tb.id ? 'bg-secondary text-brand' : 'text-muted-foreground'}`}><tb.icon className="size-4" />{t(tb.key)}</button>)}</nav>
          <div className="border-t p-4 text-sm text-muted-foreground">{statusLabel}<Button size="icon" className="ml-3" aria-label={t('app.refreshNow')} disabled={refreshStatus.refreshing} onClick={() => void refreshStatus.refreshNow()}><RefreshCw className="size-4" /></Button></div>
        </dialog>
        <aside className="dashboard-sidebar bg-card/40 sticky top-0 hidden h-screen w-[60px] shrink-0 flex-col border-r sm:flex min-[900px]:w-[212px]">
          <div className="flex h-[64px] shrink-0 items-center justify-center border-b min-[900px]:justify-start min-[900px]:px-4">
            {/*
             * The tagline rides on the logo rather than sitting under it. The brand sheet
             * stacks the two in its logo lockup, but the sheet's OWN dashboard preview
             * shows the mark and wordmark alone, and this header is height matched to the
             * top bar beside it: growing it to fit a second line would break that line up
             * for a string nobody reads twice. This way both translations stay live.
             */}
            <Hint text={t('app.tagline')}>
              <span className="flex items-center">
                <QuotaPulseMark className="size-[22px] shrink-0" />
                <QuotaPulseWordmark className="ml-2 hidden min-[900px]:inline" />
              </span>
            </Hint>
          </div>

          <nav className="flex-1 overflow-y-auto p-2">
            <TabsList>
              {TABS.map((tb) => {
                const trigger = (
                  <TabsTrigger
                    key={tb.id}
                    value={tb.id}
                    active={tb.id === tab}
                    icon={tb.icon}
                    collapsed={collapsed}
                  >
                    {t(tb.key)}
                  </TabsTrigger>
                );
                // Only worth a tooltip when the label is not on screen.
                // Keep each sidebar group heading to one occurrence; Alerts belongs to
                // monitoring but sits directly below Limits rather than starting a second
                // "Monitor" section halfway down the rail.
                const group = tb.id === 'live' ? 'nav.monitor' : tb.id === 'usage' || tb.id === 'sessions' ? 'nav.analyze' : tb.id === 'sources' ? 'nav.system' : null;
                return <Fragment key={tb.id}>
                  {group && <span className={collapsed ? 'mt-4' : 'text-muted-foreground/70 mt-5 mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-widest'}>{!collapsed && t(group)}</span>}
                  {collapsed ? <Hint text={t(tb.key)}>{trigger}</Hint> : trigger}
                </Fragment>;
              })}
            </TabsList>
          </nav>

          <div className="flex shrink-0 items-center gap-1 border-t p-2">
            <div
              className={`${statusTone} flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full border px-1 py-1 text-[11.5px] font-medium min-[900px]:justify-start min-[900px]:px-2.5`}
              title={statusTitle}
              aria-label={statusTitle}
              role="status"
            >
              <span className="relative flex size-1.5 shrink-0">
                {refreshStatus.state === 'live' && (
                  <span className="bg-ok absolute inline-flex size-full animate-ping rounded-full opacity-60" />
                )}
                <span className="relative inline-flex size-1.5 rounded-full" style={{ background: statusColor }} />
              </span>
              <span className="hidden truncate min-[900px]:inline">{statusLabel}</span>
            </div>
            <Button
              size="icon"
              onClick={() => void refreshStatus.refreshNow()}
              disabled={refreshStatus.refreshing}
              aria-label={t('app.refreshNow')}
              title={t('app.refreshNow')}
              className="text-muted-foreground size-7 shrink-0"
            >
              <RefreshCw className={refreshStatus.refreshing ? 'size-[14px] animate-spin' : 'size-[14px]'} />
            </Button>
          </div>
        </aside>

        {/* min-w-0 so a wide table scrolls inside the main column instead of stretching it. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="dashboard-topbar bg-background/80 border-b z-(--z-chrome) sticky top-0">
            <div className="flex min-h-[64px] items-center gap-2 px-4 min-[900px]:px-6">
              <Button ref={menuButton} size="icon" className="shrink-0 sm:hidden" onClick={() => drawer.current?.showModal()} aria-label={t('nav.open')}><Menu className="size-4" /></Button>
              <h1 className="min-w-0 truncate text-base font-semibold">{t(TABS.find(tb => tb.id === tab)!.key)}</h1>
              <span className="text-muted-foreground ml-4 hidden text-xs lg:inline" title={ov?.lastPass ? t('app.lastPass', { ms: ov.lastPass.durationMs }) : undefined}>
                {ov ? t('app.sources', { n: ov.sources.length }) : t('app.connecting')}
              </span>

              <div className="flex-1" />

              {ov && (
                <AlertBell
                  limits={ov.limits}
                  subscriptions={ov.subscriptions}
                  now={ov.now}
                  onOpenLimits={() => setTab('limits')}
                />
              )}

              <CommandPalette items={TABS.map((item) => ({ id: item.id, label: t(item.key), group: item.id === 'live' || item.id === 'limits' || item.id === 'alerts' ? t('nav.monitor') : item.id === 'health' || item.id === 'sources' || item.id === 'settings' ? t('nav.system') : t('nav.analyze') }))} onSelect={(id) => { if (TABS.some((item) => item.id === id)) setTab(id as TabId); }} />

              <SettingsMenu onOpenSettings={() => setTab('settings')} />

              <Button
                size="icon"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? t('app.themeToLight') : t('app.themeToDark')}
                className="text-muted-foreground"
              >
                {theme === 'dark' ? (
                  <Sun className="size-[15px]" />
                ) : (
                  <Moon className="size-[15px]" />
                )}
              </Button>
            </div>
          </header>

          <main className="dashboard-content mx-auto w-full max-w-[1400px] px-4 pt-6 pb-16 min-[900px]:px-6">
            {err && <ErrorBox>{err}</ErrorBox>}

            {/* Content cross-fades on tab change; the pill itself slides (see TabsTrigger). */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                initial={reduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                <TabsContent value="live" forceMount={tab === 'live' ? true : undefined}>
                  {tab === 'live' && (ov ? <LiveSection ov={ov} onOpenLimits={() => setTab('limits')} onOpenHealth={() => setTab('health')} onOpenCost={() => navigateUsage('cost')} /> : <Loading />)}
                </TabsContent>
                <TabsContent value="usage" forceMount={tab === 'usage' ? true : undefined}>
                  {tab === 'usage' && (ov ? <UsageSection ov={ov} sources={ov.sources} /> : <Loading />)}
                </TabsContent>
                <TabsContent value="sources" forceMount={tab === 'sources' ? true : undefined}>
                  {tab === 'sources' && (ov ? <SourcesSection ov={ov} /> : <Loading />)}
                </TabsContent>
                <TabsContent value="limits" forceMount={tab === 'limits' ? true : undefined}>
                  {tab === 'limits' && (ov ? <LimitsSection ov={ov} /> : <Loading />)}
                </TabsContent>
                <TabsContent value="alerts" forceMount={tab === 'alerts' ? true : undefined}>
                  {tab === 'alerts' && <AlertsSection />}
                </TabsContent>
                <TabsContent value="sessions" forceMount={tab === 'sessions' ? true : undefined}>
                  {tab === 'sessions' && <SessionsSection sources={ov?.sources ?? []} />}
                </TabsContent>
                <TabsContent value="history" forceMount={tab === 'history' ? true : undefined}>
                  {tab === 'history' && <HistorySection sources={ov?.sources ?? []} />}
                </TabsContent>
                <TabsContent value="health" forceMount={tab === 'health' ? true : undefined}>
                  {tab === 'health' && <HealthSection />}
                </TabsContent>
                <TabsContent value="settings" forceMount={tab === 'settings' ? true : undefined}>
                  {tab === 'settings' && <SettingsSection subscriptions={ov?.subscriptions ?? []} onPricingUpdated={() => void refreshStatus.refreshNow()} />}
                </TabsContent>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </Tabs>
    </TooltipProvider>
  );
}

function Loading() {
  const t = useT();
  return (
    <Empty>
      <span className="inline-flex items-center gap-2">
        <Activity className="size-3.5 animate-pulse" />
        {t('app.loading')}
      </span>
    </Empty>
  );
}

export default function App() {
  // The PulsePet opens this app with ?mode=popup in a small frameless window. Same
  // origin, same providers, same preferences -- only the layout differs.
  const popupMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('mode') === 'popup';
  return (
    <I18nProvider>
      {popupMode ? <PetPopup /> : <Dashboard />}
    </I18nProvider>
  );
}
