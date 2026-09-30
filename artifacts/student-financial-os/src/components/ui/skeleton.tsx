import { cn } from '@/lib/utils';

/** Shimmer skeleton (direction follows reading order). Mirror the real layout's shapes. */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('skeleton-shimmer rounded-lg', className)}
      {...props}
    />
  );
}

export { Skeleton };
