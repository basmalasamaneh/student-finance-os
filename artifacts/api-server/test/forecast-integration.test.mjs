import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { build } from "esbuild";

test("Prompt11 owner CRUD, date overrides, immutable ledger and reconciled forecast adapters", { skip: !process.env.DATABASE_URL }, async () => {
  const compiled = await build({ stdin: { contents: `
    export { default as router } from "./src/routes/scheduled.ts";
    export { financialPlanSnapshot } from "./src/routes/planning.ts";
    export { planningForecast } from "./src/lib/forecast.ts";
    export * from "@workspace/db"; export { eq, inArray } from "drizzle-orm";`,
    resolveDir: new URL("..", import.meta.url).pathname, loader: "ts" }, bundle: true, platform: "node", format: "cjs", write: false, external: ["*.node"] });
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  const { router, financialPlanSnapshot, planningForecast, db, pool, users, scheduledItems, scheduledOccurrenceOverrides,
    incomes, scholarships, financeAccounts, financeTransactions, planningRecurring, planningLines, planningSettings,
    savingsGoals, allowances, allowanceOccurrences, familyLinks, eq, inArray } = module.exports;
  const ids = [], scheduleIds = [], marker = randomUUID();
  const call = async (method, path, userId, body, params = {}, query = {}, roles = ["student"]) => {
    const handler = router.stack.find(l => l.route?.path === path && l.route.stack.some(h => h.method === method))?.route.stack.find(l => l.method === method)?.handle;
    assert(handler, `${method} ${path}`);
    const res = { locals: { principal: userId ? { userId, roles } : undefined },
      status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; }, sendStatus(code) { this.code = code; return this; } };
    await handler({ body, params, query, res }, res);
    return res.data ?? res.code;
  };
  const amount = (minor, currency = "ILS") => ({ minor, currency });
  const input = { name: "Tuition installment", amount: amount(100), dueDate: "2024-01-31", category: "tuition",
    kind: "expense", recurrence: "monthly", endDate: "2024-03-31", notes: "", status: "planned" };
  try {
    for (let i = 0; i < 3; i++) {
      const [u] = await db.insert(users).values({ name: "Forecast integration", email: `${marker}-${i}@example.invalid`,
        role: i === 2 ? "parent" : "student", passwordHash: "synthetic-not-login" }).returning();
      ids.push(u.id);
    }
    const owner = ids[0], other = ids[1];
    const accounts = await db.insert(financeAccounts).values([
      { userId: owner, type: "wallet", name: "Available", currency: "ILS", balanceMinor: 1000n },
      { userId: owner, type: "goal_reserve", name: "Reserve", currency: "ILS", balanceMinor: 700n },
      { userId: owner, type: "wallet", name: "USD", currency: "USD", balanceMinor: 50n },
      { userId: ids[2], type: "wallet", name: "Parent", currency: "ILS", balanceMinor: 200n },
    ]).returning();
    const ledgerBefore = await db.select().from(financeTransactions).where(eq(financeTransactions.userId, owner));
    const beforePlan = await financialPlanSnapshot(owner);
    await assert.rejects(call("get", "/scheduled-items", null), { code: "UNAUTHENTICATED" });
    await assert.rejects(call("get", "/scheduled-items", ids[2], undefined, {}, {}, ["parent"]), { code: "FORBIDDEN" });
    await assert.rejects(call("get", "/planning/calendar", ids[2], undefined, {}, { from: "2024-01-01", to: "2024-03-31" }, ["parent"]), { code: "FORBIDDEN" });
    for (const bad of [{ ...input, dueDate: "2025-02-29" }, { ...input, status: "completed" },
      { ...input, amount: amount(Number.MAX_SAFE_INTEGER + 1) }, { ...input, userId: other },
      { ...input, endDate: "2023-01-01" }, { ...input, amount: { ...amount(5), ownerId: other } }]) {
      await assert.rejects(call("post", "/scheduled-items", owner, bad), { code: "BAD_REQUEST" });
    }
    const item = await call("post", "/scheduled-items", owner, input);
    assert.equal(item.commitmentPolicy, "additional_commitment");
    assert.equal((await call("get", "/scheduled-items", owner)).length, 1);
    assert.deepEqual(await call("get", "/scheduled-items", other), []);
    assert.equal((await call("get", "/scheduled-items/:id", owner, undefined, { id: item.id })).id, item.id);
    for (const method of ["get", "put", "delete"]) {
      await assert.rejects(call(method, "/scheduled-items/:id", other, input, { id: item.id }), { code: "NOT_FOUND" });
    }
    await assert.rejects(call("put", "/scheduled-items/:id/occurrences/:date", other, { status: "completed" }, { id: item.id, date: "2024-02-29" }), { code: "NOT_FOUND" });
    await assert.rejects(call("put", "/scheduled-items/:id/occurrences/:date", owner, { status: "completed" }, { id: item.id, date: "2024-02-28" }), { code: "BAD_REQUEST" });
    const calendar = () => call("get", "/planning/calendar", owner, undefined, {}, { from: "2024-01-01", to: "2024-04-30" });
    for (const status of ["completed", "cancelled", "planned"]) {
      await call("put", "/scheduled-items/:id/occurrences/:date", owner, { status }, { id: item.id, date: "2024-02-29" });
      const rows = (await calendar()).occurrences;
      assert.equal(rows.find(r => r.date === "2024-02-29").status, status);
      assert.equal(rows.find(r => r.date === "2024-03-31").status, "planned");
      assert.equal(rows.length, 3);
    }
    await assert.rejects(call("put", "/scheduled-items/:id", owner, { ...input, dueDate: "2024-01-30" }, { id: item.id }), { code: "CONFLICT" });
    await call("put", "/scheduled-items/:id", owner, { ...input, status: "cancelled", name: "Renamed" }, { id: item.id });
    assert((await calendar()).occurrences.every(r => r.status === "cancelled"));
    await call("put", "/scheduled-items/:id", owner, input, { id: item.id });
    assert.deepEqual((await financialPlanSnapshot(owner)).totals, beforePlan.totals);
    await call("delete", "/scheduled-items/:id", owner, undefined, { id: item.id });
    assert.equal((await db.select().from(scheduledOccurrenceOverrides).where(eq(scheduledOccurrenceOverrides.itemId, item.id))).length, 0);

    // Fixed June horizon gives deterministic monthly allocation and original source behavior.
    const from = "2090-06-01", to = "2090-06-30";
    await db.update(users).set({
      residence: { type: "shared", city: "Test", studentShare: amount(900), monthlyRent: amount(1000), utilities: amount(30), internet: amount(10) },
      commute: { homeCity: "Test", method: "bus", tripsPerWeek: 1, costPerTrip: amount(1), roundTrip: true, monthlyEstimate: amount(60) },
    }).where(eq(users.id, owner));
    await db.insert(planningSettings).values({ userId: owner, commuteOverrideEnabled: true, commuteOverrideMinor: 40n, commuteOverrideCurrency: "ILS" });
    await db.insert(planningRecurring).values([
      { userId: owner, category: "housing", currency: "ILS", amountMinor: 500n, frequency: "monthly", nextDate: from, description: "Rent", active: true },
      { userId: owner, category: "subscriptions", currency: "ILS", amountMinor: 15n, frequency: "monthly", nextDate: from, description: "App", active: true },
    ]);
    await db.insert(planningLines).values([
      { userId: owner, category: "housing", type: "fixed", currency: "ILS", amountMinor: 300n, description: "Manual housing", upcomingDate: from },
      { userId: owner, category: "savings", type: "savings", currency: "ILS", amountMinor: 20n, description: "Manual savings", upcomingDate: from },
    ]);
    await db.insert(savingsGoals).values({ userId: owner, reserveAccountId: accounts[1].id, name: "Goal", targetMinor: 800n, currency: "ILS",
      targetDate: new Date().toISOString().slice(0, 10), category: "other", priority: "medium", notes: "", status: "active" });
    await db.insert(incomes).values([
      { userId: owner, data: { source: "salary", amount: amount(600), frequency: "monthly", stability: "stable", active: true } },
      { userId: owner, data: { source: "scholarship", amount: amount(70), frequency: "one_time", stability: "stable", active: true, expectedDate: from } },
      { userId: owner, data: { source: "freelance", amount: amount(25), frequency: "one_time", stability: "variable", active: true, expectedDate: "2090-05-31" } },
      { userId: owner, data: { source: "gift", amount: amount(80, "JOD"), frequency: "monthly", stability: "stable", active: true, expectedDate: from } },
      { userId: other, data: { source: "salary", amount: amount(9000), frequency: "monthly", stability: "stable", active: true } },
    ]);
    await db.insert(scholarships).values({ userId: owner, data: { name: "Metadata only", provider: "Test", amount: amount(9999), type: "scholarship", coverage: "partial", period: "yearly", status: "active", notes: "" } });
    await call("post", "/scheduled-items", owner, { ...input, recurrence: "none", dueDate: from, endDate: undefined, amount: amount(50) });
    await call("post", "/scheduled-items", owner, { ...input, recurrence: "none", dueDate: "2090-05-31", endDate: undefined, amount: amount(1234) });
    let forecast = await planningForecast(owner, from, to);
    const ils = forecast.currencies.find(c => c.currency === "ILS");
    assert.equal(ils.availableOpening.minor, 1000); // not 1700, reserve excluded
    assert.equal(ils.expectedIncome.minor, 670); // salary + explicitly entered scholarship once
    assert.equal(ils.upcomingExpenses.minor, 430); // 300 housing +30 utilities+10 internet+40 commute+50 additional
    assert.equal(ils.recurringExpenses.minor, 15);
    assert.equal(ils.plannedSavings.minor, 100); // max(20 manual,100 goal need), not sum
    assert.equal(ils.projectedBalance.minor, 1125);
    assert.equal(forecast.currencies.find(c => c.currency === "JOD").expectedIncome.minor, 80);
    assert.equal(forecast.currencies.find(c => c.currency === "USD").projectedBalance.minor, 50);
    assert.equal(forecast.occurrences.filter(r => r.date < from).length, 0);
    assert.equal(forecast.occurrences.find(r => r.source === "recurring" && r.category === "housing").includedInForecast, false);
    assert(forecast.occurrences.filter(r => r.source === "line").every(r => !r.includedInForecast));
    assert.equal((await planningForecast(owner, "2090-07-01", "2090-07-31")).currencies.find(c => c.currency === "ILS").expectedIncome.minor, 600);

    // A completed one-time allowance posted today is in opening, never counted again.
    const [link] = await db.insert(familyLinks).values({ studentId: owner, parentId: ids[2], tokenHash: marker, status: "accepted",
      permissions: { monthlySummary: false, balance: false, goals: false, allowance: true, requests: false, transactions: false, upcomingPayments: false, campusSpending: false },
      receivingAccountId: accounts[0].id, expiresAt: new Date("2099-01-01") }).returning();
    for (const [kind, status, minor] of [["oneTime", "completed", 100n], ["recurring", "active", 300n]]) {
      const [schedule] = await db.insert(allowances).values({ familyLinkId: link.id, studentId: owner, parentId: ids[2],
        parentAccountId: accounts[3].id, amountMinor: minor, currency: "ILS", kind,
        frequency: kind === "recurring" ? "monthly" : null, nextPayment: from, startDate: from, endDate: to, status }).returning();
      scheduleIds.push(schedule.id);
      if (kind === "oneTime") await db.insert(allowanceOccurrences).values({ allowanceId: schedule.id, scheduledDate: from, amountMinor: minor, currency: "ILS", status: "posted" });
    }
    await db.insert(incomes).values([
      { userId: owner, data: { source: "parent_allowance", amount: amount(500), frequency: "monthly", stability: "stable", active: true } },
      { userId: owner, data: { source: "parent_allowance", amount: amount(100), frequency: "one_time", stability: "stable", active: true, expectedDate: from } },
    ]);
    forecast = await planningForecast(owner, from, to);
    assert.equal(forecast.currencies.find(c => c.currency === "ILS").expectedIncome.minor, 1070); // 670+max(500-100posted,300)
    assert.equal(forecast.occurrences.filter(r => r.status === "posted").length, 1);
    assert.equal(forecast.occurrences.find(r => r.status === "posted").includedInForecast, false);
    const actualToday = new Date().toISOString().slice(0, 10);
    const response = await call("get", "/planning/forecast", owner, undefined, {}, { through: actualToday });
    assert.equal(response.asOf, actualToday);
    assert.equal(response.estimate, true);
    await assert.rejects(call("get", "/planning/forecast", owner, undefined, {}, { through: "2020-01-01" }), { code: "BAD_REQUEST" });
    await assert.rejects(call("get", "/planning/forecast", owner, undefined, {}, { through: actualToday, asOf: from }), { code: "BAD_REQUEST" });
    await assert.rejects(call("get", "/planning/calendar", owner, undefined, {}, { from: "2090-01-01", to: "2092-01-01" }), { code: "BAD_REQUEST" });
    await db.update(familyLinks).set({ permissions: { ...link.permissions, allowance: false } }).where(eq(familyLinks.id, link.id));
    const revoked = await planningForecast(owner, from, to);
    assert.equal(revoked.occurrences.filter(r => r.source === "allowance").length, 0);
    assert.equal(revoked.currencies.find(c => c.currency === "ILS").expectedIncome.minor, 1070); // own posted credit remains covered after consent removal
    assert.deepEqual(await db.select().from(financeTransactions).where(eq(financeTransactions.userId, owner)), ledgerBefore);
    assert.deepEqual((await db.select().from(financeAccounts).where(eq(financeAccounts.userId, owner))).map(r => r.balanceMinor).sort(),
      accounts.filter(a => a.userId === owner).map(a => a.balanceMinor).sort());
  } finally {
    if (scheduleIds.length) await db.delete(allowanceOccurrences).where(inArray(allowanceOccurrences.allowanceId, scheduleIds));
    if (ids.length) {
      await db.delete(allowances).where(inArray(allowances.studentId, ids));
      await db.delete(familyLinks).where(inArray(familyLinks.studentId, ids));
      await db.delete(scheduledItems).where(inArray(scheduledItems.userId, ids));
      await db.delete(savingsGoals).where(inArray(savingsGoals.userId, ids));
      await db.delete(planningSettings).where(inArray(planningSettings.userId, ids));
      await db.delete(planningLines).where(inArray(planningLines.userId, ids));
      await db.delete(planningRecurring).where(inArray(planningRecurring.userId, ids));
      await db.delete(incomes).where(inArray(incomes.userId, ids));
      await db.delete(scholarships).where(inArray(scholarships.userId, ids));
      await db.delete(financeAccounts).where(inArray(financeAccounts.userId, ids));
      await db.delete(users).where(inArray(users.id, ids));
    }
    await pool.end();
  }
});

test("allowance forecast follows worker cursor off-anchor, inclusive ends and exact manual suppression", { skip: !process.env.DATABASE_URL }, async () => {
  const compiled = await build({ stdin: { contents: `
    export { planningCalendar, planningForecast, allowanceForecastDates } from "./src/lib/forecast.ts";
    export * from "@workspace/db"; export { eq, inArray } from "drizzle-orm";`,
    resolveDir: new URL("..", import.meta.url).pathname, loader: "ts" }, bundle: true, platform: "node", format: "cjs", write: false, external: ["*.node"] });
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  const { planningCalendar, planningForecast, allowanceForecastDates, db, pool, users, financeAccounts, incomes, familyLinks, allowances, eq, inArray } = module.exports;
  const marker = randomUUID(), ids = [];
  try {
    const weekly = { kind: "recurring", frequency: "weekly", startDate: "2090-06-01", nextPayment: "2090-06-03", endDate: "2090-06-03" };
    assert.deepEqual(allowanceForecastDates(weekly, "2090-06-01", "2090-06-30"), ["2090-06-03"]);
    assert.deepEqual(allowanceForecastDates({ ...weekly, endDate: "2090-06-17" }, "2090-06-01", "2090-06-30"), ["2090-06-03", "2090-06-10", "2090-06-17"]);
    assert.deepEqual(allowanceForecastDates({ ...weekly, frequency: "biweekly", endDate: "2090-06-17" }, "2090-06-01", "2090-06-30"), ["2090-06-03", "2090-06-17"]);
    const monthly = { kind: "recurring", frequency: "monthly", startDate: "2090-01-31", nextPayment: "2090-02-03", endDate: "2090-02-03" };
    assert.deepEqual(allowanceForecastDates(monthly, "2090-02-01", "2090-04-30"), ["2090-02-03"]);
    assert.deepEqual(allowanceForecastDates({ ...monthly, endDate: "2090-04-30" }, "2090-02-01", "2090-04-30"), ["2090-02-03", "2090-03-31", "2090-04-30"]);
    assert.deepEqual(allowanceForecastDates({ ...monthly, endDate: "2090-04-30" }, "2090-02-04", "2090-04-30"), ["2090-03-31", "2090-04-30"]);
    const leap = { ...monthly, startDate: "2087-12-31", nextPayment: "2088-01-03", endDate: "2088-03-31" };
    assert.deepEqual(allowanceForecastDates(leap, "2088-01-01", "2088-03-31"), ["2088-01-03", "2088-02-29", "2088-03-31"]);
    for (const role of ["student", "parent"]) {
      const [user] = await db.insert(users).values({ name: "Cursor integration", email: `${marker}-${role}@example.invalid`, role, passwordHash: "synthetic-not-login" }).returning();
      ids.push(user.id);
    }
    const [account] = await db.insert(financeAccounts).values({ userId: ids[1], type: "wallet", name: "Parent", currency: "ILS" }).returning();
    const [link] = await db.insert(familyLinks).values({ studentId: ids[0], parentId: ids[1], tokenHash: marker,
      status: "accepted", permissions: { monthlySummary: false, balance: false, goals: false, allowance: true, requests: false, transactions: false, upcomingPayments: false, campusSpending: false },
      expiresAt: new Date("2099-01-01") }).returning();
    const [schedule] = await db.insert(allowances).values({ ...weekly, endDate: "2090-06-17", familyLinkId: link.id, studentId: ids[0], parentId: ids[1],
      parentAccountId: account.id, amountMinor: 300n, currency: "ILS", status: "active" }).returning();
    await db.insert(incomes).values([
      { userId: ids[0], data: { source: "parent_allowance", amount: { minor: 100, currency: "ILS" }, frequency: "one_time", stability: "stable", active: true, expectedDate: "2090-06-03" } },
      { userId: ids[0], data: { source: "parent_allowance", amount: { minor: 25, currency: "ILS" }, frequency: "one_time", stability: "stable", active: true, expectedDate: "2090-06-08" } },
    ]);
    const calendar = await planningCalendar(ids[0], "2090-06-01", "2090-06-30");
    assert.deepEqual(calendar.occurrences.filter(r => r.source === "allowance").map(r => r.date), ["2090-06-03", "2090-06-10", "2090-06-17"]);
    assert.equal(calendar.occurrences.find(r => r.source === "income" && r.date === "2090-06-03").includedInForecast, false);
    assert.equal(calendar.occurrences.find(r => r.source === "income" && r.date === "2090-06-08").includedInForecast, true);
    assert.equal((await planningForecast(ids[0], "2090-06-01", "2090-06-30")).currencies[0].expectedIncome.minor, 925);
    await db.update(allowances).set(monthly).where(eq(allowances.id, schedule.id));
    await db.insert(incomes).values({ userId: ids[0], data: { source: "parent_allowance", amount: { minor: 100, currency: "ILS" },
      frequency: "one_time", stability: "stable", active: true, expectedDate: "2090-02-03" } });
    const monthlyCalendar = await planningCalendar(ids[0], "2090-02-01", "2090-04-30");
    assert.deepEqual(monthlyCalendar.occurrences.filter(r => r.source === "allowance").map(r => r.date), ["2090-02-03"]);
    assert.equal(monthlyCalendar.occurrences.find(r => r.source === "income").includedInForecast, false);
    assert(monthlyCalendar.assumptionCodes.includes("today_dated_income_may_already_be_in_opening"));
  } finally {
    if (ids.length) {
      await db.delete(allowances).where(inArray(allowances.studentId, ids));
      await db.delete(familyLinks).where(inArray(familyLinks.studentId, ids));
      await db.delete(incomes).where(inArray(incomes.userId, ids));
      await db.delete(financeAccounts).where(inArray(financeAccounts.userId, ids));
      await db.delete(users).where(inArray(users.id, ids));
    }
    await pool.end();
  }
});

test("forecast plan, goal requirement and opening share one MVCC snapshot during actual goal contribution", { skip: !process.env.DATABASE_URL }, async () => {
  const compiled = await build({ stdin: { contents: `
    export { planningForecast } from "./src/lib/forecast.ts";
    export { default as goalRouter } from "./src/routes/goals.ts";
    export * from "@workspace/db"; export { eq, inArray } from "drizzle-orm";`,
    resolveDir: new URL("..", import.meta.url).pathname, loader: "ts" }, bundle: true, platform: "node", format: "cjs", write: false, external: ["*.node"] });
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  const { planningForecast, goalRouter, db, pool, users, financeAccounts, savingsGoals, goalHistory, financeTransactions, financeEvents,
    financeIdempotency, inAppNotifications, eq, inArray } = module.exports;
  const marker = randomUUID(), originalTransaction = db.transaction.bind(db);
  let owner;
  try {
    const [user] = await db.insert(users).values({ name: "Snapshot integration", email: `${marker}@example.invalid`, role: "student", passwordHash: "synthetic-not-login" }).returning();
    owner = user.id;
    const accounts = await db.insert(financeAccounts).values([
      { userId: owner, type: "wallet", name: "Available", currency: "ILS", balanceMinor: 1000n },
      { userId: owner, type: "goal_reserve", name: "Reserve", currency: "ILS", balanceMinor: 100n },
    ]).returning();
    const today = new Date().toISOString().slice(0, 10), from = `${today.slice(0, 7)}-01`;
    const last = new Date(`${from}T00:00:00Z`); last.setUTCMonth(last.getUTCMonth() + 1, 0);
    const through = last.toISOString().slice(0, 10);
    const [goal] = await db.insert(savingsGoals).values({ userId: owner, reserveAccountId: accounts[1].id, name: "Snapshot goal",
      targetMinor: 200n, currency: "ILS", targetDate: today, category: "other", priority: "medium", status: "active" }).returning();
    const contribute = async () => {
      const handler = goalRouter.stack.find(l => l.route?.path === "/goals/:id/contributions").route.stack[0].handle;
      const res = { locals: { principal: { userId: owner, roles: ["student"] } },
        status() { return this; }, json(value) { this.data = value; return this; } };
      await handler({ params: { id: goal.id }, body: { accountId: accounts[0].id, amount: { minor: 60, currency: "ILS" }, note: "" },
        get: () => marker, res }, res);
      assert.equal(res.data.goal.current.minor, 160);
    };
    let injectNextTransaction = true, interleaved = false;
    // Deterministic barrier: after reading the old goal/reserve holdings but before
    // computing/reading opening, commit a real contribution on another connection.
    db.transaction = (callback, options) => {
      const inject = injectNextTransaction;
      injectNextTransaction = false;
      return originalTransaction(tx => callback(inject ? new Proxy(tx, {
        get(target, key, receiver) {
          if (key !== "select") return Reflect.get(target, key, receiver);
          return (...fields) => ({
            from(table) {
              const query = target.select(...fields).from(table);
              if (table !== financeAccounts || interleaved) return query;
              return new Proxy(query, {
                get(q, property, queryReceiver) {
                  if (property !== "where") return Reflect.get(q, property, queryReceiver);
                  return (...conditions) => q.where(...conditions).then(async rows => {
                    if (!interleaved) { interleaved = true; await contribute(); }
                    return rows;
                  });
                },
              });
            },
          });
        },
      }) : tx), options);
    };
    const during = await planningForecast(owner, from, through);
    db.transaction = originalTransaction;
    assert.equal(interleaved, true);
    assert.equal(during.currencies[0].availableOpening.minor, 1000);
    assert.equal(during.currencies[0].plannedSavings.minor, 100);
    assert.equal(during.currencies[0].projectedBalance.minor, 900); // never mixed 940 - old 100
    const after = await planningForecast(owner, from, through);
    assert.equal(after.currencies[0].availableOpening.minor, 940);
    assert.equal(after.currencies[0].plannedSavings.minor, 40);
    assert.equal(after.currencies[0].projectedBalance.minor, 900);
    assert(after.assumptionCodes.includes("today_dated_income_may_already_be_in_opening"));
    assert(after.assumptions.some(a => a.includes("Today's expected income may already be in available opening")));
  } finally {
    db.transaction = originalTransaction;
    if (owner) {
      await db.delete(inAppNotifications).where(eq(inAppNotifications.recipientId, owner));
      const goals = await db.select({ id: savingsGoals.id }).from(savingsGoals).where(eq(savingsGoals.userId, owner));
      if (goals.length) await db.delete(goalHistory).where(inArray(goalHistory.goalId, goals.map(g => g.id)));
      await db.delete(financeEvents).where(eq(financeEvents.userId, owner));
      await db.delete(financeTransactions).where(eq(financeTransactions.userId, owner));
      await db.delete(financeIdempotency).where(eq(financeIdempotency.userId, owner));
      await db.delete(savingsGoals).where(eq(savingsGoals.userId, owner));
      await db.delete(financeAccounts).where(eq(financeAccounts.userId, owner));
      await db.delete(users).where(eq(users.id, owner));
    }
    await pool.end();
  }
});