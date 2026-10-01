import { and, eq } from "drizzle-orm";
import { db, incomes, allowances, familyLinks, type Allowance } from "@workspace/db";
import { halfUp, monthlyNumerator, safeMinor, type Amount, type Currency } from "./planning";
import { todayUtc } from "./allowances";

export const ALLOWANCE_POLICY = "Parent allowance forecast uses an inclusive envelope: maximum of recurring manual parent_allowance and active consented schedules per currency, not their sum. Manual profile rows are never changed. Ledger actual income is separate from forecasts.";
type ProjectionIncome = { source: string; amount: Amount; frequency: string; active: boolean };
// A dated manual allowance expectation is replaced only by an actually visible scheduled
// occurrence in the same currency on that exact date. Never suppress unrelated dates/currencies.
export function manualAllowanceUpcomingCovered(
  income: { source: string; expectedDate?: string; amount: { currency: string } },
  visibleOccurrences: readonly { date: string; amount: { currency: string } }[],
) {
  return income.source === "parent_allowance" && !!income.expectedDate &&
    visibleOccurrences.some(s => s.date === income.expectedDate && s.amount.currency === income.amount.currency);
}
export function allowanceUpcoming(schedules: readonly Allowance[], today = todayUtc()) {
  return schedules.filter(s => s.status === "active" && s.nextPayment >= s.startDate &&
    (!s.endDate || s.nextPayment <= s.endDate && s.endDate >= today))
    .map(s => ({ id: s.id, date: s.nextPayment, amount: { minor: Number(s.amountMinor), currency: s.currency },
      source: "allowance" as const })).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
export async function allowanceProjection(userId: string, today = todayUtc(), reader: Pick<typeof db, "select"> = db) {
  const manualRows = await reader.select().from(incomes).where(eq(incomes.userId, userId));
  const joined = await reader.select({ schedule: allowances, link: familyLinks }).from(allowances)
      .innerJoin(familyLinks, eq(allowances.familyLinkId, familyLinks.id))
      .where(and(eq(allowances.studentId, userId), eq(allowances.status, "active"), eq(familyLinks.status, "accepted")));
  const active = joined.filter(r => r.link.permissions.allowance && (!r.schedule.endDate || r.schedule.endDate >= today)).map(r => r.schedule);
  const manual = manualRows.map(r => r.data as ProjectionIncome).filter(i => i.active);
  const currencies = new Set([...manual.filter(i => i.source === "parent_allowance").map(i => i.amount.currency), ...active.map(s => s.currency as Currency)]);
  const adjustments = new Map<string, bigint>();
  const totals = [...currencies].sort().map(currency => {
    const parent = manual.filter(i => i.source === "parent_allowance" && i.amount.currency === currency)
      .reduce((n, i) => n + (monthlyNumerator(i.amount, i.frequency) ?? 0n), 0n);
    const other = manual.filter(i => i.source !== "parent_allowance" && i.amount.currency === currency)
      .reduce((n, i) => n + (monthlyNumerator(i.amount, i.frequency) ?? 0n), 0n);
    const scheduled = active.filter(s => s.currency === currency && s.kind === "recurring" && s.startDate <= today)
      .reduce((n, s) => n + (monthlyNumerator({ minor: Number(s.amountMinor), currency }, s.frequency!) ?? 0n), 0n);
    const effective = parent > scheduled ? parent : scheduled;
    adjustments.set(currency, effective - parent);
    const money = (minor: bigint) => ({ minor: safeMinor(minor), currency });
    return { currency, manualMonthly: money(halfUp(parent, 12n)), scheduledMonthly: money(halfUp(scheduled, 12n)),
      effectiveMonthly: money(halfUp(effective, 12n)),
      adjustmentMonthly: money(halfUp(other + effective, 12n) - halfUp(other + parent, 12n)) };
  });
  return {
    dto: { policy: "inclusive_parent_allowance_envelope" as const, totals,
      upcoming: allowanceUpcoming(active, today) },
    adjustments,
  };
}