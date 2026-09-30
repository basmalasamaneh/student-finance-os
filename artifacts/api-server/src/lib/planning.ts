import { ApiError } from "./http-errors";

export type Currency = "ILS" | "USD" | "JOD";
export type Amount = { minor: number; currency: Currency };
export const MAX = BigInt(Number.MAX_SAFE_INTEGER);
export const POLICY = "Monthly estimates only. Active recurring income is annualized and rounded once per currency; irregular/one-time income and scholarship metadata are excluded. Manual expense lines replace recurring expenses and profile baseline in the same canonical category/currency; otherwise recurring replaces profile baseline. Housing share replaces rent, utilities and internet remain separate. Budget limits are comparisons, not expenses; weekly and monthly budget actuals overlap and must never be summed. Upcoming items do not post ledger entries.";
const aliases: Record<string, string> = {
  cafeteria: "food", bookstore: "books", campus_transportation: "transportation",
  fees: "university_fees", rent: "housing", accommodation: "housing",
};
export function canonicalCategory(category: string): string { return aliases[category] ?? category; }
export function validDate(date: string): boolean {
  return /^\d{4}-\d\d-\d\d$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) &&
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
}
export function safeMinor(value: bigint): number {
  if (value > MAX || value < -MAX) throw new ApiError("BAD_REQUEST");
  return Number(value);
}
export function halfUp(n: bigint, denominator: bigint): bigint {
  return (n + denominator / 2n) / denominator;
}
const rates: Record<string, bigint> = {
  daily: 365n, weekly: 52n, biweekly: 26n, monthly: 12n,
  quarterly: 4n, yearly: 1n,
};
export function monthlyNumerator(amount: Amount, frequency: string): bigint | null {
  const rate = rates[frequency];
  return rate === undefined ? null : BigInt(amount.minor) * rate;
}
export function periodBounds(period: "weekly" | "monthly", now: Date): { start: Date; end: Date; periodStart: string; periodEnd: string } {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let start: Date, end: Date;
  if (period === "weekly") {
    start = new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * 86400000);
    end = new Date(start.getTime() + 7 * 86400000);
  } else {
    start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
    end = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 1));
  }
  return { start, end, periodStart: start.toISOString().slice(0, 10), periodEnd: new Date(end.getTime() - 86400000).toISOString().slice(0, 10) };
}
export function sumAmounts(amounts: readonly Amount[]): Map<Currency, bigint> {
  const totals = new Map<Currency, bigint>();
  for (const a of amounts) totals.set(a.currency, (totals.get(a.currency) ?? 0n) + BigInt(a.minor));
  return totals;
}
type CostEntry = { category: string; source: "profile" | "override" | "recurring" | "manual"; amount: Amount; numerator?: bigint };
export function resolveCosts(profile: readonly CostEntry[], recurring: readonly CostEntry[], manual: readonly CostEntry[]): { category: string; source: CostEntry["source"]; amount: Amount }[] {
  const grouped = new Map<string, CostEntry[]>();
  for (const source of [profile, recurring, manual]) {
    const byBucket = new Map<string, CostEntry[]>();
    for (const entry of source) {
      const category = canonicalCategory(entry.category);
      const key = `${category}:${entry.amount.currency}`;
      byBucket.set(key, [...(byBucket.get(key) ?? []), { ...entry, category }]);
    }
    for (const [key, entries] of byBucket) grouped.set(key, entries);
  }
  return [...grouped.values()].map(entries => ({
    category: entries[0]!.category, source: entries[0]!.source,
    amount: { currency: entries[0]!.amount.currency, minor: safeMinor(
      entries[0]!.source === "recurring"
        ? halfUp(entries.reduce((n, e) => n + (e.numerator ?? 0n), 0n), 12n)
        : entries.reduce((n, e) => n + BigInt(e.amount.minor), 0n),
    ) },
  })).sort((a, b) => a.category.localeCompare(b.category) || a.amount.currency.localeCompare(b.amount.currency));
}
export function isBudgetDebit(row: { direction: string; kind: string; serviceId?: string | null }): boolean {
  return row.direction === "debit" && (row.kind === "payment" || row.kind === "withdrawal");
}