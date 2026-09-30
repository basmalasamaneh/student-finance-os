import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, type SavingsGoal, type SavingsGoalStatus } from '@workspace/api-client-react';
import type { Tx } from '@/features/money/money-model';

export const GOAL_REFETCH = { refetchInterval: 15_000, refetchOnWindowFocus: true, refetchOnMount: 'always' as const };

export const STATUS_LABEL: Record<SavingsGoalStatus, [string, string]> = {
  active: ['Active', 'نشط'], paused: ['Paused', 'متوقف مؤقتاً'], completed: ['Completed', 'مكتمل'], archived: ['Archived', 'مؤرشف'],
};
export const PRIORITY_LABEL: Record<string, [string, string]> = { low: ['Low', 'منخفضة'], medium: ['Medium', 'متوسطة'], high: ['High', 'عالية'] };
export const ACTION_LABEL: Record<string, [string, string]> = {
  created: ['Goal created', 'أُنشئ الهدف'], edited: ['Details edited', 'عُدّلت التفاصيل'], contribution: ['Contribution', 'مساهمة'],
  paused: ['Paused', 'أُوقف مؤقتاً'], resumed: ['Resumed', 'استُؤنف'], completed: ['Marked complete', 'عُلّم كمكتمل'], archived: ['Archived', 'أُرشف'],
};
export const SOURCE_LABEL: Record<string, [string, string]> = {
  student_account: ['From your account', 'من حسابك'], parent_simulated: ['Parent · simulated external funding', 'الأهل · تمويل خارجي محاكى'],
};
export const tl = (m: Record<string, [string, string]>, k: string, t: Tx) => { const l = m[k]; return l ? t(l[0], l[1]) : k; };

export const CONSENT_TEXT: [string, string] = [
  "Allow one signed-in parent to see this goal's name, target, saved amount, remaining, target date and status, and add simulated funds. This does not share your accounts, profile, notes or other goals.",
  'السماح لوليّ أمر واحد مسجّل الدخول برؤية اسم هذا الهدف والمبلغ المستهدف والمدّخر والمتبقي والتاريخ المستهدف والحالة، وإضافة أموال محاكاة. هذا لا يشارك حساباتك أو ملفك أو ملاحظاتك أو أهدافك الأخرى.',
];
export const SIMULATED_FUNDING: [string, string] = ['Simulated external funding — no bank connection or real money transfer.', 'تمويل خارجي محاكى — لا اتصال بنكي ولا تحويل أموال حقيقي.'];

function newKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Idempotency key bound to one logical submission (a fingerprint of the exact payload).
 * Identical retries reuse the key; any payload change or reset() after success yields a new one.
 * Computed during render so the generated hook's request options always carry the current key.
 */
export function useSubmissionKey(fingerprint: string) {
  const [gen, setGen] = useState(0);
  const ref = useRef<{ fp: string; key: string } | null>(null);
  const fp = `${gen}#${fingerprint}`;
  if (!ref.current || ref.current.fp !== fp) ref.current = { fp, key: newKey() };
  const key = ref.current.key;
  const reset = useCallback(() => setGen((g) => g + 1), []);
  return { key, reset, headers: { 'Idempotency-Key': key } };
}

const prefixed = (prefixes: string[]) => (q: { queryKey: readonly unknown[] }) =>
  typeof q.queryKey[0] === 'string' && prefixes.some((p) => (q.queryKey[0] as string).startsWith(p));

/** Contributions move money: refresh goals, finance (accounts/summary/history/options), planning (budgets+forecast), which also feeds the dashboard. */
export function useRefreshAfterContribution() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ predicate: prefixed(['/api/goals', '/api/finance', '/api/planning', '/api/campus']) }), [qc]);
}
/** Status/metadata edits: goals + planning (forecast requirements) + history filter labels. */
export function useRefreshAfterGoalChange() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ predicate: prefixed(['/api/goals', '/api/planning', '/api/finance/history']) }), [qc]);
}

export function goalErrorText(err: unknown, t: Tx): string {
  if (err instanceof ApiError) {
    const data = err.data as { error?: { code?: string; message?: string } } | null;
    const code = data?.error?.code;
    if (code === 'INSUFFICIENT_FUNDS') return t('Not enough available balance in that account. Nothing was moved.', 'الرصيد المتاح غير كافٍ في هذا الحساب. لم يُحرَّك شيء.');
    if (err.status === 401) return t('Your session ended. Sign in again.', 'انتهت جلستك. سجّل الدخول مجدداً.');
    if (err.status === 403) return t('This account type cannot do that.', 'نوع الحساب هذا لا يمكنه ذلك.');
    if (err.status === 404) return t('That goal is not available.', 'هذا الهدف غير متاح.');
    if (err.status === 409) return data?.error?.message
      ? t(`Not applied: ${data.error.message}`, `لم يُطبَّق: ${data.error.message}`)
      : t('Not applied — the goal changed, is already funded, or this state does not allow it. Refresh and check.', 'لم يُطبَّق — تغيّر الهدف أو اكتمل تمويله أو لا تسمح حالته بذلك. حدّث وتحقق.');
    if (err.status === 400) return data?.error?.message ?? t('Some details were rejected. Check the fields.', 'رُفضت بعض التفاصيل. تحقق من الحقول.');
    if (err.status === 429) return t('Too many attempts. Wait a moment and retry.', 'محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.');
    if (data?.error?.message) return data.error.message;
  }
  return t('Something went wrong. Nothing changed unless confirmed; retrying is safe.', 'حدث خطأ. لم يتغير شيء ما لم يُؤكَّد؛ إعادة المحاولة آمنة.');
}

/** Presentation-only percent (server basis points, rounded down). Never used in money math. */
export const pct = (g: { percentage: number }) => Math.max(0, Math.min(100, g.percentage)) / 100;
export const isFunded = (g: Pick<SavingsGoal, 'remaining'>) => g.remaining.minor === 0;

export function fmtDate(iso: string | null | undefined, locale: string) {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}
export function fmtDateTime(iso: string, locale: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}
