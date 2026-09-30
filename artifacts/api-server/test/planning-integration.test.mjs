import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { build } from "esbuild";

test("planning CRUD is owner scoped; campus payment updates live budgets without duplicating forecast", { skip: !process.env.DATABASE_URL }, async () => {
  const compiled = await build({
    stdin: {
      contents: `export { default as router } from "./src/routes/planning.ts";
        export { once, lockedAccounts, post } from "./src/lib/finance.ts";
        export { db, pool, users, incomes, scholarships, planningBudgets, planningRecurring, planningLines, planningSettings, financeAccounts, financeTransactions, financeEvents, financeIdempotency } from "@workspace/db";
        export { eq, inArray } from "drizzle-orm";`,
      resolveDir: new URL("..", import.meta.url).pathname, loader: "ts",
    }, bundle: true, platform: "node", format: "cjs", write: false, external: ["*.node"],
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  const { router, db, pool, users, incomes, planningBudgets, planningRecurring, planningLines, planningSettings,
    financeAccounts, financeTransactions, financeEvents, financeIdempotency, eq, inArray, once, lockedAccounts, post } = module.exports;
  const marker = randomUUID(), ids = [], accounts = [];
  const call = async (method, path, userId, body, id) => {
    const layer = router.stack.find(l => l.route?.path === path && l.route.stack.some(h => h.method === method));
    assert(layer, `${method} ${path} route exists`);
    const handler = layer.route.stack.find(l => l.method === method)?.handle;
    assert(handler);
    const res = {
      locals: { principal: { userId, roles: ["student"] } },
      status(code) { this.code = code; return this; },
      json(value) { this.data = value; return this; },
      sendStatus(code) { this.code = code; return this; },
    };
    await handler({ body, params: { id }, res }, res);
    return res.data ?? { status: res.code };
  };
  try {
    for (let i = 0; i < 2; i++) {
      const [user] = await db.insert(users).values({
        name: "Planning integration", email: `${marker}-${i}@example.invalid`,
        role: "student", passwordHash: "synthetic-fixture-not-login",
        residence: { type: "shared", city: "Test", monthlyRent: { minor: 400, currency: "ILS" },
          studentShare: { minor: 180, currency: "ILS" }, utilities: { minor: 20, currency: "ILS" } },
        commute: { homeCity: "Test", method: "bus", tripsPerWeek: 2,
          costPerTrip: { minor: 5, currency: "ILS" }, roundTrip: true,
          monthlyEstimate: { minor: 43, currency: "ILS" } },
      }).returning();
      ids.push(user.id);
      const [account] = await db.insert(financeAccounts).values({
        userId: user.id, type: "wallet", name: "Test wallet", currency: "ILS",
      }).returning();
      accounts.push(account.id);
    }
    await db.insert(incomes).values([
      { userId: ids[0], data: { source: "part_time", amount: { minor: 1200, currency: "ILS" }, frequency: "monthly", stability: "stable", active: true } },
      { userId: ids[0], data: { source: "gift", amount: { minor: 500, currency: "ILS" }, frequency: "irregular", stability: "variable", active: true } },
      { userId: ids[0], data: { source: "salary", amount: { minor: 999, currency: "USD" }, frequency: "monthly", stability: "stable", active: false } },
    ]);
    const b = await call("post", "/planning/budgets", ids[0], { category: "cafeteria", period: "weekly", limit: { minor: 100, currency: "ILS" } });
    assert.equal(b.category, "food");
    assert.equal(b.actualSpent.minor, 0);
    await assert.rejects(call("post", "/planning/budgets", ids[0], { category: "food", period: "weekly",
      limit: { minor: Number.MAX_SAFE_INTEGER + 1, currency: "ILS" } }), { code: "BAD_REQUEST" });
    await assert.rejects(call("post", "/planning/budgets", ids[0], { category: "food", period: "weekly",
      limit: { minor: 20, currency: "ILS" }, userId: ids[1] }), { code: "BAD_REQUEST" });
    await assert.rejects(call("post", "/planning/budgets", ids[0], { category: "food", period: "weekly", limit: { minor: 150, currency: "ILS" } }), { code: "CONFLICT" });
    const monthly = await call("post", "/planning/budgets", ids[0], { category: "food", period: "monthly", limit: { minor: 300, currency: "ILS" } });
    await assert.rejects(call("put", "/planning/budgets/:id", ids[1], { category: "food", period: "monthly", limit: { minor: 1, currency: "ILS" } }, b.id), { code: "NOT_FOUND" });
    await assert.rejects(call("delete", "/planning/budgets/:id", ids[1], undefined, b.id), { code: "NOT_FOUND" });
    const recurring = await call("post", "/planning/recurring-expenses", ids[0], {
      amount: { minor: 60, currency: "ILS" }, category: "rent", frequency: "monthly",
      nextDate: "2099-01-01", description: "rent", active: true,
    });
    assert.equal(recurring.category, "housing");
    await assert.rejects(call("post", "/planning/recurring-expenses", ids[0], {
      amount: { minor: 1, currency: "ILS" }, category: "food", frequency: "weekly",
      nextDate: "2025-02-30", description: "invalid", active: true,
    }), { code: "BAD_REQUEST" });
    await assert.rejects(call("put", "/planning/recurring-expenses/:id", ids[1], {
      amount: recurring.amount, category: recurring.category, frequency: recurring.frequency,
      nextDate: recurring.nextDate, active: recurring.active, description: "cross-owner",
    }, recurring.id), { code: "NOT_FOUND" });
    const manual = await call("post", "/planning/lines", ids[0], {
      amount: { minor: 80, currency: "ILS" }, category: "accommodation",
      type: "fixed", description: "share", upcomingDate: "2099-02-01",
    });
    assert.equal(manual.category, "housing");
    await assert.rejects(call("delete", "/planning/lines/:id", ids[1], undefined, manual.id), { code: "NOT_FOUND" });
    await call("put", "/planning/commute-override", ids[0], { enabled: true, amount: { minor: 70, currency: "ILS" } });
    let plan = await call("get", "/planning", ids[0]);
    assert.equal(plan.estimate, true);
    assert.equal(plan.totals[0].expectedIncome.minor, 1200);
    assert.equal(plan.totals[0].plannedExpenses.minor, 170); // housing 80 + utilities 20 + commute override 70
    assert.equal(plan.totals[0].projectedRemaining.minor, 1030);
    assert.equal(plan.irregularIncome.length, 1);
    assert.equal(plan.upcoming.length, 2);
    assert.equal(plan.costs.find(c => c.category === "housing").source, "manual");
    assert.equal((await call("get", "/planning", ids[1])).budgets.length, 0);
    await db.update(users).set({ residence: null, commute: null }).where(eq(users.id, ids[1]));
    assert.deepEqual((await call("get", "/planning", ids[1])).totals, []);
    const weekly = await call("post", "/planning/recurring-expenses", ids[0], {
      amount: { minor: 5, currency: "ILS" }, category: "cafeteria", frequency: "weekly",
      nextDate: "2099-01-01", description: "meals", active: true,
    });
    assert.equal((await call("get", "/planning", ids[0])).costs.find(c => c.category === "food").amount.minor, 22);
    await call("put", "/planning/recurring-expenses/:id", ids[0], {
      amount: weekly.amount, category: weekly.category, frequency: weekly.frequency,
      nextDate: weekly.nextDate, description: weekly.description, active: false,
    }, weekly.id);
    assert.equal((await call("get", "/planning", ids[0])).costs.find(c => c.category === "food"), undefined);
    await assert.rejects(call("delete", "/planning/recurring-expenses/:id", ids[1], undefined, weekly.id), { code: "NOT_FOUND" });
    await call("delete", "/planning/recurring-expenses/:id", ids[0], undefined, weekly.id);
    await once(ids[0], `fund-${marker}`, "receive", { amount: 200 }, async tx => {
      const a = (await lockedAccounts(tx, [accounts[0]])).get(accounts[0]);
      return post(tx, a, 200n, { kind: "receive", category: "external_income" });
    });
    await once(ids[0], `campus-${marker}`, "campus-payment", { amount: 35 }, async tx => {
      const a = (await lockedAccounts(tx, [accounts[0]])).get(accounts[0]);
      return post(tx, a, -35n, { kind: "payment", category: "food", serviceId: randomUUID(), merchantName: "Campus cafeteria" });
    });
    plan = await call("get", "/planning", ids[0]);
    assert.equal(plan.budgets.find(v => v.id === b.id).actualSpent.minor, 35);
    assert.equal(plan.budgets.find(v => v.id === monthly.id).actualSpent.minor, 35);
    assert.equal(plan.budgets.find(v => v.id === b.id).remaining.minor, 65);
    assert.equal(plan.totals[0].plannedExpenses.minor, 170); // budgets/ledger never become planned expenses
    await assert.rejects(call("put", "/planning/lines/:id", ids[1], {
      category: "housing", type: "fixed", amount: { minor: 12, currency: "ILS" }, description: "intrusion",
    }, manual.id), { code: "NOT_FOUND" });
    await assert.rejects(call("put", "/planning/commute-override", ids[0], { enabled: true }), { code: "BAD_REQUEST" });
    await assert.rejects(call("post", "/planning/lines", ids[0], {
      category: "savings", type: "fixed", amount: { minor: 12, currency: "ILS" }, description: "not savings",
    }), { code: "BAD_REQUEST" });
    await call("put", "/planning/lines/:id", ids[0], {
      category: "savings", type: "savings", amount: { minor: 1100, currency: "ILS" }, description: "reserve",
    }, manual.id);
    plan = await call("get", "/planning", ids[0]);
    assert.equal(plan.totals[0].plannedExpenses.minor, 150); // recurring housing 60 + utilities 20 + commute 70
    assert.equal(plan.totals[0].projectedRemaining.minor, -50);
    await call("delete", "/planning/recurring-expenses/:id", ids[0], undefined, recurring.id);
    await call("delete", "/planning/lines/:id", ids[0], undefined, manual.id);
    await call("delete", "/planning/budgets/:id", ids[0], undefined, b.id);
    await call("delete", "/planning/budgets/:id", ids[0], undefined, monthly.id);
    assert.equal((await call("get", "/planning", ids[0])).totals[0].plannedExpenses.minor, 270); // share 180 + utilities 20 + override 70
    await call("put", "/planning/commute-override", ids[0], { enabled: false });
    assert.equal((await call("get", "/planning", ids[0])).totals[0].plannedExpenses.minor, 243); // profile commute 43
  } finally {
    if (ids.length) {
      const tx = await db.select({ id: financeTransactions.id }).from(financeTransactions).where(inArray(financeTransactions.userId, ids));
      if (tx.length) await db.delete(financeEvents).where(inArray(financeEvents.transactionId, tx.map(t => t.id)));
      await db.delete(financeTransactions).where(inArray(financeTransactions.userId, ids));
      await db.delete(financeIdempotency).where(inArray(financeIdempotency.userId, ids));
      await db.delete(financeAccounts).where(inArray(financeAccounts.userId, ids));
      await db.delete(planningSettings).where(inArray(planningSettings.userId, ids));
      await db.delete(planningLines).where(inArray(planningLines.userId, ids));
      await db.delete(planningRecurring).where(inArray(planningRecurring.userId, ids));
      await db.delete(planningBudgets).where(inArray(planningBudgets.userId, ids));
      await db.delete(incomes).where(inArray(incomes.userId, ids));
      await db.delete(users).where(inArray(users.id, ids));
    }
    await pool.end();
  }
});