import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * A native select styled to match the shadcn control set. Deliberately native rather
 * than a Radix popover: these are dense, frequently-changed filters where the OS
 * picker is faster, and it keeps keyboard and touch behaviour for free.
 */
export type SelectProps = React.ComponentProps<'select'> & { label?: string };

export const Select = ({ className, label, children, ...props }: SelectProps) => (
  <label className="inline-flex items-center gap-2">
    {label && <span className="text-muted-foreground text-xs whitespace-nowrap">{label}</span>}
    <select
      className={cn(
        'border-input bg-card hover:bg-accent/50 focus-visible:ring-ring/40 h-8 rounded-md border px-2.5 text-[12.5px] outline-none focus-visible:ring-[3px]',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  </label>
);
