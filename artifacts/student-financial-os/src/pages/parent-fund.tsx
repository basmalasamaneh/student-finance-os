import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Goal, KeyRound } from 'lucide-react';
import {
  getListParentFundingGoalsQueryKey, useFundSavingsGoalAsParent, useListParentFundingGoals, useRedeemGoalInvitation,
  type ParentFundingGoal, type ParentGoalContributionReceipt,
} from '@workspace/api-client-react';
import { Page, PageHeader, SectionHeading } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RetryButton, SkeletonRows, StatePanel } from '@/components/states/state-panel';
import { AmountInput, Field, inputClass, ReviewRow } from '@/components/money/fields';
import { MoneyDisplay } from '@/components/finance/money-display';
import { GoalProgress, StatusPill } from '@/components/goals/goal-progress';
import { useAccount } from '@/features/auth/account';
import { useI18n } from '@/features/i18n/i18n-provider';
import { amountErrorText, parseAmountInput, useTx, type Tx } from '@/features/money/money-model';
import { fmtDate, fmtDateTime, GOAL_REFETCH, goalErrorText, SIMULATED_FUNDING, useSubmissionKey } from '@/features/goals/goals-model';
import type { Currency } from '@/lib/money';

function FundDialog({ goal, onClose, t }: { goal: ParentFundingGoal | null; onClose: () => void; t: Tx }) {
  const { locale } = useI18n();
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [ack, setAck] = useState(false);
  const [step, setStep] = useState<'form' | 'review'>('form');
  const [touched, setTouched] = useState(false);
  const [receipt, setReceipt] = useState<ParentGoalContributionReceipt | null>(null);
  const currency = (goal?.target.currency ?? 'ILS') as Currency;
  const parsed = parseAmountInput(amount, currency);
  let err: string | undefined;
  if (!parsed.ok) err = amountErrorText(parsed.reason, currency, t);
  else if (goal && parsed.value.minor > goal.remaining.minor) err = t('More than what’s remaining on this goal.', 'أكثر من المتبقي في هذا الهدف.');
  const valid = !err && ack && note.length <= 500;
  const data = parsed.ok ? { amount: { minor: parsed.value.minor, currency }, simulatedFundingAcknowledged: true as const, ...(note.trim() ? { note: note.trim() } : {}) } : null;
  const idem = useSubmissionKey(`${goal?.id}|${JSON.stringify(data)}`);
  const m = useFundSavingsGoalAsParent({ request: { headers: idem.headers } });
  const reset = () => { setAmount(''); setNote(''); setAck(false); setStep('form'); setTouched(false); setReceipt(null); m.reset(); };
  const close = () => { if (m.isPending) return; reset(); onClose(); };
  const next = (e: FormEvent) => { e.preventDefault(); setTouched(true); if (valid) setStep('review'); };
  const confirm = () => {
    if (!goal || !data || m.isPending) return;
    m.mutate({ id: goal.id, data }, { onSuccess: (r) => { idem.reset(); setReceipt(r); void qc.invalidateQueries({ queryKey: getListParentFundingGoalsQueryKey() }); } });
  };

  return (
    <Dialog open={!!goal} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto" data-testid="dialog-parent-fund">
        <DialogHeader>
          <DialogTitle>{receipt ? t('Funds added', 'أُضيفت الأموال') : t('Add simulated funds', 'أضف أموالاً محاكاة')}</DialogTitle>
          <DialogDescription>{goal?.name}</DialogDescription>
        </DialogHeader>
        <p className="type-caption rounded-lg bg-primary-soft px-3 py-2" data-testid="text-simulated-funding">{t(...SIMULATED_FUNDING)}</p>
        {receipt ? (
          <dl className="divide-y divide-divider border-y border-divider" data-testid="receipt-parent-fund">
            <ReviewRow label={t('Amount', 'المبلغ')} testId="text-parent-receipt-amount"><MoneyDisplay value={receipt.amount} size="sm" /></ReviewRow>
            <ReviewRow label={t('Goal now saved', 'مدّخر الهدف الآن')}><MoneyDisplay value={receipt.goal.current} size="sm" /></ReviewRow>
            <ReviewRow label={t('Remaining', 'المتبقي')}><MoneyDisplay value={receipt.goal.remaining} size="sm" /></ReviewRow>
            <ReviewRow label={t('Recorded', 'سُجّل')}><bdi>{fmtDateTime(receipt.createdAt, locale)}</bdi></ReviewRow>
            <ReviewRow label={t('Receipt ID', 'معرّف الإيصال')}><bdi className="font-mono text-xs break-all">{receipt.id}</bdi></ReviewRow>
          </dl>
        ) : step === 'form' && goal ? (
          <form id="parent-fund-form" onSubmit={next} className="flex flex-col gap-4" noValidate>
            <Field id="pf-amount" label={t('Amount', 'المبلغ')} error={touched ? err : undefined}>
              <AmountInput id="pf-amount" value={amount} onChange={setAmount} currency={currency} error={touched ? err : undefined} />
            </Field>
            <p className="type-caption text-muted-foreground">{t('Remaining', 'المتبقي')}: <MoneyDisplay value={goal.remaining} size="sm" className="inline !text-xs" /></p>
            <Field id="pf-note" label={t('Note (optional)', 'ملاحظة (اختياري)')} hint={`${note.length}/500`}>
              <input id="pf-note" className={inputClass} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} data-testid="input-parent-note" />
            </Field>
            <label htmlFor="pf-ack" className="type-label flex items-start gap-3 font-normal">
              <Checkbox id="pf-ack" checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-1" data-testid="checkbox-simulated-ack" />
              <span>{t('I understand this is simulated and no real money moves.', 'أفهم أن هذا محاكاة ولا تتحرك أموال حقيقية.')}</span>
            </label>
            {touched && !ack ? <p role="alert" className="type-caption text-destructive">{t('Please confirm to continue.', 'يرجى التأكيد للمتابعة.')}</p> : null}
          </form>
        ) : goal ? (
          <div className="flex flex-col gap-3">
            <dl className="divide-y divide-divider border-y border-divider">
              <ReviewRow label={t('Goal', 'الهدف')}>{goal.name}</ReviewRow>
              <ReviewRow label={t('Amount', 'المبلغ')}>{parsed.ok ? <MoneyDisplay value={parsed.value} size="sm" /> : null}</ReviewRow>
              {note.trim() ? <ReviewRow label={t('Note', 'ملاحظة')}>{note.trim()}</ReviewRow> : null}
            </dl>
            {m.isError ? <p role="alert" className="type-label text-destructive" data-testid="error-parent-fund">{goalErrorText(m.error, t)}</p> : null}
          </div>
        ) : null}
        <DialogFooter className="gap-2">
          {receipt ? <Button onClick={close} data-testid="button-parent-done">{t('Done', 'تم')}</Button>
            : step === 'form' ? <><Button variant="ghost" onClick={close}>{t('Cancel', 'إلغاء')}</Button><Button type="submit" form="parent-fund-form" data-testid="button-parent-review">{t('Review', 'مراجعة')}</Button></>
              : <><Button variant="ghost" onClick={() => setStep('form')} disabled={m.isPending}>{t('Back', 'رجوع')}</Button>
                <Button onClick={confirm} disabled={m.isPending} data-testid="button-parent-confirm">{m.isPending ? t('Adding…', 'جارٍ الإضافة…') : m.isError ? t('Retry safely', 'أعد المحاولة بأمان') : t('Confirm', 'تأكيد')}</Button></>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Redeem({ t }: { t: Tx }) {
  const qc = useQueryClient();
  const [token, setToken] = useState('');
  const [ack, setAck] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const m = useRedeemGoalInvitation();
  const clean = token.trim();
  const shapeOk = /^[A-Za-z0-9_-]{43,128}$/.test(clean);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!shapeOk || !ack || m.isPending) return;
    m.mutate({ data: { token: clean, limitedConsentAcknowledged: true } }, {
      onSuccess: (g) => { setToken(''); setAck(false); setDone(g.name); void qc.invalidateQueries({ queryKey: getListParentFundingGoalsQueryKey() }); },
    });
  };
  return (
    <section aria-labelledby="redeem-title" className="flex flex-col gap-3 rounded-card border border-card-border bg-card p-4 md:p-6">
      <h2 id="redeem-title" className="type-title flex items-center gap-2"><KeyRound className="size-4 text-gold-ink" aria-hidden />{t('Enter an invitation code', 'أدخل رمز دعوة')}</h2>
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate autoComplete="off">
        <Field id="redeem-token" label={t('Code from the student', 'الرمز من الطالب')} error={clean && !shapeOk ? t('That doesn’t look like a complete code.', 'لا يبدو هذا رمزاً كاملاً.') : undefined}>
          <input id="redeem-token" dir="ltr" spellCheck={false} autoCapitalize="off" className={`${inputClass} font-mono text-sm`} value={token} onChange={(e) => { setToken(e.target.value); setDone(null); m.reset(); }} data-testid="input-redeem-token" />
        </Field>
        <label htmlFor="redeem-ack" className="type-caption flex items-start gap-3">
          <Checkbox id="redeem-ack" checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-0.5" data-testid="checkbox-redeem-ack" />
          <span>{t('I understand I will only see this one goal’s name, target, saved amount, remaining, target date and status, and can add simulated funds.', 'أفهم أنني سأرى فقط اسم هذا الهدف والمبلغ المستهدف والمدّخر والمتبقي والتاريخ والحالة، ويمكنني إضافة أموال محاكاة.')}</span>
        </label>
        {m.isError ? <p role="alert" className="type-label text-destructive" data-testid="error-redeem">{t('This code is invalid, expired, already used, or was revoked.', 'هذا الرمز غير صالح أو منتهي أو مستخدم أو أُلغي.')}</p> : null}
        {done ? <p role="status" className="type-label text-success" data-testid="text-redeem-success">{t(`You can now fund “${done}”.`, `يمكنك الآن تمويل «${done}».`)}</p> : null}
        <div><Button type="submit" disabled={!shapeOk || !ack || m.isPending} data-testid="button-redeem">{m.isPending ? t('Checking…', 'جارٍ التحقق…') : t('Redeem code', 'استخدام الرمز')}</Button></div>
      </form>
    </section>
  );
}

export default function ParentFundPage() {
  const t = useTx();
  const { locale } = useI18n();
  const me = useAccount();
  const isParent = me.role === 'parent';
  const q = useListParentFundingGoals({ query: { queryKey: getListParentFundingGoalsQueryKey(), enabled: isParent, ...GOAL_REFETCH } });
  const [funding, setFunding] = useState<ParentFundingGoal | null>(null);
  if (!isParent) return <Page><StatePanel tone="permission" title={t('Only for signed-in parent accounts', 'فقط لحسابات الأهل المسجّلة')} body={t('Students manage their own goals. Parent funding can’t be recorded from a student account.', 'يدير الطلاب أهدافهم بأنفسهم. لا يمكن تسجيل تمويل الأهل من حساب طالب.')} /></Page>;
  const goals = q.data ?? [];
  return (
    <Page className="max-w-3xl">
      <PageHeader eyebrow={t('FUND A GOAL', 'تمويل هدف')} title={t('Help with a savings goal', 'ساعد في هدف ادخار')}
        lede={t('A student can invite you to a single goal. You see only that goal’s progress — never their accounts, profile or other goals.', 'يمكن للطالب دعوتك إلى هدف واحد. ترى تقدّم هذا الهدف فقط — لا حساباته ولا ملفه ولا أهدافه الأخرى.')} />
      <p className="type-caption -mt-3 mb-6 rounded-lg bg-primary-soft px-3 py-2">{t(...SIMULATED_FUNDING)}</p>
      <div className="flex flex-col gap-10">
        <Redeem t={t} />
        <section className="flex flex-col gap-3">
          <SectionHeading id="consented" title={t('Goals you can fund', 'أهداف يمكنك تمويلها')} />
          {q.isPending ? <SkeletonRows rows={2} label={t('Loading…', 'جارٍ التحميل…')} />
            : q.isError ? <StatePanel tone="error" title={t('Goals did not load', 'تعذّر تحميل الأهداف')} body={goalErrorText(q.error, t)} action={<RetryButton label={t('Retry', 'إعادة المحاولة')} busyLabel="…" busy={q.isRefetching} onClick={() => q.refetch()} />} />
              : !goals.length ? <StatePanel tone="empty" icon={<Goal className="size-[18px]" aria-hidden />} title={t('No goals shared with you', 'لا أهداف مشاركة معك')} body={t('Ask the student to create an invitation code from their goal and give it to you. If access was revoked, the goal disappears from here.', 'اطلب من الطالب إنشاء رمز دعوة من هدفه وإعطاءه لك. إذا أُلغي الوصول يختفي الهدف من هنا.')} />
                : (
                  <ul className="flex flex-col gap-3" data-testid="list-parent-goals">
                    {goals.map((g) => (
                      <li key={g.id} className="flex flex-col gap-3 rounded-card border border-card-border bg-card p-4 md:p-5" data-testid={`card-parent-goal-${g.id}`}>
                        <div className="flex items-start justify-between gap-3"><p className="type-subtitle break-words">{g.name}</p><StatusPill status={g.status} t={t} /></div>
                        <GoalProgress goal={{ ...g, percentage: g.target.minor ? Math.floor(Number((BigInt(g.current.minor) * BigInt(10000)) / BigInt(g.target.minor))) / 100 : 0 }} t={t} compact />
                        <p className="type-caption text-muted-foreground">{t('Remaining', 'المتبقي')}: <MoneyDisplay value={g.remaining} size="sm" className="inline !text-xs" /> · {g.targetDate ? `${t('By', 'بحلول')} ${fmtDate(g.targetDate, locale)}` : t('No target date', 'بلا تاريخ مستهدف')}</p>
                        {g.status === 'active' && g.remaining.minor > 0
                          ? <div><Button onClick={() => setFunding(g)} data-testid={`button-fund-${g.id}`}>{t('Add simulated funds', 'أضف أموالاً محاكاة')}</Button></div>
                          : <p className="type-caption text-muted-foreground">{g.remaining.minor === 0 ? t('Fully funded — nothing more needed.', 'مموّل بالكامل — لا حاجة لمزيد.') : t('This goal isn’t accepting funds right now.', 'هذا الهدف لا يقبل التمويل حالياً.')}</p>}
                      </li>
                    ))}
                  </ul>
                )}
          <p className="type-caption text-muted-foreground">{t('Access lasts until the student revokes it. Refreshes every 15 seconds.', 'يستمر الوصول حتى يلغيه الطالب. يتحدّث كل 15 ثانية.')}</p>
        </section>
      </div>
      <FundDialog goal={funding} onClose={() => setFunding(null)} t={t} />
    </Page>
  );
}
