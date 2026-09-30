import { useState } from 'react';
import { Link, useParams } from 'wouter';
import { Archive, ArrowLeft, ArrowRight, CheckCircle2, Pause, Pencil, Play, PiggyBank } from 'lucide-react';
import {
  ApiError, getGetSavingsGoalHistoryQueryKey, getGetSavingsGoalQueryKey, getListFinanceAccountsQueryKey,
  useChangeSavingsGoalStatus, useGetSavingsGoal, useGetSavingsGoalHistory, useListFinanceAccounts,
  type SavingsGoal, type SavingsGoalActionAction,
} from '@workspace/api-client-react';
import { Page } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { RetryButton, SkeletonRows, StatePanel } from '@/components/states/state-panel';
import { MoneyDisplay } from '@/components/finance/money-display';
import { GoalProgress, StatusPill } from '@/components/goals/goal-progress';
import { GoalFormDialog } from '@/components/goals/goal-form-dialog';
import { ContributeDialog } from '@/components/goals/contribute-dialog';
import { InvitationPanel } from '@/components/goals/invitation-panel';
import { useAccount } from '@/features/auth/account';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useTx, type Tx } from '@/features/money/money-model';
import { isUuid } from '@/features/transactions/history-filters';
import {
  ACTION_LABEL, fmtDate, fmtDateTime, goalErrorText, GOAL_REFETCH, isFunded, PRIORITY_LABEL, SOURCE_LABEL, tl,
  useRefreshAfterGoalChange, useSubmissionKey,
} from '@/features/goals/goals-model';

const CONFIRM: Record<SavingsGoalActionAction, { title: [string, string]; body: [string, string]; cta: [string, string] }> = {
  pause: { title: ['Pause this goal?', 'إيقاف الهدف مؤقتاً؟'], body: ['No contributions while paused, and it drops out of your monthly forecast. Saved money stays reserved.', 'لا مساهمات أثناء الإيقاف، ويخرج من توقعاتك الشهرية. المال المدّخر يبقى محجوزاً.'], cta: ['Pause', 'إيقاف مؤقت'] },
  resume: { title: ['Resume this goal?', 'استئناف الهدف؟'], body: ['Contributions reopen and any target date counts in your forecast again.', 'تُفتح المساهمات مجدداً ويُحسب التاريخ المستهدف في توقعاتك.'], cta: ['Resume', 'استئناف'] },
  complete: { title: ['Mark as complete?', 'تعليم كمكتمل؟'], body: ['The goal is fully funded. Completing locks it from edits and contributions. Its reserved funds stay reserved — there is no withdrawal.', 'الهدف مموّل بالكامل. الإكمال يقفله عن التعديل والمساهمات. أمواله المحجوزة تبقى محجوزة — لا يوجد سحب.'], cta: ['Mark complete', 'تعليم كمكتمل'] },
  archive: { title: ['Archive permanently?', 'أرشفة نهائية؟'], body: ['Archiving is final and cannot be undone. The goal stops accepting money, and everything already saved stays reserved — it does not return to your spendable balance.', 'الأرشفة نهائية ولا يمكن التراجع عنها. يتوقف الهدف عن قبول المال، وكل ما ادُّخر يبقى محجوزاً — لا يعود إلى رصيدك القابل للإنفاق.'], cta: ['Archive forever', 'أرشفة نهائياً'] },
};

function Metric({ label, children, testId, hint }: { label: string; children: React.ReactNode; testId: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 py-3">
      <dt className="type-caption text-muted-foreground">{label}</dt>
      <dd className="type-label min-w-0 break-words" data-testid={testId}>{children}</dd>
      {hint ? <p className="type-caption text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function History({ goal, t }: { goal: SavingsGoal; t: Tx }) {
  const { locale } = useI18n();
  const h = useGetSavingsGoalHistory(goal.id, { query: { queryKey: getGetSavingsGoalHistoryQueryKey(goal.id), ...GOAL_REFETCH } });
  return (
    <section aria-labelledby="history-title" className="flex flex-col gap-3 border-t border-divider py-7">
      <h2 id="history-title" className="type-title">{t('History', 'السجل')}</h2>
      {h.isPending ? <SkeletonRows rows={3} label={t('Loading history…', 'جارٍ تحميل السجل…')} />
        : h.isError ? <StatePanel tone="error" className="py-4" title={t('History did not load', 'تعذّر تحميل السجل')} body={goalErrorText(h.error, t)} action={<RetryButton label={t('Retry', 'إعادة المحاولة')} busyLabel="…" busy={h.isRefetching} onClick={() => h.refetch()} />} />
          : !h.data?.length ? <p className="type-label text-muted-foreground">{t('No events yet.', 'لا أحداث بعد.')}</p>
            : (
              <ol className="divide-y divide-divider border-y border-divider" data-testid="list-goal-history">
                {h.data.map((e) => (
                  <li key={e.id} className="flex flex-col gap-1 py-3" data-testid={`row-history-${e.id}`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="type-label">{tl(ACTION_LABEL, e.action, t)}</span>
                      {e.amount ? <MoneyDisplay value={e.amount} size="sm" tone="positive" showPlus /> : null}
                    </div>
                    <p className="type-caption text-muted-foreground"><bdi>{fmtDateTime(e.createdAt, locale)}</bdi>{e.source ? ` · ${tl(SOURCE_LABEL, e.source, t)}` : ''}</p>
                    {e.note ? <p className="type-caption break-words">{e.note}</p> : null}
                    {e.transactionIds.length ? (
                      <div className="flex flex-wrap gap-x-4">
                        {e.transactionIds.map((id, i) => <Link key={id} href={`/transactions/${id}`} className="type-caption inline-flex min-h-9 items-center text-gold-ink underline-offset-4 hover:underline" data-testid={`link-history-tx-${id}`}>{t(`Receipt ${i + 1}`, `إيصال ${i + 1}`)}</Link>)}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
    </section>
  );
}

function Detail({ goal, t }: { goal: SavingsGoal; t: Tx }) {
  const { locale } = useI18n();
  const accounts = useListFinanceAccounts({ query: { queryKey: getListFinanceAccountsQueryKey(), ...GOAL_REFETCH } });
  const [editOpen, setEditOpen] = useState(false);
  const [contribOpen, setContribOpen] = useState(false);
  const [pending, setPending] = useState<SavingsGoalActionAction | null>(null);
  const idem = useSubmissionKey(`${goal.id}|${pending ?? ''}`);
  const refresh = useRefreshAfterGoalChange();
  const status = useChangeSavingsGoalStatus({ request: { headers: idem.headers } });
  const funded = isFunded(goal);
  const open = goal.status === 'active' || goal.status === 'paused';

  const run = () => {
    if (!pending || status.isPending) return;
    status.mutate({ id: goal.id, data: { action: pending } }, { onSuccess: () => { idem.reset(); setPending(null); void refresh(); } });
  };

  return (
    <article className="flex flex-col">
      <header className="flex flex-col gap-3 pb-6">
        <div className="flex flex-wrap items-center gap-2"><StatusPill status={goal.status} t={t} /><span className="type-caption text-muted-foreground">{goal.category} · {t('Priority', 'الأولوية')}: {tl(PRIORITY_LABEL, goal.priority, t)}</span></div>
        <h1 className="type-display break-words" data-testid="text-page-title">{goal.name}</h1>
        <div className="flex flex-wrap items-baseline gap-x-3"><MoneyDisplay value={goal.current} size="hero" tone="highlight" testId="text-goal-current" /><span className="type-body text-muted-foreground">{t('of', 'من')} <MoneyDisplay value={goal.target} size="md" className="inline" testId="text-goal-target" /></span></div>
        <GoalProgress goal={goal} t={t} compact />
        <div className="flex flex-wrap gap-2 pt-2" data-testid="group-goal-actions">
          {goal.status === 'active' && !funded ? <Button onClick={() => setContribOpen(true)} data-testid="button-contribute"><PiggyBank aria-hidden />{t('Add money', 'أضف مالاً')}</Button> : null}
          {open ? <Button variant="outline" onClick={() => setEditOpen(true)} data-testid="button-edit-goal"><Pencil aria-hidden />{t('Edit', 'تعديل')}</Button> : null}
          {goal.status === 'active' ? <Button variant="outline" onClick={() => setPending('pause')} data-testid="button-pause"><Pause aria-hidden />{t('Pause', 'إيقاف مؤقت')}</Button> : null}
          {goal.status === 'paused' ? <Button variant="outline" onClick={() => setPending('resume')} data-testid="button-resume"><Play aria-hidden />{t('Resume', 'استئناف')}</Button> : null}
          {open ? <Button variant={funded ? 'default' : 'outline'} disabled={!funded} onClick={() => setPending('complete')} title={funded ? undefined : t('Available once fully funded', 'متاح بعد اكتمال التمويل')} data-testid="button-complete"><CheckCircle2 aria-hidden />{t('Complete', 'إكمال')}</Button> : null}
          {goal.status !== 'archived' ? <Button variant="ghost" className="text-muted-foreground" onClick={() => setPending('archive')} data-testid="button-archive"><Archive aria-hidden />{t('Archive', 'أرشفة')}</Button> : null}
        </div>
        {open && !funded ? <p className="type-caption text-muted-foreground">{t('Complete unlocks once the goal is fully funded.', 'يُتاح الإكمال بعد اكتمال تمويل الهدف.')}</p> : null}
        {goal.status === 'paused' ? <p className="type-caption text-warning">{t('Paused goals can’t receive money. Resume to contribute.', 'الأهداف المتوقفة لا تستقبل المال. استأنف للمساهمة.')}</p> : null}
        {goal.status === 'archived' ? <p className="type-caption text-muted-foreground">{t('Archived — final. Its funds stay reserved and are not spendable.', 'مؤرشف — نهائي. أمواله تبقى محجوزة وغير قابلة للإنفاق.')}</p> : null}
      </header>

      <section aria-labelledby="metrics-title" className="border-t border-divider py-5">
        <h2 id="metrics-title" className="sr-only">{t('Goal numbers', 'أرقام الهدف')}</h2>
        <dl className="grid grid-cols-1 gap-x-8 divide-y divide-divider sm:grid-cols-2 sm:divide-y-0">
          <Metric label={t('Progress', 'التقدم')} testId="text-goal-percentage"><bdi className="tabular">{goal.percentage.toLocaleString(locale, { maximumFractionDigits: 2 })}%</bdi></Metric>
          <Metric label={t('Remaining', 'المتبقي')} testId="text-goal-remaining"><MoneyDisplay value={goal.remaining} size="sm" /></Metric>
          <Metric label={t('Required per month', 'المطلوب شهرياً')} testId="text-goal-required"
            hint={goal.requiredContributionMonthly ? t('Remaining ÷ calendar months left, rounded up.', 'المتبقي ÷ الأشهر المتبقية، مقرّب للأعلى.') : goal.status !== 'active' ? t('Only active goals are forecast.', 'تُتوقع الأهداف النشطة فقط.') : t('Add a target date to see this.', 'أضف تاريخاً مستهدفاً لرؤية هذا.')}>
            {goal.requiredContributionMonthly ? <MoneyDisplay value={goal.requiredContributionMonthly} size="sm" tone="planned" /> : <span className="text-muted-foreground">{t('Not forecast', 'غير متوقع')}</span>}
          </Metric>
          <Metric label={t('Estimated completion', 'الإكمال المتوقع')} testId="text-goal-estimate"
            hint={goal.estimatedCompletion ? t('From your actual contribution pace.', 'من وتيرة مساهماتك الفعلية.') : t('Needs contributions on at least two different days — we don’t guess.', 'يحتاج مساهمات في يومين مختلفين على الأقل — لا نخمّن.')}>
            {goal.estimatedCompletion ? <bdi>{fmtDate(goal.estimatedCompletion, locale)}</bdi> : <span className="text-muted-foreground">{t('Not enough history', 'سجل غير كافٍ')}</span>}
          </Metric>
          <Metric label={t('Target date', 'التاريخ المستهدف')} testId="text-goal-date">{goal.targetDate ? <bdi>{fmtDate(goal.targetDate, locale)}</bdi> : <span className="text-muted-foreground">{t('None', 'لا يوجد')}</span>}</Metric>
          <Metric label={t('Currency', 'العملة')} testId="text-goal-currency">{goal.currency}</Metric>
        </dl>
        {goal.notes ? <div className="border-t border-divider pt-4"><p className="type-caption text-muted-foreground">{t('Notes (private)', 'ملاحظات (خاصة)')}</p><p className="type-body whitespace-pre-wrap break-words" data-testid="text-goal-notes">{goal.notes}</p></div> : null}
      </section>

      <History goal={goal} t={t} />
      <InvitationPanel goal={goal} t={t} />

      <GoalFormDialog open={editOpen} onOpenChange={setEditOpen} goal={goal} t={t} />
      <ContributeDialog open={contribOpen} onOpenChange={setContribOpen} goal={goal} accounts={accounts.data ?? []} t={t} />
      <AlertDialog open={!!pending} onOpenChange={(o) => { if (!o && !status.isPending) { setPending(null); status.reset(); } }}>
        <AlertDialogContent data-testid="dialog-status">
          {pending ? <>
            <AlertDialogHeader><AlertDialogTitle>{t(...CONFIRM[pending].title)}</AlertDialogTitle><AlertDialogDescription>{t(...CONFIRM[pending].body)}</AlertDialogDescription></AlertDialogHeader>
            {status.isError ? <p role="alert" className="type-label text-destructive" data-testid="error-status">{goalErrorText(status.error, t)}</p> : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={status.isPending}>{t('Cancel', 'إلغاء')}</AlertDialogCancel>
              <AlertDialogAction disabled={status.isPending} onClick={(e) => { e.preventDefault(); run(); }} className={pending === 'archive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : undefined} data-testid="button-confirm-status">
                {status.isPending ? t('Applying…', 'جارٍ التطبيق…') : status.isError ? t('Retry', 'إعادة المحاولة') : t(...CONFIRM[pending].cta)}
              </AlertDialogAction>
            </AlertDialogFooter>
          </> : null}
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

export default function GoalDetailPage() {
  const t = useTx();
  const { dir } = useI18n();
  const me = useAccount();
  const id = useParams().id ?? '';
  const isStudent = me.role === 'student';
  const valid = isUuid(id);
  const q = useGetSavingsGoal(id, { query: { queryKey: getGetSavingsGoalQueryKey(id), enabled: isStudent && valid, retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 1, ...GOAL_REFETCH } });
  const Back = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const back = <Link href="/goals" className="type-label inline-flex min-h-11 items-center gap-2 text-gold-ink underline-offset-4 hover:underline" data-testid="link-back-goals"><Back className="size-4" aria-hidden />{t('All goals', 'كل الأهداف')}</Link>;
  if (!isStudent) return <Page>{back}<StatePanel tone="permission" title={t('Goal details are for the student who owns them', 'تفاصيل الهدف لصاحبه الطالب')} body={t('Parents fund invited goals from “Fund a goal”.', 'يموّل الأهل الأهداف المدعوين إليها من «تمويل هدف».')} /></Page>;
  const notFound = !valid || (q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 400));
  return (
    <Page className="max-w-3xl">
      <div className="pb-4">{back}</div>
      {notFound ? <StatePanel tone="empty" title={t('Goal not found', 'الهدف غير موجود')} body={t('It doesn’t exist or isn’t yours.', 'غير موجود أو ليس لك.')} />
        : q.isPending ? <div role="status" aria-label={t('Loading goal…', 'جارٍ تحميل الهدف…')} className="flex flex-col gap-4" data-testid="state-loading"><span className="skeleton-shimmer h-8 w-2/3 rounded" /><span className="skeleton-shimmer h-12 w-1/2 rounded" /><span className="skeleton-shimmer h-2 w-full rounded" />{[0, 1, 2, 3].map((i) => <span key={i} className="skeleton-shimmer h-10 w-full rounded" />)}</div>
          : q.isError || !q.data ? <StatePanel tone="error" title={t('Goal did not load', 'تعذّر تحميل الهدف')} body={goalErrorText(q.error, t)} action={<RetryButton label={t('Retry', 'إعادة المحاولة')} busyLabel="…" busy={q.isFetching} onClick={() => q.refetch()} />} />
            : <Detail goal={q.data} t={t} />}
    </Page>
  );
}
