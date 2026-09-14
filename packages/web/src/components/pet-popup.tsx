import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ExternalLink, EyeOff, RefreshCw, X } from 'lucide-react';
import { api, type Limit, type Overview } from '@/api';
import { useI18n, useT } from '@/i18n';
import { useLiveRefresh, useRefreshStatus } from '@/lib/use-live';
import { useTheme } from '@/lib/use-theme';
import { quotaSummaries } from '@/lib/quota-summary';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GaugeStack } from '@/components/gauge';
import { Empty, ErrorBox, Stagger, StaggerItem } from '@/components/primitives';
import { TooltipProvider } from '@/components/ui/tooltip';
import { severityOf } from '@/format';

/**
 * The pet popup: the dashboard's own design system (shadcn tokens, motion) in the small
 * frameless window the PulsePet opens. It is the web app rather than a second renderer on
 * purpose -- same origin means the SAME preferences, so a subscription hidden in Settings
 * is hidden here with no synchronisation code at all (PET_MODE_SPEC integration note).
 */

/** Sprite frames, in `pulsepet_states_sprite.png` order, for the worst live severity. */
const SPRITE_FOR_SEVERITY = { ok: 0, warn: 2, crit: 3 } as const;
const SPRITE_SIZE = 44;

const BADGE_VARIANT = { available: 'ok', attention: 'crit', check: 'warn', inactive: 'outline' } as const;

function worstLimit(ov: Overview): Limit | null {
  const usable = ov.limits.filter((l) => l.used_percent != null);
  if (usable.length === 0) return null;
  return usable.reduce((a, b) => ((b.used_percent ?? 0) > (a.used_percent ?? 0) ? b : a));
}

function SpriteMark({ ov }: { ov: Overview | null }) {
  const worst = ov ? worstLimit(ov) : null;
  const frame = SPRITE_FOR_SEVERITY[worst ? severityOf(worst.used_percent) : 'ok'];
  const reduced = useReducedMotion();
  return (
    <motion.div
      aria-hidden="true"
      className="shrink-0"
      style={{
        width: SPRITE_SIZE,
        height: SPRITE_SIZE,
        backgroundImage: 'url(/pulsepet_states_sprite.png)',
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${SPRITE_SIZE * 5}px ${SPRITE_SIZE}px`,
        backgroundPosition: `-${frame * SPRITE_SIZE}px 0`,
      }}
      animate={reduced ? undefined : { y: [0, -2, 0] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

export function PetPopup() {
  const t = useT();
  const { lang, hiddenSubscriptions } = useI18n();
  useTheme();
  const reduced = useReducedMotion();
  const refreshStatus = useRefreshStatus();
  const [ov, setOv] = useState<Overview | null>(null);

  useLiveRefresh(() => api.overview().then(setOv), []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const summaries = useMemo(
    () => (ov ? quotaSummaries(ov, hiddenSubscriptions) : []),
    [ov, hiddenSubscriptions],
  );

  const run = (fn: 'refresh' | 'openDashboard' | 'hidePet' | 'close') => () => {
    const bridge = window.qpPopup;
    if (bridge) bridge[fn]();
    else if (fn === 'openDashboard') window.open('/#live', '_blank');
  };

  const updated = ov
    ? new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(ov.now)
    : null;

  return (
    <TooltipProvider>
      <div className="bg-background text-foreground flex h-screen flex-col overflow-hidden">
        <header className="border-border bg-card/40 flex items-center gap-3 border-b px-3 py-2.5 [-webkit-app-region:drag]">
          <SpriteMark ov={ov} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[13.5px] font-semibold">{t('pet.title')}</h1>
            <p className="text-muted-foreground tabular truncate text-[11px]">
              {updated ? t('pet.updated', { time: updated }) : t('app.connecting')}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="[-webkit-app-region:no-drag] size-7"
            aria-label={t('pet.close')}
            title={t('pet.close')}
            onClick={run('close')}
          >
            <X className="size-4" />
          </Button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {!ov && <Empty>{t('app.loading')}</Empty>}
          {ov && summaries.length === 0 && (
            <Empty>
              {ov.subscriptions.length === 0 ? t('quota.noSubscriptions') : t('live.allSubscriptionsHidden')}
            </Empty>
          )}
          {ov && summaries.length > 0 && (
            <AnimatePresence mode="wait" initial={false}>
              <Stagger
                key={summaries.map((s) => s.subscription.subscription_key).join('|')}
                className="flex flex-col gap-2.5"
              >
                {summaries.map((item) => {
                  const s = item.subscription;
                  const first = item.limits[0];
                  return (
                    <StaggerItem key={s.subscription_key}>
                      <motion.section
                        whileHover={reduced ? undefined : { y: -2 }}
                        className="quota-card bg-card rounded-xl border p-3"
                      >
                        <div className="mb-2.5 flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="size-2 shrink-0 rounded-full"
                            style={{
                              background:
                                first?.used_percent != null
                                  ? `var(--${severityOf(first.used_percent)})`
                                  : 'var(--muted-foreground)',
                            }}
                          />
                          <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                            {s.subscription_display_name}
                          </h2>
                          <Badge variant={BADGE_VARIANT[item.status]}>{t(`quota.${item.status}`)}</Badge>
                        </div>
                        {item.limits.length > 0 ? (
                          <GaugeStack limits={item.limits} now={ov.now} />
                        ) : (
                          <p className="text-muted-foreground text-[12px]">{t('live.subscriptionInactive')}</p>
                        )}
                      </motion.section>
                    </StaggerItem>
                  );
                })}
              </Stagger>
            </AnimatePresence>
          )}
          {refreshStatus.lastError && ov && <ErrorBox>{refreshStatus.lastError}</ErrorBox>}
        </main>

        <footer className="border-border bg-card/40 flex items-center gap-2 border-t px-3 py-2.5">
          <Button
            size="sm"
            className="flex-1"
            onClick={() => {
              run('refresh')();
              void refreshStatus.refreshNow();
            }}
            disabled={refreshStatus.refreshing}
          >
            <RefreshCw className={refreshStatus.refreshing ? 'size-3.5 animate-spin' : 'size-3.5'} />
            {t('app.refreshNow')}
          </Button>
          <Button size="sm" className="flex-1" onClick={run('openDashboard')}>
            <ExternalLink className="size-3.5" />
            {t('pet.openDashboard')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={run('hidePet')}
            title={t('pet.hide')}
            aria-label={t('pet.hide')}
          >
            <EyeOff className="size-3.5" />
          </Button>
        </footer>
      </div>
    </TooltipProvider>
  );
}
