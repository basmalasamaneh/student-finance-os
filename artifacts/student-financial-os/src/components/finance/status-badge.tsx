import { AlertTriangle, CalendarClock, Check, Circle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

const map: Record<StatusTone, { icon: typeof Check; cls: string }> = {
  neutral: { icon: Circle, cls: 'bg-muted text-muted-foreground' },
  info: { icon: CalendarClock, cls: 'bg-primary-soft text-gold-ink' },
  success: { icon: Check, cls: 'bg-success-soft text-success' },
  warning: { icon: AlertTriangle, cls: 'bg-warning-soft text-warning' },
  error: { icon: X, cls: 'bg-destructive-soft text-destructive' },
};

/** Status always pairs an icon with a word. Pills are reserved for status. */
export function StatusBadge({ tone, label, className }: { tone: StatusTone; label: string; className?: string }) {
  const { icon: Icon, cls } = map[tone];
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium', cls, className)} data-testid={`status-${tone}`}>
      <Icon className="size-3" aria-hidden strokeWidth={2.4} />
      {label}
    </span>
  );
}
