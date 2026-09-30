import { Link } from 'wouter';
import type { SavingsGoal } from '@workspace/api-client-react';
import { ProgressMeter } from '@/components/finance/progress-meter';
import { MoneyDisplay } from '@/components/finance/money-display';
import { useI18n } from '@/features/i18n/i18n-provider';
import type { Tx } from '@/features/money/money-model';
import { fmtDate, isFunded, pct, PRIORITY_LABEL, STATUS_LABEL, tl } from '@/features/goals/goals-model';
import { cn } from '@/lib/utils';

export function StatusPill({ status, t }: { status: SavingsGoal['status']; t: Tx }) {
  const tone = status === 'active' ? 'bg-primary-soft text-gold-ink' : status === 'completed' ? 'bg-success-soft text-success' : status === 'paused' ? 'bg-warning-soft text-warning' : 'bg-muted text-muted-foreground';
  return <span className={cn('type-caption inline-flex items-center rounded-full px-2 py-0.5 font-medium', tone)} data-testid={`status-goal-${status}`}>{tl(STATUS_LABEL, status, t)}</span>;
}

export function GoalProgress({ goal, t, compact }: { goal: Pick<SavingsGoal, 'name' | 'percentage' | 'current' | 'target' | 'remaining' | 'status'>; t: Tx; compact?: boolean }) {
  const done = isFunded(goal);
  return (
    <ProgressMeter kind="savings" value={pct(goal)} label={compact ? t('Saved', 'المدّخر') : goal.name}
      status={done ? 'done' : goal.percentage >= 80 ? 'near' : 'on'}
      statusLabel={done ? t('Fully funded', 'مموّل بالكامل') : undefined}
      detail={<span><MoneyDisplay value={goal.current} size="sm" className="inline" /> {t('of', 'من')} <MoneyDisplay value={goal.target} size="sm" className="inline" /></span>} />
  );
}

export function GoalCard({ goal, t }: { goal: SavingsGoal; t: Tx }) {
  const { locale } = useI18n();
  return (
    <Link href={`/goals/${goal.id}`} className="hover-elevate flex min-w-0 flex-col gap-3 rounded-card border border-card-border bg-card p-4 shadow-xs md:p-5" data-testid={`card-goal-${goal.id}`}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="type-subtitle break-words" data-testid={`text-goal-name-${goal.id}`}>{goal.name}</p>
          <p className="type-caption text-muted-foreground break-words">{goal.category} · {t('Priority', 'الأولوية')}: {tl(PRIORITY_LABEL, goal.priority, t)}</p>
        </div>
        <StatusPill status={goal.status} t={t} />
      </div>
      <GoalProgress goal={goal} t={t} compact />
      <div className="type-caption flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
        <span>{t('Remaining', 'المتبقي')}: <MoneyDisplay value={goal.remaining} size="sm" className="inline !text-xs" /></span>
        {goal.requiredContributionMonthly ? <span>{t('Needs', 'يتطلب')} <MoneyDisplay value={goal.requiredContributionMonthly} size="sm" className="inline !text-xs" />/{t('mo', 'شهر')}</span> : null}
        <span>{goal.targetDate ? `${t('By', 'بحلول')} ${fmtDate(goal.targetDate, locale)}` : t('No target date', 'بلا تاريخ مستهدف')}</span>
      </div>
    </Link>
  );
}
