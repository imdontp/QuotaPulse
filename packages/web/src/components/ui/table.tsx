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

export const TableHead = ({ className, ...props }: React.ComponentProps<'th'>) => (
  <th
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
