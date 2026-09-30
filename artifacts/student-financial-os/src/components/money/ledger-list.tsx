import { Fragment, type ReactNode } from 'react';
import { Link } from 'wouter';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, BookOpen, Bus, GraduationCap, Printer, ShoppingBag, UtensilsCrossed, Wallet, type LucideIcon } from 'lucide-react';
import type { FinanceAccount, FinanceTransaction } from '@workspace/api-client-react';
import { MoneyDisplay } from '@/components/finance/money-display';
import { groupByDay, TransactionDateHeader } from '@/components/finance/transaction-row';
import { useI18n } from '@/features/i18n/i18n-provider';
import { accountName, CATEGORY_LABEL, KIND_LABEL, label, type Tx } from '@/features/money/money-model';
import { transactionDescription } from '@/features/transactions/labels';
import { cn } from '@/lib/utils';

const CATEGORY_ICON: Record<string, LucideIcon> = {
  food: UtensilsCrossed, books: BookOpen, printing: Printer, transportation: Bus, fees: GraduationCap,
  income: ArrowDownLeft, transfer: ArrowLeftRight, withdrawal: Wallet,
};

/** Server ledger entries only — never profile/planning data. `grouped` adds sticky Today/Yesterday/date headers. */
export function LedgerList({ items, accounts, t, onOpen, hrefFor, categoryText, testId = 'list-ledger', grouped = false }: { items: FinanceTransaction[]; accounts?: FinanceAccount[]; t: Tx; onOpen?: (tx: FinanceTransaction) => void; hrefFor?: (tx: FinanceTransaction) => string; categoryText?: (tx: FinanceTransaction) => string; testId?: string; grouped?: boolean }) {
  const { locale } = useI18n();
  const row = (tx: FinanceTransaction): ReactNode => {
    const credit = tx.direction === 'credit';
    const Icon = tx.serviceId ? ShoppingBag : CATEGORY_ICON[tx.category] ?? (credit ? ArrowDownLeft : ArrowUpRight);
    const directional = Icon === ArrowDownLeft || Icon === ArrowUpRight;
    const acct = accounts?.find((a) => a.id === tx.accountId);
    const body = (
      <>
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', credit ? 'bg-success-soft text-success' : 'bg-primary-soft text-gold-ink ring-1 ring-inset ring-gold-200/70 dark:ring-gold-800/50')}><Icon className={cn('size-[18px]', directional && 'rtl:-scale-x-100')} aria-hidden /></span>
        <span className="flex min-w-0 flex-1 flex-col text-start">
          <span className="type-label truncate">{tx.merchantName ?? label(KIND_LABEL, tx.kind, t)}</span>
          <span className="type-caption truncate text-muted-foreground">
            {categoryText ? categoryText(tx) : label(CATEGORY_LABEL, tx.category, t)}{acct ? ` · ${accountName(acct, t)}` : tx.accountName ? ` · ${tx.accountName}` : ''} · <bdi>{new Date(tx.createdAt).toLocaleString(locale, grouped ? { timeStyle: 'short' } : { dateStyle: 'short', timeStyle: 'short' })}</bdi>
          </span>
        </span>
        <MoneyDisplay value={credit ? tx.amount : { ...tx.amount, minor: -tx.amount.minor }} size="sm" tone={credit ? 'positive' : 'default'} showPlus={credit} className="shrink-0" />
      </>
    );
    return (
      <li key={tx.id} data-testid={`row-tx-${tx.id}`}>
        {hrefFor ? <Link href={hrefFor(tx)} className="flex min-h-16 w-full min-w-0 items-center gap-3 rounded-xl px-1 py-3 transition-colors hover:bg-primary-soft/50" aria-label={`${transactionDescription(tx, t)} — ${t('View details', 'عرض التفاصيل')}`} data-testid={`link-tx-${tx.id}`}>{body}</Link>
          : onOpen ? <button type="button" onClick={() => onOpen(tx)} className="flex min-h-16 w-full min-w-0 items-center gap-3 rounded-xl px-1 py-3 transition-colors hover:bg-primary-soft/50">{body}</button>
          : <div className="flex min-h-16 min-w-0 items-center gap-3 px-1 py-3">{body}</div>}
      </li>
    );
  };
  if (!grouped) return <ul className="divide-y divide-divider" data-testid={testId}>{items.map(row)}</ul>;
  const groups = groupByDay(items, (tx) => new Date(tx.createdAt), {
    today: t('Today', 'اليوم'), yesterday: t('Yesterday', 'أمس'),
    format: (d) => d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }),
  });
  return (
    <div data-testid={testId}>
      {groups.map((g) => (
        <Fragment key={g.key}>
          <TransactionDateHeader label={g.label} />
          <ul className="divide-y divide-divider">{g.items.map(row)}</ul>
        </Fragment>
      ))}
    </div>
  );
}
