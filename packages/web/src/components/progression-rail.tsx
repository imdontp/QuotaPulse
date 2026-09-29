import { motion } from 'motion/react';
import {
  Activity, Anchor, CalendarDays, Database, Flame, Moon, ShieldCheck, Sunrise, Trophy, Wallet, Zap,
  type LucideIcon,
} from 'lucide-react';
import { BADGE_META, badgeShelf } from '@/lib/badges';
import type { BadgeId, Progress } from '@/lib/progress';
import { Hint } from '@/components/ui/tooltip';
import { useT } from '@/i18n';
import { useMotionPref } from '@/lib/motion';
import { cn } from '@/lib/utils';

const BADGE_ICON: Record<BadgeId, LucideIcon> = {
  'first-pulse': Zap,
  'streak-3': Flame,
  'streak-7': CalendarDays,
  'streak-30': Trophy,
  'cache-50': Database,
  'cache-80': Zap,
  'early-bird': Sunrise,
  'night-owl': Moon,
  steady: Anchor,
  thrifty: Wallet,
  guardian: ShieldCheck,
};

/**
 * Level, streak and the badge shelf.
 *
 * The scoring rule is stated on screen rather than hidden. A score the user cannot explain
 * is a score they stop trusting, and this one in particular has to not look like a spending
 * counter -- so the caption says out loud that it is earned by caching and by leaving
 * headroom, and the two live figures beside the bar are the cache share and the streak.
 * Neither moves when you burn more quota, which is the point.
 */
export function ProgressionRail({ progress }: { progress: Progress }) {
  const t = useT();
  const shelf = badgeShelf(progress.unlocked);
  const earned = shelf.filter((b) => b.earned).length;
  const remaining = progress.span - progress.into;

  return (
    <section aria-label={t('progress.level')} className="border-y">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 px-3 py-4 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <LevelDial progress={progress} />
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-semibold">
              {t('progress.level')} <span className="tabular">{progress.level}</span>
            </p>
            <p className="text-muted-foreground tabular mt-0.5 text-[11px]">
              {t('progress.xp', { into: Math.round(progress.into), span: progress.span })}
            </p>
            <p className="text-muted-foreground mt-0.5 text-[11px]">
              {remaining > 0
                ? t('progress.nextLevel', { xp: Math.ceil(remaining), level: progress.level + 1 })
                : t('progress.maxLevel')}
            </p>
          </div>
        </div>

        <Stat icon={Flame} label={t('progress.streak')} value={
          progress.streak > 0
            ? t(progress.streak === 1 ? 'progress.streakDay' : 'progress.streakDays', { n: progress.streak })
            : t('progress.streakNone')
        } tone={progress.streak > 0 ? 'text-warn' : undefined} />

        <Stat icon={Database} label={t('live.cacheToday')} value={t('progress.cacheShare', { pct: progress.cacheShare.toFixed(1) })} />

        <div className="min-w-[11rem] flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-muted-foreground text-[11px]">{t('progress.badges')}</p>
            <p className="text-muted-foreground tabular text-[11px]">
              {t('progress.badgesCount', { earned, total: shelf.length })}
            </p>
          </div>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {shelf.map(({ id, earned: has }) => {
              const Icon = BADGE_ICON[id];
              const meta = BADGE_META[id];
              return (
                <li key={id}>
                  <Hint text={`${t(meta.name)} — ${t(meta.hint)}`}>
                    <span
                      className={cn(
                        'flex size-6 items-center justify-center rounded-md border transition-colors',
                        has
                          ? 'border-brand/40 bg-brand/12 text-brand'
                          : 'text-muted-foreground/35 border-border bg-transparent',
                      )}
                      aria-label={`${t(meta.name)} — ${has ? t('progress.unlocked') : t('progress.locked')}`}
                      aria-hidden={has ? undefined : 'true'}
                      data-badge={id}
                      data-earned={has ? 'true' : 'false'}
                    >
                      <Icon className="size-3.5" />
                    </span>
                  </Hint>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <p className="text-muted-foreground border-t px-3 py-2 text-[11px] leading-relaxed sm:px-4">
        {t('progress.hint')}
      </p>
    </section>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
        <Icon className={cn('size-3.5 shrink-0', tone)} />
        <span className="truncate">{label}</span>
      </p>
      <p className={cn('tabular mt-1 text-[13px] font-semibold', tone)}>{value}</p>
    </div>
  );
}

/** A small echo of the quota ring, so the level reads as the same family of object. */
function LevelDial({ progress }: { progress: Progress }) {
  const pref = useMotionPref();
  const t = useT();
  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative size-11 shrink-0">
      <svg viewBox="0 0 40 40" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="20" cy="20" r={radius} fill="none" stroke="var(--track)" strokeWidth="3" />
        <motion.circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="3"
          strokeLinecap="round"
          initial={pref.enter({ strokeDasharray: `0 ${circumference}` })}
          animate={{ strokeDasharray: `${(progress.levelPct / 100) * circumference} ${circumference}` }}
          transition={pref.reveal('deliberate')}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="tabular text-[13px] font-semibold">{progress.level}</span>
      </div>
      <span className="sr-only">{t('progress.levelShort')}</span>
    </div>
  );
}
