import { eq } from "drizzle-orm";
import { db, financeAccounts } from "@workspace/db";
import {
  CompareAffordabilityBody,
  type AffordabilityRequest, type AffordabilityComparison, type AffordabilityScenario,
  type AffordabilityMessageCode, type AffordabilityCashComparison, type ForecastCurrency, type Amount,
} from "@workspace/api-zod";
import { ApiError } from "./http-errors";
import { assertRange, validScheduledDate } from "./forecast-math";
import { forecastSnapshot } from "./forecast";
import { financialPlanSnapshot } from "../routes/planning";
import { ownerGoals } from "./goals";
import { canonicalCategory, safeMinor } from "./planning";

type Reader = Pick<typeof db, "select">;
type Plan = Awaited<ReturnType<typeof financialPlanSnapshot>>;
type Goals = Awaited<ReturnType<typeof ownerGoals>>;
type Account = typeof financeAccounts.$inferSelect;

export const AFFORDABILITY_ASSUMPTION_CODES: AffordabilityMessageCode[] = [
  "today_dated_income_may_already_be_in_opening", "utc_inclusive_horizon",
  "recurrence_and_scholarship_policy", "reconciled_expense_sources",
  "constant_housing_commute_and_savings", "exact_monthly_allocations_not_cash_dates",
  "inclusive_allowance_envelope", "inactive_occurrences_excluded",
  "independent_additional_purchase", "current_cash_not_purchase_date_cash",
  "future_projection_not_guaranteed", "reserves_protected_no_fx",
  "budgets_comparison_only", "goal_timeline_not_calculated",
];

function keys(value: object, allowed: readonly string[]) {
  if (Object.keys(value).some(k => !allowed.includes(k))) throw new ApiError("BAD_REQUEST");
}

export function affordabilityInput(value: unknown, now: Date): AffordabilityRequest {
  const parsed = CompareAffordabilityBody.safeParse(value);
  if (!parsed.success) throw new ApiError("BAD_REQUEST");
  const raw = value as AffordabilityRequest;
  keys(raw, ["through", "alternatives"]);
  const today = now.toISOString().slice(0, 10);
  assertRange(today, parsed.data.through);
  parsed.data.alternatives.forEach((alternative, index) => {
    keys(raw.alternatives[index]!, ["item", "price", "category", "purchaseDate", "accountId"]);
    keys(raw.alternatives[index]!.price, ["minor", "currency"]);
    alternative.item = alternative.item.trim();
    const purchaseDate = alternative.purchaseDate ?? today;
    if (!alternative.item || !Number.isSafeInteger(alternative.price.minor) ||
      !validScheduledDate(purchaseDate) || purchaseDate < today || purchaseDate > parsed.data.through ||
      alternative.category && canonicalCategory(alternative.category) === "savings") throw new ApiError("BAD_REQUEST");
  });
  return parsed.data;
}

const amount = (minor: bigint, currency: Amount["currency"]): Amount => ({ minor: safeMinor(minor), currency });
const shortfall = (minor: bigint, currency: Amount["currency"]) => amount(minor < 0n ? -minor : 0n, currency);

export function cashComparison(before: Amount, price: Amount): AffordabilityCashComparison {
  if (before.currency !== price.currency) throw new ApiError("BAD_REQUEST");
  const after = BigInt(before.minor) - BigInt(price.minor);
  return { before, after: amount(after, price.currency), shortfall: shortfall(after, price.currency) };
}

export function emptyAffordabilityBaseline(currency: Amount["currency"]): ForecastCurrency {
  return { currency, availableOpening: amount(0n, currency), expectedIncome: amount(0n, currency),
    upcomingExpenses: amount(0n, currency), recurringExpenses: amount(0n, currency),
    plannedSavings: amount(0n, currency), projectedBalance: amount(0n, currency) };
}

// Pure comparison: every alternative starts from the same immutable currency baseline.
export function affordabilityScenario(input: AffordabilityRequest["alternatives"][number], index: number,
  today: string, baseline: ForecastCurrency, plan: Pick<Plan, "budgets" | "goalSavings">,
  goals: Goals, accounts: readonly Account[]): AffordabilityScenario {
  const { price } = input, currency = price.currency;
  if (baseline.currency !== currency) throw new ApiError("BAD_REQUEST");
  const purchaseDate = input.purchaseDate ?? today;
  const category = input.category ? canonicalCategory(input.category) : undefined;
  const currentCash = cashComparison(baseline.availableOpening, price);
  const after = BigInt(baseline.projectedBalance.minor) - BigInt(price.minor);
  const projectedAfterPurchase = amount(after, currency), projectedShortfall = shortfall(after, currency);
  const messageCodes: AffordabilityMessageCode[] = [];
  if (currentCash.shortfall.minor > 0) messageCodes.push("current_cash_shortfall");
  if (after < 0n) messageCodes.push("projected_shortfall");

  let accountComparison: AffordabilityScenario["accountComparison"] = null;
  if (input.accountId) {
    // accounts is prefiltered by owner in the same read-only snapshot.
    const account = accounts.find(a => a.id === input.accountId);
    if (!account) throw new ApiError("NOT_FOUND");
    if (!["wallet", "bank", "cash", "other"].includes(account.type) || account.currency !== currency) throw new ApiError("BAD_REQUEST");
    accountComparison = { accountId: account.id, cash: cashComparison(amount(account.balanceMinor, currency), price) };
    if (accountComparison.cash.shortfall.minor > 0) messageCodes.push("account_cash_shortfall");
  }

  const matches = category ? plan.budgets.filter(b => canonicalCategory(b.category) === category && b.limit.currency === currency) : [];
  const budgetAssessment = !category ? "category_not_provided" : matches.length ? "current_periods" : "not_configured";
  messageCodes.push(!category ? "budget_category_not_provided" : matches.length ? "budget_comparison_available" : "budget_not_configured");
  const budgets: AffordabilityScenario["budgets"] = matches.map(budget => {
    const inPeriod = purchaseDate >= budget.periodStart && purchaseDate <= budget.periodEnd;
    const remaining = BigInt(budget.remaining.minor) - BigInt(price.minor);
    return { period: budget.period, periodStart: budget.periodStart, periodEnd: budget.periodEnd,
      category: budget.category, limit: budget.limit, actualSpent: budget.actualSpent,
      remainingBefore: budget.remaining, remainingAfter: inPeriod ? amount(remaining, currency) : null,
      shortfallAfter: inPeriod ? shortfall(remaining, currency) : null,
      assessment: inPeriod ? "compared" : "outside_current_period" };
  });
  if (budgets.some(b => b.assessment === "outside_current_period")) messageCodes.push("budget_outside_current_period");
  const activeGoals = goals.goals.filter(g => g.status === "active" && g.currency === currency);
  const savings = plan.goalSavings?.find(g => g.currency === currency);
  const potentialPressure = activeGoals.length > 0 && after < 0n;
  if (potentialPressure) messageCodes.push("goal_pressure_possible");
  return { index, item: input.item, price, ...(category ? { category } : {}), purchaseDate, baseline,
    currentCash, projectedAfterPurchase, projectedShortfall, accountComparison, budgetAssessment, budgets,
    goalContext: {
      goals: activeGoals.map(g => ({ id: g.id, name: g.name, target: amount(BigInt(g.target.minor), currency),
        current: amount(BigInt(g.current.minor), currency), remaining: amount(BigInt(g.remaining.minor), currency),
        targetDate: g.targetDate, requiredContributionMonthly: g.requiredContributionMonthly === null ? null :
          amount(BigInt(g.requiredContributionMonthly.minor), currency),
        baselineEstimatedCompletion: g.estimatedCompletion })),
      protectedReserves: amount(BigInt(goals.totals.find(g => g.currency === currency)?.reserved.minor ?? 0), currency),
      requiredMonthly: savings?.goalRequired ?? amount(0n, currency),
      effectiveMonthlySavings: savings?.effectiveSavings ?? amount(0n, currency),
      plannedSavingsInHorizon: baseline.plannedSavings,
      projectedHeadroomAfter: projectedAfterPurchase, projectedShortfallAfter: projectedShortfall,
      potentialPressure, timelineImpact: "not_calculated",
    }, messageCodes };
}

// Exported reader adapter permits an actual concurrent MVCC regression test.
export async function affordabilitySnapshot(reader: Reader, userId: string, input: AffordabilityRequest,
  now: Date): Promise<AffordabilityComparison> {
  const today = now.toISOString().slice(0, 10);
  const goals = await ownerGoals(userId, reader, now, "BAD_REQUEST");
  const plan = await financialPlanSnapshot(userId, reader, now, goals);
  const forecast = await forecastSnapshot(reader, userId, today, input.through, { now, plan });
  const accounts = await reader.select().from(financeAccounts).where(eq(financeAccounts.userId, userId));
  return { asOf: today, through: input.through, estimate: true,
    comparisonPolicy: "independent_additional_purchase",
    assumptionCodes: [...new Set([...forecast.assumptionCodes, ...AFFORDABILITY_ASSUMPTION_CODES])],
    sourceAssumptions: forecast.assumptions,
    scenarios: input.alternatives.map((alternative, index) => affordabilityScenario(alternative, index, today,
      forecast.currencies.find(c => c.currency === alternative.price.currency) ?? emptyAffordabilityBaseline(alternative.price.currency),
      plan, goals, accounts)),
  };
}

export async function compareAffordability(userId: string, value: unknown, now = new Date()) {
  const input = affordabilityInput(value, now);
  return db.transaction(reader => affordabilitySnapshot(reader, userId, input, now),
    { isolationLevel: "repeatable read", accessMode: "read only" });
}