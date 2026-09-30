import { formatPercent } from '@/lib/money';
import { useI18n } from '@/features/i18n/i18n-provider';
import { cn } from '@/lib/utils';

type Status = 'on' | 'near' | 'done';

/** Progress with the number always visible — never colour alone. value is 0..1. */
export function ProgressMeter({ value, label, statusLabel, status = 'on', className }: { value: number; label: string; statusLabel?: string; status?: Status; className?: string }) {
  const { locale } = useI18n();
  const clamped = Math.min(1, Math.max(0, value));
  const fill = status === 'done' ? 'bg-success' : status === 'near' ? 'bg-[hsl(var(--amber-raw))]' : 'bg-primary';
  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular text-muted-foreground">
          {statusLabel ? <span className="me-2">{statusLabel}</span> : null}
          <bdi>{formatPercent(clamped, locale)}</bdi>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
        aria-valuetext={`${formatPercent(clamped, locale)}${statusLabel ? ` — ${statusLabel}` : ''}`}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full w-full origin-left rounded-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] rtl:origin-right', fill)}
          style={{ transform: `scaleX(${clamped})` }}
        />
      </div>
    </div>
  );
}
