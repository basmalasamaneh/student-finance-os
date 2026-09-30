import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, getGetFinancialPlanQueryKey, useGetFinancialPlan, type PlanningCategory } from '@workspace/api-client-react';
import type { Currency } from '@/lib/money';
import { apiErrorText, type Tx } from '@/features/money/money-model';
import { minorDigits, minorToInput, barPercent } from './planning-math';

export { minorDigits, minorToInput, barPercent };

export const PLAN_CATEGORIES: PlanningCategory[] = [
  'tuition', 'registration', 'university_fees', 'transportation', 'food', 'cafeteria', 'housing', 'utilities', 'internet',
  'books', 'printing', 'academic_supplies', 'subscriptions', 'personal', 'shopping', 'savings', 'other',
];
export const EXPENSE_CATEGORIES = PLAN_CATEGORIES.filter((c) => c !== 'savings');

export const CATEGORY: Record<string, [string, string]> = {
  tuition: ['Tuition', 'الرسوم الدراسية'], registration: ['Registration', 'التسجيل'], university_fees: ['University fees', 'رسوم جامعية'],
  transportation: ['Transportation', 'المواصلات'], food: ['Food', 'الطعام'], cafeteria: ['Cafeteria', 'الكافتيريا'],
  housing: ['Housing', 'السكن'], utilities: ['Utilities', 'الخدمات'], internet: ['Internet', 'الإنترنت'], books: ['Books', 'الكتب'],
  printing: ['Printing', 'الطباعة'], academic_supplies: ['Academic supplies', 'مستلزمات دراسية'], subscriptions: ['Subscriptions', 'الاشتراكات'],
  personal: ['Personal', 'شخصي'], shopping: ['Shopping', 'التسوق'], savings: ['Savings', 'الادخار'], other: ['Other', 'أخرى'],
};
export const FREQUENCY: Record<string, [string, string]> = {
  daily: ['Daily', 'يومي'], weekly: ['Weekly', 'أسبوعي'], biweekly: ['Every 2 weeks', 'كل أسبوعين'], monthly: ['Monthly', 'شهري'],
  quarterly: ['Quarterly', 'ربع سنوي'], yearly: ['Yearly', 'سنوي'], one_time: ['One-time', 'لمرة واحدة'], irregular: ['Irregular', 'غير منتظم'],
};
export const COST_SOURCE: Record<string, [string, string]> = {
  manual: ['Manual line', 'بند يدوي'], recurring: ['Recurring', 'متكرر'], profile: ['Profile baseline', 'أساس الملف'], override: ['Commute override', 'تجاوز التنقل'],
};
export const LINE_TYPE: Record<string, [string, string]> = { fixed: ['Fixed', 'ثابت'], variable: ['Variable', 'متغير'], savings: ['Savings', 'ادخار'] };
export const INCOME_SOURCE: Record<string, [string, string]> = {
  parent_allowance: ['Parent allowance', 'مصروف الأهل'], family_support: ['Family support', 'دعم العائلة'], scholarship: ['Scholarship', 'منحة'],
  financial_aid: ['Financial aid', 'مساعدة مالية'], student_loan: ['Student loan', 'قرض طلابي'], salary: ['Salary', 'راتب'], part_time: ['Part-time job', 'عمل جزئي'],
  full_time: ['Full-time job', 'عمل كامل'], freelance: ['Freelance', 'عمل حر'], internship: ['Internship', 'تدريب'], business_project: ['Business project', 'مشروع تجاري'],
  gift: ['Gift', 'هدية'], other: ['Other', 'أخرى'],
};
export const RESIDENCE: Record<string, [string, string]> = {
  family: ['With family', 'مع العائلة'], university_housing: ['University housing', 'سكن جامعي'], shared: ['Shared apartment', 'شقة مشتركة'], private: ['Private apartment', 'شقة خاصة'], other: ['Other', 'أخرى'],
};
export const COMMUTE: Record<string, [string, string]> = {
  walking: ['Walking', 'مشياً'], private_car: ['Private car', 'سيارة خاصة'], family_ride: ['Family ride', 'توصيل العائلة'], taxi: ['Taxi', 'تاكسي'],
  shared_taxi: ['Shared taxi', 'سرفيس'], bus: ['Bus', 'حافلة'], other: ['Other', 'أخرى'],
};
export const lbl = (map: Record<string, [string, string]>, key: string, t: Tx) => { const l = map[key]; return l ? t(l[0], l[1]) : key.replace(/_/g, ' '); };

export function usePlan() {
  return useGetFinancialPlan({ query: { queryKey: getGetFinancialPlanQueryKey(), refetchInterval: 15_000, refetchOnWindowFocus: true, refetchOnMount: 'always' } });
}
export function useRefreshPlan() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ queryKey: getGetFinancialPlanQueryKey() }), [qc]);
}

export function planErrorText(err: unknown, t: Tx, what: 'budget' | 'other' = 'other'): string {
  if (err instanceof ApiError) {
    const status = (err as unknown as { status?: number }).status;
    if (status === 409 && what === 'budget') return t('A budget for this category, period and currency already exists. Edit that one instead.', 'توجد ميزانية لهذه الفئة والفترة والعملة. عدّل الموجودة بدلاً من ذلك.');
    if (status === 400 || status === 422) return t('The server rejected these details. Check the category, amount and date.', 'رفض الخادم هذه البيانات. تحقق من الفئة والمبلغ والتاريخ.');
  }
  const txt = apiErrorText(err, t);
  return txt.includes('balance') || txt.includes('رصيد') ? t('Could not save. Nothing changed; you can retry.', 'تعذّر الحفظ. لم يتغير شيء؛ يمكنك إعادة المحاولة.') : txt;
}

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export function isValidIsoDate(s: string) {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
export function formatUtcDate(iso: string, locale: string) {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d);
}
export type { Currency };
