/**
 * Pure planning helpers for the student home (Prompt 3).
 * All inputs are persisted profile data. Nothing here is a balance or a transaction.
 * Money math is exact BigInt on integer minor units; rounding is half-up once, at the end.
 * Mixed currencies are never summed — every result is grouped per currency.
 */

export type HomeCurrency = 'ILS' | 'USD' | 'JOD';
export type HomeAmount = { minor: number; currency: HomeCurrency };
export type IncomeFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | 'one_time' | 'irregular';
export type AllowanceFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'irregular';
export type HomeIncome = {
  id: string;
  source: string;
  amount: HomeAmount;
  frequency: IncomeFrequency;
  expectedDate?: string;
  active: boolean;
};

export const CURRENCY_ORDER: readonly HomeCurrency[] = ['ILS', 'USD', 'JOD'];
const MAX = BigInt(Number.MAX_SAFE_INTEGER);

/** Occurrences per year. one_time and irregular have no annual rate. */
export const PER_YEAR: Readonly<Record<IncomeFrequency, bigint | null>> = {
  daily: 365n,
  weekly: 52n,
  biweekly: 26n,
  monthly: 12n,
  quarterly: 4n,
  yearly: 1n,
  one_time: null,
  irregular: null,
};

export type ExactResult = { ok: true; minor: number } | { ok: false; reason: 'overflow' };

/** numerator / denominator, half-up, as a safe integer or an overflow marker. */
export function divideHalfUp(numerator: bigint, denominator: bigint): ExactResult {
  if (denominator <= 0n || numerator < 0n) throw new RangeError('invalid division');
  const q = (numerator * 2n + denominator) / (denominator * 2n);
  return q > MAX ? { ok: false, reason: 'overflow' } : { ok: true, minor: Number(q) };
}

/** Monthly equivalent of one recurring amount; null when the frequency has no rate. */
export function monthlyEquivalent(minor: number, frequency: IncomeFrequency): ExactResult | null {
  const rate = PER_YEAR[frequency];
  if (rate === null) return null;
  return divideHalfUp(BigInt(minor) * rate, 12n);
}

/** Weekly equivalent of a school allowance (annualised, then / 52). Irregular → null (unknown). */
export function weeklyAllowance(amount: HomeAmount | undefined, frequency: AllowanceFrequency | undefined): { currency: HomeCurrency; result: ExactResult } | null {
  if (!amount || !frequency || frequency === 'irregular') return null;
  const rate = PER_YEAR[frequency];
  if (rate === null) return null;
  return { currency: amount.currency, result: divideHalfUp(BigInt(amount.minor) * rate, 52n) };
}

export type CurrencyEstimate = {
  currency: HomeCurrency;
  result: ExactResult;
  sourceCount: number;
  /** Exact adjustmentMonthly from managed parent allowance schedules, already included in result. */
  allowanceAdjustment?: number;
};

export type MonthlyIncomeEstimate = {
  byCurrency: CurrencyEstimate[];
  /** Active incomes excluded because they are one-time or irregular. */
  excluded: number;
  activeCount: number;
};

/** Active recurring incomes → one exact monthly estimate per currency (sum numerators, divide once). */
export function estimateMonthlyIncome(incomes: readonly HomeIncome[]): MonthlyIncomeEstimate {
  const sums = new Map<HomeCurrency, { num: bigint; count: number }>();
  let excluded = 0;
  let activeCount = 0;
  for (const income of incomes) {
    if (!income.active) continue;
    activeCount++;
    const rate = PER_YEAR[income.frequency];
    if (rate === null) { excluded++; continue; }
    const entry = sums.get(income.amount.currency) ?? { num: 0n, count: 0 };
    entry.num += BigInt(income.amount.minor) * rate;
    entry.count++;
    sums.set(income.amount.currency, entry);
  }
  const byCurrency = CURRENCY_ORDER.filter((c) => sums.has(c)).map((currency) => {
    const e = sums.get(currency)!;
    return { currency, result: divideHalfUp(e.num, 12n), sourceCount: e.count };
  });
  return { byCurrency, excluded, activeCount };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Normalise an ISO date/datetime to YYYY-MM-DD; invalid input → null (never guessed). */
export function toDay(value: string | undefined): string | null {
  if (!value) return null;
  const day = value.slice(0, 10);
  if (!DATE_RE.test(day)) return null;
  const d = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== day ? null : day;
}

/** Local calendar day as YYYY-MM-DD. */
export function localToday(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export type UpcomingIncome = { income: HomeIncome; day: string };

/** Active incomes with a stored expected date on or after today, earliest first (ties by id). */
export function upcomingIncomes(incomes: readonly HomeIncome[], today: string): UpcomingIncome[] {
  const out: UpcomingIncome[] = [];
  for (const income of incomes) {
    if (!income.active) continue;
    const day = toDay(income.expectedDate);
    if (day && day >= today) out.push({ income, day });
  }
  return out.sort((a, b) => (a.day === b.day ? a.income.id.localeCompare(b.income.id) : a.day < b.day ? -1 : 1));
}

/** Earliest upcoming active parent allowance, or null when no date is stored. */
export function nextAllowance(incomes: readonly HomeIncome[], today: string): UpcomingIncome | null {
  return upcomingIncomes(incomes.filter((i) => i.source === 'parent_allowance'), today)[0] ?? null;
}

/** Exact share a / b in tenths of a percent (half-up), or null if b is 0. */
export function shareTenths(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  const r = divideHalfUp(BigInt(part) * 1000n, BigInt(whole));
  return r.ok ? r.minor : null;
}

export function formatTenths(tenths: number): string {
  return `${Math.floor(tenths / 10)}.${tenths % 10}`;
}

export type Insight =
  | { kind: 'no-income' }
  | { kind: 'only-unscheduled'; count: number }
  | { kind: 'cost-share'; cost: 'commute' | 'housing'; tenths: number; currency: HomeCurrency }
  | { kind: 'currency-mismatch'; cost: 'commute' | 'housing' }
  | { kind: 'allowance-weekly'; currency: HomeCurrency; minor: number }
  | { kind: 'estimate-ready'; sources: number; currencies: number };

/**
 * One deterministic observation derived from the saved profile. It describes the user's own
 * numbers; it is not advice and never infers spending or balances.
 */
export function deriveInsight(input: {
  studentType?: 'school' | 'university';
  incomes: readonly HomeIncome[];
  commuteMonthly?: HomeAmount;
  housingShare?: HomeAmount;
  allowance?: HomeAmount;
  allowanceFrequency?: AllowanceFrequency;
}): Insight {
  if (input.studentType === 'school') {
    const w = weeklyAllowance(input.allowance, input.allowanceFrequency);
    if (w && w.result.ok) return { kind: 'allowance-weekly', currency: w.currency, minor: w.result.minor };
  }
  const est = estimateMonthlyIncome(input.incomes);
  if (est.activeCount === 0) return { kind: 'no-income' };
  if (est.byCurrency.length === 0) return { kind: 'only-unscheduled', count: est.excluded };
  const costs: Array<['commute' | 'housing', HomeAmount | undefined]> = [['housing', input.housingShare], ['commute', input.commuteMonthly]];
  for (const [cost, amount] of costs) {
    if (!amount || amount.minor <= 0) continue;
    const match = est.byCurrency.find((c) => c.currency === amount.currency);
    if (!match) return { kind: 'currency-mismatch', cost };
    if (!match.result.ok) continue;
    const tenths = shareTenths(amount.minor, match.result.minor);
    if (tenths !== null) return { kind: 'cost-share', cost, tenths, currency: amount.currency };
  }
  return { kind: 'estimate-ready', sources: est.byCurrency.reduce((n, c) => n + c.sourceCount, 0), currencies: est.byCurrency.length };
}

/**
 * Add server allowanceProjection.totals[].adjustmentMonthly to a profile-based estimate,
 * per matching currency only (no FX, no duplication: adjustment is the exact delta from the
 * inclusive-envelope reconciliation). Currencies absent from profile income get their own row.
 */
export function applyAllowanceAdjustment(
  estimate: MonthlyIncomeEstimate,
  totals: readonly { currency: HomeCurrency; adjustmentMonthly: { minor: number } }[] | undefined,
): MonthlyIncomeEstimate {
  if (!totals?.length) return estimate;
  const rows = new Map(estimate.byCurrency.map((c) => [c.currency, { ...c }]));
  for (const tot of totals) {
    const adj = tot.adjustmentMonthly.minor;
    if (!adj) continue;
    const row = rows.get(tot.currency) ?? { currency: tot.currency, result: { ok: true, minor: 0 } as ExactResult, sourceCount: 0 };
    if (row.result.ok) {
      const sum = BigInt(row.result.minor) + BigInt(adj);
      row.result = sum > BigInt(Number.MAX_SAFE_INTEGER) || sum < -BigInt(Number.MAX_SAFE_INTEGER) ? { ok: false, reason: 'overflow' } : { ok: true, minor: Number(sum) };
    }
    row.allowanceAdjustment = (row.allowanceAdjustment ?? 0) + adj;
    rows.set(tot.currency, row);
  }
  return { ...estimate, byCurrency: CURRENCY_ORDER.filter((c) => rows.has(c)).map((c) => rows.get(c)!) };
}
