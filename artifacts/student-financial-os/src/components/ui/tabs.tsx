import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

/**
 * Pill segmented control with an animated gold indicator. The indicator is measured from the
 * active trigger (works in LTR/RTL and when wrapping); falls back gracefully to the trigger's own
 * active fill if measurement is unavailable.
 */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, ref) => {
  const localRef = React.useRef<HTMLDivElement | null>(null);
  const [box, setBox] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      localRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );
  React.useLayoutEffect(() => {
    const list = localRef.current;
    if (!list) return;
    const measure = () => {
      const active = list.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
      if (!active) return setBox((prev) => (prev === null ? prev : null));
      const next = { x: active.offsetLeft, y: active.offsetTop, w: active.offsetWidth, h: active.offsetHeight };
      setBox((prev) => (prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h ? prev : next));
    };
    measure();
    // Only react to tab state changes (ignore the indicator's own style/attribute churn).
    const mo = new MutationObserver((records) => {
      if (records.some((r) => r.type === 'childList' || (r.target as HTMLElement).getAttribute?.('role') === 'tab')) measure();
    });
    mo.observe(list, { attributes: true, subtree: true, attributeFilter: ['data-state'], childList: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(list);
    return () => { mo.disconnect(); ro?.disconnect(); };
  }, []);
  return (
    <TabsPrimitive.List
      ref={setRefs}
      data-indicator={box ? 'on' : 'off'}
      className={cn(
        'group/tabs relative inline-flex h-auto max-w-full flex-wrap items-center justify-start gap-1 rounded-full border border-border-subtle bg-surface-sunken p-1 text-muted-foreground',
        className,
      )}
      {...props}
    >
      {box ? (
        <span
          aria-hidden
          className="tabs-indicator pointer-events-none absolute left-0 top-0 rounded-full border border-gold-300/70 bg-surface shadow-sm dark:border-gold-700/60"
          style={{ transform: `translate(${box.x}px, ${box.y}px)`, width: box.w, height: box.h }}
        />
      ) : null}
      {children}
    </TabsPrimitive.List>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'relative z-[1] inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-full px-4 type-label transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground group-data-[indicator=off]/tabs:data-[state=active]:bg-surface group-data-[indicator=off]/tabs:data-[state=active]:shadow-sm [&_svg]:size-4',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:motion-fade',
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
