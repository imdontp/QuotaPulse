import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  /*
   * The four states a control has, declared once, in the order a pointer meets them.
   *
   * The press state was the one missing, and it is the one a person notices first: a button
   * that changes on hover but does nothing when you push it reads as a label rather than a
   * control, and on a dashboard where the whole point is acting on a number quickly that is
   * felt as sluggishness. `active:scale-[0.97]` is a 3% squash on a 120ms step, which is
   * below the threshold where it becomes a bounce.
   *
   * The duration is the named `--motion-instant` step rather than Tailwind's unnamed 150ms
   * default, and it is the same step the nav pill and the hovers use, so a control's whole
   * interaction reads as one speed.
   */
  'inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap outline-none select-none motion-fast transition-[color,background-color,border-color,transform] focus-visible:ring-ring/40 focus-visible:ring-[3px] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'bg-card border hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-8 px-3 text-[13px]',
        sm: 'h-7 px-2.5 text-xs',
        icon: 'size-8',
      },
    },
    defaultVariants: { variant: 'outline', size: 'default' },
  },
);

export type ButtonProps = React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';
