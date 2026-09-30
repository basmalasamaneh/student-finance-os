import type { ReactNode } from 'react';
import { AlertTriangle, Check, CircleDashed, Info, Lock, RotateCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Tone = 'empty' | 'error' | 'success' | 'permission';

const toneStyles: Record<Tone, { icon: typeof Check; ring: string }> = {
  empty: { icon: CircleDashed, ring: 'bg-primary-soft text-gold-ink' },
  error: { icon: AlertTriangle, ring: 'bg-destructive-soft text-destructive' },
  success: { icon: Check, ring: 'bg-success-soft text-success' },
  permission: { icon: Lock, ring: 'bg-primary-soft text-gold-ink' },
};

/** Shared empty / error / success / permission-limited state. One voice everywhere. */
export function StatePanel({
  tone,
  title,
  body,
  action,
  icon,
  className,
  align = 'start',
}: {
  tone: Tone;
  title: string;
  body: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
  /** Optional: center the composition (empty pages); default start-aligned. */
  align?: 'start' | 'center';
}) {
  const { icon: Icon, ring } = toneStyles[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('motion-rise flex flex-col gap-4 py-8', align === 'center' ? 'items-center text-center' : 'items-start', className)}
      data-testid={`state-${tone}`}
    >
      {/* Gold line-art mark: concentric hairline rings around a tinted glyph. */}
      <span aria-hidden className={cn('relative grid size-16 place-items-center rounded-full border border-dashed border-gold-300/80 dark:border-gold-700/70', align === 'center' && 'self-center')}>
        <span className="absolute inset-1.5 rounded-full border border-gold-200/80 dark:border-gold-800/70" />
        <span className={cn('relative grid size-10 place-items-center rounded-full', ring, tone === 'success' && 'motion-pop')}>{icon ?? <Icon className="size-5" />}</span>
      </span>
      <div className="flex max-w-md flex-col gap-1.5">
        <p className="type-subtitle">{title}</p>
        <p className="type-label font-normal text-muted-foreground">{body}</p>
      </div>
      {action}
    </div>
  );
}

type NoticeTone = 'success' | 'warning' | 'error' | 'info';
const noticeStyles: Record<NoticeTone, { icon: typeof Check; bar: string; ink: string }> = {
  success: { icon: Check, bar: 'bg-success', ink: 'text-success' },
  warning: { icon: AlertTriangle, bar: 'bg-warning', ink: 'text-warning' },
  error: { icon: X, bar: 'bg-destructive', ink: 'text-destructive' },
  info: { icon: Info, bar: 'bg-primary', ink: 'text-gold-ink' },
};

/** Inline notice: a hairline accent on the start edge, icon + title + one sentence. No filled boxes. */
export function Notice({ tone, title, body, className }: { tone: NoticeTone; title: string; body: string; className?: string }) {
  const { icon: Icon, bar, ink } = noticeStyles[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('relative flex gap-3 py-1 ps-4', className)} data-testid={`notice-${tone}`}>
      <span aria-hidden className={cn('absolute inset-y-0 start-0 w-0.5 rounded-full', bar)} />
      <Icon className={cn('mt-0.5 size-4 shrink-0', ink)} aria-hidden strokeWidth={2.2} />
      <div className="flex flex-col gap-0.5">
        <p className="type-label font-semibold">{title}</p>
        <p className="type-label font-normal text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

export function RetryButton({ label, busyLabel, busy, onClick }: { label: string; busyLabel: string; busy?: boolean; onClick: () => void }) {
  return (
    <Button variant="outline" onClick={onClick} disabled={busy} aria-busy={busy} className="self-start" data-testid="button-retry">
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
