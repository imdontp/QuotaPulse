import * as React from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { Hint } from '@/components/ui/tooltip';
import { age, freshness } from '@/format';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Counts to a new value instead of snapping. On a dashboard that repaints itself
 * every few seconds this is what tells you a number MOVED rather than the page
 * having redrawn -- so it is animation carrying information, not decoration.
 */
export function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(value);
  const spring = useSpring(mv, { stiffness: 90, damping: 20, mass: 0.6 });
  const text = useTransform(spring, (v) => format(v));

  React.useEffect(() => {
    if (reduced) mv.jump(value);
    else mv.set(value);
  }, [value, mv, reduced]);

  return <motion.span className={className}>{reduced ? format(value) : text}</motion.span>;
}

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
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.9 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
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
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <div className="text-muted-foreground py-6 text-center text-[13px]">no data</div>;

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
              transition={{ duration: 0.55, delay: i * 0.025, ease: [0.22, 1, 0.36, 1] }}
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
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : 'hidden'}
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.045 } } }}
    >
      {children}
    </motion.div>
  );
}

export const StaggerItem = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <motion.div
    className={className}
    variants={{
      hidden: { opacity: 0, y: 8 },
      show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
    }}
  >
    {children}
  </motion.div>
);

export const Empty = ({ children }: { children: React.ReactNode }) => (
  <div className="text-muted-foreground py-8 text-center text-[13px]">{children}</div>
);

export const ErrorBox = ({ children }: { children: React.ReactNode }) => (
  <div className="border-crit/30 bg-crit/8 text-crit mb-4 rounded-lg border px-3 py-2.5 text-[13px]">
    {children}
  </div>
);
