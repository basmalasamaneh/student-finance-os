import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { CreditCard, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Banknote, HandCoins, Inbox, Landmark, Plus, ShoppingBag, Wallet } from 'lucide-react';
import {
  getGetFinanceSummaryQueryKey, getListFinanceAccountsQueryKey, getListFinanceTransactionsQueryKey, useGetFinanceSummary, getListMoneyRequestsQueryKey,
  useListFinanceAccounts, useListFinanceTransactions, useListMoneyRequests,
  type FinanceMovementInputKind, type FinanceTransaction,
} from '@workspace/api-client-react';
import { Page, PageHeader, SectionHeading } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RetryButton, SkeletonRows, StatePanel } from '@/components/states/state-panel';
import { MoneyDisplay } from '@/components/finance/money-display';
import { AccountList } from '@/components/money/account-list';
import { CreateAccountDialog } from '@/components/money/create-account-dialog';
import { MovementDialog } from '@/components/money/movement-dialog';
import { RequestDialog } from '@/components/money/request-dialog';
import { RequestsList } from '@/components/money/requests-list';
import { LedgerList } from '@/components/money/ledger-list';
import { Receipt } from '@/components/money/receipt';
import { useAccount } from '@/features/auth/account';
import { totalsByCurrency, useTx } from '@/features/money/money-model';

const ACTIONS: { kind: FinanceMovementInputKind | 'request' | 'campus'; icon: typeof Wallet; en: string; ar: string; debit?: boolean }[] = [
  { kind: 'add', icon: Plus, en: 'Add money', ar: 'إضافة مال' },
  { kind: 'send', icon: ArrowUpRight, en: 'Send', ar: 'إرسال', debit: true },
  { kind: 'request', icon: HandCoins, en: 'Request', ar: 'طلب' },
  { kind: 'receive', icon: ArrowDownLeft, en: 'Receive', ar: 'استلام' },
  { kind: 'transfer', icon: ArrowLeftRight, en: 'Transfer', ar: 'تحويل', debit: true },
  { kind: 'payment', icon: CreditCard, en: 'Pay', ar: 'دفع', debit: true },
  { kind: 'campus', icon: ShoppingBag, en: 'Campus', ar: 'الحرم', debit: true },
  { kind: 'deposit', icon: Landmark, en: 'Deposit', ar: 'إيداع' },
  { kind: 'withdrawal', icon: Banknote, en: 'Withdraw', ar: 'سحب', debit: true },
];

export default function MoneyPage() {
  const t = useTx();
  const me = useAccount();
  const accountsQ = useListFinanceAccounts({ query: { queryKey: getListFinanceAccountsQueryKey(), enabled: me.role === 'student', refetchInterval: 15_000, refetchOnWindowFocus: true } });
  const txQ = useListFinanceTransactions({ query: { queryKey: getListFinanceTransactionsQueryKey(), enabled: me.role === 'student', refetchInterval: 15_000, refetchOnWindowFocus: true } });
  const reqQ = useListMoneyRequests({ query: { queryKey: getListMoneyRequestsQueryKey(), enabled: me.role === 'student', refetchInterval: 15_000, refetchOnWindowFocus: true } });
  const summaryQ = useGetFinanceSummary({ query: { queryKey: getGetFinanceSummaryQueryKey(), enabled: me.role === 'student', refetchInterval: 15_000, refetchOnWindowFocus: true } });
  const [selected, setSelected] = useState<string>();
  const [movement, setMovement] = useState<FinanceMovementInputKind | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [receipt, setReceipt] = useState<FinanceTransaction | null>(null);
  const [reqFilter, setReqFilter] = useState<'pending' | 'all'>('pending');

  const accounts = useMemo(() => accountsQ.data ?? [], [accountsQ.data]);
  const totals = useMemo(() => totalsByCurrency(accounts), [accounts]);
  const txs = useMemo(() => (txQ.data ?? []).filter((x) => !selected || x.accountId === selected), [txQ.data, selected]);
  const requests = useMemo(() => (reqQ.data ?? []).filter((r) => reqFilter === 'all' || r.status === 'pending'), [reqQ.data, reqFilter]);

  if (me.role !== 'student') {
    return <Page><StatePanel tone="permission" title={t('Money is for student accounts', 'المال مخصص لحسابات الطلاب')} body={t('Parent and admin accounts do not hold simulated wallets.', 'حسابات الأهل والمشرفين لا تحتوي محافظ محاكاة.')} /></Page>;
  }

  return (
    <Page>
      <PageHeader eyebrow={t('SIMULATED LEDGER', 'سجل محاكاة')} title={t('Money', 'المال')}
        lede={t('Every balance here is the sum of recorded entries. No real money moves, and balances are never edited directly.', 'كل رصيد هنا هو مجموع قيود مسجلة. لا تتحرك أموال حقيقية، ولا تُعدَّل الأرصدة مباشرة.')}
        actions={<Button onClick={() => setCreateOpen(true)} data-testid="button-new-account"><Plus aria-hidden />{t('New account', 'حساب جديد')}</Button>} />

      {accountsQ.isPending ? <SkeletonRows rows={3} label={t('Loading accounts…', 'جارٍ تحميل الحسابات…')} />
        : accountsQ.isError ? <StatePanel tone="error" title={t('Accounts did not load', 'تعذّر تحميل الحسابات')} body={t('No balance is shown until real data arrives.', 'لا يُعرض رصيد حتى تصل البيانات الحقيقية.')}
          action={<RetryButton label={t('Retry', 'إعادة المحاولة')} busyLabel={t('Retrying…', 'جارٍ المحاولة…')} busy={accountsQ.isRefetching} onClick={() => accountsQ.refetch()} />} />
          : !accounts.length ? (
            <StatePanel tone="empty" icon={<Wallet className="size-[18px]" aria-hidden />} title={t('No accounts yet', 'لا حسابات بعد')}
              body={t('Create a Student Wallet to start. It opens at zero; add simulated money to try payments and transfers.', 'أنشئ محفظة طلابية للبدء. تبدأ من صفر؛ أضف مالاً محاكى لتجربة الدفع والتحويل.')}
              action={<Button onClick={() => setCreateOpen(true)} data-testid="button-empty-create">{t('Create Student Wallet', 'إنشاء محفظة طلابية')}</Button>} />
          ) : (
            <div className="flex flex-col gap-10">
              <section aria-labelledby="totals-title" className="flex flex-col gap-3">
                <h2 id="totals-title" className="type-caption text-muted-foreground">{t('Total by currency', 'الإجمالي حسب العملة')}</h2>
                <div className="flex flex-wrap items-end gap-x-10 gap-y-3" data-testid="text-totals">
                  {totals.map((m) => m.value ? <MoneyDisplay key={m.currency} value={m.value} size="hero" /> : <p key={m.currency} role="alert" className="type-label text-destructive">{t(`${m.currency} total is too large to display exactly.`, `إجمالي ${m.currency} أكبر من أن يُعرض بدقة.`)}</p>)}
                </div>
                {summaryQ.data?.cashflow.some((c) => (c.reservedBalance?.minor ?? 0) > 0) ? (
                  <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="list-balance-breakdown">
                    {summaryQ.data.cashflow.filter((c) => c.reservedBalance && c.netBalance).map((c) => (
                      <div key={c.currency} className="type-caption flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg bg-surface-sunken px-3 py-2">
                        <span><dt className="inline text-muted-foreground">{t('Available', 'المتاح')} </dt><dd className="inline"><MoneyDisplay value={c.balance} size="sm" className="inline !text-xs" /></dd></span>
                        <span><dt className="inline text-muted-foreground">+ {t('Reserved in goals', 'محجوز في الأهداف')} </dt><dd className="inline"><MoneyDisplay value={c.reservedBalance!} size="sm" tone="highlight" className="inline !text-xs" testId={`text-money-reserved-${c.currency}`} /></dd></span>
                        <span><dt className="inline text-muted-foreground">= {t('Net', 'الصافي')} </dt><dd className="inline"><MoneyDisplay value={c.netBalance!} size="sm" className="inline !text-xs" testId={`text-money-net-${c.currency}`} /></dd></span>
                      </div>
                    ))}
                  </dl>
                ) : null}
                <p className="type-caption text-muted-foreground">{t('Totals above are spendable. Money in savings goals is reserved and can’t be spent or sent. Currencies are never mixed or converted.', 'الإجماليات أعلاه قابلة للإنفاق. مال أهداف الادخار محجوز ولا يمكن إنفاقه أو إرساله. لا تُخلط العملات ولا تُحوَّل.')} <Link href="/goals" className="text-gold-ink underline-offset-4 hover:underline" data-testid="link-money-goals">{t('Goals', 'الأهداف')}</Link></p>
              </section>

              <nav aria-label={t('Money actions', 'إجراءات المال')} className="grid grid-cols-3 gap-2 min-[400px]:grid-cols-5 lg:grid-cols-9" data-testid="grid-actions">
                {ACTIONS.map(({ kind, icon: Icon, en, ar }) => {
                  const cls = 'flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-lg px-1 text-center transition-colors hover:bg-muted active:bg-surface-sunken';
                  const inner = <><span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground"><Icon className="size-[18px]" aria-hidden /></span><span className="type-nav leading-tight">{t(en, ar)}</span></>;
                  return kind === 'campus'
                    ? <Link key={kind} href="/campus" className={cls} data-testid="link-action-campus">{inner}</Link>
                    : <button key={kind} type="button" className={cls} onClick={() => kind === 'request' ? setRequestOpen(true) : setMovement(kind)} data-testid={`button-action-${kind}`}>{inner}</button>;
                })}
              </nav>

              <section className="flex flex-col gap-2">
                <SectionHeading id="accounts" title={t('Accounts', 'الحسابات')} meta={t(`${accounts.length} total`, `${accounts.length} حساب`)} />
                <AccountList accounts={accounts} selectedId={selected} onSelect={(id) => setSelected((s) => (s === id ? undefined : id))} t={t} />
                <p className="type-caption text-muted-foreground">{t('Tap an account to filter activity. Share its ID so others can send or request.', 'اضغط على حساب لتصفية النشاط. شارك معرّفه ليرسل لك الآخرون أو يطلبوا.')}</p>
              </section>

              <section className="flex flex-col gap-2">
                <SectionHeading id="requests" title={t('Money requests', 'طلبات المال')} trailing={
                  <div role="group" aria-label={t('Filter requests', 'تصفية الطلبات')} className="flex gap-1 rounded-lg bg-muted p-0.5">
                    {(['pending', 'all'] as const).map((f) => (
                      <button key={f} type="button" aria-pressed={reqFilter === f} onClick={() => setReqFilter(f)}
                        className={`type-caption min-h-8 rounded-lg px-2.5 ${reqFilter === f ? 'bg-surface font-medium shadow-xs' : 'text-muted-foreground'}`} data-testid={`button-filter-${f}`}>
                        {f === 'pending' ? t('Pending', 'معلّقة') : t('All', 'الكل')}
                      </button>
                    ))}
                  </div>} />
                {reqQ.isPending ? <SkeletonRows rows={2} label={t('Loading requests…', 'جارٍ تحميل الطلبات…')} />
                  : reqQ.isError ? <StatePanel tone="error" title={t('Requests did not load', 'تعذّر تحميل الطلبات')} body={t('Try again in a moment.', 'حاول بعد قليل.')} action={<RetryButton label={t('Retry', 'إعادة المحاولة')} busyLabel="…" busy={reqQ.isRefetching} onClick={() => reqQ.refetch()} />} />
                    : requests.length ? <RequestsList requests={requests} accounts={accounts} userId={me.id} t={t} />
                      : <StatePanel tone="empty" icon={<Inbox className="size-[18px]" aria-hidden />} className="py-5" title={reqFilter === 'pending' ? t('Nothing pending', 'لا شيء معلّق') : t('No requests yet', 'لا طلبات بعد')} body={t('Requests you send or receive appear here.', 'تظهر هنا الطلبات التي ترسلها أو تستلمها.')} />}
              </section>

              <section className="flex flex-col gap-2">
                <SectionHeading id="activity" title={t('Activity', 'النشاط')} meta={selected ? t('Filtered by account', 'مُصفّى حسب الحساب') : undefined} trailing={<Link href={selected ? `/transactions?accountId=${selected}` : '/transactions'} className="type-label inline-flex min-h-11 items-center text-gold-ink underline-offset-4 hover:underline" data-testid="link-full-history">{t('Full history', 'السجل الكامل')}</Link>} />
                {txQ.isPending ? <SkeletonRows rows={4} label={t('Loading activity…', 'جارٍ تحميل النشاط…')} />
                  : txQ.isError ? <StatePanel tone="error" title={t('Activity did not load', 'تعذّر تحميل النشاط')} body={t('Try again in a moment.', 'حاول بعد قليل.')} action={<RetryButton label={t('Retry', 'إعادة المحاولة')} busyLabel="…" busy={txQ.isRefetching} onClick={() => txQ.refetch()} />} />
                    : txs.length ? <LedgerList items={txs.slice(0, 30)} accounts={accounts} t={t} onOpen={setReceipt} />
                      : <StatePanel tone="empty" className="py-5" title={t('No activity yet', 'لا نشاط بعد')} body={t('Add money or make a campus payment to see entries here.', 'أضف مالاً أو ادفع في الحرم لتظهر القيود هنا.')} />}
              </section>
            </div>
          )}

      <CreateAccountDialog open={createOpen} onOpenChange={setCreateOpen} t={t} />
      <MovementDialog kind={movement ?? 'add'} open={!!movement} onOpenChange={(o) => { if (!o) setMovement(null); }} accounts={accounts} defaultAccountId={selected} t={t} />
      <RequestDialog open={requestOpen} onOpenChange={setRequestOpen} accounts={accounts} t={t} />
      <Dialog open={!!receipt} onOpenChange={(o) => { if (!o) setReceipt(null); }}>
        <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto" data-testid="dialog-receipt">
          <DialogHeader><DialogTitle>{t('Receipt', 'الإيصال')}</DialogTitle><DialogDescription>{t('Recorded entries are immutable.', 'القيود المسجلة غير قابلة للتعديل.')}</DialogDescription></DialogHeader>
          {receipt ? <Receipt tx={receipt} account={accounts.find((a) => a.id === receipt.accountId)} t={t} /> : null}
          <DialogFooter className="gap-2">{receipt ? <Button asChild variant="outline"><Link href={`/transactions/${receipt.id}`} data-testid="link-receipt-details">{t('Full details', 'التفاصيل الكاملة')}</Link></Button> : null}<Button onClick={() => setReceipt(null)}>{t('Close', 'إغلاق')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
