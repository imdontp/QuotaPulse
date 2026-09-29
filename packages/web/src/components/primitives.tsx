import * as React from 'react';
import { motion } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/tooltip';
import { age, freshness } from '@/format';
import { useT } from '@/i18n';
import { useMotionPref } from '@/lib/motion';
import { cn } from '@/lib/utils';

/** Tiny trend line for a stat card. Pure SVG: no library for nine points. */
export function Sparkline({
  points,
  className,
  width = 76,
  height = 22,
}: {
  points: number[];
  className?: string;
  width?: number;
  height?: number;
}) {
  /* Hooks run before the early return: a sparkline with too few points still has to
     take the same number of hooks as one that renders. */
  const grad = `qp-spark-${React.useId().replace(/:/g, '')}`;
  const pref = useMotionPref();
  if (points.length < 2) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const d = points
    .map((p, i) => {
      const x = i * step;
      const y = height - 2 - ((p - min) / span) * (height - 4);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" className={className}>
      <defs>
        {/* The brand sweep, left to right across the window. A sparkline is trend, not
            status, so it is the one chart mark that may carry brand colour: the severity
            tokens stay reserved for gauges, where the colour IS the reading.

            userSpaceOnUse for the same reason as the logo mark: a flat series (a quiet day
            where every hour is zero) draws a horizontal line, whose bounding box is zero
            pixels tall, and an objectBoundingBox gradient is undefined on that. The line
            would vanish precisely when it should read as flat. */}
        <linearGradient id={grad} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={width} y2="0">
          <stop offset="0%" stopColor="var(--brand-2)" />
          <stop offset="100%" stopColor="var(--brand)" />
        </linearGradient>
      </defs>
      <motion.path
        d={d}
        stroke={`url(#${grad})`}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={pref.enter({ pathLength: 0, opacity: 0 })}
        animate={{ pathLength: 1, opacity: 0.9 }}
        /*
         * The draw-on was the one motion primitive in this file with no reduced-motion
         * check, and the stylesheet's clamp could not reach it: a `motion` animation is JS,
         * not CSS, so `prefers-reduced-motion` never touched it. Someone who asked the OS
         * for less movement still got a line drawing itself across on every mount.
         */
        transition={pref.reveal('deliberate')}
      />
    </svg>
  );
}

/**
 * Mandatory on every quota reading. A Codex figure can be seconds old while a Claude
 * fallback is two days old, and they must never look alike.
 */
export function FreshnessBadge({
  seconds,
  origin,
  className,
}: {
  seconds: number | null;
  origin?: string;
  className?: string;
}) {
  const t = useT();
  const f = freshness(seconds);
  const variant = f === 'live' ? 'ok' : f === 'stale' ? 'crit' : 'default';
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <Hint text={t('badge.freshHint', { age: age(seconds) })}>
        <Badge variant={variant}>
          {f === 'live' && (
            <span className="bg-ok relative flex size-1.5 rounded-full">
              <span className="bg-ok absolute inline-flex size-full animate-ping rounded-full opacity-60" />
            </span>
          )}
          {f === 'live' ? t('badge.live') : t('badge.old', { age: age(seconds) })}
        </Badge>
      </Hint>
      {origin && (
        <Hint text={t('badge.originHint')}>
          <Badge variant="origin">{origin}</Badge>
        </Hint>
      )}
    </span>
  );
}

/** Horizontal ranked bars. Used wherever a "top N by value" list is the right answer. */
export function BarList({
  rows,
  className,
}: {
  rows: Array<{
    label: string;
    value: number;
    display: React.ReactNode;
    color?: string;
    sub?: string;
    icon?: React.ReactNode;
  }>;
  className?: string;
}) {
  const t = useT();
  const max = Math.max(1, ...rows.map((r) => r.value));
  const pref = useMotionPref();
  // This was a hardcoded English "no data" in a bilingual app, rendered inside an `Empty`
  // that everything else in the same position had already translated.
  if (rows.length === 0) return <Empty>{t('barList.noData')}</Empty>;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {rows.map((r, i) => (
        <div key={r.label} className="flex items-center gap-3">
          <div
            className="flex w-44 shrink-0 items-center justify-end gap-1.5 truncate text-right text-[12.5px]"
            title={r.label}
          >
            {r.icon && <span className="text-muted-foreground shrink-0 text-[14px]">{r.icon}</span>}
            <span className="truncate">{r.label}</span>
            {r.sub && <span className="text-muted-foreground/70 shrink-0 text-[11px]">{r.sub}</span>}
          </div>
          <div className="bg-track h-6 flex-1 overflow-hidden rounded-[5px]">
            <motion.div
              className="h-full rounded-[5px]"
              style={{ background: r.color ?? 'var(--brand)' }}
              initial={{ width: 0 }}
              animate={{ width: `${(r.value / max) * 100}%` }}
              // No reduced-motion check previously: twenty-odd bars sweeping open on a
              // monitor page, on every mount, for a reader who asked the OS not to.
              transition={pref.reveal('slow', 'motion', i * 0.025)}
            />
          </div>
          <div className="tabular w-24 shrink-0 text-right font-mono text-[12.5px]">{r.display}</div>
        </div>
      ))}
    </div>
  );
}

/** Staggered entrance for a group of cards; skipped when the OS asks for less motion. */
export function Stagger({ children, className }: { children: React.ReactNode; className?: string }) {
  const pref = useMotionPref();
  return (
    <motion.div
      className={className}
      initial={pref.enter('hidden')}
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.045 } } }}
    >
      {children}
    </motion.div>
  );
}

/**
 * The item half of the pair, which used to have no motion preference of its own.
 *
 * It relied on `Stagger` passing `initial={false}` down through the variant chain, so it
 * was correct exactly as often as it was used inside a `Stagger` -- and animated a slide-up
 * for everyone else. `useMotionPref` is one line and removes the coupling, which matters
 * because the failure mode is invisible: nothing looks wrong, it just moves when it was told
 * not to.
 */
export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  const pref = useMotionPref();
  return (
    <motion.div
      className={className}
      initial={pref.enter({ opacity: 0, y: 8 })}
      variants={{
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0, transition: pref.reveal('fast') },
      }}
    >
      {children}
    </motion.div>
  );
}

export const Empty = ({ children }: { children: React.ReactNode }) => (
  <div className="text-muted-foreground py-8 text-center text-[13px]">{children}</div>
);

export const ErrorBox = ({ children }: { children: React.ReactNode }) => (
  <div className="border-crit/30 bg-crit/8 text-crit mb-4 rounded-lg border px-3 py-2.5 text-[13px]">
    {children}
  </div>
);

/**
 * A failed region, with the one thing that actually helps: a way to ask again.
 *
 * `ErrorBox` alone is a dead end. It tells the reader that something broke and leaves them
 * there, which is why several surfaces ended up preferring a permanent "loading…" instead --
 * Settings' notification card, for one, caught the failure and kept rendering as if the
 * request were merely still in flight, so a permanently broken endpoint looked identical to
 * a slow one and there was no version of the screen that admitted a problem.
 *
 * A failure that cannot be retried is a failure the reader has to reload the page to escape,
 * so the retry belongs in the primitive rather than in each caller.
 */
export function RetryableError({
  children,
  onRetry,
  retryLabel,
  className,
}: {
  children: React.ReactNode;
  onRetry: () => void;
  retryLabel: string;
  className?: string;
}) {
  return (
    <div className={cn('border-crit/30 bg-crit/8 rounded-lg border px-3 py-2.5', className)}>
      <div className="text-crit text-[13px]">{children}</div>
      <Button size="sm" variant="outline" onClick={onRetry} className="mt-2">
        {retryLabel}
      </Button>
    </div>
  );
}
