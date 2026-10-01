import { useCallback } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  getGetPlanningCalendarQueryKey, getGetPlanningForecastQueryKey, getListScheduledItemsQueryKey,
  useGetPlanningCalendar, useGetPlanningForecast, useListScheduledItems,
  type PlanningOccurrence, type PlanningMonthlyAllocation,
} from '@workspace/api-client-react';
import { ApiError } from '@workspace/api-client-react';
import type { Tx } from '@/features/money/money-model';
import { planErrorText } from '@/features/planning/planning-model';

const LIVE = { refetchInterval: 15_000, refetchOnWindowFocus: true, refetchOnMount: 'always' as const };

/** Prefix keys (no params) so one invalidation refreshes every range. */
export const UPCOMING_KEYS = [
  getListScheduledItemsQueryKey(),
  [getGetPlanningCalendarQueryKey()[0]],
  [getGetPlanningForecastQueryKey()[0]],
] as const;

export function invalidateUpcoming(qc: QueryClient) {
  return Promise.all(UPCOMING_KEYS.map((queryKey) => qc.invalidateQueries({ queryKey: [...queryKey] })));
}
export function useRefreshUpcoming() {
  const qc = useQueryClient();
  return useCallback(() => invalidateUpcoming(qc), [qc]);
}

export function useScheduledItems() {
  return useListScheduledItems({ query: { queryKey: getListScheduledItemsQueryKey(), ...LIVE } });
}
export function useForecast(through: string) {
  const params = { through };
  return useGetPlanningForecast(params, { query: { queryKey: getGetPlanningForecastQueryKey(params), ...LIVE } });
}
export function useCalendar(from: string, to: string) {
  const params = { from, to };
  return useGetPlanningCalendar(params, { query: { queryKey: getGetPlanningCalendarQueryKey(params), ...LIVE } });
}

/* ── UTC calendar-date helpers (dates only — never money) ── */
export const pad = (n: number) => String(n).padStart(2, '0');
export const isoOf = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const utcToday = () => isoOf(new Date());
export function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return isoOf(d);
}
export function monthBounds(year: number, month0: number) {
  const first = new Date(Date.UTC(year, month0, 1));
  const last = new Date(Date.UTC(year, month0 + 1, 0));
  return { from: isoOf(first), to: isoOf(last), days: last.getUTCDate(), startWeekday: first.getUTCDay() };
}
export function formatDay(iso: string, locale: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
}

export function groupByDate<T extends { date: string }>(items: T[]) {
  const m = new Map<string, T[]>();
  for (const it of [...items].sort((a, b) => a.date.localeCompare(b.date))) {
    const arr = m.get(it.date) ?? []; arr.push(it); m.set(it.date, arr);
  }
  return [...m.entries()];
}

/* ── Labels ── */
export const KIND: Record<string, [string, string]> = { expense: ['Expense', 'مصروف'], income: ['Income', 'دخل'], savings: ['Savings', 'ادخار'] };
export const RECURRENCE: Record<string, [string, string]> = {
  none: ['One time', 'مرة واحدة'], daily: ['Daily', 'يومي'], weekly: ['Weekly', 'أسبوعي'], biweekly: ['Every 2 weeks', 'كل أسبوعين'],
  monthly: ['Monthly', 'شهري'], quarterly: ['Quarterly', 'ربع سنوي'], yearly: ['Yearly', 'سنوي'],
};
export const STATUS: Record<string, [string, string]> = {
  planned: ['Planned', 'مخطط'], completed: ['Marked done', 'مُعلَّم كمنجز'], cancelled: ['Cancelled', 'ملغى'], posted: ['Posted', 'مُسجَّل'],
};
export const SOURCE: Record<string, [string, string]> = {
  scheduled_item: ['Your scheduled item', 'بند مجدول خاص بك'], income: ['Profile income', 'دخل الملف'], allowance: ['Family allowance', 'مصروف عائلي'],
  recurring: ['Recurring expense', 'مصروف متكرر'], line: ['Plan line', 'بند خطة'],
  manual: ['Plan line envelope', 'مخصص بنود الخطة'], profile: ['Profile baseline', 'أساس الملف'], override: ['Commute override', 'تجاوز التنقل'],
  goal_savings: ['Savings goals', 'أهداف الادخار'], allowance_envelope: ['Allowance envelope', 'مخصص المصروف'],
};

/** Where a read-only source is edited. Upcoming never copies these into editable rows. */
export function sourceLink(source: PlanningOccurrence['source'] | PlanningMonthlyAllocation['source'], t: Tx): { href: string; label: string } | null {
  switch (source) {
    case 'income': return { href: '/profile', label: t('Edit in profile', 'عدّل في الملف') };
    case 'profile': return { href: '/profile', label: t('Edit in profile', 'عدّل في الملف') };
    case 'allowance': case 'allowance_envelope': return { href: '/family', label: t('View in family', 'اعرض في العائلة') };
    case 'recurring': case 'line': case 'manual': case 'override': return { href: '/plan', label: t('Edit in plan', 'عدّل في الخطة') };
    case 'goal_savings': return { href: '/goals', label: t('Open goals', 'افتح الأهداف') };
    default: return null;
  }
}

export function upcomingErrorText(err: unknown, t: Tx) {
  if (err instanceof ApiError) {
    const status = (err as unknown as { status?: number }).status;
    if (status === 409) return t('This series already has dates marked done or cancelled, so its date, repeat or end date cannot change. Delete it and add a new one instead.', 'لهذه السلسلة تواريخ معلّمة كمنجزة أو ملغاة، لذا لا يمكن تغيير تاريخها أو تكرارها أو نهايتها. احذفها وأضف واحدة جديدة.');
    if (status === 404) return t('This item no longer exists. The list has been refreshed.', 'هذا البند لم يعد موجوداً. تم تحديث القائمة.');
  }
  return planErrorText(err, t);
}

export const ADDITIONAL_NOTICE: [string, string] = [
  'Additional commitment — this adds to your existing monthly plan. It does not replace an existing budget, income, recurring expense or savings goal.',
  'التزام إضافي — يُضاف إلى خطتك الشهرية الحالية. لا يحل محل ميزانية أو دخل أو مصروف متكرر أو هدف ادخار موجود.',
];
export const NO_LEDGER: [string, string] = [
  'Marking an item done or cancelled only updates your plan. It never posts a payment, moves money or changes a balance.',
  'تعليم بند كمنجز أو ملغى يحدّث خطتك فقط. لا يسجّل أي دفعة ولا ينقل مالاً ولا يغيّر أي رصيد.',
];
