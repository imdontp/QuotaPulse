import { cn } from '@/lib/utils';

/**
 * Loading placeholders that match the shape of what is arriving.
 *
 * Why this exists. The app had no loading language at all. Every surface rendered
 * `<Empty>Loading…</Empty>` -- a centred 13px muted line -- and five surfaces had no loading
 * branch whatsoever, so they fell through to their *empty* branch. That is not a cosmetic
 * difference: the Models view guarded on `loaded && models.length === 0`, so on a cold open
 * the first thing a user saw was "no models match your filters", which is a confident false
 * claim about their own data. `aria-busy` appeared nowhere in the codebase.
 *
 * A placeholder is a promise about layout. If the real thing is a card with a title, a
 * figure and three rows, then a single centred word is not a quieter version of that -- it
 * is a different shape, so the page jumps when the data lands. These are shaped after the
 * surfaces they stand in for, which is the only way the swap is invisible.
 *
 * The sweep is CSS (`animate-shimmer`, declared in `index.css`), not JS. That is the right
 * division: this is chrome, not data, so it needs no `useReducedMotion` branch, and the
 * stylesheet's existing reduced-motion clamp stops it for free. The colour never animates --
 * only a low-contrast highlight translates -- so it cannot wash out the contrast of whatever
 * text replaces it.
 */

/** One bar. The atom every other shape here is built from. */
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      aria-hidden="true"
      data-slot="skeleton"
      className={cn('bg-muted relative overflow-hidden rounded-[3px]', className)}
      {...props}
    >
      {/*
        A single child highlight, translated across. `inset-y-0 -left-full w-full` puts the
        highlight entirely outside the bar before the first frame, so the sweep enters from
        one edge instead of appearing mid-bar.
      */}
      <div className="animate-shimmer bg-linear-to-r from-background/0 via-background/45 absolute inset-y-0 -left-full w-full" />
    </div>
  );
}

/**
 * Wraps a loading region and announces it.
 *
 * The `aria-busy` and the visually hidden label are the part that is easy to omit and the
 * part that matters: a screen reader otherwise reads a page of unlabelled grey rectangles,
 * or worse, nothing at all, with no indication that the answer is on its way. The label is
 * required rather than defaulted because "the thing being loaded" is a different sentence
 * on every surface.
 */
export function SkeletonRegion({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/**
 * A run of text lines, the last one short.
 *
 * Every real paragraph in this app ends ragged, so a placeholder where all four lines are
 * the same width reads as a grid rather than as a sentence being assembled -- and the eye
 * notices the difference even when it cannot name it.
 */
export function SkeletonLines({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-2/5' : i % 2 ? 'w-11/12' : 'w-full')} />
      ))}
    </div>
  );
}

/**
 * The four-up figure row that opens Usage, Cost and the session drawer.
 *
 * Sized to the real tile: a short label bar, a tall figure bar in the same proportion as
 * `StatTile`'s number, and a note line. A placeholder that is a uniform stack of bars makes
 * the page look simpler than it is, and then the real tiles arrive and everything reflows.
 */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="border-border/70 bg-card rounded-xl border px-4 py-3.5">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="mt-2.5 h-6 w-24" />
          <Skeleton className="mt-2 h-2.5 w-28" />
        </div>
      ))}
    </div>
  );
}

/**
 * A table's worth of rows, under a real header.
 *
 * `cols` decides how many cells each row has, because the widths are what make a placeholder
 * look like a table. The row heights match `TableCell`'s padding so the height of the block
 * is right before the first row of data lands.
 */
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="flex flex-col">
      <div className="border-border/60 flex gap-4 border-b pb-2">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} className={cn('h-2.5', i === 0 ? 'w-24' : 'w-16')} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="border-border/40 flex items-center gap-4 border-b py-3 last:border-b-0">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className={cn('h-3', c === 0 ? 'w-32' : c === cols - 1 ? 'ml-auto w-12' : 'w-16')} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** A titled block the size of a section card, for panels with prose rather than figures. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="border-border/70 bg-card rounded-xl border px-4 py-4">
      <Skeleton className="h-3.5 w-32" />
      <SkeletonLines lines={lines} className="mt-3" />
    </div>
  );
}
