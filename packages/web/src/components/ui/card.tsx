import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * A section surface.
 *
 * `interactive` is for cards a person can act on -- a session row, a project bar, a quota
 * card that opens something. Those cards need to say so before they are clicked, and there
 * were two competing ways of saying it: one bespoke `.quota-card:hover` rule with its own
 * shadow, and nothing at all everywhere else. So a card that behaved like a control and a
 * card that was a label looked the same until the pointer arrived.
 *
 * The lift is a border and shadow, not a transform. A card can be tall, and scaling one
 * would move its contents; a shadow says "this is above" without moving anything. The
 * press is the same 3% squash the buttons use, so the two agree.
 */
export const Card = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & { interactive?: boolean }
>(({ className, interactive = false, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card"
    data-interactive={interactive ? '' : undefined}
    className={cn(
      'bg-card text-card-foreground min-w-0 rounded-2xl border shadow-xs',
      interactive &&
        'hover:shadow-md focus-within:shadow-md motion-base cursor-pointer transition-[box-shadow,border-color,transform] active:scale-[0.99]',
      className,
    )}
    {...props}
  />
));
Card.displayName = 'Card';

export const CardHeader = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div data-slot="card-header" className={cn('flex items-center gap-2 px-4 pt-4 pb-3', className)} {...props} />
);

export const CardTitle = ({ className, as: As = 'div', ...props }: React.ComponentProps<'div'> & { as?: 'div' | 'h2' | 'h3' | 'h4' }) => (
  <As data-slot="card-title" className={cn('text-[15px] leading-snug font-semibold', className)} {...props} />
);

export const CardDescription = ({ className, ...props }: React.ComponentProps<'p'>) => (
  <p data-slot="card-description" className={cn('text-muted-foreground text-xs leading-relaxed', className)} {...props} />
);

export const CardContent = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div data-slot="card-content" className={cn('px-4 pb-4', className)} {...props} />
);

/*
 * Every heading level in this app, in one place, because the one thing a heading outline
 * cannot do is guess.
 *
 * `CardTitle` drew a `div`, and it is the title primitive for every section card in the
 * dashboard -- Health's adapters and coverage, Sources' accounts and unbound groups, the
 * cost breakdowns, the settings panels. So none of those were headings: six of the eleven
 * surfaces had no heading element in their subtree at all, which removes them from a screen
 * reader's heading list and from jumping between sections by heading for everyone else.
 *
 * `as` is opt-in rather than automatic because the right level depends on nesting depth,
 * which only the call site knows. What this removes is the possibility of forgetting.
 */
