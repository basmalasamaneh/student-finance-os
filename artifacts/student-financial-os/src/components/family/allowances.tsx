import { useEffect, useState } from 'react';
import { CalendarClock, Pause, Pencil, Play, RotateCw, X } from 'lucide-react';
import type { Allowance, AllowanceInput, FinanceAccount } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { MoneyDisplay } from '@/components/finance/money-display';
import { StatusBadge } from '@/components/finance/status-badge';
import { HighValueConfirm } from '@/components/money/high-value-confirm';
import { AccountSelect, AmountInput, BalanceHint, Field, inputClass, ReviewRow, SimulatedNote } from '@/components/money/fields';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useDeviceSecurity } from '@/features/security/device-security';
import { formatDate, formatMoney, type Currency } from '@/lib/money';
import { amountErrorText, parseAmountInput, type Tx } from '@/features/money/money-model';
import { ALLOWANCE_STATUS, allowanceActions, day, failureText, FREQUENCY_TEXT, minorToDecimal, todayUtc, type AllowanceAction } from '@/features/family/family-view';
import { cn } from '@/lib/utils';

type Freq = 'weekly' | 'biweekly' | 'monthly';

/** Create/edit allowance. Exact decimal → minor units; review step separates "debits now" from "scheduled". */
export function AllowanceFormDialog({ open, onOpenChange, childName, accounts, initial, onSubmit, pending, error, t }: {
  open: boolean; onOpenChange: (o: boolean) => void; childName: string; accounts: FinanceAccount[];
  initial?: Allowance | null; onSubmit: (v: AllowanceInput) => void; pending?: boolean; error?: string | null; t: Tx;
}) {
  const editing = !!initial;
  const { confirmationThreshold } = useDeviceSecurity();
  const { locale } = useI18n();
  const [acct, setAcct] = useState(''); const [kind, setKind] = useState<'oneTime' | 'recurring'>('recurring');
  const [amount, setAmount] = useState(''); const [note, setNote] = useState('');
  const [date, setDate] = useState(''); const [freq, setFreq] = useState<Freq>('monthly');
  const [start, setStart] = useState(''); const [end, setEnd] = useState(''); const [next, setNext] = useState('');
  const [tried, setTried] = useState(false); const [step, setStep] = useState<'form' | 'review'>('form');
  useEffect(() => {
    if (!open) return;
    setTried(false); setStep('form');
    setAcct(initial?.parentAccountId ?? (accounts.length === 1 ? accounts[0].id : ''));
    setKind(initial?.kind ?? 'recurring');
    setAmount(initial ? minorToDecimal(initial.amount.minor, initial.amount.currency) : '');
    setNote(initial?.note ?? ''); setDate(initial?.kind === 'oneTime' ? initial.nextPayment : '');
    setFreq((initial?.frequency as Freq) ?? 'monthly'); setStart(initial?.startDate ?? ''); setEnd(initial?.endDate ?? '');
    setNext(initial?.kind === 'recurring' ? initial.nextPayment : '');
  }, [open, initial, accounts]);
  const account = accounts.find((a) => a.id === acct);
  const currency = (account?.currency ?? 'ILS') as Currency;
  const parsed = parseAmountInput(amount, currency);
  const today = todayUtc();
  const nextPay = kind === 'oneTime' ? date : (next || start);
  const errs = {
    acct: !acct ? t('Choose one of your accounts', 'اختر أحد حساباتك') : undefined,
    amount: !parsed.ok ? amountErrorText(parsed.reason, currency, t) : undefined,
    date: kind === 'oneTime' && (!date ? t('Choose a date', 'اختر تاريخاً') : date < today ? t('Date can’t be in the past', 'لا يمكن أن يكون التاريخ ماضياً') : undefined) || undefined,
    start: kind === 'recurring' && !start ? t('Choose a start date', 'اختر تاريخ البدء') : undefined,
    end: kind === 'recurring' && end && start && end < start ? t('End must be on or after start', 'يجب أن تكون النهاية في البدء أو بعده') : undefined,
    next: kind === 'recurring' && start && (nextPay < today ? t('Next payment can’t be in the past', 'لا يمكن أن تكون الدفعة التالية ماضية') : nextPay < start || (end && nextPay > end) ? t('Next payment must be within start and end', 'يجب أن تكون الدفعة التالية ضمن الفترة') : undefined) || undefined,
    note: note.length > 500 ? t('500 characters max', '500 حرف كحد أقصى') : undefined,
  };
  const valid = !Object.values(errs).some(Boolean);
  const body: AllowanceInput | null = parsed.ok && valid ? {
    parentAccountId: acct, amount: { minor: parsed.value.minor, currency }, kind,
    frequency: kind === 'recurring' ? freq : null, nextPayment: nextPay,
    startDate: kind === 'oneTime' ? date : start, endDate: kind === 'recurring' && end ? end : null, note: note.trim(),
  } : null;
  const enhanced = !!body && (body.amount.currency !== 'ILS' || body.amount.minor > confirmationThreshold.minor);
  const e = (k: keyof typeof errs) => (tried ? errs[k] : undefined);
  const dueToday = body?.nextPayment === today;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!pending) onOpenChange(o); }}>
      <DialogContent data-parent-confidential-portal data-testid="dialog-allowance" className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t('Edit allowance', 'تعديل المصروف') : t('New allowance', 'مصروف جديد')} · {childName}</DialogTitle>
          <DialogDescription>{t('Goes to the account your child chose. You never see their account or balance unless they share it.', 'يذهب إلى الحساب الذي اختاره ابنك. لا ترى حسابه أو رصيده إلا إذا شاركه.')}</DialogDescription>
        </DialogHeader>
        {step === 'form' ? (
          <form className="flex flex-col gap-4" noValidate onSubmit={(ev) => { ev.preventDefault(); setTried(true); if (body) setStep('review'); }}>
            {!editing ? (
              <div role="radiogroup" aria-label={t('Type', 'النوع')} className="grid grid-cols-2 gap-2 rounded-[14px] bg-surface-sunken p-1">
                {(['recurring', 'oneTime'] as const).map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} data-testid={`radio-kind-${k}`}
                    className={cn('type-label min-h-11 rounded-[10px] transition-colors', kind === k ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground')}>
                    {k === 'recurring' ? t('Recurring', 'متكرر') : t('One-time', 'مرة واحدة')}
                  </button>))}
              </div>) : null}
            <Field id="allowance-account" label={t('Pay from', 'الدفع من')} error={e('acct')} hint={t('Currency must match your child’s receiving account. No conversion.', 'يجب أن تطابق العملة حساب ابنك المستلم. لا تحويل.')}>
              <AccountSelect id="allowance-account" value={acct} onChange={setAcct} accounts={accounts} t={t} error={e('acct')} />
            </Field>
            <BalanceHint account={account} t={t} />
            <Field id="allowance-amount" label={t('Amount', 'المبلغ')} error={e('amount')}>
              <AmountInput id="allowance-amount" value={amount} onChange={setAmount} currency={currency} error={e('amount')} />
            </Field>
            {kind === 'oneTime' ? (
              <Field id="allowance-date" label={t('Date', 'التاريخ')} error={e('date')}>
                <input id="allowance-date" type="date" min={today} value={date} onChange={(ev) => setDate(ev.target.value)} className={inputClass} data-testid="input-allowance-date" />
              </Field>
            ) : <>
              <Field id="allowance-frequency" label={t('Frequency', 'التكرار')}>
                <select id="allowance-frequency" value={freq} onChange={(ev) => setFreq(ev.target.value as Freq)} className={cn(inputClass, 'appearance-auto')} data-testid="select-allowance-frequency">
                  {(Object.keys(FREQUENCY_TEXT) as Freq[]).map((f) => <option key={f} value={f}>{t(...FREQUENCY_TEXT[f])}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field id="allowance-start" label={t('Starts', 'يبدأ')} error={e('start')}>
                  <input id="allowance-start" type="date" value={start} onChange={(ev) => setStart(ev.target.value)} className={inputClass} data-testid="input-allowance-start" />
                </Field>
                <Field id="allowance-end" label={t('Ends (optional)', 'ينتهي (اختياري)')} error={e('end')}>
                  <input id="allowance-end" type="date" value={end} onChange={(ev) => setEnd(ev.target.value)} className={inputClass} data-testid="input-allowance-end" />
                </Field>
              </div>
              <Field id="allowance-next" label={t('Next payment', 'الدفعة التالية')} error={e('next')} hint={t('Defaults to the start date.', 'الافتراضي تاريخ البدء.')}>
                <input id="allowance-next" type="date" min={today} value={next} onChange={(ev) => setNext(ev.target.value)} className={inputClass} data-testid="input-allowance-next" />
              </Field>
            </>}
            <Field id="allowance-note" label={t('Note (optional)', 'ملاحظة (اختياري)')} error={e('note')}>
              <input id="allowance-note" maxLength={500} value={note} onChange={(ev) => setNote(ev.target.value)} className={inputClass} data-testid="input-allowance-note" />
            </Field>
            <DialogFooter className="form-action-bar">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>{t('Cancel', 'إلغاء')}</Button>
              <Button type="submit" data-testid="button-review-allowance">{t('Review', 'مراجعة')}</Button>
            </DialogFooter>
          </form>
        ) : body ? (
          <div className="flex flex-col gap-4">
            <dl className="divide-y divide-divider border-y border-divider">
              <ReviewRow label={t('Amount', 'المبلغ')} testId="text-review-amount"><MoneyDisplay value={body.amount} size="sm" /></ReviewRow>
              <ReviewRow label={t('Schedule', 'الجدول')}>{body.frequency ? t(...FREQUENCY_TEXT[body.frequency]) : t('One-time', 'مرة واحدة')}</ReviewRow>
              <ReviewRow label={t('Next payment', 'الدفعة التالية')}>{formatDate(day(body.nextPayment), locale)}</ReviewRow>
              {body.endDate ? <ReviewRow label={t('Ends', 'ينتهي')}>{formatDate(day(body.endDate), locale)}</ReviewRow> : null}
              <ReviewRow label={t('Fees', 'الرسوم')}>{t('None', 'لا شيء')}</ReviewRow>
            </dl>
            <p className="type-caption rounded-lg bg-surface-sunken px-3 py-2" data-testid="text-allowance-debit-timing">{dueToday
              ? t('Due today: your selected account is debited when it processes (within about 30 seconds). Nothing is debited when you save.', 'مستحق اليوم: يُخصم من حسابك عند المعالجة (خلال 30 ثانية تقريباً). لا يُخصم شيء عند الحفظ.')
              : t('Nothing is debited now. Each payment is debited from your account on its date. This is a plan for future payments.', 'لا يُخصم شيء الآن. تُخصم كل دفعة من حسابك في تاريخها. هذه خطة لدفعات مستقبلية.')}</p>
            <SimulatedNote t={t} />
            {error ? <p role="alert" className="type-label text-destructive" data-testid="error-allowance">{error}</p> : null}
            <DialogFooter className={cn('form-action-bar gap-2', enhanced && 'sm:flex-col')}>
              <Button variant="secondary" onClick={() => setStep('form')} disabled={pending}>{t('Back', 'رجوع')}</Button>
              {enhanced ? <HighValueConfirm onConfirm={() => onSubmit(body)} pending={pending} threshold={confirmationThreshold} t={t} testId="button-save-allowance" />
                : <Button onClick={() => onSubmit(body)} loading={pending} data-testid="button-save-allowance">{editing ? t('Save changes', 'حفظ التغييرات') : t('Schedule allowance', 'جدولة المصروف')}</Button>}
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function AllowanceConfirm({ target, action, onOpenChange, onConfirm, pending, error, t }: {
  target: Allowance | null; action: 'cancel' | 'retry' | null; onOpenChange: (o: boolean) => void; onConfirm: () => void; pending?: boolean; error?: string | null; t: Tx;
}) {
  const { locale } = useI18n();
  return (
    <AlertDialog open={!!target && !!action} onOpenChange={(o) => { if (!pending) onOpenChange(o); }}>
      <AlertDialogContent data-testid="dialog-allowance-confirm">
        <AlertDialogHeader>
          <AlertDialogTitle>{action === 'retry' ? t('Process the due payment now?', 'معالجة الدفعة المستحقة الآن؟') : t('Cancel this allowance?', 'إلغاء هذا المصروف؟')}</AlertDialogTitle>
          <AlertDialogDescription>
            <bdi dir="ltr" className="tabular">{target ? formatMoney(target.amount, locale) : ''}</bdi>{' — '}
            {action === 'retry' ? t('If a payment is due, it’s debited from your account now (simulated). If nothing is due, nothing moves.', 'إن كانت هناك دفعة مستحقة تُخصم من حسابك الآن (محاكاة). إن لم يكن هناك شيء مستحق لا يتحرك شيء.') : t('No future payments will be sent. Past payments stay in history. This can’t be undone.', 'لن تُرسل دفعات مستقبلية. تبقى الدفعات السابقة في السجل. لا يمكن التراجع.')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p role="alert" className="type-label text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t('Back', 'رجوع')}</AlertDialogCancel>
          <AlertDialogAction disabled={pending} data-testid="button-confirm-allowance-action"
            className={action === 'cancel' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : undefined}
            onClick={(ev) => { ev.preventDefault(); onConfirm(); }}>
            {pending ? t('Working…', 'جارٍ التنفيذ…') : action === 'retry' ? t('Process now', 'معالجة الآن') : t('Cancel allowance', 'إلغاء المصروف')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const ACTION_UI: Record<AllowanceAction, { icon: typeof Pause; text: [string, string] }> = {
  edit: { icon: Pencil, text: ['Edit', 'تعديل'] }, pause: { icon: Pause, text: ['Pause', 'إيقاف مؤقت'] },
  resume: { icon: Play, text: ['Resume', 'استئناف'] }, cancel: { icon: X, text: ['Cancel', 'إلغاء'] },
  retry: { icon: RotateCw, text: ['Process now', 'معالجة الآن'] },
};

export function AllowanceRow({ a, onAction, busyAction, rowError, t }: { a: Allowance; onAction: (a: Allowance, act: AllowanceAction) => void; busyAction?: AllowanceAction | null; rowError?: string | null; t: Tx }) {
  const { locale } = useI18n();
  const s = ALLOWANCE_STATUS[a.status];
  const live = a.status === 'active' || a.status === 'paused';
  const when = [a.frequency ? t(...FREQUENCY_TEXT[a.frequency]) : t('One-time', 'مرة واحدة'),
    live ? `${t('Next', 'التالي')} ${formatDate(day(a.nextPayment), locale)}` : null,
    a.endDate ? `${t('Until', 'حتى')} ${formatDate(day(a.endDate), locale)}` : null].filter(Boolean).join(' · ');
  const fail = failureText(a.lastFailure, t);
  const posted = a.occurrences.filter((o) => o.status === 'posted').length;
  const acts = allowanceActions(a).filter((x) => x !== 'retry' || !!a.lastFailure || a.nextPayment <= todayUtc());
  return (
    <li className="flex flex-col gap-3 py-4" data-testid={`row-allowance-${a.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2"><StatusBadge tone={a.lastFailure && live ? 'error' : s.tone} label={a.lastFailure && live ? t('Needs attention', 'يحتاج انتباهاً') : t(...s.text)} /></div>
          <span className="type-caption flex items-center gap-1.5 text-muted-foreground"><CalendarClock className="size-3.5" aria-hidden />{when}</span>
          {posted ? <span className="type-caption text-muted-foreground">{t(`${posted} sent`, `أُرسلت ${posted}`)}</span> : null}
          {a.note ? <span className="type-caption break-words text-muted-foreground" dir="auto">{a.note}</span> : null}
        </div>
        <MoneyDisplay value={a.amount} size="md" testId={`text-allowance-amount-${a.id}`} />
      </div>
      {fail && live ? <p role="status" className="type-caption rounded-lg bg-destructive-soft px-3 py-2 text-destructive" data-testid={`text-allowance-failure-${a.id}`}>{fail}</p> : null}
      {rowError ? <p role="alert" className="type-caption text-destructive">{rowError}</p> : null}
      {acts.length ? <div className="flex flex-wrap gap-2">{acts.map((act) => {
        const { icon: Icon, text } = ACTION_UI[act];
        return <Button key={act} size="sm" variant={act === 'cancel' ? 'ghost' : act === 'retry' ? 'outline' : 'secondary'} className={act === 'cancel' ? 'text-destructive' : undefined}
          loading={busyAction === act} disabled={!!busyAction} onClick={() => onAction(a, act)} data-testid={`button-allowance-${act}-${a.id}`}><Icon />{t(...text)}</Button>;
      })}</div> : null}
    </li>
  );
}
