/**
 * Prompt 13 — "Can I afford this?" model. Contract: POST /api/planning/affordability
 * (generated plain `compareAffordability`). The page deliberately uses the plain function, NOT
 * `useCompareAffordability`: TanStack's global MutationCache would retain scenario variables and
 * results (see .agents/memory/ephemeral-request-privacy.md). No financial math here — only exact
 * input parsing (finance-core via parseAmountInput) and labels for server codes.
 */
import type { AffordabilityAlternative, AffordabilityRequest, PlanningCategory } from '@workspace/api-client-react';
import { parseAmountInput, type Tx } from '@/features/money/money-model';
import type { Currency } from '@/lib/money';

export const MAX_SCENARIOS = 4;
export const HORIZONS = [30, 60, 90] as const;
export type Horizon = (typeof HORIZONS)[number];

export interface ScenarioDraft {
  id: number; item: string; price: string; currency: Currency;
  category: string; // '' = none
  date: string;     // '' = captured UTC today (server default)
  accountId: string; // 'all' = total available opening
}
export const emptyScenario = (id: number, currency: Currency = 'ILS'): ScenarioDraft =>
  ({ id, item: '', price: '', currency, category: '', date: '', accountId: 'all' });

export function utcToday() { return new Date().toISOString().slice(0, 10); }
export function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}

export type FieldErrors = Partial<Record<'item' | 'price' | 'date', string>>;
export function validateScenario(s: ScenarioDraft, through: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!s.item.trim()) errors.item = 'item';
  const p = parseAmountInput(s.price, s.currency);
  if (!p.ok) errors.price = p.reason;
  if (s.date && (s.date < utcToday() || s.date > through)) errors.date = 'range';
  return errors;
}

export function buildRequest(scenarios: ScenarioDraft[], through: string): AffordabilityRequest | null {
  const alternatives: AffordabilityAlternative[] = [];
  for (const s of scenarios) {
    if (Object.keys(validateScenario(s, through)).length) return null;
    const p = parseAmountInput(s.price, s.currency);
    if (!p.ok) return null;
    const alt: AffordabilityAlternative = { item: s.item.trim(), price: { minor: p.value.minor, currency: s.currency } };
    if (s.category) alt.category = s.category as PlanningCategory;
    if (s.date) alt.purchaseDate = s.date;
    if (s.accountId !== 'all') alt.accountId = s.accountId;
    alternatives.push(alt);
  }
  if (alternatives.length < 1 || alternatives.length > MAX_SCENARIOS) return null;
  return { through, alternatives };
}

/** Localized text for every server message/assumption code. Unknown codes get a generic line. */
const CODE_TEXT: Record<string, [string, string]> = {
  today_dated_income_may_already_be_in_opening: ['Income dated today may already be in your available balance and could be counted twice. Review it on Upcoming.', 'قد يكون الدخل المؤرخ اليوم ضمن رصيدك المتاح فيُحتسب مرتين. راجعه في القادم.'],
  utc_inclusive_horizon: ['Dates use UTC and the window includes its last day.', 'التواريخ بتوقيت UTC والنافذة تشمل يومها الأخير.'],
  recurrence_and_scholarship_policy: ['Recurring income follows its schedule; scholarships are listed as information, not added as income.', 'الدخل المتكرر يتبع جدوله؛ المنح تُعرض كمعلومة ولا تُضاف دخلاً.'],
  reconciled_expense_sources: ['Plan lines, recurring expenses and profile costs are reconciled so nothing is counted twice.', 'بنود الخطة والمصاريف المتكررة وتكاليف الملف تُطابق كي لا يُحتسب شيء مرتين.'],
  constant_housing_commute_and_savings: ['Housing, commute and planned savings are treated as steady monthly amounts.', 'السكن والتنقل والادخار المخطط تُعامل كمبالغ شهرية ثابتة.'],
  exact_monthly_allocations_not_cash_dates: ['Monthly amounts are spread exactly across the window; they are not specific payment dates.', 'المبالغ الشهرية موزعة بدقة على النافذة؛ وليست تواريخ دفع محددة.'],
  inclusive_allowance_envelope: ['Family allowance is counted once, using the larger of your manual or scheduled amount.', 'المصروف العائلي يُحتسب مرة واحدة بالأكبر بين المبلغ اليدوي والمجدول.'],
  inactive_occurrences_excluded: ['Items marked done or cancelled are not included.', 'البنود المعلّمة كمنجزة أو ملغاة غير محتسبة.'],
  independent_additional_purchase: ['Each option is an extra purchase on top of your plan, compared on its own — options are never added together.', 'كل خيار شراء إضافي فوق خطتك ويُقارن وحده — ولا تُجمع الخيارات.'],
  current_cash_not_purchase_date_cash: ['“Available now” is today’s money, not a prediction of your balance on the purchase date.', '«المتاح الآن» هو مالك اليوم، وليس توقعاً لرصيدك في تاريخ الشراء.'],
  future_projection_not_guaranteed: ['Projections are estimates, not guarantees.', 'التوقعات تقديرية وليست مضمونة.'],
  reserves_protected_no_fx: ['Reserved goal savings are not spent, and currencies are never converted.', 'مدخرات الأهداف المحجوزة لا تُصرف، والعملات لا تُحوَّل.'],
  budgets_comparison_only: ['Budgets are shown for comparison only; a budget limit is never added as an expense.', 'الميزانيات للمقارنة فقط؛ حدّ الميزانية لا يُضاف مصروفاً.'],
  goal_timeline_not_calculated: ['Effects on goal timelines are not calculated.', 'لا يُحسب الأثر على مواعيد الأهداف.'],
  current_cash_shortfall: ['The price is more than the money available now.', 'السعر أكبر من المال المتاح الآن.'],
  projected_shortfall: ['After this purchase, the projection for this window goes below zero.', 'بعد هذا الشراء، يصبح التوقع لهذه النافذة دون الصفر.'],
  account_cash_shortfall: ['The price is more than the selected account holds now.', 'السعر أكبر مما في الحساب المختار الآن.'],
  budget_category_not_provided: ['No category chosen, so no budget is compared.', 'لم تُختر فئة، لذا لا تُقارن ميزانية.'],
  budget_not_configured: ['You have no budget for this category.', 'لا توجد ميزانية لهذه الفئة.'],
  budget_outside_current_period: ['The purchase date falls outside the current budget period.', 'تاريخ الشراء خارج فترة الميزانية الحالية.'],
  budget_comparison_available: ['A budget for this category is compared below.', 'ميزانية هذه الفئة مقارنة أدناه.'],
  goal_pressure_possible: ['You have active goals in this currency and the projection after purchase is below zero; your goal savings could feel pressure.', 'لديك أهداف نشطة بهذه العملة والتوقع بعد الشراء دون الصفر؛ قد يتأثر ادخارك للأهداف.'],
};
export function codeText(code: string, t: Tx) {
  const e = CODE_TEXT[code];
  return e ? t(e[0], e[1]) : t('The server reported an additional note; review your plan sources.', 'أبلغ الخادم عن ملاحظة إضافية؛ راجع مصادر خطتك.');
}
/** Codes that describe a situation in this scenario (shown neutrally, not as verdicts). */
export const SITUATION_CODES = new Set(['current_cash_shortfall', 'projected_shortfall', 'account_cash_shortfall', 'goal_pressure_possible']);
/** Server codes already covered by the shared localized forecast policy list (Assumptions component). */
export const FORECAST_POLICY_CODES = new Set([
  'utc_inclusive_horizon', 'recurrence_and_scholarship_policy', 'reconciled_expense_sources', 'constant_housing_commute_and_savings',
  'exact_monthly_allocations_not_cash_dates', 'inclusive_allowance_envelope', 'inactive_occurrences_excluded', 'reserves_protected_no_fx',
]);
/** Affordability-specific assumption codes rendered after the shared forecast policy. */
export const AFFORD_ONLY_CODES = new Set([
  'independent_additional_purchase', 'current_cash_not_purchase_date_cash', 'future_projection_not_guaranteed',
  'budgets_comparison_only', 'goal_timeline_not_calculated',
]);
