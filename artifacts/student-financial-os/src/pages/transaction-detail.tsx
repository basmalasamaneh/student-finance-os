import type { ReactNode } from 'react';
import { Link, useParams, useSearch } from 'wouter';
import { ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, Lock, ShoppingBag } from 'lucide-react';
import {
  ApiError, getGetFinanceHistoryFilterOptionsQueryKey, getGetFinanceTransactionQueryKey, useGetFinanceHistoryFilterOptions, useGetFinanceTransaction,
  type FinanceTransaction,
} from '@workspace/api-client-react';
import { Page } from '@/components/layout/page';
import { RetryButton, StatePanel } from '@/components/states/state-panel';
import { MoneyDisplay } from '@/components/finance/money-display';
import { statusText } from '@/components/money/receipt';
import { useAccount } from '@/features/auth/account';
import { useI18n } from '@/features/i18n/i18n-provider';
import { apiErrorText, KIND_LABEL, label, useTx, type Tx } from '@/features/money/money-model';
import { isUuid } from '@/features/transactions/history-filters';
import { categoryLabel, typeLabel, transactionDescription } from '@/features/transactions/labels';
import { SensitiveReference } from '@/features/security/sensitive-reference';

function Row({ term, children, testId }: { term: string; children: ReactNode; testId: string }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:gap-6">
      <dt className="type-caption text-muted-foreground">{term}</dt>
      <dd className="type-label min-w-0 break-words font-normal" data-testid={testId}>{children}</dd>
    </div>
  );
}
const Missing = ({ text }: { text: string }) => <span className="text-muted-foreground italic">{text}</span>;
const Mono = ({ v }: { v: string }) => <SensitiveReference value={v} copy />;

function Linked({ id, name, t, future }: { id: string | null; name?: string | null; t: Tx; future?: boolean }) {
  if (!id) return <Missing text={future ? t('Not linked (feature not available yet)', 'غير مرتبط (الميزة غير متاحة بعد)') : t('Not linked', 'غير مرتبط')} />;
  return <span className="flex flex-col gap-0.5">{name ? <span>{name}</span> : null}<Mono v={id} /></span>;
}

function Detail({ tx, t }: { tx: FinanceTransaction; t: Tx }) {
  const { lang, locale } = useI18n();
  const optionsQ = useGetFinanceHistoryFilterOptions({ query: { queryKey: getGetFinanceHistoryFilterOptionsQueryKey() } });
  const credit = tx.direction === 'credit';
  const Icon = tx.serviceId || tx.type === 'campus_payment' ? ShoppingBag : credit ? ArrowDownLeft : ArrowUpRight;
  const when = new Date(tx.createdAt);
  const na = t('Not available', 'غير متاح');
  return (
    <article className="flex flex-col gap-8" aria-labelledby="tx-title">
      <header className="motion-rise flex flex-col items-start gap-3">
        <span className={`grid size-12 place-items-center rounded-full ${credit ? 'bg-success-soft text-success' : 'bg-primary-soft text-gold-ink'}`}><Icon className="size-5" aria-hidden /></span>
        <p className="eyebrow">{typeLabel(tx.type, t)} · {credit ? t('Money in', 'أموال واردة') : t('Money out', 'أموال صادرة')}</p>
        <h1 id="tx-title" className="type-display" data-testid="text-tx-description">{transactionDescription(tx, t)}</h1>
        <MoneyDisplay value={credit ? tx.amount : { ...tx.amount, minor: -tx.amount.minor }} size="hero" tone={credit ? 'positive' : 'default'} showPlus={credit} testId="text-tx-amount" />
        <div className="flex flex-wrap items-center gap-2">
          <span className="type-caption rounded-full border border-primary/40 bg-primary-soft px-2.5 py-0.5 font-medium text-gold-ink" data-testid="status-tx">{statusText(tx.status, t)}</span>
          <span className="type-caption inline-flex items-center gap-1 text-muted-foreground"><Lock className="size-3" aria-hidden />{t('Recorded entries are immutable', 'القيود المسجلة غير قابلة للتعديل')}</span>
        </div>
      </header>

      {tx.items?.length ? (
        <section aria-labelledby="items-title" className="flex flex-col gap-2">
          <h2 id="items-title" className="type-title">{t('Purchased items', 'المشتريات')}</h2>
          <p className="type-caption text-muted-foreground">{t('Prices as charged at the time — later catalog changes never alter this receipt.', 'الأسعار كما دُفعت وقتها — تغييرات الكتالوج لاحقاً لا تغيّر هذا الإيصال.')}</p>
          <ul className="divide-y divide-divider border-y border-divider" data-testid="list-tx-items">
            {tx.items.map((it) => (
              <li key={it.productId} className="flex items-baseline justify-between gap-3 py-2.5">
                <span className="flex min-w-0 flex-col"><span className="type-label break-words">{it.name}</span><span className="type-caption tabular text-muted-foreground"><bdi>{it.quantity}</bdi> × <MoneyDisplay value={it.unitPrice} size="sm" className="inline" /></span></span>
                <MoneyDisplay value={it.lineTotal} size="sm" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="fields-title">
        <h2 id="fields-title" className="type-title pb-1">{t('Recorded details', 'التفاصيل المسجلة')}</h2>
        <dl className="divide-y divide-divider border-y border-divider">
          <Row term={t('Transaction ID', 'معرّف المعاملة')} testId="field-id"><Mono v={tx.id} /></Row>
          <Row term={t('User', 'المستخدم')} testId="field-user"><Mono v={tx.userId} /></Row>
          <Row term={t('Amount', 'المبلغ')} testId="field-amount"><MoneyDisplay value={tx.amount} size="sm" /></Row>
          <Row term={t('Type', 'النوع')} testId="field-type">{typeLabel(tx.type, t)} <span className="text-muted-foreground">· {label(KIND_LABEL, tx.kind, t)}</span></Row>
          <Row term={t('Category', 'الفئة')} testId="field-category">{categoryLabel(tx.category, optionsQ.data?.categories, t, lang)}</Row>
          <Row term={t('Date & time', 'التاريخ والوقت')} testId="field-date"><bdi>{when.toLocaleString(locale, { dateStyle: 'full', timeStyle: 'medium' })}</bdi><span className="block type-caption text-muted-foreground"><bdi>{tx.createdAt}</bdi> (UTC)</span></Row>
          <Row term={t('Description', 'الوصف')} testId="field-description">{transactionDescription(tx, t)}</Row>
          <Row term={t('Source', 'المصدر')} testId="field-source">{tx.source ?? <Missing text={na} />}</Row>
          <Row term={t('Destination', 'الوجهة')} testId="field-destination">{tx.destination ?? <Missing text={na} />}</Row>
          <Row term={t('Account', 'الحساب')} testId="field-account"><Linked id={tx.accountId} name={tx.accountName} t={t} /></Row>
          <Row term={t('Balance after', 'الرصيد بعد')} testId="field-balance-after"><MoneyDisplay value={tx.balanceAfter} size="sm" /></Row>
          <Row term={t('Status', 'الحالة')} testId="field-status">{statusText(tx.status, t)}</Row>
          <Row term={t('Note', 'ملاحظة')} testId="field-note">{tx.note || <Missing text={t('No note', 'لا ملاحظة')} />}</Row>
          <Row term={t('Merchant', 'التاجر')} testId="field-merchant">{tx.merchantName ?? <Missing text={na} />}</Row>
          <Row term={t('Campus service', 'الخدمة الجامعية')} testId="field-campus-service"><Linked id={tx.campusServiceId} t={t} /></Row>
          <Row term={t('University', 'الجامعة')} testId="field-university"><Linked id={tx.universityId} name={tx.universityName} t={t} /></Row>
          <Row term={t('Campus', 'الحرم')} testId="field-campus"><Linked id={tx.campusId} name={tx.campusName} t={t} /></Row>
          <Row term={t('Related goal', 'الهدف المرتبط')} testId="field-goal">{tx.relatedGoalId ? <Link href={`/goals/${tx.relatedGoalId}`} className="text-gold-ink underline-offset-4 hover:underline" data-testid="link-related-goal">{optionsQ.data?.goalOptions?.find((g) => g.id === tx.relatedGoalId)?.name ?? t('Open goal', 'افتح الهدف')}</Link> : <Missing text={t('Not linked', 'غير مرتبط')} />}</Row>
          {tx.goalFundingSource ? <Row term={t('Goal funding source', 'مصدر تمويل الهدف')} testId="field-goal-source">{tx.goalFundingSource === 'parent_simulated' ? t('Parent · simulated external funding (no bank, no real money)', 'الأهل · تمويل خارجي محاكى (لا بنك ولا أموال حقيقية)') : t('Your own account', 'حسابك الخاص')}</Row> : null}
          <Row term={t('Related budget', 'الميزانية المرتبطة')} testId="field-budget"><Linked id={tx.relatedBudgetId} t={t} /></Row>
          <Row term={t('Parent transfer', 'تحويل الأهل')} testId="field-parent-transfer"><Linked id={tx.parentTransferId} t={t} future /></Row>
          <Row term={t('Recurring expense', 'المصروف المتكرر')} testId="field-recurring"><Linked id={tx.recurringExpenseId} t={t} /></Row>
          {tx.counterpartyAccountId ? <Row term={t('Counterparty account', 'حساب الطرف الآخر')} testId="field-counterparty"><Mono v={tx.counterpartyAccountId} /></Row> : null}
        </dl>
        <p className="type-caption pt-3 text-muted-foreground">{t('Source and destination are simulated labels, not verified bank identities. No real money moved.', 'المصدر والوجهة تسميات محاكاة وليست هويات بنكية موثقة. لم تتحرك أموال حقيقية.')}</p>
      </section>
    </article>
  );
}

export default function TransactionDetailPage() {
  const t = useTx();
  const { dir } = useI18n();
  const me = useAccount();
  const params = useParams();
  const id = params.id ?? '';
  const search = useSearch();
  const from = new URLSearchParams(search).get('from');
  const backHref = `/transactions${from ? `?${from.replace(/^\?/, '')}` : ''}`;
  const isStudent = me.role === 'student';
  const validId = isUuid(id);
  const q = useGetFinanceTransaction(id, { query: { queryKey: getGetFinanceTransactionQueryKey(id), enabled: isStudent && validId, retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 1, refetchOnWindowFocus: true, refetchOnMount: 'always' } });
  const Back = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const back = <Link href={backHref} className="type-label inline-flex min-h-11 items-center gap-2 text-gold-ink underline-offset-4 hover:underline" data-testid="link-back-history"><Back className="size-4" aria-hidden />{t('Back to history', 'العودة إلى السجل')}</Link>;

  if (!isStudent) return <Page>{back}<StatePanel tone="permission" title={t('Transaction details are for student accounts', 'تفاصيل المعاملات مخصصة لحسابات الطلاب')} body={t('Parent and admin accounts cannot open student ledger entries.', 'لا يمكن لحسابات الأهل والمشرفين فتح قيود الطلاب.')} /></Page>;

  const notFound = !validId || (q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 400));
  return (
    <Page className="max-w-3xl">
      <div className="pb-4">{back}</div>
      {notFound ? <StatePanel tone="empty" title={t('Transaction not found', 'المعاملة غير موجودة')} body={t('It does not exist or is not on your accounts.', 'غير موجودة أو ليست على حساباتك.')} />
        : q.isPending ? (
          <div role="status" aria-label={t('Loading transaction…', 'جارٍ تحميل المعاملة…')} className="flex flex-col gap-4" data-testid="state-loading">
            <span className="skeleton-shimmer size-12 rounded-full" /><span className="skeleton-shimmer h-7 w-2/3 rounded" /><span className="skeleton-shimmer h-10 w-1/3 rounded" />
            {Array.from({ length: 8 }).map((_, i) => <span key={i} className="skeleton-shimmer h-4 w-full rounded" />)}
          </div>
        ) : q.isError ? <StatePanel tone="error" title={t('Transaction did not load', 'تعذّر تحميل المعاملة')} body={apiErrorText(q.error, t)} action={<RetryButton label={t('Retry', 'إعادة المحاولة')} busyLabel={t('Retrying…', 'جارٍ المحاولة…')} busy={q.isFetching} onClick={() => q.refetch()} />} />
          : q.data ? <Detail tx={q.data} t={t} /> : null}
    </Page>
  );
}
