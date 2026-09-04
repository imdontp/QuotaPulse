import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

export const Tabs = TabsPrimitive.Root;

/*
 * The nav is a vertical rail in the sidebar. It stays a Radix Tabs list rather than a
 * list of links because the sections are panels of one page, not routes: keeping the
 * roving focus, the aria wiring and the panel association is free here and would all have
 * to be rebuilt by hand otherwise. Radix switches the arrow keys to up/down as long as
 * the Tabs root carries orientation="vertical".
 *
 * No card chrome of its own: the sidebar it sits in provides the surface and the border.
 */
export const TabsList = ({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) => (
  <TabsPrimitive.List className={cn('flex w-full flex-col gap-0.5', className)} {...props} />
);

/**
 * The active pill is a shared layoutId, so switching sections slides one element rather
 * than cross-fading two -- it reads as the same control moving, which is what it is. The
 * layout animation needs no changes to run vertically.
 *
 * `collapsed` hides the label rather than dropping it: the text stays in the accessible
 * name, and the caller pairs the narrow state with a tooltip.
 */
export const TabsTrigger = ({
  className,
  value,
  children,
  active,
  icon: Icon,
  collapsed = false,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & {
  active: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  collapsed?: boolean;
}) => (
  <TabsPrimitive.Trigger
    value={value}
    className={cn(
      'text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 relative flex w-full items-center gap-2.5 rounded-[7px] py-2 text-[13px] font-medium transition-colors outline-none focus-visible:ring-[3px]',
      collapsed ? 'justify-center px-0' : 'px-2.5',
      'data-[state=active]:text-foreground',
      className,
    )}
    {...props}
  >
    {active && (
      <motion.span
        layoutId="tab-pill"
        className="bg-secondary absolute inset-0 rounded-[7px] shadow-xs"
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      />
    )}
    {Icon && (
      <Icon
        className={cn(
          'relative z-10 size-[15px] shrink-0 transition-colors',
          active ? 'text-brand' : 'opacity-70',
        )}
      />
    )}
    <span className={cn('relative z-10 truncate', collapsed && 'sr-only')}>{children}</span>
  </TabsPrimitive.Trigger>
);

export const TabsContent = TabsPrimitive.Content;
