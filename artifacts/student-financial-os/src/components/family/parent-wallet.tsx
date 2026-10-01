import { useEffect, useState } from 'react';
import { Plus, Wallet } from 'lucide-react';
import { useCreateParentAccount, useTopUpParentWallet, type FinanceAccount, type FinanceAccountInputCurrency, type FinanceAccountInputType, type ParentWallet } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MoneyDisplay } from '@/components/finance/money-display';
import { StatePanel } from '@/components/states/state-panel';
import { HighValueConfirm } from '@/components/money/high-value-confirm';
import { AccountSelect, AmountInput, Field, inputClass, ReviewRow } from '@/components/money/fields';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useDeviceSecurity } from '@/features/security/device-security';
import { formatDate, type Currency } from '@/lib/money';
import { ACCOUNT_TYPE_LABEL, accountName, amountErrorText, apiErrorText, parseAmountInput, totalsByCurrency, type Tx } from '@/features/money/money-model';
import { useKeyRing, useRefreshFamily } from '@/features/family/family-view';
import { cn } from '@/lib/utils';

const TOPUP_LABEL: [string, string] = ['Simulated external top-up — no bank connection or real money', 'شحن خارجي تجريبي — بلا اتصال بنكي أو أموال حقيقية'];

export function ParentCreateAccountDialog({ open, onOpenChange, initialCurrency, t }: { open: boolean; onOpenChange: (o: boolean) => void; initialCurrency?: string; t: Tx }) {
  const [type, setType] = useState<FinanceAccountInputType>('wallet');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<FinanceAccountInputCurrency>('ILS');
  const ring = useKeyRing(); const refresh = useRefreshFamily();
  const m = useCreateParentAccount({ request: { headers: ring.headers } });
  useEffect(() => { if (open) { setType('wallet'); setName(''); setCurrency((initialCurrency as FinanceAccountInputCurrency) ?? 'ILS'); m.reset(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = () => {
    if (m.isPending) return;
    const data = { type, name: name.trim() || t(...ACCOUNT_TYPE_LABEL[type]!), currency };
    const fp = JSON.stringify(data); ring.prime(fp);
    m.mutate({ data }, { onSuccess: () => { ring.done(fp); void refresh(); onOpenChange(false); } });
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!m.isPending) onOpenChange(o); }}>
      <DialogContent data-parent-confidential-portal data-testid="dialog-parent-account" className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('New account', 'حساب جديد')}</DialogTitle>
          <DialogDescription>{t('Starts at zero. Simulated — not connected to any bank.', 'يبدأ من صفر. محاكاة — غير متصل بأي بنك.')}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('Type', 'النوع')}>
            {(['wallet', 'bank', 'cash', 'other'] as const).map((ty) => (
              <label key={ty} className={cn('type-label flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3', type === ty ? 'border-primary bg-primary-soft' : 'border-input hover:bg-muted')}>
                <input type="radio" name="parent-acct-type" checked={type === ty} onChange={() => setType(ty)} className="accent-[hsl(var(--primary))]" data-testid={`radio-parent-type-${ty}`} />
                {t(...ACCOUNT_TYPE_LABEL[ty]!)}
              </label>))}
          </div>
          <Field id="parent-acct-name" label={t('Name', 'الاسم')} hint={t('Optional.', 'اختياري.')}>
            <input id="parent-acct-name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} data-testid="input-parent-account-name" />
          </Field>
          <Field id="parent-acct-currency" label={t('Currency', 'العملة')} hint={t('Can’t be changed later.', 'لا يمكن تغييرها لاحقاً.')}>
            <select id="parent-acct-currency" value={currency} onChange={(e) => setCurrency(e.target.value as FinanceAccountInputCurrency)} className={cn(inputClass, 'appearance-auto')} data-testid="select-parent-account-currency">
              {(['ILS', 'USD', 'JOD'] as const).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          {m.isError ? <p role="alert" className="type-label text-destructive">{apiErrorText(m.error, t)}</p> : null}
          <DialogFooter className="form-action-bar">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={m.isPending}>{t('Cancel', 'إلغاء')}</Button>
            <Button type="submit" loading={m.isPending} data-testid="button-create-parent-account">{t('Create account', 'إنشاء الحساب')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TopUpDialog({ open, onOpenChange, accounts, initialAccountId, t }: { open: boolean; onOpenChange: (o: boolean) => void; accounts: FinanceAccount[]; initialAccountId?: string; t: Tx }) {
  const { confirmationThreshold } = useDeviceSecurity();
  const [acct, setAcct] = useState(''); const [amount, setAmount] = useState(''); const [ack, setAck] = useState(false);
  const [step, setStep] = useState<'form' | 'review' | 'done'>('form'); const [tried, setTried] = useState(false);
  const ring = useKeyRing(); const refresh = useRefreshFamily();
  const m = useTopUpParentWallet({ request: { headers: ring.headers } });
  useEffect(() => { if (open) { setAcct(initialAccountId ?? (accounts.length === 1 ? accounts[0].id : '')); setAmount(''); setAck(false); setStep('form'); setTried(false); m.reset(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const account = accounts.find((a) => a.id === acct);
  const currency = (account?.currency ?? 'ILS') as Currency;
  const parsed = parseAmountInput(amount, currency);
  const amountErr = !parsed.ok ? amountErrorText(parsed.reason, currency, t) : undefined;
  const valid = !!account && !amountErr && ack;
  const value = parsed.ok ? { minor: parsed.value.minor, currency } : null;
  const enhanced = !!value && (value.currency !== 'ILS' || value.minor > confirmationThreshold.minor);
  const confirm = () => {
    if (!value || !account || m.isPending) return;
    const data = { accountId: account.id, amount: value, simulatedFundingAcknowledged: true as const };
    const fp = JSON.stringify(data); ring.prime(fp);
    m.mutate({ data }, { onSuccess: () => { ring.done(fp); setStep('done'); void refresh(); } });
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!m.isPending) onOpenChange(o); }}>
      <DialogContent data-parent-confidential-portal data-testid="dialog-topup" className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{step === 'done' ? t('Top-up recorded', 'تم تسجيل الشحن') : t('Add money', 'إضافة مال')}</DialogTitle>
          <DialogDescription>{t(...TOPUP_LABEL)}</DialogDescription>
        </DialogHeader>
        {step === 'form' ? (
          <form className="flex flex-col gap-4" noValidate onSubmit={(e) => { e.preventDefault(); setTried(true); if (valid) setStep('review'); }}>
            <Field id="topup-account" label={t('Into', 'إلى')} error={tried && !account ? t('Choose an account', 'اختر حساباً') : undefined}>
              <AccountSelect id="topup-account" value={acct} onChange={setAcct} accounts={accounts} t={t} />
            </Field>
            <Field id="topup-amount" label={t('Amount', 'المبلغ')} error={tried ? amountErr : undefined}>
              <AmountInput id="topup-amount" value={amount} onChange={setAmount} currency={currency} error={tried ? amountErr : undefined} large />
            </Field>
            <label className="flex min-h-11 cursor-pointer items-start gap-3">
              <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-1" data-testid="checkbox-topup-ack" />
              <span className="type-label font-normal">{t('I understand this is simulated. No bank is charged and no real money moves.', 'أفهم أن هذا محاكاة. لا يُخصم من أي بنك ولا تتحرك أموال حقيقية.')}</span>
            </label>
            <DialogFooter className="form-action-bar">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>{t('Cancel', 'إلغاء')}</Button>
              <Button type="submit" disabled={!ack} data-testid="button-review-topup">{t('Review', 'مراجعة')}</Button>
            </DialogFooter>
          </form>
        ) : step === 'review' && value && account ? (
          <div className="flex flex-col gap-4">
            <dl className="divide-y divide-divider border-y border-divider">
              <ReviewRow label={t('Into', 'إلى')}>{accountName(account, t)}</ReviewRow>
              <ReviewRow label={t('Amount', 'المبلغ')} testId="text-topup-review-amount"><MoneyDisplay value={value} size="sm" /></ReviewRow>
              <ReviewRow label={t('Fees', 'الرسوم')}>{t('None', 'لا شيء')}</ReviewRow>
              <ReviewRow label={t('Source', 'المصدر')}>{t('Simulated external', 'خارجي تجريبي')}</ReviewRow>
            </dl>
            {m.isError ? <p role="alert" className="type-label text-destructive" data-testid="error-topup">{apiErrorText(m.error, t)}</p> : null}
            <DialogFooter className={cn('form-action-bar gap-2', enhanced && 'sm:flex-col')}>
              <Button variant="secondary" onClick={() => setStep('form')} disabled={m.isPending}>{t('Back', 'رجوع')}</Button>
              {enhanced ? <HighValueConfirm onConfirm={confirm} pending={m.isPending} threshold={confirmationThreshold} t={t} testId="button-confirm-topup" />
                : <Button onClick={confirm} loading={m.isPending} data-testid="button-confirm-topup">{t('Add money', 'إضافة المال')}</Button>}
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {m.data ? <MoneyDisplay value={m.data.amount} size="lg" tone="positive" showPlus testId="text-topup-done" /> : null}
            <DialogFooter><Button onClick={() => onOpenChange(false)} data-testid="button-done-topup">{t('Done', 'تم')}</Button></DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Parent's own simulated wallet: per-currency totals, accounts, latest entries. */
export function ParentWalletPanel({ wallet, t, onCreate, onTopUp }: { wallet: ParentWallet; t: Tx; onCreate: () => void; onTopUp: (accountId?: string) => void }) {
  const { locale } = useI18n();
  const { hideBalances: hb } = useDeviceSecurity();
  const totals = totalsByCurrency(wallet.accounts);
  if (!wallet.accounts.length) return <StatePanel tone="empty" icon={<Wallet className="size-5" />} title={t('No wallet account yet', 'لا حساب محفظة بعد')}
    body={t('Create a simulated account, then add simulated money to fund allowances.', 'أنشئ حساباً تجريبياً ثم أضف مالاً تجريبياً لتمويل المصروفات.')}
    action={<Button onClick={onCreate} data-testid="button-create-parent-account-empty"><Plus />{t('Create account', 'إنشاء حساب')}</Button>} />;
  return (
    <div className="flex flex-col gap-5" data-testid="panel-parent-wallet">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">{totals.map((x) => x.value ? <MoneyDisplay hidden={hb} hiddenLabel={t('Amount hidden', 'المبلغ مخفي')} key={x.currency} value={x.value} size="xl" testId={`text-wallet-total-${x.currency}`} /> : null)}</div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCreate} data-testid="button-create-parent-account"><Plus />{t('Account', 'حساب')}</Button>
          <Button onClick={() => onTopUp()} data-testid="button-topup">{t('Add money', 'إضافة مال')}</Button>
        </div>
      </div>
      <ul className="divide-y divide-divider">
        {wallet.accounts.map((a) => (
          <li key={a.id} className="flex min-h-14 items-center justify-between gap-3 py-2" data-testid={`row-parent-account-${a.id}`}>
            <span className="type-label truncate">{accountName(a, t)} · <span className="text-muted-foreground">{a.currency}</span></span>
            <span className="flex items-center gap-2"><MoneyDisplay hidden={hb} hiddenLabel={t('Amount hidden', 'المبلغ مخفي')} value={a.balance} size="sm" />
              <Button size="sm" variant="tertiary" onClick={() => onTopUp(a.id)} data-testid={`button-topup-${a.id}`}>{t('Top up', 'شحن')}</Button></span>
          </li>))}
      </ul>
      {wallet.transactions.length ? <div className="flex flex-col gap-1">
        <span className="type-caption text-muted-foreground">{t('Recent wallet activity', 'نشاط المحفظة الأخير')}</span>
        <ul className="divide-y divide-divider">{wallet.transactions.slice(0, 8).map((x) => (
          <li key={x.id} className="flex min-h-11 items-center justify-between gap-3 py-2 type-label" data-testid={`row-wallet-tx-${x.id}`}>
            <span className="truncate">{x.kind === 'allowance' ? t('Allowance', 'مصروف') : x.direction === 'credit' ? t('Simulated top-up', 'شحن تجريبي') : x.kind.replace(/_/g, ' ')} · <span className="text-muted-foreground">{formatDate(new Date(x.createdAt), locale)}</span></span>
            <MoneyDisplay hidden={hb} hiddenLabel={t('Amount hidden', 'المبلغ مخفي')} value={x.amount} size="sm" tone={x.direction === 'credit' ? 'positive' : 'default'} showPlus={x.direction === 'credit'} />
          </li>))}</ul>
      </div> : null}
    </div>
  );
}
