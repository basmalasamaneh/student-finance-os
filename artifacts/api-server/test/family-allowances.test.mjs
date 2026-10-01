import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { build } from "esbuild";

test("family privacy, allowance atomic concurrency/revocation, occurrence retries and inclusive projections", { skip: !process.env.DATABASE_URL }, async () => {
  const compiled = await build({ stdin: { contents: `
    export { default as familyRouter } from "./src/routes/family.ts";
    export { default as financeRouter } from "./src/routes/finance.ts";
    export { default as planningRouter } from "./src/routes/planning.ts";
    export { default as goalsRouter } from "./src/routes/goals.ts";
    export { allowanceProjection } from "./src/lib/allowance-projection.ts";
    export { lockedFamily, lockedAllowance, processOccurrence, nextAllowanceDate } from "./src/lib/allowances.ts";
    export { lockedAccounts, post } from "./src/lib/finance.ts";
    export * from "@workspace/db"; export { eq, inArray, and } from "drizzle-orm";`,
    resolveDir: new URL("..", import.meta.url).pathname, loader: "ts" },
    bundle: true, platform: "node", format: "cjs", write: false, external: ["*.node"] });
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  const m = module.exports, { db, pool, eq, inArray, and } = m, ids = [], marker = randomUUID();
  async function call(router, method, path, actor, body, params = {}, key = randomUUID()) {
    const layer = router.stack.find(l => l.route?.path === path && l.route.stack.some(h => h.method === method));
    assert(layer, `${method} ${path}`);
    const res = { locals: { principal: { userId: ids[actor], roles: [actor >= 2 ? "parent" : "student"] } },
      status(c) { this.code = c; return this; }, set() { return this; },
      json(data) { this.data = data; return this; }, sendStatus(c) { this.code = c; return this; } };
    await layer.route.stack.find(l => l.method === method).handle({ body, params, res, get: () => key }, res);
    return res.data ?? { status: res.code };
  }
  const f = (...args) => call(m.familyRouter, ...args);
  const finance = (...args) => call(m.financeRouter, ...args);
  const plan = (...args) => call(m.planningRouter, ...args);
  const goals = (...args) => call(m.goalsRouter, ...args);
  const none = { monthlySummary: false, balance: false, goals: false, allowance: false, requests: false,
    transactions: false, upcomingPayments: false, campusSpending: false };
  const all = Object.fromEntries(Object.keys(none).map(k => [k, true]));
  const today = new Date().toISOString().slice(0, 10);
  let receiving, wallet;
  const cp = () => ({ childId: ids[0] });
  const ap = a => ({ ...cp(), id: a.id });
  const list = () => f("get", "/parent/children/:childId/allowances", 2, null, cp());
  const create = (minor = 100, overrides = {}, k) => f("post", "/parent/children/:childId/allowances", 2, {
    parentAccountId: wallet.id, amount: { minor, currency: "JOD" }, kind: "oneTime", frequency: null,
    nextPayment: today, startDate: today, endDate: null, note: "Private allowance", ...overrides,
  }, cp(), k);
  const retry = (a, k) => f("post", "/parent/children/:childId/allowances/:id/retry", 2, { retry: true }, ap(a), k);
  const status = (a, action, k) => f("post", "/parent/children/:childId/allowances/:id/status", 2, { action }, ap(a), k);
  const topup = minor => f("post", "/parent/wallet/topups", 2, { accountId: wallet.id, amount: { minor, currency: "JOD" }, simulatedFundingAcknowledged: true });
  const child = () => f("get", "/parent/children/:childId", 2, null, cp());
  try {
    for (let i = 0; i < 4; i++) {
      const [u] = await db.insert(m.users).values({ name: `Family synthetic ${i}`, email: `${marker}-${i}@example.invalid`,
        role: i >= 2 ? "parent" : "student", passwordHash: "synthetic-not-login" }).returning();
      ids.push(u.id);
    }
    receiving = await finance("post", "/finance/accounts", 0, { type: "wallet", name: "Student", currency: "JOD" });
    wallet = await f("post", "/parent/wallet/accounts", 2, { type: "wallet", name: "Parent", currency: "JOD" });
    await assert.rejects(finance("get", "/finance/accounts", 2), { code: "FORBIDDEN" });
    await assert.rejects(f("get", "/parent/wallet", 0), { code: "FORBIDDEN" });
    await assert.rejects(finance("get", "/finance/recipients/:id", 0, null, { id: wallet.id }), { code: "NOT_FOUND" });
    await assert.rejects(f("post", "/parent/wallet/topups", 3, { accountId: wallet.id, amount: { minor: 1, currency: "JOD" }, simulatedFundingAcknowledged: true }), { code: "NOT_FOUND" });
    await assert.rejects(f("post", "/parent/wallet/topups", 2, { accountId: wallet.id, amount: { minor: 1.5, currency: "JOD" }, simulatedFundingAcknowledged: true }), { code: "BAD_REQUEST" });
    await assert.rejects(child(), { code: "NOT_FOUND" });
    await assert.rejects(f("post", "/family/invitations", 0, { permissions: all, receivingAccountId: wallet.id }), { code: "NOT_FOUND" });
    const invite = await f("post", "/family/invitations", 0, { permissions: none, receivingAccountId: receiving.id });
    assert.equal(invite.token.length, 43);
    assert(!("parentName" in invite.link));
    const [stored] = await db.select().from(m.familyLinks).where(eq(m.familyLinks.id, invite.link.id));
    assert.notEqual(stored.tokenHash, invite.token);
    assert.deepEqual(stored.permissions, none);
    const accepted = await f("post", "/parent/family-invitations/decide", 2, { token: invite.token, action: "accept" });
    assert.equal(accepted.childName, "Family synthetic 0");
    assert.deepEqual(await f("post", "/parent/family-invitations/decide", 2, { token: invite.token, action: "accept" }), accepted);
    await assert.rejects(f("post", "/parent/family-invitations/decide", 3, { token: invite.token, action: "accept" }), { code: "NOT_FOUND" });
    assert.deepEqual(Object.keys(await child()).sort(), ["childId", "name", "permissions"]);
    await assert.rejects(create(), { code: "NOT_FOUND" });
    await assert.rejects(f("put", "/family/links/:id", 1, { permissions: all, receivingAccountId: receiving.id }, { id: invite.link.id }), { code: "NOT_FOUND" });
    await f("put", "/family/links/:id", 0, { permissions: all, receivingAccountId: receiving.id }, { id: invite.link.id });
    assert.equal((await f("get", "/family", 0)).links[0].parentName, "Family synthetic 2");
    assert.equal((await child()).requests.status, "live");
    // Multiple accepted guardians, multiple children; neither grants access to the other's schedules.
    const second = await f("post", "/family/invitations", 0, { permissions: all, receivingAccountId: receiving.id });
    await f("post", "/parent/family-invitations/decide", 3, { token: second.token, action: "accept" });
    const otherChild = await f("post", "/family/invitations", 1, { permissions: none, receivingAccountId: null });
    await f("post", "/parent/family-invitations/decide", 2, { token: otherChild.token, action: "accept" });
    assert.equal((await f("get", "/parent/dashboard", 2)).children.length, 2);
    assert.equal((await f("get", "/parent/dashboard", 3)).children.length, 1);
    // Decline has no names; revoked and expired tokens have no redeemable access.
    const decline = await f("post", "/family/invitations", 1, { permissions: none, receivingAccountId: null });
    assert.deepEqual(await f("post", "/parent/family-invitations/decide", 3, { token: decline.token, action: "decline" }), { status: "declined" });
    const expiring = await f("post", "/family/invitations", 1, { permissions: none, receivingAccountId: null });
    await db.update(m.familyLinks).set({ expiresAt: new Date(0) }).where(eq(m.familyLinks.id, expiring.link.id));
    await assert.rejects(f("post", "/parent/family-invitations/decide", 3, { token: expiring.token, action: "accept" }), { code: "NOT_FOUND" });
    // Goals summary consent is not original goal-funding consent; original consent is not family consent.
    const g = await goals("post", "/goals", 0, { name: "Test goal", target: { minor: 500, currency: "JOD" }, targetDate: today, category: "books", priority: "low", notes: "private goal notes" });
    assert.equal((await child()).goals[0].id, g.id);
    await assert.rejects(goals("post", "/parent/goals/:id/contributions", 2, { amount: { minor: 1, currency: "JOD" }, simulatedFundingAcknowledged: true }, { id: g.id }), { code: "NOT_FOUND" });
    const isolatedGoal = await goals("post", "/goals", 1, { name: "Narrow consent only", target: { minor: 500, currency: "JOD" }, targetDate: today, category: "books", priority: "low", notes: "" });
    const goalToken = await goals("post", "/goals/:id/invitations", 1, { limitedConsentAcknowledged: true }, { id: isolatedGoal.id });
    await goals("post", "/parent/goal-invitations/redeem", 3, { token: goalToken.token, limitedConsentAcknowledged: true });
    await assert.rejects(f("get", "/parent/children/:childId", 3, null, { childId: ids[1] }), { code: "NOT_FOUND" });
    // Duplicate create/retry and atomic overspend: only one out of competing 700-unit transfers can post.
    await topup(1000);
    const createKey = randomUUID();
    const [a, same] = await Promise.all([create(700, {}, createKey), create(700, {}, createKey)]);
    assert.deepEqual(a, same);
    const retryKey = randomUUID();
    const receipts = await Promise.all([retry(a, retryKey), retry(a, retryKey)]);
    assert.deepEqual(receipts[0], receipts[1]);
    assert.equal(receipts[0].status, "completed");
    assert.equal(receipts[0].occurrences.length, 1);
    assert.equal(receipts[0].occurrences[0].status, "posted");
    const studentRows = await db.select().from(m.financeTransactions).where(and(eq(m.financeTransactions.userId, ids[0]), eq(m.financeTransactions.kind, "allowance")));
    assert.equal(studentRows.length, 1);
    assert.equal(studentRows[0].parentTransferId, receipts[0].occurrences[0].id);
    assert.equal(studentRows[0].category, "parent_allowance");
    assert.equal((await finance("get", "/finance/summary", 0)).cashflow[0].monthlyIncome.minor, 700);
    await assert.rejects(retry(a), { code: "CONFLICT" });
    const b = await create(200), c = await create(200);
    const competing = await Promise.all([retry(b), retry(c)]);
    assert.equal(competing.filter(r => r.status === "completed").length, 1);
    const failed = competing.find(r => r.lastFailure);
    assert.equal(failed.lastFailure, "insufficient_funds");
    assert.equal(failed.occurrences[0].status, "failed");
    assert.equal((await f("get", "/parent/wallet", 2)).accounts[0].balance.minor, 100);
    await assert.rejects(f("post", "/parent/children/:childId/allowances/:id/retry", 3, { retry: true }, ap(failed)), { code: "NOT_FOUND" });
    await assert.rejects(f("post", "/parent/children/:childId/allowances/:id/retry", 2, { retry: true }, { childId: ids[1], id: failed.id }), { code: "NOT_FOUND" });
    const failedOccurrenceId = failed.occurrences[0].id;
    await topup(100);
    const recovered = await retry(failed);
    assert.equal(recovered.status, "completed");
    assert.equal(recovered.occurrences[0].id, failedOccurrenceId);
    assert.equal(recovered.lastFailure, null);
    // Parent DTOs cannot leak campus activity through summary, free text, balances after transactions or nested receipts.
    await db.transaction(async tx => {
      let account = (await m.lockedAccounts(tx, [receiving.id])).get(receiving.id);
      await m.post(tx, account, -50n, { kind: "payment", category: "cafeteria", serviceId: randomUUID(), merchantName: "SECRET_CAMPUS", note: "SECRET_NOTE" });
    });
    // Exercise alias canonicalization through the real planning API, not hand-inserted categories.
    const privatePlanningIds = [];
    for (const [alias, canonical] of [["cafeteria", "food"], ["bookstore", "books"], ["campus_transportation", "transportation"], ["fees", "university_fees"]]) {
      const recurringExpense = await plan("post", "/planning/recurring-expenses", 0, {
        category: alias, amount: { minor: 1, currency: "JOD" }, frequency: "monthly",
        nextDate: today, description: "SECRET_CAMPUS_PLANNING", active: true,
      });
      const line = await plan("post", "/planning/lines", 0, {
        category: alias, type: "fixed", amount: { minor: 1, currency: "JOD" },
        upcomingDate: today, description: "SECRET_CAMPUS_PLAN_LINE",
      });
      assert.equal(recurringExpense.category, canonical); assert.equal(line.category, canonical);
      privatePlanningIds.push(recurringExpense.id, line.id);
    }
    const nonCampusLine = await plan("post", "/planning/lines", 0, { category: "housing", type: "fixed",
      amount: { minor: 1, currency: "JOD" }, upcomingDate: today, description: "Rent" });
    const permissions = { ...all, campusSpending: false, balance: false, goals: false };
    await f("put", "/family/links/:id", 0, { permissions, receivingAccountId: receiving.id }, { id: invite.link.id });
    const limited = await child();
    assert(!("balance" in limited)); assert(!("goals" in limited)); assert(!("campusSpending" in limited));
    assert.equal(limited.monthlySummary[0].spending.minor, 0);
    assert.equal(limited.monthlySummary[0].campusIncluded, false);
    assert(limited.transactions.every(t => t.type !== "campus_payment" && !("balanceAfter" in t) && !("accountId" in t)));
    assert(!JSON.stringify(limited).includes("SECRET_"));
    assert.equal(limited.allowanceCurrency, "JOD");
    assert(limited.upcomingPayments.some(r => r.id === nonCampusLine.id));
    assert(limited.upcomingPayments.every(r => !privatePlanningIds.includes(r.id)));
    const studentPlanning = await plan("get", "/planning", 0);
    assert(privatePlanningIds.every(id => studentPlanning.upcoming.some(r => r.id === id)));
    await f("put", "/family/links/:id", 0, { permissions: all, receivingAccountId: receiving.id }, { id: invite.link.id });
    assert.equal((await child()).campusSpending[0].minor, 50);
    const campusPermitted = await child();
    assert(privatePlanningIds.every(id => campusPermitted.upcomingPayments.some(r => r.id === id)));
    // Manual upcoming expectations reconcile only a visible occurrence with the same currency/date.
    const tomorrow = new Date(Date.parse(today) + 86400000).toISOString().slice(0, 10);
    const datedSchedule = await create(1);
    const expectations = [];
    for (const [currency, expectedDate] of [["JOD", today], ["ILS", today], ["JOD", tomorrow]]) {
      const [entry] = await db.insert(m.incomes).values({ userId: ids[0], data: {
        source: "parent_allowance", amount: { minor: 1, currency }, frequency: "one_time",
        stability: "variable", active: true, expectedDate, description: "Separate manual expectation",
      } }).returning();
      expectations.push(entry);
    }
    for (const upcoming of [(await child()).upcomingPayments, (await plan("get", "/planning", 0)).upcoming]) {
      assert(!upcoming.some(r => r.id === expectations[0].id));
      assert(upcoming.some(r => r.id === expectations[1].id));
      assert(upcoming.some(r => r.id === expectations[2].id));
      assert(upcoming.some(r => r.id === datedSchedule.id));
    }
    // Defensively handle stale active schedules even if a legacy/direct revocation did not cancel them.
    await db.update(m.familyLinks).set({ permissions: { ...all, allowance: false } }).where(eq(m.familyLinks.id, invite.link.id));
    const noAllowance = await child();
    assert(!("allowanceCurrency" in noAllowance)); assert(!("allowances" in noAllowance));
    assert(noAllowance.upcomingPayments.every(r => r.source !== "allowance"));
    assert(expectations.every(e => noAllowance.upcomingPayments.some(r => r.id === e.id)));
    await f("put", "/family/links/:id", 0, { permissions: all, receivingAccountId: receiving.id }, { id: invite.link.id });
    await status(datedSchedule, "cancel");
    const expired = await create(1);
    const yesterday = new Date(Date.parse(today) - 86400000).toISOString().slice(0, 10);
    await db.update(m.allowances).set({ startDate: yesterday, nextPayment: yesterday, endDate: yesterday }).where(eq(m.allowances.id, expired.id));
    const expiredUpcoming = (await child()).upcomingPayments;
    assert(!expiredUpcoming.some(r => r.id === expired.id));
    assert(expectations.every(e => expiredUpcoming.some(r => r.id === e.id)));
    await status(expired, "cancel");
    await db.delete(m.incomes).where(inArray(m.incomes.id, expectations.map(r => r.id)));
    // Recurring forecasts use the manual envelope, not overwrite/double-count; actuals never enter the forecast.
    const [manual] = await db.insert(m.incomes).values({ userId: ids[0], data: { source: "parent_allowance",
      amount: { minor: 1000, currency: "JOD" }, frequency: "monthly", stability: "fixed", active: true, description: "User-owned envelope" } }).returning();
    const recurring = await create(200, { kind: "recurring", frequency: "weekly" });
    let projection = (await m.allowanceProjection(ids[0])).dto;
    assert.equal(projection.totals[0].manualMonthly.minor, 1000);
    assert.equal(projection.totals[0].scheduledMonthly.minor, 867);
    assert.equal(projection.totals[0].effectiveMonthly.minor, 1000);
    assert.equal((await plan("get", "/planning", 0)).totals[0].expectedIncome.minor, 1000);
    const recurring2 = await create(200, { kind: "recurring", frequency: "weekly" });
    projection = (await m.allowanceProjection(ids[0])).dto;
    assert.equal(projection.totals[0].scheduledMonthly.minor, 1733);
    assert.equal(projection.totals[0].adjustmentMonthly.minor, 733);
    assert.equal((await plan("get", "/planning", 0)).totals[0].expectedIncome.minor, 1733);
    assert.deepEqual((await db.select().from(m.incomes).where(eq(m.incomes.id, manual.id)))[0], manual);
    const pauseKey = randomUUID();
    await status(recurring2, "pause", pauseKey);
    assert.equal((await plan("get", "/planning", 0)).totals[0].expectedIncome.minor, 1000);
    await status(recurring2, "resume");
    await status(recurring2, "cancel");
    await assert.rejects(status(recurring2, "resume"), { code: "CONFLICT" });
    assert.equal(m.nextAllowanceDate("2025-01-31", "monthly", "2025-01-31"), "2025-02-28");
    assert.equal(m.nextAllowanceDate("2025-02-28", "monthly", "2025-01-31"), "2025-03-31");
    assert.equal(m.nextAllowanceDate("2024-01-31", "monthly", "2024-01-31"), "2024-02-29");
    // Two scheduler transactions race for the same date. Only one posts; next date is advanced once.
    await topup(1000);
    const worker = () => db.transaction(async tx => {
      const link = await m.lockedFamily(tx, ids[2], ids[0], "allowance");
      return m.processOccurrence(tx, link, await m.lockedAllowance(tx, recurring.id, link), today);
    });
    await Promise.all([worker(), worker()]);
    const recurringStored = (await list()).find(r => r.id === recurring.id);
    assert.equal(recurringStored.occurrences.length, 1);
    assert.equal(recurringStored.nextPayment, m.nextAllowanceDate(today, "weekly", today));
    // Due end-date final occurrence completes; invalid currency/account/amount never reaches ledger.
    const ending = await create(1, { kind: "recurring", frequency: "monthly", endDate: today });
    assert.equal((await retry(ending)).status, "completed");
    // Edits change only future metadata, and duplicate edits replay without a second change.
    const editable = await create(3, { kind: "recurring", frequency: "monthly" });
    const editInput = { parentAccountId: wallet.id, amount: { minor: 4, currency: "JOD" }, kind: "recurring",
      frequency: "biweekly", nextPayment: today, startDate: today, endDate: null, note: "Edited by parent" };
    const editKey = randomUUID();
    const edited = await f("put", "/parent/children/:childId/allowances/:id", 2, editInput, ap(editable), editKey);
    assert.equal(edited.amount.minor, 4);
    assert.deepEqual(await f("put", "/parent/children/:childId/allowances/:id", 2, editInput, ap(editable), editKey), edited);
    await retry(editable);
    await assert.rejects(f("put", "/parent/children/:childId/allowances/:id", 2, editInput, ap(editable)), { code: "CONFLICT" });
    // Removing only allowance consent cancels future schedules; re-enabling doesn't resurrect them.
    await f("put", "/family/links/:id", 0, { permissions: { ...all, allowance: false }, receivingAccountId: receiving.id }, { id: invite.link.id });
    assert(!("allowances" in await child()));
    await assert.rejects(retry(a, retryKey), { code: "NOT_FOUND" });
    await f("put", "/family/links/:id", 0, { permissions: all, receivingAccountId: receiving.id }, { id: invite.link.id });
    assert.equal((await list()).find(r => r.id === recurring.id).status, "cancelled");
    assert.equal((await list()).find(r => r.id === editable.id).occurrences.length, 1);
    await assert.rejects(create(0), { code: "BAD_REQUEST" });
    await assert.rejects(create(1, { amount: { minor: 1, currency: "ILS" } }), { code: "BAD_REQUEST" });
    await assert.rejects(create(1, { parentAccountId: receiving.id }), { code: "NOT_FOUND" });
    await assert.rejects(create(1, { studentId: ids[1] }), { code: "BAD_REQUEST" });
    // Revocation wins a held link lock before worker; no future posting, response replay rechecks permission.
    const pending = await create(10);
    let release, acquired;
    const lockAcquired = new Promise(resolve => { acquired = resolve; });
    const hold = new Promise(resolve => { release = resolve; });
    const revoke = db.transaction(async tx => {
      await tx.select().from(m.familyLinks).where(eq(m.familyLinks.id, invite.link.id)).for("update");
      acquired();
      await hold;
      await tx.update(m.familyLinks).set({ status: "revoked" }).where(eq(m.familyLinks.id, invite.link.id));
      await tx.update(m.allowances).set({ status: "cancelled" }).where(and(eq(m.allowances.familyLinkId, invite.link.id), eq(m.allowances.status, "active")));
    });
    await lockAcquired;
    const blocked = retry(pending);
    const blockedAssertion = assert.rejects(blocked, { code: "NOT_FOUND" });
    release();
    await revoke; await blockedAssertion;
    await assert.rejects(retry(a, retryKey), { code: "NOT_FOUND" });
    await assert.rejects(child(), { code: "NOT_FOUND" });
    assert.equal((await f("get", "/parent/dashboard", 2)).children.length, 1);
    assert.equal((await db.select().from(m.allowanceOccurrences).where(eq(m.allowanceOccurrences.allowanceId, pending.id))).length, 0);
    assert.equal((await plan("get", "/planning", 0)).totals[0].expectedIncome.minor, 1000);
    // Real revoke endpoint remains owner scoped and retains history.
    await f("delete", "/family/links/:id", 0, null, { id: second.link.id });
    await f("delete", "/family/links/:id", 0, null, { id: second.link.id });
    assert.equal((await f("get", "/parent/dashboard", 3)).children.length, 0);
    const family = await f("get", "/family", 0);
    assert(family.links.every(l => l.status !== "accepted" || l.parentName));
    assert(family.links.filter(l => l.status === "revoked").every(l => !("parentName" in l)));
    const completedStudent = family.allowances.find(s => s.id === a.id);
    assert.equal(completedStudent.occurrences.length, 1);
    assert(!("parentAccountId" in completedStudent));
    assert.deepEqual(completedStudent.occurrences[0].transactionIds, [studentRows[0].id]);
  } finally {
    if (ids.length) {
      const schedules = await db.select({ id: m.allowances.id }).from(m.allowances).where(inArray(m.allowances.studentId, ids));
      if (schedules.length) await db.delete(m.allowanceOccurrences).where(inArray(m.allowanceOccurrences.allowanceId, schedules.map(r => r.id)));
      await db.delete(m.allowances).where(inArray(m.allowances.studentId, ids));
      await db.delete(m.familyLinks).where(inArray(m.familyLinks.studentId, ids));
      const gs = await db.select({ id: m.savingsGoals.id }).from(m.savingsGoals).where(inArray(m.savingsGoals.userId, ids));
      if (gs.length) for (const t of [m.goalInvitations, m.goalHistory]) await db.delete(t).where(inArray(t.goalId, gs.map(r => r.id)));
      await db.delete(m.savingsGoals).where(inArray(m.savingsGoals.userId, ids));
      for (const t of [m.financeEvents, m.financeIdempotency, m.financeTransactions, m.planningBudgets, m.planningRecurring,
        m.planningLines, m.planningSettings, m.incomes, m.financeAccounts]) await db.delete(t).where(inArray(t.userId, ids));
      await db.delete(m.users).where(inArray(m.users.id, ids));
    }
    await pool.end();
  }
});