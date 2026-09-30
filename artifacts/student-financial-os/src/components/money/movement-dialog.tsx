import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import {
  getLookupFinanceRecipientQueryKey, useCreateFinanceMovement, useLookupFinanceRecipient,
  type FinanceAccount, type FinanceMovementInputKind, type FinanceTransaction,
} from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FlowSteps, SuccessCheck } from '@/components/money/flow-steps';
import { MoneyDisplay } from '@/components/finance/money-display';
import { Notice } from '@/components/states/state-panel';
import { AccountSelect, AmountInput, BalanceHint, Field, inputClass, ReviewRow, SimulatedNote } from './fields';
import { Receipt } from './receipt';
import {
  accountName, amountErrorText, apiErrorText, KIND_LABEL, label, parseAmountInput, useIdempotencyKey, useRefreshFinance, type Tx,
} from '@/features/money/money-model';
import type { Currency, Money } from '@/lib/money';

const DEBIT: FinanceMovementInputKind[] = ['withdrawal', 'send', 'transfer', 'payment'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DESCRIPTION: Record<FinanceMovementInputKind, [string, string]> = {
  add: ['Top up an account with simulated funds.', 'اشحن حساباً بأموال محاكاة.'],
  receive: ['Record simulated money received from outside the app.', 'سجّل مالاً محاكى وصلك من خارج التطبيق.'],
  deposit: ['Record a simulated deposit into this account.', 'سجّل إيداعاً محاكى في هذا الحساب.'],
  withdrawal: ['Take simulated money out of an account.', 'اسحب مالاً محاكى من حساب.'],
  send: ['Send to another student using their exact account ID. The server verifies it.', 'أرسل لطالب آخر باستخدام معرّف حسابه الدقيق. يتحقق الخادم منه.'],
  payment: ['Record a simulated outgoing payment, for example to a shop. It is logged under Other.', 'سجّل دفعة صادرة محاكاة، مثلاً لمتجر. تُسجَّل ضمن «أخرى».'],
  transfer: ['Move money between two of your own accounts in the same currency.', 'انقل المال بين حسابين لك بنفس العملة.'],
};

type Step = 'form' | 'review' | 'done';

export function MovementDialog({ kind, open, onOpenChange, accounts, defaultAccountId, t }: {
  kind: FinanceMovementInputKind; open: boolean; onOpenChange: (o: boolean) => void; accounts: FinanceAccount[]; defaultAccountId?: string; t: Tx;
}) {
  const [step, setStep] = useState<Step>('form');
  const [accountId, setAccountId] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [amountRaw, setAmountRaw] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState<Money | null>(null);
  const [receipt, setReceipt] = useState<FinanceTransaction | null>(null);
  const idem = useIdempotencyKey();
  const refresh = useRefreshFinance();
  const mutation = useCreateFinanceMovement({ request: { headers: idem.headers } });

  useEffect(() => {
    if (open) {
      setStep('form'); setAccountId(defaultAccountId ?? (accounts.length === 1 ? accounts[0]!.id : '')); setRecipientId('');
      setAmountRaw(''); setNote(''); setErrors({}); setAmount(null); setReceipt(null); idem.renew(); mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind]);

  const source = accounts.find((a) => a.id === accountId);
  const currency = source?.currency as Currency | undefined;
  const isDebit = DEBIT.includes(kind);
  const ownTargets = useMemo(() => accounts.filter((a) => a.id !== accountId && a.currency === source?.currency), [accounts, accountId, source]);
  const target = kind === 'transfer' ? accounts.find((a) => a.id === recipientId) : undefined;
  const trimmedRecipient = recipientId.trim();

  const lookup = useLookupFinanceRecipient(trimmedRecipient, {
    query: { enabled: kind === 'send' && step === 'review' && UUID.test(trimmedRecipient), queryKey: getLookupFinanceRecipientQueryKey(trimmedRecipient), retry: false },
  });
  const recipientMismatch = kind === 'send' && lookup.data && lookup.data.currency !== currency;

  function validate() {
    const e: Record<string, string> = {};
    if (!source) e.account = t('Choose an account.', 'اختر حساباً.');
    if (kind === 'transfer' && !target) e.recipient = t('Choose the receiving account.', 'اختر الحساب المستلم.');
    if (kind === 'send') {
      if (!trimmedRecipient) e.recipient = t('Enter the recipient account ID.', 'أدخل معرّف حساب المستلم.');
      else if (!UUID.test(trimmedRecipient)) e.recipient = t('That is not a valid account ID format.', 'صيغة معرّف الحساب غير صحيحة.');
      else if (accounts.some((a) => a.id === trimmedRecipient)) e.recipient = t('That is your own account. Use Internal transfer instead.', 'هذا حسابك. استخدم التحويل الداخلي.');
    }
    let parsed: Money | null = null;
    if (currency) {
      const r = parseAmountInput(amountRaw, currency);
      if (!r.ok) e.amount = amountErrorText(r.reason, currency, t);
      else {
        parsed = r.value;
        if (isDebit && source && r.value.minor > source.balance.minor) e.amount = t('Insufficient balance in this account.', 'الرصيد غير كافٍ في هذا الحساب.');
      }
    }
    if (note.length > 300) e.note = t('Keep the note under 300 characters.', 'اجعل الملاحظة أقل من 300 حرف.');
    setErrors(e);
    if (Object.keys(e).length === 0 && parsed) { setAmount(parsed); setStep('review'); }
    else requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  }

  function confirm() {
    if (!source || !amount || mutation.isPending) return;
    mutation.mutate({
      data: {
        kind, accountId: source.id, amount: { minor: amount.minor, currency: amount.currency },
        ...(kind === 'transfer' ? { recipientAccountId: target!.id } : kind === 'send' ? { recipientAccountId: trimmedRecipient } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      },
    }, {
      onSuccess: (tx) => { setReceipt(tx); setStep('done'); idem.renew(); void refresh(); },
    });
  }

  const title = label(KIND_LABEL, kind, t);
  const sendBlocked = kind === 'send' && (lookup.isLoading || lookup.isError || !!recipientMismatch);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!mutation.isPending) onOpenChange(o); }}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto" data-testid={`dialog-movement-${kind}`}>
        <DialogHeader>
          <DialogTitle>{step === 'review' ? t(`Review: ${title}`, `مراجعة: ${title}`) : step === 'done' ? t('Recorded', 'تم التسجيل') : title}</DialogTitle>
          <DialogDescription>{step === 'review' ? t('Check every detail. Nothing moves until you confirm.', 'راجع كل التفاصيل. لا يتحرك شيء حتى تؤكد.') : t(DESCRIPTION[kind][0], DESCRIPTION[kind][1])}</DialogDescription>
        </DialogHeader>
        <FlowSteps label={t('Progress', 'التقدم')} current={step === 'form' ? 0 : step === 'review' ? 1 : 2} steps={[t('Details', 'التفاصيل'), t('Review', 'مراجعة'), t('Done', 'تم')]} />

        {step === 'form' && (
          <form className="flex flex-col gap-4" noValidate onSubmit={(e) => { e.preventDefault(); validate(); }}>
            <Field id="account" label={isDebit ? t('From account', 'من حساب') : t('Into account', 'إلى حساب')} error={errors.account}>
              <AccountSelect id="account" value={accountId} onChange={(v) => { setAccountId(v); if (kind === 'transfer') setRecipientId(''); }} accounts={accounts} t={t} error={errors.account} />
              <BalanceHint account={source} t={t} />
            </Field>
            {kind === 'transfer' && (
              <Field id="recipient" label={t('To account', 'إلى حساب')} error={errors.recipient}
                hint={source && !ownTargets.length ? t(`No other ${source.currency} account. Create one first.`, `لا يوجد حساب آخر بعملة ${source.currency}. أنشئ واحداً أولاً.`) : t('Only your accounts in the same currency are shown.', 'تظهر حساباتك بنفس العملة فقط.')}>
                <AccountSelect id="recipient" value={recipientId} onChange={setRecipientId} accounts={ownTargets} t={t} error={errors.recipient} />
              </Field>
            )}
            {kind === 'send' && (
              <Field id="recipient" label={t('Recipient account ID', 'معرّف حساب المستلم')} error={errors.recipient} hint={t('Ask the recipient to copy it from their Money page.', 'اطلب من المستلم نسخه من صفحة المال لديه.')}>
                <input id="recipient" dir="ltr" autoComplete="off" spellCheck={false} value={recipientId} onChange={(e) => setRecipientId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className={`${inputClass} tabular text-xs`} aria-invalid={!!errors.recipient} aria-describedby={errors.recipient ? 'recipient-error' : 'recipient-hint'} data-testid="input-recipient" />
              </Field>
            )}
            <Field id="amount" label={t('Amount', 'المبلغ')} error={errors.amount} hint={!currency ? t('Choose an account to set the currency.', 'اختر حساباً لتحديد العملة.') : undefined}>
              <AmountInput id="amount" value={amountRaw} onChange={setAmountRaw} currency={currency} error={errors.amount} />
            </Field>
            <Field id="note" label={t('Note (optional)', 'ملاحظة (اختياري)')} error={errors.note}>
              <input id="note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} className={inputClass} aria-invalid={!!errors.note} data-testid="input-note" />
            </Field>
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">{t('Cancel', 'إلغاء')}</Button>
              <Button type="submit" disabled={!currency} data-testid="button-review">{t('Review', 'مراجعة')}</Button>
            </DialogFooter>
          </form>
        )}

        {step === 'review' && source && amount && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-1 py-2">
              <span className="type-caption text-muted-foreground">{isDebit ? t('You will move', 'ستحوّل') : t('You will record', 'ستسجّل')}</span>
              <MoneyDisplay value={amount} size="xl" testId="text-review-amount" />
            </div>
            <dl className="divide-y divide-divider border-y border-divider">
              <ReviewRow label={isDebit ? t('From', 'من') : t('Into', 'إلى')}>{accountName(source, t)}</ReviewRow>
              {kind === 'transfer' && target ? <ReviewRow label={t('To', 'إلى')}>{accountName(target, t)}</ReviewRow> : null}
              {kind === 'send' ? (
                <ReviewRow label={t('Recipient', 'المستلم')} testId="text-review-recipient">
                  {lookup.isLoading ? <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Loader2 className="size-3.5 animate-spin" aria-hidden />{t('Verifying…', 'جارٍ التحقق…')}</span>
                    : lookup.data ? <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-success" aria-hidden />{lookup.data.name} · {lookup.data.currency}</span>
                      : <span className="text-destructive">{t('Not verified', 'غير متحقق')}</span>}
                </ReviewRow>
              ) : null}
              <ReviewRow label={t('Balance now', 'الرصيد الآن')}><MoneyDisplay value={source.balance} size="sm" /></ReviewRow>
              {note.trim() ? <ReviewRow label={t('Note', 'ملاحظة')}>{note.trim()}</ReviewRow> : null}
            </dl>
            {kind === 'send' && lookup.isError ? <Notice tone="error" title={t('Recipient not found', 'المستلم غير موجود')} body={apiErrorText(lookup.error, t)} /> : null}
            {recipientMismatch ? <Notice tone="error" title={t('Currency mismatch', 'عدم تطابق العملة')} body={t(`The recipient account uses ${lookup.data!.currency}. Send from a ${lookup.data!.currency} account.`, `حساب المستلم بعملة ${lookup.data!.currency}. أرسل من حساب بنفس العملة.`)} /> : null}
            {mutation.isError ? <Notice tone="error" title={t('Not completed', 'لم يكتمل')} body={apiErrorText(mutation.error, t)} /> : null}
            <SimulatedNote t={t} />
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => { setStep('form'); idem.renew(); mutation.reset(); }} data-testid="button-edit"><ArrowLeft className="rtl:rotate-180" aria-hidden />{t('Edit', 'تعديل')}</Button>
              <Button type="button" onClick={confirm} disabled={sendBlocked} loading={mutation.isPending} data-testid="button-confirm">
                {mutation.isError ? t('Retry safely', 'أعد المحاولة بأمان') : t('Confirm', 'تأكيد')}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'done' && receipt && (
          <>
            <SuccessCheck label={t('Recorded', 'تم التسجيل')} />
            <Receipt tx={receipt} account={source} t={t} />
            <DialogFooter><Button onClick={() => onOpenChange(false)} data-testid="button-done">{t('Done', 'تم')}</Button></DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
