import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-px text-[10.5px] font-medium whitespace-nowrap tabular',
  {
    variants: {
      variant: {
        default: 'border-border bg-muted/60 text-muted-foreground',
        ok: 'border-ok/30 bg-ok/10 text-ok',
        warn: 'border-warn/30 bg-warn/10 text-warn',
        crit: 'border-crit/35 bg-crit/10 text-crit',
        outline: 'border-border text-muted-foreground',
        /** The origin file a reading came from: present, but never competing for attention. */
        origin: 'border-transparent bg-transparent px-1 font-mono text-[10px] text-muted-foreground/70',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export type BadgeProps = React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

/**
 * forwardRef is load-bearing, not ceremony.
 *
 * A Badge is used as a tooltip trigger (`Hint` -> Radix `TooltipTrigger asChild`), which
 * clones it and attaches a ref to anchor the popper. React 18 drops refs on a plain
 * function component **silently** -- no warning at all in a production build -- and the
 * failure is invisible rather than obvious: the tooltip still opens, but with no anchor
 * floating-ui never positions it, so it stays parked at `translate(0, -200%)`, two
 * viewport-heights above the page. Every freshness and origin badge on Limits and on the
 * Live gauges was dead this way. Do not unwrap this.
 */
export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  ),
);
Badge.displayName = 'Badge';
