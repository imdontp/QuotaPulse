import * as React from 'react';
import { cn } from '@/lib/utils';

export const Card = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card"
      className={cn('bg-card text-card-foreground min-w-0 rounded-2xl border shadow-xs', className)}
      {...props}
    />
  ),
);
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
