import type { ReactNode } from 'react';
import { AlertTriangle, Check, CircleDashed, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Tone = 'empty' | 'error' | 'success';

const toneStyles: Record<Tone, { icon: typeof Check; ring: string }> = {
  empty: { icon: CircleDashed, ring: 'bg-muted text-muted-foreground' },
  error: { icon: AlertTriangle, ring: 'bg-destructive-soft text-destructive' },
  success: { icon: Check, ring: 'bg-success-soft text-success' },
};

/** Shared empty / error / success state. One voice everywhere. */
export function StatePanel({
  tone,
  title,
  body,
  action,
  icon,
  className,
}: {
  tone: Tone;
  title: string;
  body: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  const { icon: Icon, ring } = toneStyles[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('motion-rise flex flex-col items-start gap-4 py-8', className)}
      data-testid={`state-${tone}`}
    >
      <span className={cn('grid size-11 place-items-center rounded-full', ring, tone === 'success' && 'motion-pop')}>{icon ?? <Icon className="size-5" aria-hidden />}</span>
      <div className="flex max-w-md flex-col gap-1.5">
        <p className="text-base font-semibold">{title}</p>
        <p className="text-sm leading-6 text-muted-foreground">{body}</p>
      </div>
      {action}
    </div>
  );
}

export function RetryButton({ label, busyLabel, busy, onClick }: { label: string; busyLabel: string; busy?: boolean; onClick: () => void }) {
  return (
    <Button variant="outline" onClick={onClick} disabled={busy} aria-busy={busy} data-testid="button-retry">
      <RotateCw className={cn(busy && 'animate-spin')} aria-hidden />
      {busy ? busyLabel : label}
    </Button>
  );
}

/** Skeletal loading — mirrors the shape of the content it replaces. */
export function SkeletonRows({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className="flex flex-col divide-y divide-divider" data-testid="state-loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-4">
          <span className="skeleton-shimmer size-10 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <span className="skeleton-shimmer h-3.5 w-2/5 rounded" />
            <span className="skeleton-shimmer h-3 w-1/4 rounded" />
          </div>
          <span className="skeleton-shimmer h-4 w-16 rounded" />
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
