import type { FinanceHistoryFilterOptions, FinanceTransaction } from '@workspace/api-client-react';
import type { Tx } from '@/features/money/money-model';
import { CATEGORY_LABEL, label } from '@/features/money/money-model';

export const TYPE_LABEL: Record<string, [string, string]> = {
  income: ['Income', 'دخل'],
  expense: ['Expense', 'مصروف'],
  transfer: ['Transfer', 'تحويل'],
  allowance: ['Allowance', 'مصروف أهل'],
  refund: ['Refund', 'استرداد'],
  savings: ['Savings', 'ادخار'],
  withdrawal: ['Withdrawal', 'سحب'],
  deposit: ['Deposit', 'إيداع'],
  payment: ['Payment', 'دفعة'],
  campus_payment: ['Campus payment', 'دفع جامعي'],
};

export const GROUP_LABEL: Record<string, [string, string]> = {
  university: ['University', 'الجامعة'],
  school: ['School', 'المدرسة'],
  campus: ['Campus', 'الحرم الجامعي'],
  legacy: ['Recorded (earlier entries)', 'مسجّلة (قيود سابقة)'],
};

export const typeLabel = (type: string, t: Tx) => label(TYPE_LABEL, type, t);

const DESCRIPTION_LABEL: Record<string, [string, string]> = {
  add: ['Simulated funds added', 'إضافة أموال محاكاة'],
  receive: ['Simulated funds received', 'استلام أموال محاكاة'],
  deposit: ['Simulated deposit', 'إيداع محاكى'],
  withdrawal: ['Simulated withdrawal', 'سحب محاكى'],
  payment: ['Simulated payment', 'دفعة محاكاة'],
  transfer: ['Account transfer', 'تحويل بين الحسابات'],
  send: ['Student transfer', 'تحويل لطالب'],
  request_fulfillment: ['Fulfilled money request', 'طلب مال تم سداده'],
};

/** Localize only server-generated descriptions, never user-entered text. */
export function transactionDescription(tx: FinanceTransaction, t: Tx) {
  if (tx.merchantName && tx.description === `Payment to ${tx.merchantName}`) {
    return t(`Payment to ${tx.merchantName}`, `دفع إلى ${tx.merchantName}`);
  }
  const known = DESCRIPTION_LABEL[tx.kind];
  if (known && tx.description === known[0]) return t(...known);
  return tx.description || tx.merchantName || typeLabel(tx.type, t);
}

/** Category label: prefer server taxonomy (bilingual) for the stored key, fall back to Prompt 4 labels. */
export function categoryLabel(key: string, categories: FinanceHistoryFilterOptions['categories'] | undefined, t: Tx, lang: string) {
  const hit = categories?.find((c) => c.key === key);
  if (hit) return lang === 'ar' ? hit.arabicLabel : hit.label;
  return label(CATEGORY_LABEL, key, t);
}
