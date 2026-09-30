/**
 * Frontend money boundary. All money formatting and parsing flows through
 * `@workspace/finance-core` — the single source of truth for integer
 * minor-unit money. Never do floating-point arithmetic on amounts in the UI.
 */
export { money, parseMoney, formatMoney, formatNumber, formatPercent, formatDate } from '@workspace/finance-core';
export type { Money } from '@workspace/finance-core';

export type Currency = 'ILS' | 'USD' | 'JOD';
export const CURRENCIES: readonly Currency[] = ['ILS', 'USD', 'JOD'];
