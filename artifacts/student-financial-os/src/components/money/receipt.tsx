import { CheckCircle2 } from 'lucide-react';
import type { FinanceAccount, FinanceTransaction } from '@workspace/api-client-react';
import { MoneyDisplay } from '@/components/finance/money-display';
import { useI18n } from '@/features/i18n/i18n-provider';
import { accountName, CATEGORY_LABEL, KIND_LABEL, label, type Tx } from '@/features/money/money-model';
import { ReviewRow, SimulatedNote } from './fields';

export function statusText(status: string, t: Tx) {
  return status === 'simulated_payment' ? t('Simulated Payment', 'دفعة محاكاة') : t('Simulated', 'محاكاة');
}

/** Immutable receipt rendered from the server's ledger entry — never from local form state. */
export function Receipt({ tx, account, t }: { tx: FinanceTransaction; account?: FinanceAccount; t: Tx }) {
  const { locale } = useI18n();
  const when = new Date(tx.createdAt);
  return (
    <div className="motion-rise flex flex-col gap-4" data-testid="receipt">
      <div className="flex flex-col items-center gap-2 pt-1 text-center">
        <span className="motion-pop grid size-11 place-items-center rounded-full bg-success-soft text-success"><CheckCircle2 className="size-5" aria-hidden /></span>
        <p className="type-caption text-muted-foreground">{tx.merchantName ?? label(KIND_LABEL, tx.kind, t)}</p>
        <MoneyDisplay value={tx.amount} size="xl" tone={tx.direction === 'credit' ? 'positive' : 'default'} showPlus={tx.direction === 'credit'} testId="text-receipt-amount" />
        <span className="type-caption rounded-full border border-primary/40 bg-primary-soft px-2.5 py-0.5 font-medium text-gold-ink" data-testid="status-receipt">{statusText(tx.status, t)}</span>
      </div>
      {tx.items?.length ? (
        <ul className="divide-y divide-divider border-y border-divider" data-testid="list-receipt-items">
          {tx.items.map((it) => (
            <li key={it.productId} className="flex items-baseline justify-between gap-3 py-2">
              <span className="type-label min-w-0 break-words">{it.name} <span className="tabular text-muted-foreground">× {it.quantity}</span></span>
              <MoneyDisplay value={it.lineTotal} size="sm" />
            </li>
          ))}
        </ul>
      ) : null}
      <dl className="divide-y divide-divider">
        <ReviewRow label={t('Type', 'النوع')}>{label(KIND_LABEL, tx.kind, t)} · {label(CATEGORY_LABEL, tx.category, t)}</ReviewRow>
        <ReviewRow label={t('Account', 'الحساب')} testId="text-receipt-account">{account ? accountName(account, t) : tx.accountId}</ReviewRow>
        <ReviewRow label={t('Balance after', 'الرصيد بعد')}><MoneyDisplay value={tx.balanceAfter} size="sm" /></ReviewRow>
        {tx.counterpartyAccountId ? <ReviewRow label={t('Counterparty account', 'حساب الطرف الآخر')}><bdi className="tabular break-all text-xs">{tx.counterpartyAccountId}</bdi></ReviewRow> : null}
        <ReviewRow label={t('Date & time', 'التاريخ والوقت')}><bdi>{when.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}</bdi></ReviewRow>
        <ReviewRow label={t('Transaction ID', 'رقم الحركة')} testId="text-receipt-id"><bdi className="tabular break-all text-xs">{tx.id}</bdi></ReviewRow>
        {tx.note ? <ReviewRow label={t('Note', 'ملاحظة')}>{tx.note}</ReviewRow> : null}
      </dl>
      <SimulatedNote t={t} />
    </div>
  );
}
