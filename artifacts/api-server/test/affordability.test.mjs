import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { build } from "esbuild";

const compiled = await build({ stdin: { contents: `
  export * from "./src/lib/affordability.ts";
  export { ownerGoals } from "./src/lib/goals.ts";
  export { checked } from "./src/lib/finance-money.ts";
  export { forecastSnapshot } from "./src/lib/forecast.ts";
  export { default as router } from "./src/routes/affordability.ts";
  export * from "@workspace/db";
  export { eq, inArray } from "drizzle-orm";`,
  resolveDir: new URL("..", import.meta.url).pathname, loader: "ts" },
  bundle: true, platform: "node", format: "cjs", write: false, external: ["*.node"] });
const module = { exports: {} };
new Function("require", "module", "exports", compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const { affordabilityInput, affordabilityScenario, emptyAffordabilityBaseline, cashComparison,
  compareAffordability, ownerGoals, checked, forecastSnapshot, router, db, pool, users, financeAccounts, financeTransactions,
  savingsGoals, incomes, planningBudgets, planningLines, planningRecurring, scheduledItems, eq, inArray } = module.exports;
after(() => pool.end());
const amount = (minor, currency = "ILS") => ({ minor, currency });
const now = new Date("2090-06-15T23:59:59.999Z"), today = "2090-06-15", through = "2090-06-30";
const alternative = { item: "Book", price: amount(120) };
const body = { through, alternatives: [alternative] };
const emptyGoals = { goals: [], totals: [] }, emptyPlan = { budgets: [], goalSavings: [] };

test("affordability strict nested input, positive safe money, IDs and UTC inclusive bounds", () => {
  const valid = affordabilityInput({ ...body, alternatives: [{ ...alternative, item: " Book " }] }, now);
  assert.equal(valid.alternatives[0].item, "Book");
  for (const invalid of [
    null, {}, { ...body, ownerId: randomUUID() }, { ...body, alternatives: [] },
    { ...body, alternatives: Array(5).fill(alternative) }, { ...body, through: "2090-06-14" },
    { ...body, through: "2091-06-16" }, { ...body, through: "2090-02-30" },
    ...[{ item: " " }, { item: "x".repeat(121) }, { accountId: "bad" }, { category: "savings" },
      { purchaseDate: "2090-06-14" }, { purchaseDate: "2090-07-01" }, { purchaseDate: "2090-06-15T12:00:00Z" },
      { purchaseDate: "2090-02-30" }, { userId: randomUUID() }, { price: { ...amount(1), userId: randomUUID() } },
      { price: amount(0) }, { price: amount(-1) }, { price: amount(1.5) },
      { price: amount(Number.MAX_SAFE_INTEGER + 1) }, { price: amount(1, "EUR") },
      { price: amount("10") }, { category: null }, { accountId: null },
    ].map(extra => ({ ...body, alternatives: [{ ...alternative, ...extra }] })),
  ]) assert.throws(() => affordabilityInput(invalid, now), { code: "BAD_REQUEST" });
  affordabilityInput({ through: "2091-06-15", alternatives: [alternative] }, now); // 366 inclusive days
  affordabilityInput({ through: today, alternatives: Array(4).fill(alternative) }, now);
});

test("signed JOD exact subtraction, absent currency, overflow and independent alternatives", () => {
  const baseline = { ...emptyAffordabilityBaseline("JOD"), availableOpening: amount(1234, "JOD"),
    projectedBalance: amount(-11, "JOD"), plannedSavings: amount(17, "JOD") };
  const a = { item: "A", price: amount(1235, "JOD") }, b = { item: "B", price: amount(1, "JOD") };
  const run = (input, index) => affordabilityScenario(input, index, today, baseline, emptyPlan, emptyGoals, []);
  const forward = [a, b].map(run), reverse = [b, a].map(run);
  assert.equal(forward[0].currentCash.after.minor, -1);
  assert.equal(forward[0].projectedAfterPurchase.minor, -1246);
  assert.equal(forward[0].goalContext.plannedSavingsInHorizon.minor, 17);
  assert.deepEqual(forward.map(({ index, ...r }) => r), reverse.reverse().map(({ index, ...r }) => r));
  assert.equal(baseline.projectedBalance.minor, -11);
  const absent = affordabilityScenario(a, 0, today, emptyAffordabilityBaseline("JOD"), emptyPlan, emptyGoals, []);
  assert.equal(absent.projectedAfterPurchase.minor, -1235);
  assert.throws(() => affordabilityScenario(b, 0, today,
    { ...baseline, projectedBalance: amount(-Number.MAX_SAFE_INTEGER, "JOD") }, emptyPlan, emptyGoals, []), { code: "BAD_REQUEST" });
  assert.throws(() => cashComparison(amount(100, "USD"), amount(1)), { code: "BAD_REQUEST" });
  assert.equal(cashComparison(amount(Number.MAX_SAFE_INTEGER), amount(1)).after.minor, Number.MAX_SAFE_INTEGER - 1);
});

test("student authorization occurs before input parsing and database reads", async () => {
  const handler = router.stack.find(l => l.route?.path === "/planning/affordability").route.stack[0].handle;
  for (const [principal, code] of [[undefined, "UNAUTHENTICATED"], [{ userId: randomUUID(), roles: ["parent"] }, "FORBIDDEN"],
    [{ userId: randomUUID(), roles: ["admin"] }, "FORBIDDEN"]]) {
    await assert.rejects(handler({ body: null }, { locals: { principal } }), { code });
  }
});

test("affordability aggregate overflow is 400 while legacy goal and money boundaries retain 409", {
  skip: !process.env.DATABASE_URL,
}, async () => {
  let owner;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  assert.throws(() => checked(max + 1n), { code: "CONFLICT", status: 409 });
  try {
    const [user] = await db.insert(users).values({ name: "Aggregate overflow test",
      email: `${randomUUID()}@example.invalid`, role: "student", passwordHash: "synthetic-not-login" }).returning();
    owner = user.id;
    await db.insert(financeAccounts).values([
      { userId: owner, type: "wallet", name: "Maximum valid balance", currency: "ILS", balanceMinor: max },
      { userId: owner, type: "goal_reserve", name: "Valid reserve", currency: "ILS", balanceMinor: 1n },
    ]);
    const before = await db.select().from(financeAccounts).where(eq(financeAccounts.userId, owner));
    await assert.rejects(ownerGoals(owner), { code: "CONFLICT", status: 409 });
    await assert.rejects(compareAffordability(owner, body, now), { code: "BAD_REQUEST", status: 400 });
    assert.deepEqual(await db.select().from(financeAccounts).where(eq(financeAccounts.userId, owner)), before);
    assert.deepEqual(await db.select().from(financeTransactions).where(eq(financeTransactions.userId, owner)), []);
  } finally {
    if (owner) {
      await db.delete(financeAccounts).where(eq(financeAccounts.userId, owner));
      await db.delete(users).where(eq(users.id, owner));
    }
  }
});

test("real owner snapshot: reconciled baseline, current cash vs future income, budgets/goals, no writes or foreign leaks", {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const ids = [], marker = randomUUID();
  const originalTransaction = db.transaction.bind(db);
  try {
    for (let i = 0; i < 2; i++) {
      const [user] = await db.insert(users).values({ name: "Affordability test", email: `${marker}-${i}@example.invalid`,
        role: "student", passwordHash: "synthetic-not-login" }).returning();
      ids.push(user.id);
    }
    const [owner, other] = ids;
    await db.update(users).set({
      residence: { type: "shared", city: "Test", studentShare: amount(100), monthlyRent: amount(300), utilities: amount(20) },
      commute: { homeCity: "Test", method: "bus", tripsPerWeek: 1, costPerTrip: amount(1), roundTrip: true, monthlyEstimate: amount(30) },
    }).where(eq(users.id, owner));
    const accounts = await db.insert(financeAccounts).values([
      { userId: owner, type: "wallet", name: "Small", currency: "ILS", balanceMinor: 50n },
      { userId: owner, type: "bank", name: "Other ordinary", currency: "ILS", balanceMinor: 150n },
      { userId: owner, type: "wallet", name: "JOD", currency: "JOD", balanceMinor: 1234n },
      { userId: owner, type: "goal_reserve", name: "Dated reserve", currency: "ILS", balanceMinor: 100n },
      { userId: owner, type: "goal_reserve", name: "Undated reserve", currency: "ILS", balanceMinor: 0n },
      { userId: owner, type: "goal_reserve", name: "Archived reserve", currency: "ILS", balanceMinor: 70n },
      { userId: other, type: "wallet", name: "Secret", currency: "ILS", balanceMinor: 99999n },
      { userId: other, type: "goal_reserve", name: "Secret reserve", currency: "ILS", balanceMinor: 2n },
    ]).returning();
    const goalRows = await db.insert(savingsGoals).values([
      { userId: owner, reserveAccountId: accounts[3].id, name: "Laptop", targetMinor: 200n, currency: "ILS", targetDate: today, category: "other", priority: "medium", status: "active" },
      { userId: owner, reserveAccountId: accounts[4].id, name: "Undated", targetMinor: 300n, currency: "ILS", targetDate: null, category: "other", priority: "medium", status: "active" },
      { userId: owner, reserveAccountId: accounts[5].id, name: "Archived", targetMinor: 200n, currency: "ILS", targetDate: today, category: "other", priority: "medium", status: "archived" },
      { userId: other, reserveAccountId: accounts[7].id, name: "Foreign goal", targetMinor: 500n, currency: "ILS", category: "other", priority: "medium", status: "active" },
    ]).returning();
    await db.insert(incomes).values({ userId: owner, data: { source: "salary", active: true, amount: amount(2000),
      frequency: "one_time", stability: "stable", expectedDate: today } });
    await db.insert(planningLines).values([
      { userId: owner, category: "housing", type: "fixed", currency: "ILS", amountMinor: 60n, description: "Manual wins", upcomingDate: today },
      { userId: owner, category: "savings", type: "savings", currency: "ILS", amountMinor: 80n, description: "Savings" },
      { userId: owner, category: "university_fees", type: "fixed", currency: "ILS", amountMinor: 30n, description: "University" },
    ]);
    await db.insert(planningRecurring).values({ userId: owner, category: "housing", currency: "ILS", amountMinor: 90n,
      frequency: "monthly", nextDate: today, description: "Covered rent", active: true });
    await db.insert(scheduledItems).values({ userId: owner, name: "Campus commitment", amountMinor: 40n, currency: "ILS",
      dueDate: today, category: "books", kind: "expense", recurrence: "none", status: "planned", notes: "" });
    await db.insert(planningBudgets).values(["weekly", "monthly"].map(period => ({
      userId: owner, category: "food", period, currency: "ILS", limitMinor: period === "weekly" ? 100n : 500n,
    })));
    await db.insert(financeTransactions).values({
      userId: owner, accountId: accounts[0].id, kind: "payment", direction: "debit", category: "cafeteria",
      amountMinor: 30n, currency: "ILS", balanceAfterMinor: 50n, createdAt: new Date("2090-06-15T00:00:00Z"),
    });
    const ownedState = async () => Promise.all([financeAccounts, financeTransactions, savingsGoals, incomes,
      planningBudgets, planningLines, planningRecurring, scheduledItems].map(table =>
      db.select().from(table).where(eq(table.userId, owner))));
    const before = await ownedState();
    const input = { through, alternatives: [
      { item: "Food", price: amount(300), category: "cafeteria", accountId: accounts[0].id },
      { item: "Large", price: amount(5000), category: "food" },
      { item: "JOD precision", price: amount(1235, "JOD") },
      { item: "No USD borrowing", price: amount(1, "USD"), category: "books" },
    ] };
    const result = await compareAffordability(owner, input, now);
    const expectedForecast = await db.transaction(tx => forecastSnapshot(tx, owner, today, through, { now }),
      { isolationLevel: "repeatable read", accessMode: "read only" });
    const [small, large, jod, usd] = result.scenarios;
    assert.deepEqual(small.baseline, expectedForecast.currencies.find(c => c.currency === "ILS"));
    assert.equal(small.currentCash.before.minor, 200);
    assert.equal(small.currentCash.after.minor, -100);
    assert(small.projectedAfterPurchase.minor > 0);
    assert(small.messageCodes.includes("current_cash_shortfall"));
    assert.equal(small.accountComparison.cash.before.minor, 50);
    assert.equal(small.accountComparison.cash.after.minor, -250);
    assert.equal(small.baseline.availableOpening.minor, 200); // not selected account opening
    assert.equal(small.category, "food");
    assert.deepEqual(small.budgets.map(b => b.actualSpent.minor), [30, 30]);
    assert.deepEqual(small.budgets.map(b => b.remainingAfter.minor), [-230, 170]);
    assert.equal(small.projectedAfterPurchase.minor, small.baseline.projectedBalance.minor - 300);
    assert.deepEqual(small.baseline, large.baseline);
    assert.equal(large.goalContext.potentialPressure, true);
    assert.equal(large.goalContext.projectedShortfallAfter.minor, -large.projectedAfterPurchase.minor);
    assert.equal(small.goalContext.protectedReserves.minor, 170);
    assert.equal(small.goalContext.requiredMonthly.minor, 100);
    assert.equal(small.goalContext.effectiveMonthlySavings.minor, 100); // max, not 100+80
    assert.equal(small.goalContext.plannedSavingsInHorizon.minor, small.baseline.plannedSavings.minor);
    assert.equal(small.goalContext.goals.length, 2);
    assert.equal(small.goalContext.goals.find(g => g.name === "Undated").requiredContributionMonthly, null);
    assert(small.goalContext.goals.every(g => g.baselineEstimatedCompletion === null));
    assert.equal(small.goalContext.timelineImpact, "not_calculated");
    assert.equal(jod.projectedAfterPurchase.minor, -1);
    assert.equal(jod.budgetAssessment, "category_not_provided");
    assert.deepEqual(jod.budgets, []);
    assert.equal(usd.currentCash.before.minor, 0);
    assert.equal(usd.projectedAfterPurchase.minor, -1);
    assert.equal(usd.budgetAssessment, "not_configured");
    assert(result.sourceAssumptions.some(s => s.includes("counted twice")));
    assert(result.assumptionCodes.includes("today_dated_income_may_already_be_in_opening"));
    const serialized = JSON.stringify(result);
    for (const secret of [other, accounts[6].id, goalRows[3].id, "Foreign goal", "Secret"]) assert(!serialized.includes(secret));
    const reversed = await compareAffordability(owner, { ...input, alternatives: [...input.alternatives].reverse() }, now);
    assert.deepEqual(result.scenarios.map(({ index, ...s }) => s), reversed.scenarios.reverse().map(({ index, ...s }) => s));
    for (const accountId of [accounts[6].id, randomUUID()]) {
      await assert.rejects(compareAffordability(owner, { ...body, alternatives: [{ ...alternative, accountId }] }, now), { code: "NOT_FOUND" });
    }
    for (const accountId of [accounts[2].id, accounts[3].id]) {
      await assert.rejects(compareAffordability(owner, { ...body, alternatives: [{ ...alternative, accountId }] }, now), { code: "BAD_REQUEST" });
    }
    const dated = await compareAffordability(owner, { through: "2090-07-01",
      alternatives: [{ ...input.alternatives[0], purchaseDate: "2090-07-01" }] }, now);
    assert(dated.scenarios[0].budgets.every(b => b.assessment === "outside_current_period" && b.remainingAfter === null && b.shortfallAfter === null));
    assert.equal(dated.scenarios[0].currentCash.before.minor, 200);
    const datedSameHorizon = await compareAffordability(owner, { through: "2090-07-01", alternatives: [input.alternatives[0]] }, now);
    assert.deepEqual(dated.scenarios[0].baseline, datedSameHorizon.scenarios[0].baseline);
    const weeklyEnd = small.budgets.find(b => b.period === "weekly").periodEnd;
    const nextWeek = new Date(Date.parse(`${weeklyEnd}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
    const partial = await compareAffordability(owner, { through,
      alternatives: [{ ...input.alternatives[0], purchaseDate: nextWeek }] }, now);
    assert.equal(partial.scenarios[0].budgets.find(b => b.period === "weekly").remainingAfter, null);
    assert.equal(partial.scenarios[0].budgets.find(b => b.period === "monthly").remainingAfter.minor, 170);
    assert.deepEqual(partial.scenarios[0].baseline, small.baseline);
    assert.equal(partial.scenarios[0].projectedAfterPurchase.minor, small.projectedAfterPurchase.minor);
    assert.deepEqual(await ownedState(), before);

    // Handler response uses generated validation; direct invocation needs no HTTP server.
    const handler = router.stack.find(l => l.route?.path === "/planning/affordability").route.stack[0].handle;
    const res = { locals: { principal: { userId: owner, roles: ["student"] } }, json(data) { this.data = data; } };
    await handler({ body: { through: new Date().toISOString().slice(0, 10), alternatives: [alternative] } }, res);
    assert.equal(res.data.scenarios.length, 1);
    assert.deepEqual(await ownedState(), before);

    // Barrier after old reserves are read: another connection atomically changes opening,
    // goal funding, budget limit, and a monthly cost before remaining scenario reads.
    let interleaved = false;
    db.transaction = (callback, options) => {
      assert.deepEqual(options, { isolationLevel: "repeatable read", accessMode: "read only" });
      return originalTransaction(tx => callback(new Proxy(tx, {
        get(target, key, receiver) {
          if (key !== "select") return Reflect.get(target, key, receiver);
          return (...fields) => ({ from(table) {
            const query = target.select(...fields).from(table);
            if (table !== financeAccounts || interleaved) return query;
            return new Proxy(query, { get(q, property, queryReceiver) {
              if (property !== "where") return Reflect.get(q, property, queryReceiver);
              return (...conditions) => q.where(...conditions).then(async rows => {
                if (!interleaved) {
                  interleaved = true;
                  await originalTransaction(async writer => {
                    await writer.update(financeAccounts).set({ balanceMinor: 90n }).where(eq(financeAccounts.id, accounts[1].id));
                    await writer.update(financeAccounts).set({ balanceMinor: 160n }).where(eq(financeAccounts.id, accounts[3].id));
                    await writer.update(planningBudgets).set({ limitMinor: 999n }).where(eq(planningBudgets.userId, owner));
                    await writer.update(planningLines).set({ amountMinor: 10n }).where(eq(planningLines.userId, owner));
                  });
                }
                return rows;
              });
            } });
          } });
        },
      })), options);
    };
    const during = await compareAffordability(owner, input, now);
    db.transaction = originalTransaction;
    assert.equal(interleaved, true);
    assert.deepEqual(during, result); // all old values, not a mixed-generation snapshot
    const changed = await compareAffordability(owner, input, now);
    assert.equal(changed.scenarios[0].currentCash.before.minor, 140);
    assert.equal(changed.scenarios[0].goalContext.protectedReserves.minor, 230);
    assert.equal(changed.scenarios[0].goalContext.requiredMonthly.minor, 40);
    assert.equal(changed.scenarios[0].goalContext.effectiveMonthlySavings.minor, 40);
    assert(changed.scenarios[0].budgets.every(b => b.limit.minor === 999));
    assert.deepEqual(await db.select().from(financeTransactions).where(eq(financeTransactions.userId, owner)), before[1]);
  } finally {
    db.transaction = originalTransaction;
    if (ids.length) {
      await db.delete(financeTransactions).where(inArray(financeTransactions.userId, ids));
      await db.delete(savingsGoals).where(inArray(savingsGoals.userId, ids));
      await db.delete(financeAccounts).where(inArray(financeAccounts.userId, ids));
      await db.delete(users).where(inArray(users.id, ids));
    }
  }
});