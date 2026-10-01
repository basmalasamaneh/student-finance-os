import { Link } from 'wouter';
import { UpcomingPayment } from '@/components/finance/upcoming-payment';
import { Notice, RetryButton, SkeletonRows } from '@/components/states/state-panel';
import type { T } from './home-primitives';
import { CATEGORY, lbl } from '@/features/planning/planning-model';
import { addDaysIso, KIND, SOURCE, STATUS, upcomingErrorText, useForecast, utcToday } from '@/features/upcoming/upcoming-model';

/** Home: next normalized dated items from the server forecast (replaces the old profile-only income list). */
export const UNIVERSITY_CATEGORIES = ['tuition', 'registration', 'university_fees', 'fees', 'books', 'bookstore', 'academic_supplies', 'printing', 'accommodation'];

export function UpcomingHomeList({ t, hidden, days = 30, categories, kind, emptyText, testId = 'list-home-upcoming' }: {
  t: T; hidden?: boolean; days?: number; categories?: string[]; kind?: 'expense' | 'income' | 'savings'; emptyText?: string; testId?: string;
}) {
  const fc = useForecast(addDaysIso(utcToday(), days));
  if (fc.isLoading) return <SkeletonRows rows={2} label={t('Loading', 'جارٍ التحميل')} />;
  if (fc.isError || !fc.data) return <div className="flex flex-col gap-2"><Notice tone="error" title={t('Upcoming could not load', 'تعذّر تحميل القادم')} body={upcomingErrorText(fc.error, t)} /><RetryButton label={t('Retry', 'أعد المحاولة')} busyLabel={t('Retrying…', 'جارٍ المحاولة…')} busy={fc.isFetching} onClick={() => void fc.refetch()} /></div>;
  const next = fc.data.occurrences.filter((o) => o.status === 'planned' && (!categories || categories.includes(o.category)) && (!kind || o.kind === kind)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  return (
    <div className="flex flex-col">
      {next.length ? (
        <ul className="divide-y divide-divider" data-testid={testId}>
          {next.map((o) => (
            <UpcomingPayment key={o.id} testId={`row-home-upcoming-${o.id}`} title={o.name} due={new Date(`${o.date}T00:00:00Z`)} amount={o.amount}
              meta={`${lbl(KIND, o.kind, t)} · ${lbl(CATEGORY, o.category, t)} · ${lbl(SOURCE, o.source, t)}`}
              statusTone={o.includedInForecast ? 'info' : 'neutral'} statusLabel={o.includedInForecast ? lbl(STATUS, o.status, t) : t('Not counted', 'غير محتسب')}
              hidden={hidden} hiddenLabel={t('Amount hidden', 'المبلغ مخفي')} />
          ))}
        </ul>
      ) : <p className="type-label py-2 text-muted-foreground">{emptyText ?? t(`Nothing dated in the next ${days} days.`, `لا شيء مؤرخ في الأيام الـ${days} القادمة.`)}</p>}
      <Link href="/upcoming" className="type-label inline-flex min-h-11 items-center text-gold-ink underline-offset-4 hover:underline" data-testid="link-upcoming-all">{t('Open upcoming & forecast', 'افتح القادم والتوقع')}</Link>
    </div>
  );
}
