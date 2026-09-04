import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  Boxes,
  Coins,
  FolderGit2,
  Gauge,
  HeartPulse,
  MessagesSquare,
  Moon,
  Sun,
  TrendingUp,
} from 'lucide-react';
import { api, subscribe, type Overview } from '@/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SettingsMenu } from '@/components/settings-menu';
import { I18nProvider, useI18n, useT } from '@/i18n';
import { AlertBell } from '@/components/alert-bell';
import { Hint, TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Empty, ErrorBox } from '@/components/primitives';
import { QuotaPulseMark, QuotaPulseWordmark } from '@/components/logo';
import { LiveSection } from '@/sections/live';
import { LimitsSection } from '@/sections/limits';
import { TrendSection } from '@/sections/trend';
import { CostSection } from '@/sections/cost';
import { SessionsSection } from '@/sections/sessions';
import { ProjectsSection } from '@/sections/projects';
import { ModelsSection } from '@/sections/models';
import { HealthSection } from '@/sections/health';

const TABS = [
  { id: 'live', key: 'tab.live', icon: Activity },
  { id: 'limits', key: 'tab.limits', icon: Gauge },
  { id: 'trend', key: 'tab.trend', icon: TrendingUp },
  { id: 'cost', key: 'tab.cost', icon: Coins },
  { id: 'sessions', key: 'tab.sessions', icon: MessagesSquare },
  { id: 'projects', key: 'tab.projects', icon: FolderGit2 },
  { id: 'models', key: 'tab.models', icon: Boxes },
  { id: 'health', key: 'tab.health', icon: HeartPulse },
] as const;

type TabId = (typeof TABS)[number]['id'];
type Theme = 'light' | 'dark';

/**
 * The sidebar collapses to icons below this width. The number is set by the tray popup,
 * which is a 460px BrowserWindow (packages/tray/src/main.ts): a full width rail would eat
 * nearly half of it. Kept in JS as well as CSS because the collapsed rail needs tooltips,
 * and a tooltip cannot be turned on by a media query alone.
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

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      // 'plimsoll-theme' is the key from the previous name: read it once so a rename
      // does not silently flip everyone back to their OS preference.
      const saved =
        localStorage.getItem('quotapulse-theme') ?? localStorage.getItem('plimsoll-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      /* private window or blocked storage: fall through to the OS preference */
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem('quotapulse-theme', theme);
    } catch {
      /* remembering the choice is a convenience, never a requirement */
    }
  }, [theme]);

  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

function Dashboard() {
  const t = useT();
  const { lang } = useI18n();
  const [tab, setTab] = useState<TabId>(
    () => (TABS.find((t) => t.id === location.hash.slice(1))?.id ?? 'live') as TabId,
  );
  const [ov, setOv] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [theme, toggleTheme] = useTheme();
  const reduced = useReducedMotion();
  const collapsed = !useMediaQuery(WIDE);

  const refresh = useCallback(() => {
    api
      .overview()
      .then((o) => {
        setOv(o);
        setErr(null);
        setLastUpdate(Date.now());
      })
      .catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => {
    refresh();
    // The daemon pushes on every pass that produced new rows, so the page never polls.
    const off = subscribe(refresh);
    // Countdowns still need to tick when no new data arrives.
    const tick = setInterval(() => setLastUpdate((v) => v), 30_000);
    return () => {
      off();
      clearInterval(tick);
    };
  }, [refresh]);

  useEffect(() => {
    location.hash = tab;
  }, [tab]);

  /*
   * Chrome picks its line-breaking dictionary from <html lang>. Thai has no spaces
   * between words, so under lang="en" it breaks at arbitrary points mid-word. This also
   * drives font fallback and what a screen reader announces.
   */
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const streaming = Date.now() - lastUpdate < 90_000;

  return (
    <TooltipProvider>
      {/* orientation drives Radix's roving focus: up/down rather than left/right. */}
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TabId)}
        orientation="vertical"
        className="flex min-h-screen"
      >
        <aside className="bg-card/40 sticky top-0 flex h-screen w-[60px] shrink-0 flex-col border-r min-[900px]:w-[212px]">
          <div className="flex h-[57px] shrink-0 items-center justify-center border-b min-[900px]:justify-start min-[900px]:px-4">
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
                return collapsed ? (
                  <Hint key={tb.id} text={t(tb.key)}>
                    {trigger}
                  </Hint>
                ) : (
                  trigger
                );
              })}
            </TabsList>
          </nav>

          <div className="shrink-0 border-t p-2">
            <div
              className={
                streaming
                  ? 'border-ok/30 bg-ok/8 text-ok flex items-center justify-center gap-2 rounded-full border px-2.5 py-1 text-[11.5px] font-medium min-[900px]:justify-start'
                  : 'text-muted-foreground border-border flex items-center justify-center gap-2 rounded-full border px-2.5 py-1 text-[11.5px] min-[900px]:justify-start'
              }
            >
              <span className="relative flex size-1.5 shrink-0">
                {streaming && (
                  <span className="bg-ok absolute inline-flex size-full animate-ping rounded-full opacity-60" />
                )}
                <span
                  className="relative inline-flex size-1.5 rounded-full"
                  style={{ background: streaming ? 'var(--ok)' : 'var(--muted-foreground)' }}
                />
              </span>
              <span className="hidden truncate min-[900px]:inline">
                {streaming ? t('app.streaming') : t('app.idle')}
              </span>
            </div>
          </div>
        </aside>

        {/* min-w-0 so a wide table scrolls inside the main column instead of stretching it. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur-sm">
            <div className="flex h-[57px] flex-wrap items-center gap-3 px-4 min-[900px]:px-6">
              <span className="text-muted-foreground text-[12.5px]">
                {ov ? t('app.sources', { n: ov.sources.length }) : t('app.connecting')}
              </span>
              {ov?.lastPass && (
                <>
                  <span className="text-muted-foreground/50 text-[12.5px]">&middot;</span>
                  <span className="text-muted-foreground/70 tabular font-mono text-[12px]">
                    {t('app.lastPass', { ms: ov.lastPass.durationMs })}
                  </span>
                </>
              )}

              <div className="flex-1" />

              {ov && (
                <AlertBell limits={ov.limits} now={ov.now} onOpenLimits={() => setTab('limits')} />
              )}

              <SettingsMenu />

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

          <main className="mx-auto w-full max-w-[1400px] px-4 pt-4 pb-16 min-[900px]:px-6">
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
                  {tab === 'live' && (ov ? <LiveSection ov={ov} /> : <Loading />)}
                </TabsContent>
                <TabsContent value="limits" forceMount={tab === 'limits' ? true : undefined}>
                  {tab === 'limits' && (ov ? <LimitsSection ov={ov} /> : <Loading />)}
                </TabsContent>
                <TabsContent value="trend" forceMount={tab === 'trend' ? true : undefined}>
                  {tab === 'trend' && <TrendSection />}
                </TabsContent>
                <TabsContent value="cost" forceMount={tab === 'cost' ? true : undefined}>
                  {tab === 'cost' && (ov ? <CostSection ov={ov} /> : <Loading />)}
                </TabsContent>
                <TabsContent value="sessions" forceMount={tab === 'sessions' ? true : undefined}>
                  {tab === 'sessions' && <SessionsSection />}
                </TabsContent>
                <TabsContent value="projects" forceMount={tab === 'projects' ? true : undefined}>
                  {tab === 'projects' && <ProjectsSection />}
                </TabsContent>
                <TabsContent value="models" forceMount={tab === 'models' ? true : undefined}>
                  {tab === 'models' && <ModelsSection />}
                </TabsContent>
                <TabsContent value="health" forceMount={tab === 'health' ? true : undefined}>
                  {tab === 'health' && <HealthSection />}
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
  return (
    <I18nProvider>
      <Dashboard />
    </I18nProvider>
  );
}
