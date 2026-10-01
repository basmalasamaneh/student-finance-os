import { and, eq, gte, lte } from "drizzle-orm";
import { db, incomes, scheduledItems, scheduledOccurrenceOverrides, allowances, allowanceOccurrences, familyLinks, financeAccounts, type Allowance } from "@workspace/db";
import type { Amount, PlanningCalendar, PlanningForecast, PlanningMonthlyAllocation, PlanningOccurrence, ScheduledRecurrence } from "@workspace/api-zod";
import { financialPlanSnapshot } from "../routes/planning";
import { canonicalCategory, halfUp, monthlyNumerator, safeMinor, type Currency } from "./planning";
import { assertRange, FORECAST_ASSUMPTIONS, FORECAST_ASSUMPTION_CODES, FORECAST_POLICY, forecastTotals, monthAllocations, recurrenceDates } from "./forecast-math";
import { nextAllowanceDate } from "./allowances";

type Reader = Pick<typeof db, "select">;
type ProfileIncome = { source: string; active: boolean; amount: Amount; frequency: string; expectedDate?: string; description?: string };
type Plan = Awaited<ReturnType<typeof financialPlanSnapshot>>;
const money = (minor: bigint, currency: string): Amount => ({ minor: safeMinor(minor), currency: currency as Currency });
const frequency = (value: string): ScheduledRecurrence => value === "one_time" || value === "irregular" ? "none" : value as ScheduledRecurrence;

export function allowanceForecastDates(schedule: Pick<Allowance, "nextPayment" | "startDate" | "endDate" | "kind" | "frequency">, from: string, to: string): string[] {
  assertRange(from, to);
  const cursor = schedule.nextPayment;
  if (cursor > to || schedule.endDate && cursor > schedule.endDate) return [];
  const first = cursor >= from ? [cursor] : [];
  if (schedule.kind === "oneTime" || cursor === to ||
    schedule.frequency === "monthly" && cursor.slice(0, 7) === to.slice(0, 7)) return first;
  // The worker posts its actual nextPayment first, even when that cursor is off the
  // original start-date cadence. Afterwards monthly dates use the original day,
  // while weekly/biweekly dates advance from the actual cursor.
  const next = nextAllowanceDate(cursor, schedule.frequency!, schedule.startDate);
  if (next > to || schedule.endDate && next > schedule.endDate) return first;
  const anchor = schedule.frequency === "monthly" ? schedule.startDate : next;
  return first.concat(recurrenceDates(anchor, frequency(schedule.frequency!), schedule.endDate, from, to).filter(date => date >= next));
}

async function calendarSnapshot(reader: Reader, userId: string, from: string, to: string, plan: Plan): Promise<PlanningCalendar> {
  assertRange(from, to);
  const items = await reader.select().from(scheduledItems).where(eq(scheduledItems.userId, userId));
  const overrides = await reader.select({ override: scheduledOccurrenceOverrides }).from(scheduledOccurrenceOverrides)
      .innerJoin(scheduledItems, eq(scheduledOccurrenceOverrides.itemId, scheduledItems.id))
      .where(and(eq(scheduledItems.userId, userId), gte(scheduledOccurrenceOverrides.date, from), lte(scheduledOccurrenceOverrides.date, to)));
  const incomeRows = await reader.select().from(incomes).where(eq(incomes.userId, userId));
  const joinedSchedules = await reader.select({ schedule: allowances, link: familyLinks }).from(allowances)
      .innerJoin(familyLinks, eq(allowances.familyLinkId, familyLinks.id))
      .where(and(eq(allowances.studentId, userId), eq(familyLinks.studentId, userId), eq(familyLinks.status, "accepted")));
  const postedRows = await reader.select({ occurrence: allowanceOccurrences, scheduleId: allowances.id }).from(allowanceOccurrences)
      .innerJoin(allowances, eq(allowanceOccurrences.allowanceId, allowances.id))
      .where(and(eq(allowances.studentId, userId), gte(allowanceOccurrences.scheduledDate, from), lte(allowanceOccurrences.scheduledDate, to)));
  const occurrences: PlanningOccurrence[] = [], monthlyAllocations: PlanningMonthlyAllocation[] = [];
  const add = (entry: Omit<PlanningOccurrence, "id">) => {
    occurrences.push({ ...entry, id: `${entry.source}:${entry.sourceId}:${entry.date}` });
  };
  const overrideMap = new Map(overrides.map(r => [`${r.override.itemId}:${r.override.date}`, r.override.status]));
  for (const item of items) {
    for (const date of recurrenceDates(item.dueDate, frequency(item.recurrence), item.endDate, from, to)) {
      const status = item.status === "cancelled" ? "cancelled" :
        (overrideMap.get(`${item.id}:${date}`) ?? item.status) as PlanningOccurrence["status"];
      add({ sourceId: item.id, source: "scheduled_item", name: item.name, date,
        amount: money(item.amountMinor, item.currency), category: item.category,
        kind: item.kind as PlanningOccurrence["kind"], status, recurrence: frequency(item.recurrence),
        includedInForecast: status === "planned", policy: "additional_commitment" });
    }
  }
  // The existing monthly reconciler is authoritative: do not build a second category priority policy.
  for (const row of plan.recurringExpenses.filter(r => r.active)) {
    const winning = plan.costs.some(c => c.source === "recurring" && c.category === canonicalCategory(row.category) && c.amount.currency === row.amount.currency);
    for (const date of recurrenceDates(row.nextDate, row.frequency, undefined, from, to)) {
      add({ sourceId: row.id, source: "recurring", name: row.description || row.category, date,
        amount: row.amount, category: canonicalCategory(row.category), kind: "expense", status: "planned", recurrence: row.frequency,
        includedInForecast: winning, policy: winning ? "winning_recurring_replaces_monthly_estimate" : "covered_by_manual_monthly_envelope" });
    }
  }
  for (const cost of plan.costs) {
    if (cost.source !== "recurring") {
      monthlyAllocations.push(...monthAllocations({ id: `cost:${cost.category}:${cost.amount.currency}`,
        source: cost.source, category: cost.category, kind: "expense", amount: cost.amount }, from, to));
    }
  }
  // Dated manual lines remain monthly envelopes, not extra one-off debits.
  for (const line of plan.lines) {
    if (line.upcomingDate && line.upcomingDate >= from && line.upcomingDate <= to) {
      add({ sourceId: line.id, source: "line", name: line.description || line.category,
        date: line.upcomingDate, amount: line.amount, category: line.category,
        kind: line.type === "savings" ? "savings" : "expense", status: "planned", recurrence: "none",
        includedInForecast: false, policy: "informational_date_covered_by_monthly_envelope" });
    }
  }
  // The existing snapshot always emits goalSavings (optional only for legacy clients).
  for (const row of plan.goalSavings!) {
    monthlyAllocations.push(...monthAllocations({ id: `savings:${row.currency}`, source: "goal_savings",
      category: "savings", kind: "savings", amount: row.effectiveSavings }, from, to));
  }
  const authorizedSchedules = joinedSchedules.filter(r => r.link.permissions.allowance).map(r => r.schedule);
  const postedMap = new Map(postedRows.map(r => [`${r.scheduleId}:${r.occurrence.scheduledDate}`, r.occurrence]));
  const visibleAllowanceDates = new Set<string>();
  // Posted credits remain in this student's opening even after family consent changes.
  // Use their own persisted posting amounts privately for coverage, without exposing revoked schedules.
  const ownerPosted = postedRows.filter(r => r.occurrence.status === "posted").map(r => r.occurrence);
  const ownerPostedDates = new Set(ownerPosted.map(r => `${r.scheduledDate}:${r.currency}`));
  for (const schedule of authorizedSchedules) {
    const recurrence = schedule.kind === "oneTime" ? "none" : frequency(schedule.frequency!);
    const dates = new Set(schedule.status === "active" ? allowanceForecastDates(schedule, from, to) : []);
    // Include persisted history even when a one-time schedule has become completed.
    for (const { occurrence, scheduleId } of postedRows) if (scheduleId === schedule.id) dates.add(occurrence.scheduledDate);
    for (const date of [...dates].sort()) {
      const persisted = postedMap.get(`${schedule.id}:${date}`);
      // nextPayment is the schedule's current cursor; old failed/persisted rows remain visible.
      if (!persisted && date < schedule.nextPayment) continue;
      const status = persisted?.status === "posted" ? "posted" : persisted?.status === "cancelled" || schedule.status !== "active" ? "cancelled" : "planned";
      if (status === "planned" || status === "posted") visibleAllowanceDates.add(`${date}:${persisted?.currency ?? schedule.currency}`);
      add({ sourceId: schedule.id, source: "allowance", name: "Scheduled parent allowance (simulated estimate)", date,
        amount: money(persisted?.amountMinor ?? schedule.amountMinor, persisted?.currency ?? schedule.currency),
        category: "parent_allowance", kind: "income", status, recurrence, includedInForecast: status === "planned",
        policy: status === "posted" ? "already_in_available_opening" : "inclusive_parent_allowance_envelope" });
    }
  }
  const allowanceManual = new Map<Currency, bigint>();
  // Aggregate undated annual numerators per currency before rounding, as in existing monthly planning.
  const undatedIncome = new Map<Currency, bigint>();
  for (const row of incomeRows) {
    const entry = row.data as ProfileIncome;
    if (!entry.active) continue;
    const numerator = monthlyNumerator(entry.amount, entry.frequency);
    if (entry.source === "parent_allowance" && numerator !== null) {
      allowanceManual.set(entry.amount.currency, (allowanceManual.get(entry.amount.currency) ?? 0n) + numerator);
    } else if (!entry.expectedDate && numerator !== null) {
      undatedIncome.set(entry.amount.currency, (undatedIncome.get(entry.amount.currency) ?? 0n) + numerator);
    }
    if (!entry.expectedDate) continue;
    for (const date of recurrenceDates(entry.expectedDate, frequency(entry.frequency), undefined, from, to)) {
      const allowanceCovered = entry.source === "parent_allowance" &&
        (visibleAllowanceDates.has(`${date}:${entry.amount.currency}`) || ownerPostedDates.has(`${date}:${entry.amount.currency}`));
      const envelope = entry.source === "parent_allowance" && numerator !== null;
      add({ sourceId: row.id, source: "income", name: entry.description || entry.source, date, amount: entry.amount,
        category: entry.source, kind: "income", status: "planned", recurrence: frequency(entry.frequency),
        includedInForecast: !allowanceCovered && !envelope,
        policy: allowanceCovered ? "covered_by_authorized_allowance_occurrence" : envelope ? "covered_by_allowance_monthly_envelope" : "dated_profile_income" });
    }
  }
  for (const [currency, numerator] of undatedIncome) {
    monthlyAllocations.push(...monthAllocations({ id: `income:${currency}`, source: "income", category: "income",
      kind: "income", amount: money(halfUp(numerator, 12n), currency) }, from, to));
  }
  for (const [currency, numerator] of allowanceManual) {
    const allocations = monthAllocations({ id: `allowance:${currency}`, source: "allowance_envelope",
      category: "parent_allowance", kind: "income", amount: money(halfUp(numerator, 12n), currency) }, from, to);
    // Schedules are counted directly. Only residual manual envelope is added, never the full manual plus schedules.
    const scheduledOrPosted = occurrences.filter(o => o.source === "allowance" && o.amount.currency === currency && o.status === "planned")
      .reduce((n, o) => n + BigInt(o.amount.minor), 0n) +
      ownerPosted.filter(o => o.currency === currency).reduce((n, o) => n + o.amountMinor, 0n);
    let covered = scheduledOrPosted;
    for (const allocation of allocations) {
      const original = BigInt(allocation.allocatedAmount.minor);
      const reduction = covered < original ? covered : original;
      covered -= reduction;
      monthlyAllocations.push({ ...allocation, allocatedAmount: money(original - reduction, currency),
        policy: "residual_manual_allowance_envelope_after_scheduled_and_posted_coverage_chronological" });
    }
  }
  return { from, to, estimate: true, policy: FORECAST_POLICY, assumptions: [...FORECAST_ASSUMPTIONS], assumptionCodes: [...FORECAST_ASSUMPTION_CODES],
    occurrences: occurrences.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    monthlyAllocations: monthlyAllocations.sort((a, b) => a.month.localeCompare(b.month) || a.id.localeCompare(b.id)) };
}
export async function planningCalendar(userId: string, from: string, to: string): Promise<PlanningCalendar> {
  assertRange(from, to);
  return db.transaction(async tx => {
    const plan = await financialPlanSnapshot(userId, tx);
    return calendarSnapshot(tx, userId, from, to, plan);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
// All reads, including the monthly plan's goals, reserve holdings, budgets and allowance
// projection, use the caller's snapshot. Exposed internally for controlled concurrency tests.
export async function forecastSnapshot(reader: Reader, userId: string, today: string, through: string): Promise<PlanningForecast> {
  assertRange(today, through);
  const plan = await financialPlanSnapshot(userId, reader);
  const calendar = await calendarSnapshot(reader, userId, today, through, plan);
  const accounts = await reader.select().from(financeAccounts).where(eq(financeAccounts.userId, userId));
  const opening = accounts.filter(a => a.type !== "goal_reserve").map(a => money(a.balanceMinor, a.currency));
  return { asOf: today, through, estimate: true, label: "Estimated / Projected",
    policy: calendar.policy, assumptions: calendar.assumptions, assumptionCodes: calendar.assumptionCodes,
    currencies: forecastTotals(opening, calendar.occurrences, calendar.monthlyAllocations),
    occurrences: calendar.occurrences, monthlyAllocations: calendar.monthlyAllocations };
}
export async function planningForecast(userId: string, today: string, through: string): Promise<PlanningForecast> {
  assertRange(today, through);
  return db.transaction(tx => forecastSnapshot(tx, userId, today, through),
    { isolationLevel: "repeatable read", accessMode: "read only" });
}