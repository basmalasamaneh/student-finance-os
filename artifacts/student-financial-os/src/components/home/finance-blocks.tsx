import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Eye, EyeOff } from 'lucide-react';
import type { FinanceAccount, FinanceSummary } from '@workspace/api-client-react';
import { MoneyDisplay } from '@/components/finance/money-display';
import { LedgerList } from '@/components/money/ledger-list';
import { AccountList } from '@/components/money/account-list';
import { Unavailable, type T } from './home-primitives';

type Q<D> = { data?: D; isPending: boolean; isError: boolean; refetch: () => unknown };

const linkCls = 'type-label inline-flex min-h-11 items-center text-gold-ink underline-offset-4 hover:underline';

export function FinanceLoading() {
  return <div className="flex flex-col gap-2" role="status" aria-label="loading"><span className="skeleton-shimmer h-9 w-40 rounded" /><span className="skeleton-shimmer h-3 w-56 rounded" /></div>;
}

export function FinanceError({ q, t }: { q: { refetch: () => unknown }; t: T }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-1">
      <p className="type-label text-destructive">{t('Could not load live figures.', 'تعذّر تحميل الأرقام الفعلية.')}</p>
      <button type="button" onClick={() => q.refetch()} className={linkCls} data-testid="button-retry-finance">{t('Retry', 'إعادة المحاولة')}</button>
    </div>
  );
}

/** Optional presentation props (Phase 3): hide toggle (caller owns persistence), account count, quick actions. */
export function BalanceBlock({ summary, t, hidden = false, onToggleHidden, accountCount, actions }: { summary: Q<FinanceSummary>; t: T; hidden?: boolean; onToggleHidden?: () => void; accountCount?: number; actions?: ReactNode }) {
  if (summary.isPending) return <div className="surface-gold flex flex-col gap-3 p-5 md:p-6" role="status" aria-label={t('Loading balance…', 'جارٍ تحميل الرصيد…')}><span className="h-3 w-28 rounded bg-gold-50/40" /><span className="h-10 w-48 rounded-lg bg-gold-50/40" /><span className="h-3 w-40 rounded bg-gold-50/30" /></div>;
  if (summary.isError || !summary.data) return <FinanceError q={summary} t={t} />;
  const rows = summary.data.cashflow;
  if (!rows.length) return <>
    <p className="figure-hero text-muted-foreground/60" aria-hidden>—</p>
    <p className="type-body mt-3 max-w-sm text-muted-foreground" data-testid="status-balance">{t('No accounts yet, so there is no balance to show.', 'لا حسابات بعد، لذا لا يوجد رصيد لعرضه.')}</p>
    <Link href="/money" className={linkCls} data-testid="link-create-account">{t('Create a Student Wallet', 'أنشئ محفظة طلابية')}</Link>
  </>;
  return (
    <div className="surface-gold relative flex min-w-0 flex-col gap-2 overflow-hidden p-5 md:p-6" data-testid="text-balance">
      {accountCount !== undefined || onToggleHidden ? <div className="flex items-center justify-between gap-3">
        {accountCount !== undefined ? <span className="type-label" data-testid="text-account-count">{t(`${accountCount} ${accountCount === 1 ? 'account' : 'accounts'}`, `${accountCount} حساب`)}</span> : <span />}
        {onToggleHidden ? <button type="button" onClick={onToggleHidden} aria-pressed={hidden} className="-me-2 grid size-11 place-items-center rounded-full transition-colors hover:bg-gold-50/25" aria-label={hidden ? t('Show balance', 'إظهار الرصيد') : t('Hide balance', 'إخفاء الرصيد')} data-testid="button-toggle-balance">{hidden ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}</button> : null}
      </div> : null}
      {rows.map((c) => (
        <div key={c.currency} className="flex flex-col gap-1">
          <MoneyDisplay value={c.balance} size={rows.length > 1 ? 'xl' : 'hero'} hidden={hidden} hiddenLabel={t('Amount hidden', 'المبلغ مخفي')} />
          {c.reservedBalance && c.reservedBalance.minor > 0 ? (
            <p className="type-caption text-muted-foreground" data-testid={`text-reserved-${c.currency}`}>
              + {t('reserved in goals', 'محجوز في الأهداف')} <MoneyDisplay value={c.reservedBalance} size="sm" className="inline !text-xs" tone="highlight" hidden={hidden} hiddenLabel={t('Amount hidden', 'المبلغ مخفي')} />
              {c.netBalance ? <> = {t('net', 'الصافي')} <MoneyDisplay value={c.netBalance} size="sm" className="inline !text-xs" hidden={hidden} hiddenLabel={t('Amount hidden', 'المبلغ مخفي')} /></> : null}
            </p>
          ) : null}
        </div>
      ))}
      <p className="type-caption text-muted-foreground">{t('Spendable simulated balance, grouped by currency. Goal savings are reserved and not included.', 'الرصيد المحاكى القابل للإنفاق حسب العملة. مدّخرات الأهداف محجوزة وغير مشمولة.')}</p>
      {actions ? <div className="pt-3">{actions}</div> : null}
    </div>
  );
}

export function AccountsBlock({ accounts, t }: { accounts: Q<FinanceAccount[]>; t: T }) {
  const [, navigate] = useLocation();
  if (accounts.isPending) return <FinanceLoading />;
  if (accounts.isError || !accounts.data) return <FinanceError q={accounts} t={t} />;
  if (!accounts.data.length) return <Unavailable testId="status-accounts" label={t('No accounts yet', 'لا حسابات بعد')} body={t('Wallet, bank, cash or other — create one on the Money page.', 'محفظة أو بنك أو نقد أو غير ذلك — أنشئ واحداً في صفحة المال.')} />;
  return <>
    <AccountList accounts={accounts.data.slice(0, 4)} onSelect={() => navigate('/money')} t={t} />
    <Link href="/money" className={linkCls} data-testid="link-money">{t('Open Money', 'فتح المال')}</Link>
  </>;
}

export function ActualIncomeSpending({ summary, kind, t }: { summary: Q<FinanceSummary>; kind: 'income' | 'spending'; t: T }) {
  if (summary.isPending) return <FinanceLoading />;
  if (summary.isError || !summary.data) return <FinanceError q={summary} t={t} />;
  const rows = summary.data.cashflow.filter((c) => (kind === 'income' ? c.monthlyIncome : c.monthlySpending).minor > 0);
  if (!rows.length) return <p className="type-caption text-muted-foreground" data-testid={`status-actual-${kind}`}>{kind === 'income' ? t('No money received this month yet.', 'لم يصلك مال هذا الشهر بعد.') : t('No spending recorded this month.', 'لا إنفاق مسجل هذا الشهر.')}</p>;
  return (
    <ul className="flex flex-col gap-1" data-testid={`text-actual-${kind}`}>
      {rows.map((c) => <li key={c.currency}><MoneyDisplay value={kind === 'income' ? c.monthlyIncome : c.monthlySpending} size="lg" tone={kind === 'income' ? 'positive' : 'default'} /></li>)}
    </ul>
  );
}

export function RequestsBlock({ summary, t }: { summary: Q<FinanceSummary>; t: T }) {
  if (summary.isPending) return <FinanceLoading />;
  if (summary.isError || !summary.data) return <FinanceError q={summary} t={t} />;
  const r = summary.data.upcomingRequests;
  if (!r.length) return <Unavailable testId="status-upcoming-payments" label={t('No pending requests', 'لا طلبات معلّقة')} body={t('Bills and university payments are not scheduled in this release.', 'الفواتير ومدفوعات الجامعة غير مجدولة في هذا الإصدار.')} />;
  return <>
    <ul className="divide-y divide-divider" data-testid="list-home-requests">
      {r.slice(0, 4).map((x) => <li key={x.id} className="flex items-center justify-between gap-3 py-2"><span className="type-label min-w-0 truncate">{x.note || t('Money request', 'طلب مال')}</span><MoneyDisplay value={x.amount} size="sm" /></li>)}
    </ul>
    <Link href="/money" className={linkCls}>{t('Review requests', 'مراجعة الطلبات')}</Link>
  </>;
}

export function LedgerBlock({ summary, which, t }: { summary: Q<FinanceSummary>; which: 'recent' | 'campus'; t: T }) {
  if (summary.isPending) return <FinanceLoading />;
  if (summary.isError || !summary.data) return <FinanceError q={summary} t={t} />;
  const items = which === 'recent' ? summary.data.recentTransactions : summary.data.campusActivity;
  if (!items.length) return which === 'recent'
    ? <Unavailable testId="status-transactions" label={t('No transactions yet', 'لا حركات بعد')} body={t('Your onboarding details are for planning only and are never shown as transactions.', 'بيانات الإعداد للتخطيط فقط ولا تُعرض كحركات أبداً.')} />
    : <><Unavailable testId="status-campus" label={t('No campus purchases recorded', 'لا مشتريات جامعية مسجلة')} body={t('Cafeteria, bookstore and printing payments appear here.', 'تظهر هنا مدفوعات الكافتيريا والمكتبة والطباعة.')} /><Link href="/campus" className={linkCls} data-testid="link-campus">{t('Open Campus', 'فتح الحرم')}</Link></>;
  return <>
    <LedgerList items={items.slice(0, which === 'recent' ? 6 : 3)} t={t} hrefFor={(tx) => `/transactions/${tx.id}`} testId={`list-home-${which}`} />
    <Link href={which === 'recent' ? '/transactions' : '/campus'} className={linkCls} data-testid={`link-${which}-more`}>{which === 'recent' ? t('All activity', 'كل النشاط') : t('Open Campus', 'فتح الحرم')}</Link>
  </>;
}
