/** Prompt 8 family/allowance presentation helpers over the generated contract (docs/prompt8-api.md). */
import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, type Allowance, type FamilyLink, type FamilyPermissions } from '@workspace/api-client-react';
import type { Tx } from '@/features/money/money-model';
import type { StatusTone } from '@/components/finance/status-badge';

export const PERMISSION_KEYS = [
  'monthlySummary', 'balance', 'goals', 'allowance', 'requests', 'transactions', 'upcomingPayments', 'campusSpending',
] as const satisfies readonly (keyof FamilyPermissions)[];
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/** Every flag defaults to OFF. Campus spending is never implied by another flag. */
export const defaultPermissions = (): FamilyPermissions =>
  Object.fromEntries(PERMISSION_KEYS.map((k) => [k, false])) as unknown as FamilyPermissions;

export const PERMISSION_TEXT: Record<PermissionKey, { title: [string, string]; body: [string, string] }> = {
  monthlySummary: { title: ['Monthly summary', 'الملخص الشهري'], body: ['Money in and out totals for this month.', 'إجمالي الداخل والخارج لهذا الشهر.'] },
  balance: { title: ['Balance', 'الرصيد'], body: ['Available balance per currency (not goal reserves).', 'الرصيد المتاح لكل عملة (دون احتياطي الأهداف).'] },
  goals: { title: ['Goals', 'الأهداف'], body: ['Goal names and progress, read-only.', 'أسماء الأهداف وتقدّمها، للعرض فقط.'] },
  allowance: { title: ['Allowance', 'المصروف'], body: ['Lets them schedule an allowance into the account you pick.', 'يسمح له بجدولة مصروف إلى الحساب الذي تختاره.'] },
  requests: { title: ['Requests', 'الطلبات'], body: ['Requests to this parent (coming soon).', 'الطلبات لولي الأمر (قريباً).'] },
  transactions: { title: ['Transactions', 'المعاملات'], body: ['Type, amount and date only — no notes or names.', 'النوع والمبلغ والتاريخ فقط — دون ملاحظات أو أسماء.'] },
  upcomingPayments: { title: ['Upcoming payments', 'المدفوعات القادمة'], body: ['Dated planned items and expected income.', 'البنود المخططة المؤرخة والدخل المتوقع.'] },
  campusSpending: { title: ['Campus spending', 'الإنفاق الجامعي'], body: ['Campus totals and rows. Off means campus is excluded everywhere.', 'إجماليات وحركات الحرم. الإيقاف يستثنيها من كل مكان.'] },
};
export const permLabel = (k: PermissionKey, t: Tx) => t(...PERMISSION_TEXT[k].title);
export const grantedCount = (p: FamilyPermissions) => PERMISSION_KEYS.filter((k) => p[k]).length;

export type LinkState = 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';
export const linkState = (l: FamilyLink): LinkState =>
  l.status === 'pending' && new Date(l.expiresAt).getTime() < Date.now() ? 'expired' : l.status;
export const LINK_STATUS: Record<LinkState, { tone: StatusTone; text: [string, string] }> = {
  pending: { tone: 'warning', text: ['Waiting for parent', 'بانتظار ولي الأمر'] },
  accepted: { tone: 'success', text: ['Connected', 'متصل'] },
  declined: { tone: 'neutral', text: ['Declined', 'مرفوض'] },
  revoked: { tone: 'neutral', text: ['Revoked', 'ملغى'] },
  expired: { tone: 'neutral', text: ['Expired', 'منتهي'] },
};

export const FREQUENCY_TEXT: Record<'weekly' | 'biweekly' | 'monthly', [string, string]> = {
  weekly: ['Weekly', 'أسبوعي'], biweekly: ['Every 2 weeks', 'كل أسبوعين'], monthly: ['Monthly', 'شهري'],
};
export const ALLOWANCE_STATUS: Record<Allowance['status'], { tone: StatusTone; text: [string, string] }> = {
  active: { tone: 'success', text: ['Active', 'نشط'] },
  paused: { tone: 'warning', text: ['Paused', 'متوقف مؤقتاً'] },
  cancelled: { tone: 'neutral', text: ['Cancelled', 'ملغى'] },
  completed: { tone: 'neutral', text: ['Completed', 'مكتمل'] },
};
export const failureText = (f: string | null | undefined, t: Tx) =>
  f === 'insufficient_funds' ? t('Last payment didn’t go through: not enough in your selected account. Top up, then retry.', 'لم تتم آخر دفعة: الرصيد غير كافٍ في حسابك المختار. اشحن ثم أعد المحاولة.')
  : f === 'balance_limit' ? t('Last payment didn’t go through: the receiving balance limit was reached.', 'لم تتم آخر دفعة: تم بلوغ حد رصيد الحساب المستلم.')
  : null;
export const UPCOMING_SOURCE: Record<string, [string, string]> = {
  allowance: ['Allowance', 'مصروف'], recurring: ['Recurring expense', 'مصروف متكرر'], income: ['Expected income', 'دخل متوقع'], line: ['Plan line', 'بند خطة'],
};

export type AllowanceAction = 'edit' | 'pause' | 'resume' | 'cancel' | 'retry';
/** Offered actions (server still authorizes). Unresolved failures must be retried or cancelled, never edited away. */
export function allowanceActions(a: Allowance): AllowanceAction[] {
  if (a.status !== 'active' && a.status !== 'paused') return [];
  if (a.lastFailure) return ['retry', 'cancel'];
  return a.status === 'active' ? ['edit', 'pause', 'retry', 'cancel'] : ['edit', 'resume', 'cancel'];
}

/** Finite cross-session freshness: poll 20s, refetch on focus and every mount, never trust stale. */
export const FAMILY_REFETCH = { refetchInterval: 20_000, refetchOnWindowFocus: false /* return events handled by useParentFreshnessGate */, refetchOnMount: 'always' as const, staleTime: 0 };

const PREFIXES = ['/api/family', '/api/parent', '/api/profile', '/api/finance', '/api/planning'];
export function useRefreshFamily() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && PREFIXES.some((p) => (q.queryKey[0] as string).startsWith(p)) }), [qc]);
}

/** Access revoked/declined → 404/403. Caller must drop cached permitted data. */
export const isGone = (err: unknown) => err instanceof ApiError && (err.status === 404 || err.status === 403);

function newKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
/**
 * Idempotency keys per logical body fingerprint. The same fingerprint reuses its key (safe network retry);
 * `done(fp)` after a server answer so the next deliberate attempt gets a fresh key.
 * `headers` is a stable object read by the generated fetch at call time.
 */
export function useKeyRing() {
  const keys = useRef(new Map<string, string>());
  const headers = useRef<Record<string, string>>({}).current;
  const prime = useCallback((fp: string) => {
    let k = keys.current.get(fp);
    if (!k) { k = newKey(); keys.current.set(fp, k); }
    headers['Idempotency-Key'] = k;
  }, [headers]);
  const done = useCallback((fp: string) => { keys.current.delete(fp); }, []);
  return { headers, prime, done };
}

export const todayUtc = () => new Date().toISOString().slice(0, 10);
/** Exact minor → decimal string (BigInt, no float). */
export function minorToDecimal(minor: number, currency: string) {
  const digits = currency === 'JOD' ? 3 : 2;
  const m = BigInt(minor); const scale = 10n ** BigInt(digits);
  return `${m / scale}.${(m % scale).toString().padStart(digits, '0')}`;
}
export const day = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);
