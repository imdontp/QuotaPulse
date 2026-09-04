import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

export const TooltipProvider = ({
  delayDuration = 180,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) => (
  <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />
);

export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = ({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      sideOffset={sideOffset}
      className={cn(
        'bg-popover text-popover-foreground z-50 max-w-72 rounded-md border px-2.5 py-1.5 text-xs leading-relaxed shadow-md',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
);

/**
 * Shorthand for the common "wrap this in an explanatory tooltip" case.
 *
 * `children` must be a single element that FORWARDS ITS REF to a DOM node: Radix clones
 * it and anchors the popper to that node. A component that swallows the ref still shows
 * hover state and still opens the tooltip -- it just renders it off-screen, with nothing
 * in the console to say so.
 */
export const Hint = ({ text, children }: { text: React.ReactNode; children: React.ReactNode }) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent>{text}</TooltipContent>
  </Tooltip>
);
