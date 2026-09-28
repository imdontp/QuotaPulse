import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The two shapes every section in this app was rebuilding by hand.
 *
 * These exist because they were written out five and four times respectively, slightly
 * differently each time, and because both absences had consequences beyond the duplication:
 *
 * - There was no page-heading component, so five sections hand-rolled the same `<h2>` +
 *   note pair, and six of the eleven surfaces rendered *no heading element at all* --
 *   `CardTitle` draws a `<div>`, so Limits, Sources, Health, Alerts, Sessions and Cost had
 *   no entry in a screen reader's heading outline. A page whose title is not a heading is
 *   not navigable by heading, which is one of the few navigation aids that does not need a
 *   screen reader at all.
 *
 * - There was no stat-tile component, so the four-up figure row was rebuilt per section,
 *   and the sizes had drifted: Usage's tiles were `text-2xl` inside `pt-4`, while the
 *   session drawer's were different again. A page where the same kind of number is a
 *   different size on every tab does not read as one system.
 *
 * The design rule is that a *kind* of thing is drawn one way. A figure tile is a label, a
 * figure and an optional note, in that order, at one size. A page title is a heading, a
 * note, and optional trailing context, in that order, at one size.
 */

/**
 * A page title.
 *
 * `level` is the heading tag, and it is a required decision rather than a default: a section
 * title inside a tab panel is an `h2`, and a nested panel heading is an `h3`. Getting this
 * right is the only reason the six unheaded pages become navigable, so it is not something
 * to let a default quietly guess.
 */
export function PageHeader({
  title,
  blurb,
  context,
  level = 2,
  className,
}: {
  title: string;
  /** The one-to-three line note. Rendered as a `note` so the last line never orphans a word. */
  blurb?: string;
  /** Trailing context, right-aligned on wide screens: a timezone, a period, a row count. */
  context?: React.ReactNode;
  level?: 2 | 3;
  className?: string;
}) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-4 gap-y-1', className)}>
      <div className="min-w-0">
        <Heading className="text-[15px] font-semibold tracking-tight">{title}</Heading>
        {blurb && <p className="note text-muted-foreground mt-1 text-[12.5px] leading-relaxed">{blurb}</p>}
      </div>
      {context && <div className="text-muted-foreground shrink-0 text-xs">{context}</div>}
    </div>
  );
}

/**
 * A single figure with its label.
 *
 * `note` is deliberately last and optional: it is the only part of a figure that is ever
 * provisional ("last 3h", "3 of 4 feeds"), so it is the only part that may be absent, and
 * keeping it out of the fixed part means a tile without one does not get an empty row.
 */
export function StatTile({
  label,
  value,
  icon: Icon,
  note,
  className,
}: {
  label: string;
  /** A string, or a node -- `ValueDisplay` with its pricing dialog goes here. */
  value: React.ReactNode;
  icon?: LucideIcon;
  note?: string;
  className?: string;
}) {
  return (
    <div className={cn('border-border/70 bg-card rounded-xl border px-4 py-3.5', className)}>
      <div className="text-muted-foreground flex items-center gap-2 text-[11.5px] font-medium">
        {Icon && <Icon className="size-3.5 opacity-70" />}
        {label}
      </div>
      <div className="tabular mt-2.5 font-mono text-2xl leading-none font-semibold">{value}</div>
      {note && <div className="text-muted-foreground/80 mt-2 text-[11.5px]">{note}</div>}
    </div>
  );
}

/** The four-up row, because "2 on mobile, 4 on desktop" was decided the same way four times. */
export function StatTileRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)}>{children}</div>;
}
