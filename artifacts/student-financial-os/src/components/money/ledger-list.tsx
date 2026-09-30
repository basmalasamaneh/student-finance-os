import { ArrowDownLeft, ArrowUpRight, ShoppingBag } from 'lucide-react';
import type { FinanceAccount, FinanceTransaction } from '@workspace/api-client-react';
import { MoneyDisplay } from '@/components/finance/money-display';
import { useI18n } from '@/features/i18n/i18n-provider';
import { accountName, CATEGORY_LABEL, KIND_LABEL, label, type Tx } from '@/features/money/money-model';

/** Server ledger entries only — never profile/planning data. */
export function LedgerList({ items, accounts, t, onOpen, testId = 'list-ledger' }: { items: FinanceTransaction[]; accounts?: FinanceAccount[]; t: Tx; onOpen?: (tx: FinanceTransaction) => void; testId?: string }) {
  const { locale } = useI18n();
  return (
    <ul className="divide-y divide-divider" data-testid={testId}>
      {items.map((tx) => {
        const credit = tx.direction === 'credit';
        const Icon = tx.serviceId ? ShoppingBag : credit ? ArrowDownLeft : ArrowUpRight;
        const acct = accounts?.find((a) => a.id === tx.accountId);
        const body = (
          <>
            <span className={`grid size-9 shrink-0 place-items-center rounded-full ${credit ? 'bg-success-soft text-success' : 'bg-muted text-foreground'}`}><Icon className="size-4" aria-hidden /></span>
            <span className="flex min-w-0 flex-1 flex-col text-start">
              <span className="type-label truncate">{tx.merchantName ?? label(KIND_LABEL, tx.kind, t)}</span>
              <span className="type-caption truncate text-muted-foreground">
                {label(CATEGORY_LABEL, tx.category, t)}{acct ? ` · ${accountName(acct, t)}` : ''} · <bdi>{new Date(tx.createdAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}</bdi>
              </span>
            </span>
            <MoneyDisplay value={credit ? tx.amount : { ...tx.amount, minor: -tx.amount.minor }} size="sm" tone={credit ? 'positive' : 'default'} showPlus={credit} />
          </>
        );
        return (
          <li key={tx.id} data-testid={`row-tx-${tx.id}`}>
            {onOpen ? <button type="button" onClick={() => onOpen(tx)} className="flex w-full min-w-0 items-center gap-3 py-3 hover:bg-muted/50">{body}</button>
              : <div className="flex min-w-0 items-center gap-3 py-3">{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}
