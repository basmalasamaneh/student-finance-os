import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { ChevronLeft, ChevronRight, ExternalLink, Lock } from 'lucide-react';
import type { ForecastCurrency, PlanningMonthlyAllocation, PlanningOccurrence, ScheduledItem } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { MoneyDisplay } from '@/components/finance/money-display';
import { StatusBadge } from '@/components/finance/status-badge';
import { Notice } from '@/components/states/state-panel';
import { useI18n } from '@/features/i18n/i18n-provider';
import type { Tx } from '@/features/money/money-model';
import { CATEGORY, lbl } from '@/features/planning/planning-model';
import { formatDay, groupByDate, KIND, monthBounds, RECURRENCE, SOURCE, sourceLink, STATUS, utcToday } from '@/features/upcoming/upcoming-model';
import { statusTone } from './occurrence-sheet';
import { RowActions } from '@/components/planning/plan-shared';
import { cn } from '@/lib/utils';

function Term({ label, op, children }: { label: string; op: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="type-label font-normal text-muted-foreground"><span aria-hidden className="inline-block w-4 tabular">{op}</span>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Server-computed forecast per currency. No arithmetic happens here. */
export function ForecastCard({ row, t }: { row: ForecastCurrency; t: Tx }) {
  const neg = row.projectedBalance.minor < 0;
  return (
    <div className="min-w-0 rounded-card border border-card-border bg-card p-5 shadow-sm md:p-6" data-testid={`card-forecast-${row.currency}`}>
      <div className="flex items-baseline justify-between gap-2 pb-2">
        <p className="eyebrow">{t('Forecast', 'التوقع')} · {row.currency}</p>
        <span className="type-caption rounded-full bg-primary-soft px-2 py-0.5 text-gold-ink">{t('Estimated / Projected', 'تقديري / متوقع')}</span>
      </div>
      <dl className="divide-y divide-divider">
        <Term label={t('Available now (excludes goal reserves)', 'المتاح الآن (دون احتياطي الأهداف)')} op=" "><MoneyDisplay value={row.availableOpening} size="sm" testId={`text-fc-opening-${row.currency}`} /></Term>
        <Term label={t('Expected income', 'الدخل المتوقع')} op="+"><MoneyDisplay value={row.expectedIncome} size="sm" tone="projected" testId={`text-fc-income-${row.currency}`} /></Term>
        <Term label={t('Upcoming expenses', 'المصاريف القادمة')} op="−"><MoneyDisplay value={row.upcomingExpenses} size="sm" tone="planned" testId={`text-fc-upcoming-${row.currency}`} /></Term>
        <Term label={t('Recurring expenses', 'المصاريف المتكررة')} op="−"><MoneyDisplay value={row.recurringExpenses} size="sm" tone="planned" testId={`text-fc-recurring-${row.currency}`} /></Term>
        <Term label={t('Planned savings', 'الادخار المخطط')} op="−"><MoneyDisplay value={row.plannedSavings} size="sm" tone="planned" testId={`text-fc-savings-${row.currency}`} /></Term>
      </dl>
      <div className="mt-2 border-t-2 border-foreground/80 pt-3">
        <p className="type-caption text-muted-foreground">= {t('Projected balance', 'الرصيد المتوقع')}</p>
        <p className={cn('pt-1', neg && 'text-destructive')} data-testid={`text-fc-projected-${row.currency}`}>
          {neg ? <span className="figure-hero">−</span> : null}
          <MoneyDisplay value={{ minor: Math.abs(row.projectedBalance.minor), currency: row.projectedBalance.currency }} size="hero" className={neg ? '!text-destructive' : ''} />
        </p>
        {neg ? <p className="type-caption pt-2 text-muted-foreground">{t('Planned outflow is larger than what is expected in this currency by this date. Worth a look at your plan.', 'التدفق المخطط أكبر من المتوقع بهذه العملة حتى هذا التاريخ. قد تستحق خطتك نظرة.')}</p> : null}
      </div>
    </div>
  );
}

/** Localized mirror of the server's FORECAST_ASSUMPTIONS (api-server/src/lib/forecast-math.ts), in the same order. */
const POLICY: [string, string][] = [
  ['Dates are UTC calendar days, inclusive, at most 366 days per request. An allowance already posted today is part of your available balance and is never counted again as future income.',
    'التواريخ أيام تقويم بتوقيت UTC وشاملة، بحد أقصى 366 يوماً لكل طلب. المصروف العائلي المسجَّل اليوم جزء من رصيدك المتاح ولا يُحتسب مرة أخرى كدخل قادم.'],
  ['Repeats keep their original day and clamp to the month end without drifting (Jan 31 → Feb 28/29 → Mar 31); end dates are inclusive. One-time or irregular dated income happens once. Scholarship details alone are not income.',
    'التكرار يحافظ على يومه الأصلي ويُقصّ إلى نهاية الشهر دون انزياح (31 يناير ← 28/29 فبراير ← 31 مارس)؛ تواريخ الانتهاء شاملة. الدخل المؤرخ لمرة واحدة أو غير المنتظم يحدث مرة واحدة. بيانات المنحة وحدها ليست دخلاً.'],
  ['Your manual plan lines take priority over recurring expenses and profile estimates for the same category and currency. Winning recurring expenses use their real dates; dated manual lines are covered by their monthly amount, not counted twice.',
    'بنود خطتك اليدوية لها الأولوية على المصاريف المتكررة وتقديرات الملف لنفس الفئة والعملة. المصاريف المتكررة المعتمدة تستخدم تواريخها الفعلية؛ والبنود اليدوية المؤرخة مغطاة بمبلغها الشهري ولا تُحتسب مرتين.'],
  ['Current housing, commute and monthly goal needs are held constant into future months. Planned savings is the larger of your manual savings and your goals’ needs; nothing is reserved automatically.',
    'تكاليف السكن والتنقل الحالية واحتياجات الأهداف الشهرية تبقى ثابتة في الأشهر القادمة. الادخار المخطط هو الأكبر بين ادخارك اليدوي واحتياجات أهدافك؛ ولا يُحجز شيء تلقائياً.'],
  ['Undated monthly amounts are spread across the days of each month in exact minor units (floor(M×b/D) − floor(M×a/D)). No bill dates are invented and no future money is guaranteed.',
    'المبالغ الشهرية غير المؤرخة توزَّع على أيام كل شهر بوحدات صغرى دقيقة (floor(M×b/D) − floor(M×a/D)). لا تُخترع تواريخ فواتير ولا يُضمن أي مال قادم.'],
  ['Family allowance uses the larger of your own expected allowance (minus what was already posted in the period) and the active, consented scheduled allowances — never both added together.',
    'المصروف العائلي يستخدم الأكبر بين توقعك الخاص (مطروحاً منه ما سُجّل في الفترة) والمصروفات المجدولة النشطة والموافق عليها — ولا يجمعهما معاً.'],
  ['Dates marked done or cancelled do not affect future totals. Past dates that were not marked are not carried forward. A failed allowance that was not posted stays an uncertain estimate, not a promise of payment.',
    'التواريخ المعلّمة كمنجزة أو ملغاة لا تؤثر في المجاميع القادمة. التواريخ الماضية غير المعلّمة لا تُرحَّل. المصروف الذي فشل ولم يُسجَّل يبقى تقديراً غير مؤكد وليس وعداً بالدفع.'],
  ['Reserved goal savings are not counted as available money. Amounts in different currencies are never converted or combined.',
    'مدخرات الأهداف المحجوزة لا تُحتسب مالاً متاحاً. المبالغ بعملات مختلفة لا تُحوَّل ولا تُجمع.'],
];
const KNOWN_CODES = new Set(['today_dated_income_may_already_be_in_opening']);

export function Assumptions({ forecast, t }: { forecast: { assumptionCodes?: readonly string[] }; t: Tx }) {
  const codes = forecast.assumptionCodes ?? [];
  const todayIncome = codes.includes('today_dated_income_may_already_be_in_opening');
  const unknown = codes.some((c) => !KNOWN_CODES.has(c));
  return (
    <div className="flex flex-col gap-3">
      {todayIncome ? (
        <Notice tone="warning" title={t('Income dated today', 'دخل مؤرخ اليوم')}
          body={t('Profile income or your own scheduled income dated today is not linked to recorded transactions. If you already received and recorded it, it may be in your available balance and counted twice. Review or update the original expectation. (Posted family allowance is never double counted.)',
            'الدخل من الملف أو دخلك المجدول المؤرخ اليوم غير مرتبط بالحركات المسجّلة. إذا استلمته وسجّلته، فقد يكون ضمن رصيدك المتاح ويُحتسب مرتين. راجع التوقع الأصلي أو حدّثه. (المصروف العائلي المسجَّل لا يُحتسب مرتين أبداً.)')} />
      ) : null}
      <details className="group rounded-card border border-border bg-surface p-4" data-testid="panel-assumptions">
        <summary className="type-label flex min-h-11 cursor-pointer items-center justify-between gap-2">{t('How this estimate is built', 'كيف بُني هذا التقدير')}<ChevronRight className="size-4 transition-transform group-open:rotate-90 rtl:rotate-180 rtl:group-open:rotate-90" aria-hidden /></summary>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 ps-5 type-caption text-muted-foreground">
          <li>{t('Non-allowance dated income (profile and scheduled income) is not matched to recorded transactions; no amount or date guessing is applied.', 'الدخل المؤرخ غير العائلي (دخل الملف والدخل المجدول) لا يُطابق مع الحركات المسجّلة؛ ولا يُطبَّق أي تخمين للمبلغ أو التاريخ.')}</li>
          {POLICY.map((p, i) => <li key={i}>{t(p[0], p[1])}</li>)}
          {unknown ? <li>{t('The server reported an additional assumption; review your plan sources.', 'أبلغ الخادم عن افتراض إضافي؛ راجع مصادر خطتك.')}</li> : null}
        </ul>
      </details>
    </div>
  );
}

export function OccurrenceRow({ occ, onOpen, t }: { occ: PlanningOccurrence; onOpen: (o: PlanningOccurrence) => void; t: Tx }) {
  const readOnly = occ.source !== 'scheduled_item';
  const income = occ.kind === 'income';
  return (
    <li>
      <button type="button" onClick={() => onOpen(occ)} className="flex min-h-16 w-full items-center gap-3 py-3 text-start transition-colors hover:bg-surface-sunken/60 focus-visible:bg-surface-sunken/60 sm:px-2" data-testid={`row-occ-${occ.id}`}>
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-full type-caption font-semibold', income ? 'bg-success-soft text-success' : occ.kind === 'savings' ? 'bg-primary-soft text-gold-ink' : 'bg-surface-sunken text-foreground')} aria-hidden>
          {income ? '+' : occ.kind === 'savings' ? '◎' : '−'}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn('truncate type-body font-medium', occ.status === 'cancelled' && 'line-through decoration-muted-foreground')}>{occ.name}</span>
          <span className="flex flex-wrap items-center gap-x-2 type-caption text-muted-foreground">
            <span>{lbl(CATEGORY, occ.category, t)}</span><span aria-hidden>·</span><span>{lbl(RECURRENCE, occ.recurrence, t)}</span>
            {readOnly ? <><span aria-hidden>·</span><span className="inline-flex items-center gap-1"><Lock className="size-3" aria-hidden />{lbl(SOURCE, occ.source, t)}</span></> : null}
            {!occ.includedInForecast && occ.status === 'planned' ? <><span aria-hidden>·</span><span>{t('Not counted', 'غير محتسب')}</span></> : null}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span><span className={cn('tabular text-sm font-semibold', income && 'text-success')}>{income ? '+' : '−'}</span><MoneyDisplay value={occ.amount} size="sm" tone={income ? 'positive' : 'default'} /></span>
          {occ.status !== 'planned' ? <StatusBadge tone={statusTone(occ.status)} label={t(...(STATUS[occ.status] ?? ['', '']))} className="px-2 py-0.5 type-caption" /> : null}
        </span>
      </button>
    </li>
  );
}

export function AgendaList({ occurrences, onOpen, t }: { occurrences: PlanningOccurrence[]; onOpen: (o: PlanningOccurrence) => void; t: Tx }) {
  const { locale } = useI18n();
  const today = utcToday();
  return (
    <div className="flex flex-col" data-testid="list-agenda">
      {groupByDate(occurrences).map(([date, items]) => (
        <section key={date} aria-label={formatDay(date, locale)}>
          <h3 className="date-header type-caption py-2 font-semibold text-muted-foreground">
            {date === today ? `${t('Today', 'اليوم')} · ` : ''}{formatDay(date, locale)}
          </h3>
          <ul className="divide-y divide-divider">{items.map((o) => <OccurrenceRow key={o.id} occ={o} onOpen={onOpen} t={t} />)}</ul>
        </section>
      ))}
    </div>
  );
}

/** Month grid on desktop; on mobile the grid is compact and tapping a day shows its agenda below. */
export function MonthCalendar({ year, month0, occurrences, onMonth, onOpen, loading, t }: {
  year: number; month0: number; occurrences: PlanningOccurrence[]; onMonth: (delta: number) => void; onOpen: (o: PlanningOccurrence) => void; loading: boolean; t: Tx;
}) {
  const { locale } = useI18n();
  const { from, days, startWeekday } = monthBounds(year, month0);
  const today = utcToday();
  const [selected, setSelected] = useState<string | null>(null);
  const byDate = useMemo(() => new Map(groupByDate(occurrences)), [occurrences]);
  const prefix = from.slice(0, 8);
  const weekdays = Array.from({ length: 7 }, (_, i) => formatDay(`2023-01-0${i + 1}`, locale, { weekday: 'short' })); // 2023-01-01 is Sunday
  const cells: (string | null)[] = [...Array(startWeekday).fill(null), ...Array.from({ length: days }, (_, i) => `${prefix}${String(i + 1).padStart(2, '0')}`)];
  const sel = selected && selected.startsWith(prefix) ? selected : null;
  const title = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${from}T00:00:00Z`));

  return (
    <div className="flex flex-col gap-4" data-testid="view-calendar">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" className="size-11" onClick={() => { setSelected(null); onMonth(-1); }} aria-label={t('Previous month', 'الشهر السابق')} data-testid="button-month-prev"><ChevronLeft aria-hidden /></Button>
        <h3 className="type-title" aria-live="polite" data-testid="text-month">{title}</h3>
        <Button variant="ghost" size="icon" className="size-11" onClick={() => { setSelected(null); onMonth(1); }} aria-label={t('Next month', 'الشهر التالي')} data-testid="button-month-next"><ChevronRight aria-hidden /></Button>
      </div>
      <div role="grid" aria-busy={loading} className={cn('grid grid-cols-7 gap-1 transition-opacity', loading && 'opacity-60')}>
        {weekdays.map((w) => <div key={w} role="columnheader" className="type-caption pb-1 text-center text-muted-foreground">{w}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} aria-hidden />;
          const items = byDate.get(d) ?? [];
          const isSel = sel === d;
          return (
            <button key={d} type="button" role="gridcell" aria-selected={isSel} onClick={() => setSelected(isSel ? null : d)}
              aria-label={`${formatDay(d, locale, { day: 'numeric', month: 'long' })}${items.length ? ` · ${items.length}` : ''}`}
              className={cn('flex min-h-11 flex-col items-stretch gap-1 rounded-xl border p-1 text-start transition-colors md:min-h-24 md:p-2',
                isSel ? 'border-primary bg-primary-soft' : 'border-transparent hover:border-border', d === today && !isSel && 'border-gold-300 dark:border-gold-700')}
              data-testid={`cell-day-${d}`}>
              <span className={cn('tabular type-caption text-center md:text-start', d === today && 'font-semibold text-gold-ink')}>{Number(d.slice(8))}</span>
              {/* Mobile: dots. Desktop: up to 3 readable chips. */}
              <span className="flex justify-center gap-0.5 md:hidden" aria-hidden>
                {items.slice(0, 3).map((o) => <span key={o.id} className={cn('size-1.5 rounded-full', o.kind === 'income' ? 'bg-success' : o.kind === 'savings' ? 'bg-gold-500' : 'bg-foreground/60', o.status !== 'planned' && 'opacity-40')} />)}
              </span>
              <span className="hidden flex-col gap-0.5 md:flex">
                {items.slice(0, 3).map((o) => <span key={o.id} className={cn('truncate rounded-md px-1.5 py-0.5 type-caption', o.kind === 'income' ? 'bg-success-soft text-success' : o.kind === 'savings' ? 'bg-primary-soft text-gold-ink' : 'bg-surface-sunken', o.status === 'cancelled' && 'line-through')}>{o.name}</span>)}
                {items.length > 3 ? <span className="type-caption text-muted-foreground">+{items.length - 3}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
      {sel ? (
        <div className="border-t border-divider pt-3" data-testid="panel-day">
          <p className="type-label pb-1">{formatDay(sel, locale, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          {(byDate.get(sel) ?? []).length
            ? <ul className="divide-y divide-divider">{(byDate.get(sel) ?? []).map((o) => <OccurrenceRow key={o.id} occ={o} onOpen={onOpen} t={t} />)}</ul>
            : <p className="type-caption py-3 text-muted-foreground">{t('Nothing dated on this day.', 'لا شيء مؤرخ في هذا اليوم.')}</p>}
        </div>
      ) : <p className="type-caption text-muted-foreground">{t('Tap a day to see what is planned.', 'اضغط على يوم لرؤية المخطط.')}</p>}
    </div>
  );
}

export function AllocationsList({ items, t }: { items: PlanningMonthlyAllocation[]; t: Tx }) {
  const { locale } = useI18n();
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-2" data-testid="list-allocations">
      <p className="type-caption text-muted-foreground">{t('Undated monthly allocations — spread evenly across the days of each month. They are assumptions from your plan, not bills.', 'مخصصات شهرية غير مؤرخة — موزعة بالتساوي على أيام كل شهر. هي افتراضات من خطتك وليست فواتير.')}</p>
      <ul className="divide-y divide-divider">
        {items.map((a) => {
          const link = sourceLink(a.source, t);
          return (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3" data-testid={`row-alloc-${a.id}`}>
              <div className="min-w-0">
                <p className="type-label">{lbl(CATEGORY, a.category, t)} · {lbl(KIND, a.kind, t)}</p>
                <p className="type-caption text-muted-foreground">{lbl(SOURCE, a.source, t)} · {formatDay(a.from, locale, { day: 'numeric', month: 'short' })} – {formatDay(a.to, locale, { day: 'numeric', month: 'short' })} · {t('monthly', 'شهرياً')} <MoneyDisplay value={a.monthlyAmount} size="sm" tone="muted" className="!text-[13px]" /></p>
              </div>
              <div className="flex items-center gap-2">
                <MoneyDisplay value={a.allocatedAmount} size="sm" tone="projected" />
                {link ? <Link href={link.href} className="inline-flex size-11 items-center justify-center rounded-lg text-gold-ink hover:bg-surface-sunken" aria-label={link.label} data-testid={`link-alloc-${a.id}`}><ExternalLink className="size-4" aria-hidden /></Link> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SeriesList({ items, onEdit, onDelete, t }: { items: ScheduledItem[]; onEdit: (i: ScheduledItem) => void; onDelete: (i: ScheduledItem) => void; t: Tx }) {
  const { locale } = useI18n();
  return (
    <ul className="divide-y divide-divider" data-testid="list-series">
      {items.map((i) => (
        <li key={i.id} className="flex items-center gap-1">
          <button type="button" onClick={() => onEdit(i)} className="flex min-h-14 min-w-0 flex-1 items-center justify-between gap-3 py-3 text-start hover:bg-surface-sunken/60 sm:px-2" data-testid={`row-series-${i.id}`}>
            <span className="min-w-0">
              <span className={cn('block truncate type-label', i.status === 'cancelled' && 'line-through decoration-muted-foreground')}>{i.name}</span>
              <span className="type-caption text-muted-foreground">{lbl(KIND, i.kind, t)} · {lbl(RECURRENCE, i.recurrence, t)} · {formatDay(i.dueDate, locale, { day: 'numeric', month: 'short', year: 'numeric' })}{i.endDate ? ` → ${formatDay(i.endDate, locale, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <MoneyDisplay value={i.amount} size="sm" />
              {i.status !== 'planned' ? <StatusBadge tone={statusTone(i.status)} label={t(...(STATUS[i.status] ?? ['', '']))} className="px-2 py-0.5 type-caption" /> : null}
            </span>
          </button>
          <RowActions onEdit={() => onEdit(i)} onDelete={() => onDelete(i)} t={t} testId={`series-${i.id}`} />
        </li>
      ))}
    </ul>
  );
}
