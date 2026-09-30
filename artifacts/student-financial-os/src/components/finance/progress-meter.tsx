import { useId, type ReactNode } from 'react';
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
          ? kind === 'budget' ? 'bg-warning' : 'fill-gold'
          : 'fill-gold';
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
        className="track-gold h-2 overflow-hidden rounded-full"
      >
        <div className="h-full w-full origin-left transition-transform duration-200 ease-out rtl:origin-right" style={{ transform: `scaleX(${clamped})` }}>
          <div className={cn('motion-grow h-full w-full origin-left rounded-full rtl:origin-right', fill)} />
        </div>
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

/**
 * Circular goal ring: gold gradient stroke on a gold track, sweeps in on mount (reduced motion
 * collapses the animation). value is 0..1 (clamped for drawing). Put the % or amount in children.
 */
export function GoalRing({
  value,
  label,
  size = 72,
  stroke = 7,
  done,
  children,
  className,
}: {
  value: number;
  label: string;
  size?: number;
  stroke?: number;
  done?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const { locale } = useI18n();
  const gid = useId().replace(/:/g, '');
  const clamped = Math.min(1, Math.max(0, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuetext={formatPercent(Math.max(0, value), locale)}
      className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 rtl:scale-x-[-1]" aria-hidden>
        <defs>
          <linearGradient id={`ring-${gid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" className="ring-stop-a" />
            <stop offset="50%" className="ring-stop-b" />
            <stop offset="100%" className="ring-stop-c" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="ring-track" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={done ? 'hsl(var(--success))' : `url(#ring-${gid})`}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          className="motion-ring"
          style={{ ['--ring-c' as string]: `${c}` }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-center">
        {children ?? <span className="tabular type-label font-semibold"><bdi>{formatPercent(Math.max(0, value), locale)}</bdi></span>}
      </span>
    </div>
  );
}
