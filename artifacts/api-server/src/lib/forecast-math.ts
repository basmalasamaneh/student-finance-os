import type { Amount, ForecastCurrency, PlanningMonthlyAllocation, PlanningOccurrence, ScheduledRecurrence } from "@workspace/api-zod";
import { ApiError } from "./http-errors";
import { safeMinor, validDate } from "./planning";

const DAY = 86400000;
export const validScheduledDate = (date: string) => validDate(date) && date >= "0001-01-01";
export const FORECAST_POLICY = "Estimated / Projected. Additional commitments add to the existing plan; no ledger posting or FX. Available opening excludes goal reserves. Past overdue has no carryover. Concrete dates and undated monthly allocations are separate.";
export const FORECAST_ASSUMPTION_CODES = ["today_dated_income_may_already_be_in_opening"] as const;
export const FORECAST_ASSUMPTIONS = [
  "Non-allowance dated income (profile income and additional scheduled income) is not linked to ledger postings. Today's expected income may already be in available opening and may therefore be counted twice. No amount/date matching heuristic is applied; review or update the original expectation.",
  "UTC inclusive range, maximum 366 days. Today's posted allowance is already in opening, never future income.",
  "Original recurrence anchor clamps to month end without drift; end dates inclusive. One-time/irregular dated income occurs once; scholarship metadata is not income.",
  "Manual expense envelopes replace recurring and profile costs per canonical category/currency. Winning recurring sources use concrete dates; manual dated markers are covered by their monthly envelope.",
  "Current housing/commute and monthly goal requirements are held constant into future months. Savings=max(manual,goals), no automatic reserve posting.",
  "Monthly allocation=floor(M*b/D)-floor(M*a/D) using exact minor units and elapsed-day boundaries; no invented bill dates or guaranteed future cash.",
  "Allowance horizon envelope=max(manual recurring expectation minus posted amounts in interval, active consented unposted schedules). Only any excess manual envelope is added to schedules.",
  "Completed/cancelled occurrences do not affect future totals. Failed unposted allowance remains an uncertain estimate, not a promise of retry/payment.",
];
export function assertRange(from: string, to: string) {
  if (!validScheduledDate(from) || !validScheduledDate(to) || from > to ||
    (Date.parse(to) - Date.parse(from)) / DAY >= 366) throw new ApiError("BAD_REQUEST");
}
export function recurrenceDates(anchor: string, recurrence: ScheduledRecurrence, endDate: string | null | undefined, from: string, to: string): string[] {
  assertRange(from, to);
  if (!validScheduledDate(anchor) || endDate && (!validScheduledDate(endDate) || endDate < anchor)) throw new ApiError("BAD_REQUEST");
  const original = new Date(`${anchor}T00:00:00Z`), result: string[] = [];
  const step = { daily: 1, weekly: 7, biweekly: 14 }[recurrence as "daily" | "weekly" | "biweekly"];
  const monthStep = { monthly: 1, quarterly: 3, yearly: 12 }[recurrence as "monthly" | "quarterly" | "yearly"];
  for (let time = Date.parse(`${from}T00:00:00Z`); time <= Date.parse(`${to}T00:00:00Z`); time += DAY) {
    const day = new Date(time), date = day.toISOString().slice(0, 10);
    if (date < anchor || endDate && date > endDate) continue;
    if (recurrence === "none") { if (date === anchor) result.push(date); continue; }
    if (step) { if ((time - original.getTime()) / DAY % step === 0) result.push(date); continue; }
    const months = (day.getUTCFullYear() - original.getUTCFullYear()) * 12 + day.getUTCMonth() - original.getUTCMonth();
    // setUTCFullYear avoids Date.UTC's special interpretation of years 00..99.
    const last = new Date(time); last.setUTCMonth(last.getUTCMonth() + 1, 0);
    if (monthStep && months % monthStep === 0 && day.getUTCDate() === Math.min(original.getUTCDate(), last.getUTCDate())) result.push(date);
  }
  return result;
}
export function monthAllocations(
  input: Pick<PlanningMonthlyAllocation, "source" | "category" | "kind"> & { id: string; amount: Amount },
  from: string, to: string,
): PlanningMonthlyAllocation[] {
  assertRange(from, to);
  const result: PlanningMonthlyAllocation[] = [];
  let cursor = from;
  while (cursor <= to) {
    const first = new Date(`${cursor}T00:00:00Z`);
    const last = new Date(first); last.setUTCMonth(last.getUTCMonth() + 1, 0);
    const end = last.toISOString().slice(0, 10) < to ? last.toISOString().slice(0, 10) : to;
    const a = BigInt(first.getUTCDate() - 1), b = BigInt(Number(end.slice(8))), days = BigInt(last.getUTCDate());
    const allocated = BigInt(input.amount.minor) * b / days - BigInt(input.amount.minor) * a / days;
    result.push({ id: `${input.id}:${cursor.slice(0, 7)}`, label: "Undated monthly allocation",
      source: input.source, category: input.category, kind: input.kind,
      month: cursor.slice(0, 7), from: cursor, to: end, monthlyAmount: input.amount,
      allocatedAmount: { currency: input.amount.currency, minor: safeMinor(allocated) },
      policy: "constant_current_monthly_envelope_exact_daily_allocation" });
    if (end === to) break;
    cursor = new Date(Date.parse(`${end}T00:00:00Z`) + DAY).toISOString().slice(0, 10);
  }
  return result;
}
export function forecastTotals(opening: readonly Amount[], occurrences: readonly PlanningOccurrence[], allocations: readonly PlanningMonthlyAllocation[]): ForecastCurrency[] {
  const currencies = new Set([...opening.map(a => a.currency), ...occurrences.map(o => o.amount.currency), ...allocations.map(a => a.allocatedAmount.currency)]);
  return [...currencies].sort().map(currency => {
    let expectedIncome = 0n, upcomingExpenses = 0n, recurringExpenses = 0n, plannedSavings = 0n;
    const availableOpening = opening.filter(a => a.currency === currency).reduce((n, a) => n + BigInt(a.minor), 0n);
    for (const row of occurrences.filter(o => o.amount.currency === currency && o.includedInForecast && o.status === "planned")) {
      if (row.kind === "income") expectedIncome += BigInt(row.amount.minor);
      else if (row.kind === "savings") plannedSavings += BigInt(row.amount.minor);
      else if (row.recurrence !== "none") recurringExpenses += BigInt(row.amount.minor);
      else upcomingExpenses += BigInt(row.amount.minor);
    }
    for (const row of allocations.filter(a => a.allocatedAmount.currency === currency)) {
      if (row.kind === "income") expectedIncome += BigInt(row.allocatedAmount.minor);
      else if (row.kind === "savings") plannedSavings += BigInt(row.allocatedAmount.minor);
      else upcomingExpenses += BigInt(row.allocatedAmount.minor);
    }
    const money = (minor: bigint): Amount => ({ currency, minor: safeMinor(minor) });
    return { currency, availableOpening: money(availableOpening), expectedIncome: money(expectedIncome),
      upcomingExpenses: money(upcomingExpenses), recurringExpenses: money(recurringExpenses),
      plannedSavings: money(plannedSavings), projectedBalance: money(availableOpening + expectedIncome - upcomingExpenses - recurringExpenses - plannedSavings) };
  });
}