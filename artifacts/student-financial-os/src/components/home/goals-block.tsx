import { Link } from 'wouter';
import { getListSavingsGoalsQueryKey, useListSavingsGoals } from '@workspace/api-client-react';
import { MoneyDisplay } from '@/components/finance/money-display';
import { GoalProgress } from '@/components/goals/goal-progress';
import { Unavailable, type T } from './home-primitives';
import { GOAL_REFETCH } from '@/features/goals/goals-model';

const linkCls = 'type-label inline-flex min-h-11 items-center text-gold-ink underline-offset-4 hover:underline';

/** Real goal progress (active goals first) with per-currency reserved totals. Reserved money is never shown as spendable. */
export function GoalsHomeBlock({ t, limit = 3 }: { t: T; limit?: number }) {
  const q = useListSavingsGoals({ query: { queryKey: getListSavingsGoalsQueryKey(), ...GOAL_REFETCH } });
  if (q.isPending) return <div className="flex flex-col gap-3" aria-busy><div className="skeleton-shimmer h-10 rounded" /><div className="skeleton-shimmer h-10 rounded" /></div>;
  if (q.isError || !q.data) return <div className="flex flex-col items-start gap-1"><p role="alert" className="type-label text-destructive">{t('Goals did not load.', 'تعذّر تحميل الأهداف.')}</p><button type="button" className={linkCls} onClick={() => q.refetch()} data-testid="button-retry-goals">{t('Retry', 'إعادة المحاولة')}</button></div>;
  const active = q.data.goals.filter((g) => g.status === 'active' || g.status === 'paused');
  if (!q.data.goals.length) return <>
    <Unavailable testId="status-savings" label={t('No goals yet', 'لا أهداف بعد')} body={t('Set a target and start putting money aside — it stays yours but stops being spendable.', 'حدد هدفاً وابدأ بتجنيب المال — يبقى لك لكنه لا يُنفق.')} />
    <Link href="/goals" className={linkCls} data-testid="link-create-goal">{t('Create a goal', 'أنشئ هدفاً')}</Link>
  </>;
  return (
    <div className="flex flex-col gap-4" data-testid="block-goals">
      <div className="flex flex-wrap gap-x-8 gap-y-2" data-testid="text-goal-reserved">
        {q.data.totals.filter((c) => c.reserved.minor > 0).map((c) => (
          <div key={c.currency}><p className="type-caption text-muted-foreground">{t('Reserved', 'محجوز')} · {c.currency}</p><MoneyDisplay value={c.reserved} size="lg" tone="highlight" /></div>
        ))}
      </div>
      {active.slice(0, limit).map((g) => <Link key={g.id} href={`/goals/${g.id}`} className="block rounded-lg" data-testid={`link-home-goal-${g.id}`}><GoalProgress goal={g} t={t} /></Link>)}
      {!active.length ? <p className="type-label text-muted-foreground">{t('No active goals right now.', 'لا أهداف نشطة حالياً.')}</p> : null}
      <Link href="/goals" className={linkCls} data-testid="link-all-goals">{t(`All goals (${q.data.goals.length})`, `كل الأهداف (${q.data.goals.length})`)}</Link>
    </div>
  );
}
