import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, type FinanceAccount } from '@workspace/api-client-react';
import { addMoney, multiplyMoney, parseMoney, subtractMoney, type Money, type Currency } from '@/lib/money';
import { useI18n } from '@/features/i18n/i18n-provider';

export type Tx = (en: string, ar: string) => string;

export function useTx(): Tx {
  const { lang } = useI18n();
  return useCallback((en: string, ar: string) => (lang === 'ar' ? ar : en), [lang]);
}

const ARABIC_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/g;

/** Safe decimal-string parser: never uses floats. Returns integer minor units or an error key. */
export function parseAmountInput(raw: string, currency: Currency): { ok: true; value: Money } | { ok: false; reason: 'empty' | 'format' | 'precision' | 'zero' | 'range' } {
  const normalized = raw
    .replace(ARABIC_DIGITS, (d) => String((d.charCodeAt(0) & 0xf) % 10))
    .replace(/\u066B/g, '.')
    .replace(/[\s,\u066C]/g, '')
    .trim();
  if (!normalized) return { ok: false, reason: 'empty' };
  if (!/^\d+(\.\d+)?$/.test(normalized)) return { ok: false, reason: 'format' };
  try {
    const value = parseMoney(normalized, currency);
    if (value.minor <= 0) return { ok: false, reason: 'zero' };
    return { ok: true, value };
  } catch (e) {
    if (e instanceof RangeError && /precision/i.test(e.message)) return { ok: false, reason: 'precision' };
    return { ok: false, reason: 'range' };
  }
}

export function amountErrorText(reason: string, currency: Currency, t: Tx) {
  switch (reason) {
    case 'empty': return t('Enter an amount.', 'أدخل المبلغ.');
    case 'format': return t('Use digits only, like 12.50.', 'استخدم الأرقام فقط، مثل 12.50.');
    case 'precision': return currency === 'JOD' ? t('JOD allows up to 3 decimal places.', 'الدينار يسمح بثلاث خانات عشرية كحد أقصى.') : t('Up to 2 decimal places.', 'خانتان عشريتان كحد أقصى.');
    case 'zero': return t('Amount must be more than zero.', 'يجب أن يكون المبلغ أكبر من صفر.');
    default: return t('That amount is too large.', 'المبلغ كبير جداً.');
  }
}

/** Idempotency key stable for one logical submission. Retries reuse it; renew() starts a new one. */
function newKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
export function useIdempotencyKey() {
  const [key, setKey] = useState(newKey);
  const renew = useCallback(() => setKey(newKey()), []);
  return { key, renew, headers: { 'Idempotency-Key': key } };
}

/** Refresh every finance/campus/planning query after a successful money operation (budget actuals come from the ledger). */
export function useRefreshFinance() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({
    predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0].startsWith('/api/finance') || q.queryKey[0].startsWith('/api/campus') || q.queryKey[0].startsWith('/api/planning')),
  }), [qc]);
}

export function apiErrorText(err: unknown, t: Tx): string {
  if (err instanceof ApiError) {
    const data = err.data as { error?: { code?: string; message?: string } } | null;
    const code = data?.error?.code;
    switch (code) {
      case 'INSUFFICIENT_FUNDS': return t('Insufficient balance in the selected account. Nothing was moved.', 'الرصيد غير كافٍ في الحساب المختار. لم يتم تحريك أي مبلغ.');
      case 'NOT_FOUND': return t('That account or item could not be found. Check the identifier.', 'تعذّر العثور على الحساب أو العنصر. تحقق من المعرّف.');
      case 'FORBIDDEN': return t('You are not allowed to do that.', 'غير مسموح لك بهذا الإجراء.');
      case 'CONFLICT': return t('This was already handled or no longer matches. Refresh and try again.', 'تمت معالجته مسبقاً أو لم يعد مطابقاً. حدّث وحاول مجدداً.');
      case 'BAD_REQUEST': return t('The server rejected these details. Check the account, currency and amount.', 'رفض الخادم هذه البيانات. تحقق من الحساب والعملة والمبلغ.');
      case 'RATE_LIMITED': return t('Too many attempts. Wait a moment and retry.', 'محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.');
      case 'UNAUTHENTICATED': return t('Your session ended. Sign in again.', 'انتهت جلستك. سجّل الدخول مجدداً.');
    }
    if (data?.error?.message) return data.error.message;
  }
  return t('Something went wrong. Your balance is unchanged; you can safely retry.', 'حدث خطأ. رصيدك لم يتغير؛ يمكنك إعادة المحاولة بأمان.');
}

export const ACCOUNT_TYPE_LABEL: Record<string, [string, string]> = {
  wallet: ['Student Wallet', 'المحفظة الطلابية'],
  bank: ['Bank Account', 'حساب بنكي'],
  cash: ['Cash', 'نقد'],
  other: ['Other', 'أخرى'],
};

export const KIND_LABEL: Record<string, [string, string]> = {
  add: ['Add money', 'إضافة مال'],
  receive: ['Receive money', 'استلام مال'],
  deposit: ['Deposit', 'إيداع'],
  withdrawal: ['Withdrawal', 'سحب'],
  send: ['Send money', 'إرسال مال'],
  transfer: ['Internal transfer', 'تحويل داخلي'],
  payment: ['Simulated payment', 'دفعة محاكاة'],
  request_fulfillment: ['Request paid', 'دفع طلب'],
  campus_payment: ['Campus payment', 'دفع جامعي'],
};

export const CATEGORY_LABEL: Record<string, [string, string]> = {
  food: ['Food', 'طعام'], books: ['Books', 'كتب'], printing: ['Printing', 'طباعة'],
  transportation: ['Transportation', 'مواصلات'], fees: ['University fees', 'رسوم جامعية'], other: ['Other', 'أخرى'],
  income: ['Income', 'دخل'], transfer: ['Transfer', 'تحويل'], withdrawal: ['Withdrawal', 'سحب'],
};

export const label = (map: Record<string, [string, string]>, key: string, t: Tx) => {
  const l = map[key];
  return l ? t(l[0], l[1]) : key.replace(/_/g, ' ');
};

export function accountName(a: FinanceAccount | undefined, t: Tx) {
  if (!a) return t('Unknown account', 'حساب غير معروف');
  return a.name || label(ACCOUNT_TYPE_LABEL, a.type, t);
}

export const shortId = (id: string) => `${id.slice(0, 8)}…`;

/** Exact money helpers (BigInt inside finance-core). Return null on overflow/mismatch instead of losing precision. */
export type Exact = Money | null;
export function exactSum(values: Money[], currency: Currency): Exact {
  try { return values.reduce<Money>((acc, v) => addMoney(acc, v), { minor: 0, currency }); } catch { return null; }
}
export function exactLine(price: Money, quantity: number): Exact {
  try { return multiplyMoney(price, quantity); } catch { return null; }
}
export function exactSub(a: Money, b: Money): Exact {
  try { return subtractMoney(a, b); } catch { return null; }
}
/** Group balances per currency with exact addition; overflowed currencies are reported, not shown. */
export function totalsByCurrency(items: { balance: Money }[]): { currency: Currency; value: Exact }[] {
  const groups = new Map<Currency, Money[]>();
  for (const i of items) { const c = i.balance.currency as Currency; groups.set(c, [...(groups.get(c) ?? []), i.balance]); }
  return [...groups.entries()].map(([currency, vals]) => ({ currency, value: exactSum(vals, currency) }));
}
