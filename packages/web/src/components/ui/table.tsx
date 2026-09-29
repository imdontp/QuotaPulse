import * as React from 'react';
import { cn } from '@/lib/utils';

/** Wide tables scroll inside their own container so the page body never does. */
export const Table = ({ className, ...props }: React.ComponentProps<'table'>) => (
  <div className="w-full overflow-x-auto">
    <table
      className={cn('w-full caption-bottom border-collapse text-[12.5px]', className)}
      {...props}
    />
  </div>
);

export const TableHeader = (props: React.ComponentProps<'thead'>) => <thead {...props} />;
export const TableBody = (props: React.ComponentProps<'tbody'>) => <tbody {...props} />;

export const TableRow = ({ className, ...props }: React.ComponentProps<'tr'>) => (
  <tr className={cn('hover:bg-muted/40 border-t transition-colors', className)} {...props} />
);

/**
 * A column header.
 *
 * `scope="col"` is set here rather than at the eleven call sites, because every table in this
 * app uses its header row to label columns and a `<th>` without a scope tells a screen reader
 * only that it is a header, not what it heads. With eleven tables and no shared authoring
 * habit, the reliable place for it is the primitive.
 *
 * `aria-sort` is deliberately absent. It is only correct on a column a person can sort, and
 * no table in this app has one: every `.sort()` in the codebase is a fixed ranking by cost or
 * tokens, with no control to reverse it. Announcing `aria-sort="descending"` on those would
 * advertise an affordance that does not exist, which is a worse error than saying nothing.
 */
export const TableHead = ({ className, scope = 'col', ...props }: React.ComponentProps<'th'>) => (
  <th
    scope={scope}
    className={cn(
      'text-muted-foreground px-4 py-2.5 text-left text-[10.5px] font-semibold tracking-wider uppercase whitespace-nowrap',
      className,
    )}
    {...props}
  />
);

export const TableCell = ({ className, ...props }: React.ComponentProps<'td'>) => (
  <td className={cn('px-4 py-2.5 align-middle', className)} {...props} />
);

/** Right-aligned figures with a gutter, so a number never butts against the next column. */
export const numCell = 'text-right tabular font-mono';
