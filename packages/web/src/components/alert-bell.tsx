import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useMotionPref } from '@/lib/motion';
import { Bell, TriangleAlert } from 'lucide-react';
import type { Limit, SubscriptionStatus } from '@/api';
import { Button } from '@/components/ui/button';
import { pct, primaryLimits, thresholdLimits, windowLabel, willExhaust } from '@/format';
import { useFormat } from '@/i18n/format';
import { useI18n, useT } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Windows that will hit 100% BEFORE they reset.
 *
 * Collapsed to one reading per window FIRST. The API reports a window once per origin,
 * and filtering the raw list meant a source publishing the same window twice could be
 * alerted on twice -- two rows reading "Claude Code (company) - weekly" at different
 * percentages, with nothing on screen to tell them apart. That it had not happened yet
 * was luck: the second origin simply lacked the samples to compute a burn rate.
 *
 * Both the predicate and the collapsing live in `format.ts`, so the Limits table and the
 * Live gauges genuinely share them -- an earlier version of this comment claimed that
 * while three separate copies of the rule were drifting apart.
 */
export function urgentLimits(limits: Limit[], now = Date.now()): Limit[] {
  return primaryLimits(limits, now)
    .map((w) => w.primary)
    .filter((l) => willExhaust(l, now));
}

/**
 * These alerts describe a STATE that persists, not an event that just happened, so they
 * live behind a bell that is always reachable rather than as a banner on one tab. A
 * toast that never dismisses itself would be a toast used wrongly.
 */
export function AlertBell({
  limits,
  subscriptions = [],
  now,
  onOpenLimits,
}: {
  limits: Limit[];
  subscriptions?: SubscriptionStatus[];
  now: number;
  onOpenLimits: () => void;
}) {
  const t = useT();
  const f = useFormat();
  const { hiddenSubscriptions } = useI18n();
  const reduced = useReducedMotion();
  const pref = useMotionPref();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const visible = (key: string | null | undefined) =>
    key == null || !hiddenSubscriptions.includes(key);
  const visibleLimits = limits.filter((limit) =>
    visible(limit.subscription_key ?? limit.account_key),
  );
  const urgent = urgentLimits(visibleLimits, now);
  const thresholds = thresholdLimits(visibleLimits, now);
  const gaps = subscriptions.filter(
    (subscription) =>
      visible(subscription.subscription_key) && subscription.telemetry.gap,
  );
  const count = urgent.length + thresholds.length + gaps.length;

  // Pulse only when the count GROWS -- a steady problem should not keep flashing.
  const [pulse, setPulse] = useState(false);
  const prevCount = useRef(count);
  useEffect(() => {
    if (count > prevCount.current) {
      setPulse(true);
      const id = setTimeout(() => setPulse(false), 1200);
      return () => clearTimeout(id);
    }
    prevCount.current = count;
    return undefined;
  }, [count]);
  useEffect(() => {
    prevCount.current = count;
  }, [count]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const panel = ref.current?.querySelector<HTMLElement>('[role="dialog"]');
    panel?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); ref.current?.querySelector('button')?.focus(); }
      if (e.key === 'Tab' && panel) {
        const controls = [...panel.querySelectorAll<HTMLElement>('button:not([disabled])')];
        const first = controls[0], last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Nothing wrong: no bell at all, rather than a permanently empty affordance.
  if (count === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <Button
        size="sm"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t('alerts.title')}
        className="border-crit/40 bg-crit/10 text-crit hover:bg-crit/15 gap-1.5"
      >
        <motion.span
          animate={pulse && !reduced ? { scale: [1, 1.25, 1] } : { scale: 1 }}
          transition={{ duration: 0.45, repeat: pulse && !reduced ? 2 : 0 }}
          className="inline-flex"
        >
          <Bell className="size-[14px]" />
        </motion.span>
        <span className="tabular font-semibold">{count}</span>
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={pref.enter({ opacity: 0, scale: 0.96, y: -4 })}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={pref.reduced ? undefined : { opacity: 0, scale: 0.98, y: -4 }}
            transition={pref.reveal('instant')}
            role="dialog"
            aria-label={t('alerts.title')}
            className="bg-popover text-popover-foreground absolute right-0 z-50 mt-1.5 w-[22rem] max-w-[calc(100vw-8rem)] max-h-[70vh] overflow-y-auto origin-top-right rounded-xl border p-3 shadow-xl"
          >
            <div className="text-muted-foreground px-1.5 pt-1 pb-2 text-[11px] font-semibold tracking-wider uppercase">
              {t('alerts.title')}
            </div>

            <div className="flex flex-col gap-1">
              {urgent.map((l, i) => (
                <motion.button
                  key={`${l.source_id}-${l.window_kind}-${l.origin}`}
                  initial={pref.enter({ opacity: 0, x: -6 })}
                  animate={{ opacity: 1, x: 0 }}
                  transition={pref.reveal('fast', 'motion', i * 0.05)}
                  onClick={() => {
                    setOpen(false);
                    onOpenLimits();
                  }}
                  className="hover:bg-accent/60 flex w-full items-start gap-2.5 rounded-md px-1.5 py-2 text-left transition-colors"
                >
                  <TriangleAlert className="text-crit mt-0.5 size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-medium">
                      {l.display_name}
                      <span className="text-muted-foreground font-normal"> · {windowLabel(l.window_kind)}</span>
                    </span>
                    <span className="text-muted-foreground mt-0.5 block text-[11.5px] leading-relaxed">
                      {t('alerts.rate', { rate: `${l.burn!.percentPerHour.toFixed(1)}%` })}{' '}
                      <span className="text-crit font-medium">
                        {t('alerts.full', { time: f.clock(l.burn!.projectedFullAt) })}
                      </span>
                      <br />
                      {t('alerts.resets', { time: f.clock(l.resets_at) })}
                    </span>
                  </span>
                  {/* `--`, never 0%. A window can be alerting on its burn rate while the
                      harness has not published a percentage for it, and a fabricated zero
                      here would contradict the dash the same window shows on Live. */}
                  <span
                    className={cn(
                      'tabular shrink-0 font-mono text-[13px] font-semibold',
                      l.used_percent == null ? 'text-muted-foreground/60' : 'text-crit',
                    )}
                  >
                    {pct(l.used_percent)}
                  </span>
                </motion.button>
              ))}
              {thresholds.map((l, i) => (
                <motion.button
                  key={`threshold-${l.source_id}-${l.window_kind}-${l.origin}`}
                  initial={pref.enter({ opacity: 0, x: -6 })}
                  animate={{ opacity: 1, x: 0 }}
                  transition={pref.reveal('fast', 'motion', (urgent.length + i) * 0.05)}
                  onClick={() => {
                    setOpen(false);
                    onOpenLimits();
                  }}
                  className="hover:bg-accent/60 flex w-full items-start gap-2.5 rounded-md px-1.5 py-2 text-left transition-colors"
                >
                  <TriangleAlert className="text-warn mt-0.5 size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-medium">
                      {l.display_name}
                      <span className="text-muted-foreground font-normal"> · {windowLabel(l.window_kind)}</span>
                    </span>
                    <span className="text-muted-foreground mt-0.5 block text-[11.5px] leading-relaxed">
                      {t('alerts.threshold', { pct: Math.round(l.used_percent ?? 0) })}{' '}
                      {t('alerts.resets', { time: f.clock(l.resets_at) })}
                    </span>
                  </span>
                  <span className="text-warn tabular shrink-0 font-mono text-[13px] font-semibold">
                    {pct(l.used_percent)}
                  </span>
                </motion.button>
              ))}
              {gaps.map((subscription, i) => (
                <motion.button
                  key={`gap-${subscription.subscription_key}`}
                  initial={pref.enter({ opacity: 0, x: -6 })}
                  animate={{ opacity: 1, x: 0 }}
                  transition={pref.reveal('fast', 'motion', (urgent.length + thresholds.length + i) * 0.05)}
                  onClick={() => {
                    setOpen(false);
                    onOpenLimits();
                  }}
                  className="hover:bg-accent/60 flex w-full items-start gap-2.5 rounded-md px-1.5 py-2 text-left transition-colors"
                >
                  <TriangleAlert className="text-warn mt-0.5 size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-medium">{subscription.subscription_display_name}</span>
                    <span className="text-muted-foreground mt-0.5 block text-[11.5px] leading-relaxed">
                      {t('alerts.quotaGap')}
                    </span>
                  </span>
                </motion.button>
              ))}
            </div>

            <div className="text-muted-foreground/70 border-t px-1.5 pt-2 pb-1 text-[11px]">
              {t('alerts.footnote')}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
