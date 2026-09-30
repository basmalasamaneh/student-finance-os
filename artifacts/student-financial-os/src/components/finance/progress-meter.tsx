import type { ReactNode } from 'react';
import { formatPercent } from '@/lib/money';
import { useI18n } from '@/features/i18n/i18n-provider';
import { cn } from '@/lib/utils';

type Status = 'on' | 'near' | 'done' | 'over';
type Kind = 'default' | 'savings' | 'budget';

/**
 * Progress with the number always visible — never colour alone. value is 0..1.
 * savings: gold fill → calm green when complete (the gold/mint relationship).
 * budget:  ink fill → amber when close or over plan (red is reserved for errors).
 * value may exceed 1: the label shows the real percentage, the bar clamps.
 */
export function ProgressMeter({
  value,
  label,
  statusLabel,
  status = 'on',
  kind = 'default',
  detail,
  className,
}: {
  value: number;
  label: string;
  statusLabel?: string;
  status?: Status;
  kind?: Kind;
  /** Optional supporting line, e.g. "₪1,860 of ₪4,200". */
  detail?: ReactNode;
  className?: string;
}) {
  const { locale } = useI18n();
  const shown = Math.max(0, value);
  const clamped = Math.min(1, shown);
  const fill =
    status === 'over'
      ? 'bg-warning'
      : status === 'done'
        ? 'bg-success'
        : status === 'near'
          ? kind === 'budget' ? 'bg-warning' : 'bg-primary'
          : kind === 'budget' ? 'bg-foreground/80' : 'bg-primary';
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <span className="type-body font-medium">{label}</span>
        <span className="tabular type-label font-medium">
          <bdi>{formatPercent(shown, locale)}</bdi>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
        aria-valuetext={`${formatPercent(shown, locale)}${statusLabel ? ` — ${statusLabel}` : ''}`}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full w-full origin-left rounded-full transition-transform duration-200 ease-out rtl:origin-right', fill)}
          style={{ transform: `scaleX(${clamped})` }}
        />
      </div>
      {detail || statusLabel ? (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 type-label font-normal text-muted-foreground">
          <span className="tabular min-w-0">{detail}</span>
          {statusLabel ? <span className={cn(status === 'over' && 'font-medium text-warning', status === 'near' && kind === 'budget' && 'text-warning', status === 'done' && 'text-success')}>{statusLabel}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
