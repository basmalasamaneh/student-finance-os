import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, SearchX, X } from 'lucide-react';
import {
  getGetFinanceHistoryFilterOptionsQueryKey, getGetFinanceHistoryQueryKey, useGetFinanceHistory, useGetFinanceHistoryFilterOptions,
  type GetFinanceHistoryParams,
} from '@workspace/api-client-react';
import { Page, PageHeader } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { RetryButton, SkeletonRows, StatePanel } from '@/components/states/state-panel';
import { LedgerList } from '@/components/money/ledger-list';
import { FilterPanel } from '@/components/transactions/filter-panel';
import { ActiveFilters } from '@/components/transactions/active-filters';
import { useAccount } from '@/features/auth/account';
import { useI18n } from '@/features/i18n/i18n-provider';
import { apiErrorText, useTx } from '@/features/money/money-model';
import { EMPTY_FILTERS, activeFilterCount, buildParams, filtersFromSearch, filtersToSearch, pageCount, type HistoryFilters } from '@/features/transactions/history-filters';
import { categoryLabel } from '@/features/transactions/labels';

const FRESH = { refetchInterval: 15_000, refetchOnWindowFocus: true, refetchOnMount: 'always' as const };

export default function TransactionsPage() {
  const t = useTx();
  const { lang, dir } = useI18n();
  const me = useAccount();
  const isStudent = me.role === 'student';
  const search = useSearch();
  const [, navigate] = useLocation();
  const filters = useMemo(() => filtersFromSearch(search), [search]);
  const built = useMemo(() => buildParams(filters), [filters]);
  const params = built.params as GetFinanceHistoryParams;
  const valid = built.errors.length === 0;

  const historyQ = useGetFinanceHistory(params, { query: { queryKey: getGetFinanceHistoryQueryKey(params), enabled: isStudent && valid, ...FRESH } });
  const optionsQ = useGetFinanceHistoryFilterOptions({ query: { queryKey: getGetFinanceHistoryFilterOptionsQueryKey(), enabled: isStudent, refetchOnWindowFocus: true, refetchOnMount: 'always' } });

  const setFilters = useCallback((next: HistoryFilters) => {
    const qs = filtersToSearch(next);
    navigate(`/transactions${qs ? `?${qs}` : ''}`, { replace: true });
  }, [navigate]);
  const patch = useCallback((p: Partial<HistoryFilters>) => setFilters({ ...filters, ...p, page: 1 }), [filters, setFilters]);

  // Debounced search → URL (page resets to 1). Ref-based timer; URL is the source of truth.
  const [text, setText] = useState(filters.search);
  useEffect(() => { setText(filters.search); }, [filters.search]);
  const timer = useRef<number | undefined>(undefined);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const onType = (v: string) => {
    setText(v);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { if (v.trim() !== filtersRef.current.search) setFilters({ ...filtersRef.current, search: v.trim().slice(0, 120), page: 1 }); }, 350);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const clearAll = () => {
    window.clearTimeout(timer.current);
    setText('');
    setFilters(EMPTY_FILTERS);
  };

  const [panelOpen, setPanelOpen] = useState(false);
  const listTop = useRef<HTMLDivElement>(null);
  const goPage = (p: number) => { setFilters({ ...filters, page: p }); listTop.current?.focus({ preventScroll: true }); listTop.current?.scrollIntoView({ block: 'start' }); };

  if (!isStudent) {
    return <Page><StatePanel tone="permission" title={t('Transaction history is for student accounts', 'سجل المعاملات مخصص لحسابات الطلاب')} body={t('Parent and admin accounts do not hold simulated wallets, so there is no personal history to show.', 'حسابات الأهل والمشرفين لا تحتوي محافظ محاكاة، لذا لا يوجد سجل شخصي لعرضه.')} /></Page>;
  }

  const count = activeFilterCount(filters);
  const anyFilter = count > 0 || !!filters.search;
  const data = historyQ.data;
  const pages = data ? pageCount(data.total, data.limit) : 1;
  const Prev = dir === 'rtl' ? ChevronRight : ChevronLeft;
  const Next = dir === 'rtl' ? ChevronLeft : ChevronRight;
  const optionsState = optionsQ.isPending ? 'loading' : optionsQ.isError ? 'error' : 'ready';

  return (
    <Page>
      <PageHeader eyebrow={t('IMMUTABLE LEDGER', 'سجل غير قابل للتعديل')} title={t('Transactions', 'المعاملات')}
        lede={t('Every simulated entry on your accounts, newest first. Entries are never edited — open one to see everything that was recorded.', 'كل قيد محاكاة على حساباتك، الأحدث أولاً. لا تُعدَّل القيود أبداً — افتح أي قيد لترى كل ما سُجّل.')} />

      <div className="flex flex-col gap-4">
        <div className="flex items-stretch gap-2">
          <div className="relative flex-1">
            <label htmlFor="tx-search" className="sr-only">{t('Search transactions', 'ابحث في المعاملات')}</label>
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input id="tx-search" type="search" value={text} maxLength={120} onChange={(e) => onType(e.target.value)} placeholder={t('Search note, merchant, account, type…', 'ابحث في الملاحظة أو التاجر أو الحساب أو النوع…')}
              className="min-h-11 w-full rounded-xl border border-input bg-surface ps-9 pe-10 text-sm outline-none focus-visible:border-ring" data-testid="input-search" />
            {text ? <button type="button" onClick={() => { setText(''); window.clearTimeout(timer.current); patch({ search: '' }); }} className="absolute end-0 top-0 grid size-11 place-items-center text-muted-foreground hover:text-foreground" aria-label={t('Clear search', 'مسح البحث')} data-testid="button-clear-search"><X className="size-4" aria-hidden /></button> : null}
          </div>
          <Button variant="outline" className="min-h-11 shrink-0 gap-2 rounded-xl" onClick={() => { if (optionsQ.isError) optionsQ.refetch(); setPanelOpen(true); }} aria-haspopup="dialog" data-testid="button-open-filters">
            <SlidersHorizontal aria-hidden /><span className="hidden min-[380px]:inline">{t('Filters', 'المرشحات')}</span>
            {count ? <span className="tabular grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground" aria-label={t(`${count} active`, `${count} مفعّلة`)}>{count}</span> : null}
          </Button>
        </div>

        <ActiveFilters f={filters} options={optionsQ.data} onChange={patch} onClearAll={clearAll} t={t} />

        <div ref={listTop} tabIndex={-1} className="scroll-mt-24 outline-none" aria-live="polite" aria-busy={historyQ.isFetching}>
          {!valid ? (
            <StatePanel tone="error" title={t('These filters are not valid', 'هذه المرشحات غير صالحة')} body={t('The link contains an invalid date, amount or ID. Nothing was loaded. Fix the filters or clear them.', 'الرابط يحتوي تاريخاً أو مبلغاً أو معرّفاً غير صالح. لم يُحمَّل شيء. صحّح المرشحات أو امسحها.')}
              action={<div className="flex gap-2"><Button variant="outline" onClick={() => setPanelOpen(true)}>{t('Edit filters', 'تعديل المرشحات')}</Button><Button onClick={() => setFilters(EMPTY_FILTERS)} data-testid="button-reset-invalid">{t('Clear all', 'مسح الكل')}</Button></div>} />
          ) : historyQ.isPending ? <SkeletonRows rows={6} label={t('Loading history…', 'جارٍ تحميل السجل…')} />
            : historyQ.isError ? (
              <StatePanel tone="error" title={t('History did not load', 'تعذّر تحميل السجل')} body={apiErrorText(historyQ.error, t)}
                action={<RetryButton label={t('Retry', 'إعادة المحاولة')} busyLabel={t('Retrying…', 'جارٍ المحاولة…')} busy={historyQ.isFetching} onClick={() => historyQ.refetch()} />} />
            ) : !data || data.items.length === 0 ? (
              anyFilter
                ? <StatePanel tone="empty" icon={<SearchX className="size-[18px]" aria-hidden />} title={t('No matching transactions', 'لا معاملات مطابقة')} body={filters.page > 1 && data && data.total > 0 ? t('This page is past the end of your results.', 'هذه الصفحة بعد نهاية النتائج.') : t('Nothing in your history matches every filter. Loosen one or clear them all.', 'لا شيء في سجلك يطابق كل المرشحات. خفّف أحدها أو امسحها جميعاً.')}
                  action={<Button variant="outline" onClick={() => { setText(''); setFilters(EMPTY_FILTERS); }} data-testid="button-empty-clear">{t('Clear all filters', 'مسح كل المرشحات')}</Button>} />
                : <StatePanel tone="empty" title={t('No transactions yet', 'لا معاملات بعد')} body={t('Add simulated money or pay on campus from Money, and entries will appear here.', 'أضف مالاً محاكى أو ادفع في الحرم من صفحة المال، وستظهر القيود هنا.')} />
            ) : (
              <div className="flex flex-col gap-3">
                <p className="type-caption text-muted-foreground" data-testid="text-total">
                  {t(`${data.total} ${data.total === 1 ? 'transaction' : 'transactions'}`, `${data.total} معاملة`)}{anyFilter ? t(' match', ' مطابقة') : ''} · {t(`Page ${data.page} of ${pages}`, `صفحة ${data.page} من ${pages}`)}
                </p>
                <LedgerList items={data.items} t={t} hrefFor={(tx) => `/transactions/${tx.id}${search ? `?from=${encodeURIComponent(search)}` : ''}`} categoryText={(tx) => categoryLabel(tx.category, optionsQ.data?.categories, t, lang)} testId="list-history" />
                <nav aria-label={t('Pagination', 'التنقل بين الصفحات')} className="flex items-center justify-between gap-3 border-t border-divider pt-4">
                  <Button variant="outline" className="min-h-11" disabled={data.page <= 1} onClick={() => goPage(data.page - 1)} data-testid="button-prev-page"><Prev aria-hidden />{t('Newer', 'الأحدث')}</Button>
                  <span className="type-caption tabular text-muted-foreground">{data.page} / {pages}</span>
                  <Button variant="outline" className="min-h-11" disabled={!data.hasMore} onClick={() => goPage(data.page + 1)} data-testid="button-next-page">{t('Older', 'الأقدم')}<Next aria-hidden /></Button>
                </nav>
              </div>
            )}
        </div>
      </div>

      <FilterPanel open={panelOpen} onOpenChange={setPanelOpen} value={filters} onApply={setFilters} options={optionsQ.data} optionsState={optionsState} t={t} />
    </Page>
  );
}
