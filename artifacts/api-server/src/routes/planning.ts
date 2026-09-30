import { Router, type IRouter, type Request } from "express";
import { and, eq, gte, lt } from "drizzle-orm";
import { db, users, incomes, scholarships, planningBudgets, planningRecurring, planningLines, planningSettings, financeTransactions } from "@workspace/db";
import {
  GetFinancialPlanResponse, CreateBudgetBody, CreateBudgetResponse, UpdateBudgetBody, UpdateBudgetParams, UpdateBudgetResponse, DeleteBudgetParams,
  CreateRecurringExpenseBody, CreateRecurringExpenseResponse, UpdateRecurringExpenseBody, UpdateRecurringExpenseParams, UpdateRecurringExpenseResponse, DeleteRecurringExpenseParams,
  CreatePlanLineBody, CreatePlanLineResponse, UpdatePlanLineBody, UpdatePlanLineParams, UpdatePlanLineResponse, DeletePlanLineParams,
  SavePlanCommuteOverrideBody, SavePlanCommuteOverrideResponse,
} from "@workspace/api-zod";
import { requireRole, type TrustedPrincipal } from "../lib/authorization";
import { ApiError } from "../lib/http-errors";
import { canonicalCategory, halfUp, isBudgetDebit, monthlyNumerator, periodBounds, POLICY, resolveCosts, safeMinor, validDate, type Amount, type Currency } from "../lib/planning";

const router: IRouter = Router();
const own = (req: Request) => requireRole(req.res?.locals.principal as TrustedPrincipal | undefined, "student").userId;
function parse<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ApiError("BAD_REQUEST");
  const output = parsed.data;
  if (data && typeof data === "object" && !Array.isArray(data) && output && typeof output === "object") {
    if (Object.keys(data).some(key => !Object.hasOwn(output, key))) throw new ApiError("BAD_REQUEST");
  }
  return output as T;
}
function amount(minor: bigint, currency: string): Amount {
  return { minor: safeMinor(minor), currency: currency as Currency };
}
function budgetDto(row: typeof planningBudgets.$inferSelect, spent: bigint, now = new Date()) {
  const bounds = periodBounds(row.period as "weekly" | "monthly", now);
  return { id: row.id, category: row.category, period: row.period,
    limit: amount(row.limitMinor, row.currency), actualSpent: amount(spent, row.currency),
    remaining: amount(row.limitMinor - spent, row.currency),
    periodStart: bounds.periodStart, periodEnd: bounds.periodEnd };
}
function recurringDto(row: typeof planningRecurring.$inferSelect) {
  return { id: row.id, category: row.category, amount: amount(row.amountMinor, row.currency),
    frequency: row.frequency, nextDate: row.nextDate, description: row.description, active: row.active };
}
function lineDto(row: typeof planningLines.$inferSelect) {
  return { id: row.id, category: row.category, type: row.type, amount: amount(row.amountMinor, row.currency),
    description: row.description, ...(row.upcomingDate ? { upcomingDate: row.upcomingDate } : {}) };
}
function assertExpenseCategory(category: string) {
  if (canonicalCategory(category) === "savings") throw new ApiError("BAD_REQUEST");
}
function isUnique(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("code" in error && error.code === "23505") return true;
  return "cause" in error && error.cause !== error && isUnique(error.cause);
}

async function liveBudget(row: typeof planningBudgets.$inferSelect, now = new Date()) {
  const { start, end } = periodBounds(row.period as "weekly" | "monthly", now);
  const transactions = await db.select({
    category: financeTransactions.category, direction: financeTransactions.direction,
    kind: financeTransactions.kind, serviceId: financeTransactions.serviceId,
    amountMinor: financeTransactions.amountMinor,
  }).from(financeTransactions).where(and(
    eq(financeTransactions.userId, row.userId), eq(financeTransactions.currency, row.currency),
    gte(financeTransactions.createdAt, start), lt(financeTransactions.createdAt, end),
  ));
  const spent = transactions.reduce((n, tx) => n + (
    isBudgetDebit(tx) && canonicalCategory(tx.category) === row.category ? tx.amountMinor : 0n
  ), 0n);
  return budgetDto(row, spent, now);
}
router.get("/planning", async (req, res): Promise<void> => {
  const userId = own(req);
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new ApiError("UNAUTHENTICATED");
  const [budgetRows, recurringRows, lineRows, incomeRows, scholarshipRows, settingsRows] = await Promise.all([
    db.select().from(planningBudgets).where(eq(planningBudgets.userId, userId)),
    db.select().from(planningRecurring).where(eq(planningRecurring.userId, userId)),
    db.select().from(planningLines).where(eq(planningLines.userId, userId)),
    db.select().from(incomes).where(eq(incomes.userId, userId)),
    db.select().from(scholarships).where(eq(scholarships.userId, userId)),
    db.select().from(planningSettings).where(eq(planningSettings.userId, userId)),
  ]);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const setting = settingsRows[0];
  const commuteOverride = setting?.commuteOverrideEnabled ? {
    enabled: true, amount: amount(setting.commuteOverrideMinor!, setting.commuteOverrideCurrency!),
  } : { enabled: false };
  const residence = user.residence as undefined | {
    type: string; monthlyRent?: Amount; studentShare?: Amount; utilities?: Amount; internet?: Amount
  };
  const commute = user.commute as undefined | { monthlyEstimate: Amount };
  const profileCosts: { category: string; source: "profile" | "override"; amount: Amount }[] = [];
  const rent = residence?.studentShare ?? residence?.monthlyRent;
  if (rent) profileCosts.push({ category: "housing", source: "profile", amount: rent });
  if (residence?.utilities) profileCosts.push({ category: "utilities", source: "profile", amount: residence.utilities });
  if (residence?.internet) profileCosts.push({ category: "internet", source: "profile", amount: residence.internet });
  if (commuteOverride.enabled && commuteOverride.amount) profileCosts.push({ category: "transportation", source: "override", amount: commuteOverride.amount });
  else if (commute?.monthlyEstimate) profileCosts.push({ category: "transportation", source: "profile", amount: commute.monthlyEstimate });

  const activeRecurring = recurringRows.filter(r => r.active);
  const costs = resolveCosts(profileCosts, activeRecurring.map(r => ({
    category: r.category, source: "recurring" as const, amount: amount(r.amountMinor, r.currency),
    numerator: monthlyNumerator(amount(r.amountMinor, r.currency), r.frequency) ?? 0n,
  })), lineRows.filter(r => r.type !== "savings").map(r => ({
    category: r.category, source: "manual" as const, amount: amount(r.amountMinor, r.currency),
  })));

  type IncomeRecord = { id: string; source: string; amount: Amount; frequency: string; stability: string; active: boolean; expectedDate?: string; description?: string };
  const allIncome = incomeRows.map(r => ({ ...(r.data as Omit<IncomeRecord, "id">), id: r.id }));
  const income: { id: string; source: string; monthlyEstimate: Amount; stability: string }[] = [];
  const irregularIncome: IncomeRecord[] = [];
  const incomeNumerators = new Map<Currency, bigint>();
  const upcoming: { id: string; source: "income" | "recurring" | "line"; description: string; date: string; amount: Amount }[] = [];
  for (const entry of allIncome) {
    if (!entry.active) continue;
    const numerator = monthlyNumerator(entry.amount, entry.frequency);
    if (numerator === null) {
      irregularIncome.push(entry);
    } else {
      incomeNumerators.set(entry.amount.currency, (incomeNumerators.get(entry.amount.currency) ?? 0n) + numerator);
      income.push({ id: entry.id, source: entry.source, stability: entry.stability,
        monthlyEstimate: { currency: entry.amount.currency, minor: safeMinor(halfUp(numerator, 12n)) } });
    }
    if (entry.expectedDate && entry.expectedDate >= today && validDate(entry.expectedDate)) upcoming.push({
      id: entry.id, source: "income", description: entry.description || entry.source,
      date: entry.expectedDate, amount: entry.amount,
    });
  }
  for (const entry of activeRecurring) if (entry.nextDate >= today) upcoming.push({
    id: entry.id, source: "recurring", description: entry.description || entry.category,
    date: entry.nextDate, amount: amount(entry.amountMinor, entry.currency),
  });
  for (const entry of lineRows) if (entry.upcomingDate && entry.upcomingDate >= today) upcoming.push({
    id: entry.id, source: "line", description: entry.description || entry.category,
    date: entry.upcomingDate, amount: amount(entry.amountMinor, entry.currency),
  });
  const currencies = new Set<Currency>([...incomeNumerators.keys(), ...costs.map(c => c.amount.currency),
    ...lineRows.map(r => r.currency as Currency), ...recurringRows.map(r => r.currency as Currency),
    ...budgetRows.map(r => r.currency as Currency), ...profileCosts.map(c => c.amount.currency),
    ...allIncome.filter(i => i.active).map(i => i.amount.currency)]);
  const totals = [...currencies].sort().map(currency => {
    const expected = halfUp(incomeNumerators.get(currency) ?? 0n, 12n);
    const expenses = costs.filter(c => c.amount.currency === currency).reduce((n, c) => n + BigInt(c.amount.minor), 0n);
    const savings = lineRows.filter(r => r.type === "savings" && r.currency === currency).reduce((n, r) => n + r.amountMinor, 0n);
    return { currency, expectedIncome: amount(expected, currency), plannedExpenses: amount(expenses, currency),
      plannedSavings: amount(savings, currency), projectedRemaining: amount(expected - expenses - savings, currency) };
  });
  const budgets = await Promise.all(budgetRows.map(r => liveBudget(r, now)));
  res.json(GetFinancialPlanResponse.parse({
    asOf: today, estimate: true, policy: POLICY, totals, costs, income, irregularIncome,
    irregularCount: irregularIncome.length,
    upcoming: upcoming.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    budgets, budgetCounts: { weekly: budgetRows.filter(r => r.period === "weekly").length,
      monthly: budgetRows.filter(r => r.period === "monthly").length },
    recurringExpenses: recurringRows.map(recurringDto), lines: lineRows.map(lineDto),
    ...(user.residence ? { housing: user.residence } : {}), ...(user.commute ? { commute: user.commute } : {}),
    scholarships: scholarshipRows.map(r => ({ ...(r.data as object), id: r.id })), commuteOverride,
  }));
});

router.post("/planning/budgets", async (req, res): Promise<void> => {
  const userId = own(req);
  const input = parse(CreateBudgetBody, req.body);
  assertExpenseCategory(input.category);
  let row;
  try {
    [row] = await db.insert(planningBudgets).values({
      userId, category: canonicalCategory(input.category), period: input.period,
      currency: input.limit.currency, limitMinor: BigInt(input.limit.minor),
    }).returning();
  } catch (error) { if (isUnique(error)) throw new ApiError("CONFLICT"); throw error; }
  res.status(201).json(CreateBudgetResponse.parse(await liveBudget(row!)));
});
router.put("/planning/budgets/:id", async (req, res): Promise<void> => {
  const userId = own(req), { id } = parse(UpdateBudgetParams, req.params);
  const input = parse(UpdateBudgetBody, req.body);
  assertExpenseCategory(input.category);
  let row;
  try {
    [row] = await db.update(planningBudgets).set({
      category: canonicalCategory(input.category), period: input.period,
      currency: input.limit.currency, limitMinor: BigInt(input.limit.minor),
    }).where(and(eq(planningBudgets.id, id), eq(planningBudgets.userId, userId))).returning();
  } catch (error) { if (isUnique(error)) throw new ApiError("CONFLICT"); throw error; }
  if (!row) throw new ApiError("NOT_FOUND");
  res.json(UpdateBudgetResponse.parse(await liveBudget(row)));
});
router.delete("/planning/budgets/:id", async (req, res): Promise<void> => {
  const userId = own(req), { id } = parse(DeleteBudgetParams, req.params);
  const [deleted] = await db.delete(planningBudgets).where(and(eq(planningBudgets.id, id), eq(planningBudgets.userId, userId))).returning({ id: planningBudgets.id });
  if (!deleted) throw new ApiError("NOT_FOUND");
  res.sendStatus(204);
});

router.post("/planning/recurring-expenses", async (req, res): Promise<void> => {
  const userId = own(req), input = parse(CreateRecurringExpenseBody, req.body);
  if (!validDate(input.nextDate)) throw new ApiError("BAD_REQUEST");
  assertExpenseCategory(input.category);
  const [row] = await db.insert(planningRecurring).values({
    userId, category: canonicalCategory(input.category), currency: input.amount.currency,
    amountMinor: BigInt(input.amount.minor), frequency: input.frequency,
    nextDate: input.nextDate, description: input.description.trim(), active: input.active,
  }).returning();
  res.status(201).json(CreateRecurringExpenseResponse.parse(recurringDto(row!)));
});
router.put("/planning/recurring-expenses/:id", async (req, res): Promise<void> => {
  const userId = own(req), { id } = parse(UpdateRecurringExpenseParams, req.params);
  const input = parse(UpdateRecurringExpenseBody, req.body);
  if (!validDate(input.nextDate)) throw new ApiError("BAD_REQUEST");
  assertExpenseCategory(input.category);
  const [row] = await db.update(planningRecurring).set({
    category: canonicalCategory(input.category), currency: input.amount.currency,
    amountMinor: BigInt(input.amount.minor), frequency: input.frequency,
    nextDate: input.nextDate, description: input.description.trim(), active: input.active,
  }).where(and(eq(planningRecurring.id, id), eq(planningRecurring.userId, userId))).returning();
  if (!row) throw new ApiError("NOT_FOUND");
  res.json(UpdateRecurringExpenseResponse.parse(recurringDto(row)));
});
router.delete("/planning/recurring-expenses/:id", async (req, res): Promise<void> => {
  const userId = own(req), { id } = parse(DeleteRecurringExpenseParams, req.params);
  const [row] = await db.delete(planningRecurring).where(and(eq(planningRecurring.id, id), eq(planningRecurring.userId, userId))).returning({ id: planningRecurring.id });
  if (!row) throw new ApiError("NOT_FOUND");
  res.sendStatus(204);
});
function checkLine(input: { category: string; type: string; upcomingDate?: string }) {
  if (input.upcomingDate && !validDate(input.upcomingDate)) throw new ApiError("BAD_REQUEST");
  if ((input.type === "savings") !== (canonicalCategory(input.category) === "savings")) throw new ApiError("BAD_REQUEST");
}
router.post("/planning/lines", async (req, res): Promise<void> => {
  const userId = own(req), input = parse(CreatePlanLineBody, req.body);
  checkLine(input);
  const [row] = await db.insert(planningLines).values({
    userId, category: canonicalCategory(input.category), type: input.type,
    currency: input.amount.currency, amountMinor: BigInt(input.amount.minor),
    description: input.description.trim(), upcomingDate: input.upcomingDate ?? null,
  }).returning();
  res.status(201).json(CreatePlanLineResponse.parse(lineDto(row!)));
});
router.put("/planning/lines/:id", async (req, res): Promise<void> => {
  const userId = own(req), { id } = parse(UpdatePlanLineParams, req.params);
  const input = parse(UpdatePlanLineBody, req.body);
  checkLine(input);
  const [row] = await db.update(planningLines).set({
    category: canonicalCategory(input.category), type: input.type,
    currency: input.amount.currency, amountMinor: BigInt(input.amount.minor),
    description: input.description.trim(), upcomingDate: input.upcomingDate ?? null,
  }).where(and(eq(planningLines.id, id), eq(planningLines.userId, userId))).returning();
  if (!row) throw new ApiError("NOT_FOUND");
  res.json(UpdatePlanLineResponse.parse(lineDto(row)));
});
router.delete("/planning/lines/:id", async (req, res): Promise<void> => {
  const userId = own(req), { id } = parse(DeletePlanLineParams, req.params);
  const [row] = await db.delete(planningLines).where(and(eq(planningLines.id, id), eq(planningLines.userId, userId))).returning({ id: planningLines.id });
  if (!row) throw new ApiError("NOT_FOUND");
  res.sendStatus(204);
});
router.put("/planning/commute-override", async (req, res): Promise<void> => {
  const userId = own(req), input = parse(SavePlanCommuteOverrideBody, req.body);
  if (input.enabled !== !!input.amount || !input.enabled && Object.hasOwn(req.body, "amount")) throw new ApiError("BAD_REQUEST");
  const data = { commuteOverrideEnabled: input.enabled, commuteOverrideMinor: input.amount ? BigInt(input.amount.minor) : null,
    commuteOverrideCurrency: input.amount?.currency ?? null };
  await db.insert(planningSettings).values({ userId, ...data }).onConflictDoUpdate({ target: planningSettings.userId, set: data });
  res.json(SavePlanCommuteOverrideResponse.parse(input));
});
export default router;