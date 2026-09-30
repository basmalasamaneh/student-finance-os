'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/lib/utils';

/** Gold gradient fill on a gold track; grows on mount (reduced motion collapses it). */
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn('track-gold relative h-2 w-full overflow-hidden rounded-full', className)}
      value={value}
      {...props}
    >
      <div className="h-full w-full origin-left rtl:origin-right" style={{ transform: `scaleX(${v / 100})` }}>
        <ProgressPrimitive.Indicator className="fill-gold motion-grow h-full w-full origin-left rounded-full rtl:origin-right" />
      </div>
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
