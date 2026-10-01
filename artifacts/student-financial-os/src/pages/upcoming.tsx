import { useMemo, useState } from 'react';
import { CalendarDays, Check, List, Plus, SlidersHorizontal } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDeleteScheduledItem, type PlanningOccurrence, type ScheduledItem, type ScheduledKind } from '@workspace/api-client-react';
import { Page, PageHeader, SectionHeading } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { Notice, RetryButton, SkeletonRows, StatePanel } from '@/components/states/state-panel';
import { PullToRefresh } from '@/components/gestures/pull-to-refresh';
import { ConfirmDelete, EmptyRow } from '@/components/planning/plan-shared';
import { ScheduledDialog } from '@/components/upcoming/scheduled-dialog';
import { OccurrenceSheet } from '@/components/upcoming/occurrence-sheet';
import { AgendaList, AllocationsList, Assumptions, ForecastCard, MonthCalendar, SeriesList } from '@/components/upcoming/upcoming-views';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useTx } from '@/features/money/money-model';
import { formatUtcDate } from '@/features/planning/planning-model';
import {
  addDaysIso, ADDITIONAL_NOTICE, KIND, monthBounds, NO_LEDGER, upcomingErrorText, useCalendar, useForecast, useRefreshUpcoming, useScheduledItems, utcToday,
} from '@/features/upcoming/upcoming-model';
import { cn } from '@/lib/utils';

const HORIZONS = [30, 60, 90] as const;
const KIND_FILTERS = ['all', 'income', 'expense', 'savings'] as const;
const chip = (on: boolean) => cn('inline-flex min-h-11 items-center gap-2 rounded-full border px-4 type-label transition-colors', on ? 'border-primary bg-primary-soft text-gold-ink' : 'border-border bg-surface text-foreground hover:border-foreground/30');

function ForecastSkeleton() {
  return <div className="grid gap-4 md:grid-cols-2" aria-busy data-testid="state-loading-forecast"><div className="skeleton-shimmer h-72 rounded-card" /><div className="skeleton-shimmer hidden h-72 rounded-card md:block" /></div>;
}

export default function UpcomingPage() {
  const t = useTx();
  const { locale } = useI18n();
  const today = utcToday();
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>(30);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [kindFilter, setKindFilter] = useState<ScheduledKind | 'all'>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const kindLabel = (k: ScheduledKind | 'all') => (k === 'all' ? t('All', 'الكل') : t(...KIND[k]));
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getUTCFullYear(), m: now.getUTCMonth() });
  const bounds = monthBounds(ym.y, ym.m);

  const forecast = useForecast(addDaysIso(today, horizon));
  const calendar = useCalendar(bounds.from, bounds.to);
  const items = useScheduledItems();
  const refresh = useRefreshUpcoming();
  const del = useDeleteScheduledItem();

  const [dialog, setDialog] = useState<{ open: boolean; item?: ScheduledItem }>({ open: false });
  const [occ, setOcc] = useState<PlanningOccurrence | null>(null);
  const [toDelete, setToDelete] = useState<ScheduledItem | null>(null);

  const itemById = useMemo(() => new Map((items.data ?? []).map((i) => [i.id, i])), [items.data]);
  const filt = (list: PlanningOccurrence[]) => (kindFilter === 'all' ? list : list.filter((o) => o.kind === kindFilter));
  const f = forecast.data;
  const listOcc = useMemo(() => filt(f?.occurrences ?? []), [f, kindFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  const calOcc = useMemo(() => filt(calendar.data?.occurrences ?? []), [calendar.data, kindFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const openAdd = () => setDialog({ open: true });
  const shiftMonth = (d: number) => setYm(({ y, m }) => { const n = m + d; return { y: y + Math.floor(n / 12), m: ((n % 12) + 12) % 12 }; });

  return (
    <Page>
      <PullToRefresh onRefresh={() => Promise.all([forecast.refetch(), calendar.refetch(), items.refetch()])} label={t('Refreshing…', 'جارٍ التحديث…')}>
        <PageHeader eyebrow={t('UPCOMING', 'القادم')} title={t('What is coming up', 'ما هو قادم')}
          lede={t('Dated income, bills and savings from your plan, with an estimated balance per currency. Planning only — nothing here moves money.', 'الدخل والفواتير والادخار المؤرخ من خطتك، مع رصيد تقديري لكل عملة. تخطيط فقط — لا شيء هنا ينقل المال.')}
          actions={<Button className="btn-gradient min-h-11" onClick={openAdd} data-testid="button-add-scheduled"><Plus aria-hidden />{t('Add scheduled item', 'أضف بنداً مجدولاً')}</Button>} />

        {/* Forecast */}
        <section className="flex flex-col gap-4 pb-8" aria-labelledby="fc-h">
          <SectionHeading id="fc-h" title={t('Estimated balance', 'الرصيد التقديري')}
            trailing={<div className="flex gap-2" role="radiogroup" aria-label={t('Forecast horizon', 'مدى التوقع')}>
              {HORIZONS.map((h) => <button key={h} type="button" role="radio" aria-checked={horizon === h} className={chip(horizon === h)} onClick={() => setHorizon(h)} data-testid={`chip-horizon-${h}`}>{t(`${h} days`, `${h} يوماً`)}</button>)}
            </div>} />
          {forecast.isLoading ? <ForecastSkeleton /> : forecast.isError || !f ? (
            <StatePanel tone="error" title={t('Forecast could not load', 'تعذّر تحميل التوقع')} body={upcomingErrorText(forecast.error, t)}
              action={<RetryButton label={t('Retry', 'أعد المحاولة')} busyLabel={t('Retrying…', 'جارٍ المحاولة…')} busy={forecast.isFetching} onClick={() => void forecast.refetch()} />} />
          ) : <>
            {f.currencies.length
              ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{f.currencies.map((c) => <ForecastCard key={c.currency} row={c} t={t} />)}</div>
              : <StatePanel tone="empty" title={t('No forecast yet', 'لا توقع بعد')} body={t('Add an account, income or a scheduled item and an estimate will appear here.', 'أضف حساباً أو دخلاً أو بنداً مجدولاً وسيظهر التقدير هنا.')} />}
            <p className="type-caption text-muted-foreground" data-testid="text-fc-range">{t('Estimated / Projected', 'تقديري / متوقع')} · {formatUtcDate(f.asOf, locale)} → {formatUtcDate(f.through, locale)}{forecast.isFetching ? ` · ${t('refreshing…', 'جارٍ التحديث…')}` : ''}</p>
            <Assumptions forecast={f} t={t} />
          </>}
        </section>

        {/* Dated items */}
        <section className="flex flex-col gap-4 border-t border-divider py-8" aria-labelledby="dated-h">
          <SectionHeading id="dated-h" title={t('Dated items', 'البنود المؤرخة')}
            trailing={<div className="flex gap-2" role="tablist" aria-label={t('View', 'العرض')}>
              <button type="button" role="tab" aria-selected={view === 'list'} className={chip(view === 'list')} onClick={() => setView('list')} data-testid="tab-list"><List className="size-4" aria-hidden />{t('List', 'قائمة')}</button>
              <button type="button" role="tab" aria-selected={view === 'calendar'} className={chip(view === 'calendar')} onClick={() => setView('calendar')} data-testid="tab-calendar"><CalendarDays className="size-4" aria-hidden />{t('Calendar', 'تقويم')}</button>
            </div>} />
          {/* Desktop: inline chips. Mobile: Filter button opens a bottom sheet. */}
          <div className="hidden gap-2 md:flex" role="radiogroup" aria-label={t('Filter by type', 'تصفية حسب النوع')}>
            {KIND_FILTERS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kindFilter === k} className={cn(chip(kindFilter === k), 'shrink-0')} onClick={() => setKindFilter(k)} data-testid={`chip-kind-${k}`}>
                {kindLabel(k)}
              </button>
            ))}
          </div>
          <Button variant="outline" className="min-h-11 self-start md:hidden" onClick={() => setFilterOpen(true)} aria-haspopup="dialog" data-testid="button-open-filter">
            <SlidersHorizontal aria-hidden />{t('Filter', 'تصفية')}: {kindLabel(kindFilter)}
          </Button>
          <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
            <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md" data-testid="dialog-filter">
              <DialogHeader>
                <DialogTitle>{t('Filter by type', 'تصفية حسب النوع')}</DialogTitle>
                <DialogDescription>{t('Showing', 'المعروض')}: {kindLabel(kindFilter)}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2" role="radiogroup" aria-label={t('Filter by type', 'تصفية حسب النوع')}>
                {KIND_FILTERS.map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={kindFilter === k} onClick={() => { setKindFilter(k); setFilterOpen(false); }} data-testid={`sheet-kind-${k}`}
                    className={cn('flex min-h-12 items-center justify-between rounded-[14px] border px-4 type-label transition-colors', kindFilter === k ? 'border-primary bg-primary-soft text-gold-ink' : 'border-input bg-surface hover:border-foreground/30')}>
                    {kindLabel(k)}{kindFilter === k ? <Check className="size-4" aria-hidden /> : null}
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          {view === 'list' ? (
            forecast.isLoading ? <SkeletonRows rows={4} label={t('Loading', 'جارٍ التحميل')} />
              : forecast.isError ? <Notice tone="error" title={t('Could not load dated items', 'تعذّر تحميل البنود المؤرخة')} body={upcomingErrorText(forecast.error, t)} />
              : listOcc.length ? <AgendaList occurrences={listOcc} onOpen={setOcc} t={t} />
              : <EmptyRow title={t(`Nothing dated in the next ${horizon} days`, `لا شيء مؤرخ في الأيام الـ${horizon} القادمة`)} body={t('Rent, a subscription, a scholarship payment — add anything with a date to see it here.', 'إيجار، اشتراك، دفعة منحة — أضف أي شيء بتاريخ لتراه هنا.')}
                  action={<Button variant="outline" className="min-h-11" onClick={openAdd} data-testid="button-empty-add"><Plus aria-hidden />{t('Add scheduled item', 'أضف بنداً مجدولاً')}</Button>} />
          ) : calendar.isError ? (
            <StatePanel tone="error" title={t('Calendar could not load', 'تعذّر تحميل التقويم')} body={upcomingErrorText(calendar.error, t)}
              action={<RetryButton label={t('Retry', 'أعد المحاولة')} busyLabel={t('Retrying…', 'جارٍ المحاولة…')} busy={calendar.isFetching} onClick={() => void calendar.refetch()} />} />
          ) : calendar.isLoading && !calendar.data ? <div className="skeleton-shimmer h-80 rounded-card" aria-busy data-testid="state-loading-calendar" />
            : <MonthCalendar year={ym.y} month0={ym.m} occurrences={calOcc} onMonth={shiftMonth} onOpen={setOcc} loading={calendar.isFetching} t={t} />}

          {view === 'list' && f ? <AllocationsList items={f.monthlyAllocations} t={t} /> : null}
          {view === 'calendar' && calendar.data ? <AllocationsList items={calendar.data.monthlyAllocations} t={t} /> : null}
        </section>

        {/* Own scheduled items */}
        <section className="flex flex-col gap-4 border-t border-divider py-8" aria-labelledby="series-h">
          <SectionHeading id="series-h" title={t('Your scheduled items', 'بنودك المجدولة')} meta={items.data ? String(items.data.length) : undefined} />
          <Notice tone="info" title={t('Additional commitment', 'التزام إضافي')} body={t(...ADDITIONAL_NOTICE)} />
          <p className="type-caption text-muted-foreground">{t('Income, allowances, recurring expenses, plan lines and goals appear above as read-only and are edited where they live.', 'الدخل والمصروفات والمصاريف المتكررة وبنود الخطة والأهداف تظهر أعلاه للقراءة فقط وتُعدَّل في أماكنها.')}</p>
          {items.isLoading ? <SkeletonRows rows={3} label={t('Loading', 'جارٍ التحميل')} />
            : items.isError ? <StatePanel tone="error" title={t('Items could not load', 'تعذّر تحميل البنود')} body={upcomingErrorText(items.error, t)}
                action={<RetryButton label={t('Retry', 'أعد المحاولة')} busyLabel={t('Retrying…', 'جارٍ المحاولة…')} busy={items.isFetching} onClick={() => void items.refetch()} />} />
            : items.data?.length ? <SeriesList items={items.data} onEdit={(i) => setDialog({ open: true, item: i })} onDelete={setToDelete} t={t} />
            : <EmptyRow title={t('No scheduled items yet', 'لا بنود مجدولة بعد')} body={t('Add a one-off or repeating date of your own.', 'أضف تاريخاً لمرة واحدة أو متكرراً خاصاً بك.')} />}
          <p className="type-caption text-muted-foreground">{t(...NO_LEDGER)}</p>
        </section>
      </PullToRefresh>

      <ScheduledDialog open={dialog.open} item={dialog.item} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} t={t} />
      <OccurrenceSheet occ={occ} item={occ ? itemById.get(occ.sourceId) : undefined} onClose={() => setOcc(null)}
        onEdit={(i) => { setOcc(null); setDialog({ open: true, item: i }); }} t={t} />
      <ConfirmDelete open={!!toDelete} onOpenChange={(o) => { if (!o) setToDelete(null); }} t={t}
        title={toDelete && toDelete.recurrence !== 'none' ? t('Delete this whole series?', 'حذف هذه السلسلة كاملة؟') : t('Delete this item?', 'حذف هذا البند؟')}
        body={t('It is removed from your plan, including dates you marked. Your accounts and transaction history are not touched.', 'يُزال من خطتك بما في ذلك التواريخ التي علّمتها. حساباتك وسجل حركاتك لا يتأثران.')}
        onConfirm={async () => { if (toDelete) { await del.mutateAsync({ id: toDelete.id }); void refresh(); } }} />
    </Page>
  );
}
