import { motion, useReducedMotion } from 'motion/react';
import { fractionToAngle, ringArcs, type RingWindow } from '@/lib/quota-ring';
import { severityOf } from '@/format';
import { cn } from '@/lib/utils';

/**
 * The quota ring: one arc per subscription, reading as a single object instead of a row of
 * cards. The value arc is the percentage you already had; the outer track is the other half
 * of the story, because a quota window is a span of time as much as a budget, and where
 * "now" sits in it is what tells you whether a number is comfortable or urgent.
 *
 * `aria-hidden` on purpose. The hero renders a complete text legend beside this, and a
 * screen reader announcing the same three subscriptions twice is worse than one good list.
 */
export interface RingItem {
  key: string;
  name: string;
  /** 0-100, or null when there is no current reading. */
  used: number | null;
  expired: boolean;
}

const CX = 200;
const CY = 200;
const WEDGE = 6;

function polar(radius: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return { x: CX + radius * Math.cos(radians), y: CY + radius * Math.sin(radians) };
}

export function QuotaRing({
  items,
  window: windowProgress,
  className,
}: {
  items: RingItem[];
  window?: RingWindow;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const arcs = ringArcs(items.length);
  const outer = arcs[0];
  const wedgeRadius = outer ? outer.radius + outer.strokeWidth / 2 + WEDGE : 0;
  const sweep = { duration: reduced ? 0 : 0.75, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <svg
      viewBox="0 0 400 400"
      className={cn('size-full', className)}
      aria-hidden="true"
      data-testid="pulse-ring"
      data-pulse-arcs={items.length}
    >
      {items.map((item, index) => {
        const arc = arcs[index];
        if (!arc) return null;
        const used = item.expired || item.used == null ? null : Math.min(100, Math.max(0, item.used));
        const tone = item.expired ? 'var(--muted-foreground)' : `var(--${severityOf(used)})`;
        return (
          <g key={item.key}>
            <circle
              cx={CX}
              cy={CY}
              r={arc.radius}
              fill="none"
              stroke={item.expired ? 'var(--border)' : 'var(--track)'}
              strokeWidth={arc.strokeWidth}
              strokeDasharray={item.expired ? '2 7' : undefined}
              strokeLinecap="round"
            />
            {used != null && (
              <motion.circle
                cx={CX}
                cy={CY}
                r={arc.radius}
                fill="none"
                stroke={tone}
                strokeWidth={arc.strokeWidth}
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray="100 100"
                /* A fixed 100-on/100-off dash means the spring animates one scalar, so the
                   arc eases into a new reading instead of snapping on every SSE push. */
                initial={reduced ? false : { strokeDashoffset: 100 }}
                animate={{ strokeDashoffset: 100 - used }}
                transition={{ ...sweep, type: reduced ? undefined : 'spring', stiffness: 90, damping: 22 }}
                transform={`rotate(-90 ${CX} ${CY})`}
              />
            )}
          </g>
        );
      })}

      {/*
        The time track. Three bands, outermost in: how much of the window has gone, the
        slice it will burn through before the reset, and a tick at the projected 100%. The
        middle band only appears when the projection lands before the reset, which is the
        one case where the shape of the future is actually bad news.
      */}
      {windowProgress?.elapsed != null && outer && (
        <g>
          <circle
            cx={CX}
            cy={CY}
            r={wedgeRadius}
            fill="none"
            stroke="var(--track)"
            strokeWidth={2}
          />
          <motion.circle
            cx={CX}
            cy={CY}
            r={wedgeRadius}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeWidth={2}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="100 100"
            initial={reduced ? false : { strokeDashoffset: 100 }}
            animate={{ strokeDashoffset: 100 - windowProgress.elapsed * 100 }}
            transition={sweep}
            transform={`rotate(-90 ${CX} ${CY})`}
          />
          {windowProgress.projected != null && windowProgress.willRunOut && (
            <motion.circle
              cx={CX}
              cy={CY}
              r={wedgeRadius}
              fill="none"
              stroke="var(--crit)"
              strokeOpacity={0.55}
              strokeWidth={2}
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray="100 100"
              initial={reduced ? false : { strokeDashoffset: 100 }}
              animate={{
                strokeDashoffset: 100 - (windowProgress.projected - windowProgress.elapsed) * 100,
              }}
              transition={sweep}
              transform={`rotate(${-90 + windowProgress.elapsed * 360} ${CX} ${CY})`}
            />
          )}
          {windowProgress.projected != null &&
            (() => {
              const angle = fractionToAngle(windowProgress.projected);
              const inner = polar(wedgeRadius - 5, angle);
              const tip = polar(wedgeRadius + 5, angle);
              return (
                <line
                  x1={inner.x}
                  y1={inner.y}
                  x2={tip.x}
                  y2={tip.y}
                  stroke={windowProgress.willRunOut ? 'var(--crit)' : 'var(--muted-foreground)'}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
              );
            })()}
        </g>
      )}
    </svg>
  );
}
