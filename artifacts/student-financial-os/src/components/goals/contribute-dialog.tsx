import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { useContributeToSavingsGoal, type FinanceAccount, type GoalContributionReceipt, type SavingsGoal } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { FlowSteps, SuccessCheck } from '@/components/money/flow-steps';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AccountSelect, AmountInput, BalanceHint, Field, inputClass, ReviewRow, SimulatedNote } from '@/components/money/fields';
import { MoneyDisplay } from '@/components/finance/money-display';
import { StatePanel } from '@/components/states/state-panel';
import { accountName, amountErrorText, parseAmountInput, type Tx } from '@/features/money/money-model';
import { goalErrorText, useRefreshAfterContribution, useSubmissionKey } from '@/features/goals/goals-model';
import type { Currency } from '@/lib/money';
import { cn } from '@/lib/utils';
import { useSuccessHaptic } from '@/components/money/use-success-haptic';

/** Quick-amount chips only fill the same validated text field; parsing stays with parseAmountInput. */
const QUICK = ['10', '25', '50'];
/** Exact minor → decimal string (BigInt, no float). JOD uses 3 decimals. */
function minorToDecimal(minor: number, currency: Currency) {
  const digits = currency === 'JOD' ? 3 : 2;
  const m = BigInt(minor); const scale = 10n ** BigInt(digits);
  return `${m / scale}.${(m % scale).toString().padStart(digits, '0')}`;
}

export function ContributeDialog({ open, onOpenChange, goal, accounts, t }: { open: boolean; onOpenChange: (o: boolean) => void; goal: SavingsGoal; accounts: FinanceAccount[]; t: Tx }) {
  const eligible = useMemo(() => accounts.filter((a) => a.currency === goal.currency), [accounts, goal.currency]);
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [step, setStep] = useState<'form' | 'review'>('form');
  const [touched, setTouched] = useState(false);
  const [receipt, setReceipt] = useState<GoalContributionReceipt | null>(null);
  useSuccessHaptic(receipt?.transactions[0]?.id ?? null);
  useEffect(() => { if (open) { setAccountId(eligible.length === 1 ? eligible[0].id : ''); setAmount(''); setNote(''); setStep('form'); setTouched(false); setReceipt(null); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const account = eligible.find((a) => a.id === accountId);
  const parsed = parseAmountInput(amount, goal.currency as Currency);
  let amountErr: string | undefined;
  if (!parsed.ok) amountErr = amountErrorText(parsed.reason, goal.currency as Currency, t);
  else if (parsed.value.minor > goal.remaining.minor) amountErr = t('That is more than the remaining amount. Goals cannot be overfunded.', 'هذا أكثر من المتبقي. لا يمكن تجاوز تمويل الهدف.');
  else if (account && parsed.value.minor > account.balance.minor) amountErr = t('More than this account’s available balance.', 'أكثر من الرصيد المتاح في هذا الحساب.');
  const accountErr = !accountId ? t('Choose an account.', 'اختر حساباً.') : undefined;
  const valid = !amountErr && !accountErr && note.length <= 500;

  const data = parsed.ok ? { accountId, amount: { minor: parsed.value.minor, currency: goal.currency }, ...(note.trim() ? { note: note.trim() } : {}) } : null;
  const idem = useSubmissionKey(`${goal.id}|${JSON.stringify(data)}`);
  const refresh = useRefreshAfterContribution();
  const m = useContributeToSavingsGoal({ request: { headers: idem.headers } });

  const next = (e: FormEvent) => { e.preventDefault(); setTouched(true); if (valid) setStep('review'); };
  const confirm = () => {
    if (!data || m.isPending) return;
    m.mutate({ id: goal.id, data }, { onSuccess: (r) => { idem.reset(); setReceipt(r); void refresh(); } });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!m.isPending) onOpenChange(o); }}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto" data-testid="dialog-contribute">
        <DialogHeader>
          <DialogTitle>{receipt ? t('Contribution recorded', 'سُجّلت المساهمة') : t('Add to goal', 'أضف إلى الهدف')}</DialogTitle>
          <DialogDescription>{t('Money moves from an account you own into this goal’s protected reserve. It stays yours but is no longer spendable.', 'ينتقل المال من حساب تملكه إلى احتياطي الهدف المحمي. يبقى لك لكنه لم يعد قابلاً للإنفاق.')}</DialogDescription>
        </DialogHeader>
        {eligible.length ? <FlowSteps label={t('Progress', 'التقدم')} current={receipt ? 2 : step === 'form' ? 0 : 1} steps={[t('Amount', 'المبلغ'), t('Review', 'مراجعة'), t('Done', 'تم')]} /> : null}
        {receipt ? (
          <div className="card-premium flex flex-col gap-3 rounded-card border p-4" data-testid="receipt-contribution">
            <SuccessCheck label={t('Contribution recorded', 'سُجّلت المساهمة')} />
            <dl className="divide-y divide-divider border-y border-divider">
              <ReviewRow label={t('Amount', 'المبلغ')} testId="text-receipt-amount">{receipt.entry.amount ? <MoneyDisplay value={receipt.entry.amount} size="sm" /> : '—'}</ReviewRow>
              <ReviewRow label={t('Saved now', 'المدّخر الآن')}><MoneyDisplay value={receipt.goal.current} size="sm" /></ReviewRow>
              <ReviewRow label={t('Remaining', 'المتبقي')}><MoneyDisplay value={receipt.goal.remaining} size="sm" /></ReviewRow>
            </dl>
            <ul className="flex flex-col gap-1">
              {receipt.transactions.map((tx) => (
                <li key={tx.id}><Link href={`/transactions/${tx.id}`} className="type-label inline-flex min-h-11 items-center text-gold-ink underline-offset-4 hover:underline" data-testid={`link-receipt-tx-${tx.id}`}>
                  {tx.direction === 'debit' ? t('Account debit receipt', 'إيصال الخصم من الحساب') : t('Goal reserve credit receipt', 'إيصال الإضافة إلى الاحتياطي')}</Link></li>
              ))}
            </ul>
            {receipt.goal.remaining.minor === 0 ? <p className="type-caption rounded-lg bg-success-soft px-3 py-2 text-success">{t('Fully funded. Mark it complete from the goal page when you’re ready — it doesn’t happen automatically.', 'مموّل بالكامل. علّمه كمكتمل من صفحة الهدف عندما تكون جاهزاً — لا يحدث ذلك تلقائياً.')}</p> : null}
          </div>
        ) : !eligible.length ? (
          <StatePanel tone="empty" title={t(`No ${goal.currency} account`, `لا يوجد حساب ${goal.currency}`)} body={t('Contributions must be in the goal’s currency. Create an account in this currency on the Money page.', 'يجب أن تكون المساهمة بعملة الهدف. أنشئ حساباً بهذه العملة في صفحة المال.')}
            action={<Button asChild variant="outline"><Link href="/money" data-testid="link-go-money">{t('Go to Money', 'اذهب إلى المال')}</Link></Button>} />
        ) : step === 'form' ? (
          <form id="contribute-form" onSubmit={next} className="flex flex-col gap-4" noValidate>
            <Field id="contrib-account" label={t('From account', 'من الحساب')} error={touched ? accountErr : undefined}>
              <AccountSelect id="contrib-account" value={accountId} onChange={setAccountId} accounts={eligible} t={t} error={touched ? accountErr : undefined} />
            </Field>
            <BalanceHint account={account} t={t} />
            <Field id="contrib-amount" label={t('Amount', 'المبلغ')} error={touched ? amountErr : undefined}>
              <AmountInput id="contrib-amount" large value={amount} onChange={setAmount} currency={goal.currency} error={touched ? amountErr : undefined} />
            </Field>
            <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label={t('Quick amounts', 'مبالغ سريعة')}>
              {QUICK.map((q) => <button key={q} type="button" onClick={() => setAmount(q)} aria-pressed={amount === q} className={cn('type-label min-h-11 shrink-0 snap-start rounded-full border px-4 tabular transition-colors', amount === q ? 'border-primary bg-primary-soft text-gold-ink' : 'border-border hover:border-primary')} data-testid={`chip-amount-${q}`}><bdi>{q}</bdi> <span className="text-muted-foreground">{goal.currency}</span></button>)}
              {goal.remaining.minor > 0 ? <button type="button" onClick={() => setAmount(minorToDecimal(goal.remaining.minor, goal.currency))} aria-pressed={amount === minorToDecimal(goal.remaining.minor, goal.currency)} className={cn('type-label min-h-11 shrink-0 snap-start rounded-full border px-4 transition-colors', amount === minorToDecimal(goal.remaining.minor, goal.currency) ? 'border-primary bg-primary-soft text-gold-ink' : 'border-border hover:border-primary')} data-testid="chip-amount-remaining">{t('Remaining', 'المتبقي')}</button> : null}
            </div>
            <p className="type-caption text-muted-foreground">{t('Remaining on this goal', 'المتبقي في هذا الهدف')}: <MoneyDisplay value={goal.remaining} size="sm" className="inline !text-xs" /></p>
            <Field id="contrib-note" label={t('Note (optional)', 'ملاحظة (اختياري)')} hint={`${note.length}/500`}>
              <input id="contrib-note" type="text" inputMode="text" autoComplete="off" enterKeyHint="done" className={inputClass} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} data-testid="input-contrib-note" />
            </Field>
            <SimulatedNote t={t} />
          </form>
        ) : (
          <div className="flex flex-col gap-3" data-testid="review-contribution">
            <dl className="divide-y divide-divider border-y border-divider">
              <ReviewRow label={t('Goal', 'الهدف')}>{goal.name}</ReviewRow>
              <ReviewRow label={t('From', 'من')}>{accountName(account, t)}</ReviewRow>
              <ReviewRow label={t('Amount', 'المبلغ')} testId="text-review-amount">{parsed.ok ? <MoneyDisplay value={parsed.value} size="sm" /> : null}</ReviewRow>
              {note.trim() ? <ReviewRow label={t('Note', 'ملاحظة')}>{note.trim()}</ReviewRow> : null}
            </dl>
            <p className="type-caption text-muted-foreground">{t('Your available balance drops and your reserved savings rise by the same amount. Net wealth is unchanged. There is no withdrawal from goals.', 'ينخفض رصيدك المتاح ويرتفع ادخارك المحجوز بالمبلغ نفسه. صافي ثروتك لا يتغير. لا يوجد سحب من الأهداف.')}</p>
            {m.isError ? <p role="alert" className="type-label text-destructive" data-testid="error-contribute">{goalErrorText(m.error, t)}</p> : null}
          </div>
        )}
        <DialogFooter className="form-action-bar gap-2">
          {receipt ? <Button onClick={() => onOpenChange(false)} data-testid="button-close-receipt">{t('Done', 'تم')}</Button>
            : !eligible.length ? <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('Close', 'إغلاق')}</Button>
              : step === 'form' ? <><Button variant="ghost" onClick={() => onOpenChange(false)}>{t('Cancel', 'إلغاء')}</Button><Button type="submit" form="contribute-form" data-testid="button-review-contribution">{t('Review', 'مراجعة')}</Button></>
                : <><Button variant="ghost" onClick={() => setStep('form')} disabled={m.isPending} data-testid="button-back-contribution">{t('Back', 'رجوع')}</Button>
                  <Button onClick={confirm} loading={m.isPending} data-testid="button-confirm-contribution">{m.isError ? t('Retry safely', 'أعد المحاولة بأمان') : t('Confirm contribution', 'تأكيد المساهمة')}</Button></>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
