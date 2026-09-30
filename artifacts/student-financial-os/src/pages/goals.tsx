import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { Goal, Plus } from 'lucide-react';
import { getListSavingsGoalsQueryKey, useListSavingsGoals, type SavingsGoalStatus } from '@workspace/api-client-react';
import { Page, PageHeader, SectionHeading } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { RetryButton, StatePanel } from '@/components/states/state-panel';
import { MoneyDisplay } from '@/components/finance/money-display';
import { GoalCard } from '@/components/goals/goal-progress';
import { GoalFormDialog } from '@/components/goals/goal-form-dialog';
import { useAccount } from '@/features/auth/account';
import { useTx } from '@/features/money/money-model';
import { goalErrorText, GOAL_REFETCH, STATUS_LABEL, tl } from '@/features/goals/goals-model';

type Filter = 'all' | SavingsGoalStatus;
const FILTERS: Filter[] = ['all', 'active', 'paused', 'completed', 'archived'];

export default function GoalsPage() {
  const t = useTx();
  const me = useAccount();
  const [, navigate] = useLocation();
  const isStudent = me.role === 'student';
  const q = useListSavingsGoals({ query: { queryKey: getListSavingsGoalsQueryKey(), enabled: isStudent, ...GOAL_REFETCH } });
  const [filter, setFilter] = useState<Filter>('active');
  const [createOpen, setCreateOpen] = useState(false);
  const goals = useMemo(() => q.data?.goals ?? [], [q.data]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: goals.length, active: 0, paused: 0, completed: 0, archived: 0 };
    for (const g of goals) c[g.status] += 1;
    return c;
  }, [goals]);
  const shown = useMemo(() => goals.filter((g) => filter === 'all' || g.status === filter), [goals, filter]);

  if (!isStudent) {
    return <Page><StatePanel tone="permission" title={t('Savings goals belong to student accounts', 'أهداف الادخار لحسابات الطلاب')}
      body={me.role === 'parent' ? t('To add simulated funds to a goal you were invited to, use “Fund a goal”.', 'لإضافة أموال محاكاة إلى هدف دُعيت إليه، استخدم «تمويل هدف».') : t('Admin accounts do not hold goals.', 'حسابات المشرفين لا تحتوي أهدافاً.')}
      action={me.role === 'parent' ? <Button onClick={() => navigate('/goals/fund')} data-testid="button-go-fund">{t('Fund a goal', 'تمويل هدف')}</Button> : undefined} /></Page>;
  }

  return (
    <Page>
      <PageHeader eyebrow={t('SAVINGS GOALS', 'أهداف الادخار')} title={t('What you’re saving for', 'ما تدّخر من أجله')}
        lede={t('Each goal has its own protected reserve. Money you set aside stays yours, but it’s no longer counted as spendable.', 'لكل هدف احتياطي محمي خاص. المال الذي تجنّبه يبقى لك، لكنه لا يُحسب كقابل للإنفاق.')}
        actions={<Button onClick={() => setCreateOpen(true)} data-testid="button-new-goal"><Plus aria-hidden />{t('New goal', 'هدف جديد')}</Button>} />

      {q.isPending ? (
        <div className="flex flex-col gap-4" role="status" aria-label={t('Loading goals…', 'جارٍ تحميل الأهداف…')} data-testid="state-loading">
          <div className="skeleton-shimmer h-28 rounded-2xl" />
          <div className="grid gap-3 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton-shimmer h-40 rounded-2xl" />)}</div>
        </div>
      ) : q.isError || !q.data ? (
        <StatePanel tone="error" title={t('Goals did not load', 'تعذّر تحميل الأهداف')} body={goalErrorText(q.error, t)}
          action={<RetryButton label={t('Retry', 'إعادة المحاولة')} busyLabel={t('Retrying…', 'جارٍ المحاولة…')} busy={q.isRefetching} onClick={() => q.refetch()} />} />
      ) : (
        <div className="flex flex-col gap-10">
          {q.data.totals.length ? (
            <section aria-labelledby="goal-totals" className="flex flex-col gap-3">
              <h2 id="goal-totals" className="type-caption text-muted-foreground">{t('Your money, by currency', 'أموالك حسب العملة')}</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="list-goal-totals">
                {q.data.totals.map((c) => (
                  <dl key={c.currency} className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-card-border bg-card p-4 md:p-5" data-testid={`card-goal-totals-${c.currency}`}>
                    <div><dt className="type-caption text-muted-foreground">{t('Reserved in goals', 'محجوز في الأهداف')}</dt><dd><MoneyDisplay value={c.reserved} size="lg" tone="highlight" testId={`text-reserved-${c.currency}`} /></dd></div>
                    <div><dt className="type-caption text-muted-foreground">{t('Available to spend', 'متاح للإنفاق')}</dt><dd><MoneyDisplay value={c.available} size="lg" testId={`text-available-${c.currency}`} /></dd></div>
                    <div><dt className="type-caption text-muted-foreground">{t('Net balance', 'صافي الرصيد')}</dt><dd><MoneyDisplay value={c.netBalance} size="sm" testId={`text-net-${c.currency}`} /></dd></div>
                    <div><dt className="type-caption text-muted-foreground">{t('Goals need / month', 'تحتاج الأهداف شهرياً')}</dt><dd><MoneyDisplay value={c.requiredContributionMonthly} size="sm" tone="planned" testId={`text-required-${c.currency}`} /></dd></div>
                  </dl>
                ))}
              </div>
              <p className="type-caption text-muted-foreground">{t('Net = available + reserved. Completed and archived goals keep their reserved funds. Currencies are never mixed.', 'الصافي = المتاح + المحجوز. الأهداف المكتملة والمؤرشفة تحتفظ بأموالها المحجوزة. لا تُخلط العملات.')}</p>
            </section>
          ) : null}

          <section className="flex flex-col gap-3">
            <SectionHeading id="goals-list" title={t('Goals', 'الأهداف')} meta={t(`${q.data.activeCount} active · ${q.data.completedCount} completed`, `${q.data.activeCount} نشط · ${q.data.completedCount} مكتمل`)} />
            <div role="group" aria-label={t('Filter goals by status', 'تصفية الأهداف حسب الحالة')} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
              {FILTERS.map((f) => (
                <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}
                  className={`type-label min-h-10 shrink-0 rounded-full border px-3 ${filter === f ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`} data-testid={`button-filter-${f}`}>
                  {f === 'all' ? t('All', 'الكل') : tl(STATUS_LABEL, f, t)} <bdi className="tabular">{counts[f]}</bdi>
                </button>
              ))}
            </div>
            {!goals.length ? (
              <StatePanel tone="empty" icon={<Goal className="size-[18px]" aria-hidden />} title={t('No goals yet', 'لا أهداف بعد')}
                body={t('A laptop, a semester abroad, an emergency cushion — name it, set a target, and add to it from any account you own.', 'حاسوب، فصل في الخارج، احتياطي للطوارئ — سمّه وحدد مبلغاً وأضف إليه من أي حساب تملكه.')}
                action={<Button onClick={() => setCreateOpen(true)} data-testid="button-empty-new-goal">{t('Create your first goal', 'أنشئ هدفك الأول')}</Button>} />
            ) : !shown.length ? (
              <StatePanel tone="empty" className="py-5" title={t('Nothing in this view', 'لا شيء في هذا العرض')} body={t('Try another status filter.', 'جرّب تصفية أخرى.')} />
            ) : (
              <div className="stagger grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="list-goals">
                {shown.map((g) => <GoalCard key={g.id} goal={g} t={t} />)}
              </div>
            )}
          </section>
        </div>
      )}
      <GoalFormDialog open={createOpen} onOpenChange={setCreateOpen} t={t} onSaved={(g) => navigate(`/goals/${g.id}`)} />
    </Page>
  );
}
