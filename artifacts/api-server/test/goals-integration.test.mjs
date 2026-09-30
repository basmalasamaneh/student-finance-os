import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { build } from "esbuild";

test("goal reserves, authenticated limited parent consent, exact planning and concurrent ledger invariants", { skip: !process.env.DATABASE_URL }, async () => {
  const compiled = await build({ stdin: { contents: `
    export { default as goalsRouter } from "./src/routes/goals.ts";
    export { default as financeRouter } from "./src/routes/finance.ts";
    export { default as planningRouter } from "./src/routes/planning.ts";
    export { goalMetrics } from "./src/lib/goal-math.ts";
    export { lockedAccounts } from "./src/lib/finance.ts";
    export * from "@workspace/db"; export { eq, inArray } from "drizzle-orm";`,
    resolveDir: new URL("..", import.meta.url).pathname, loader: "ts" },
    bundle: true, platform: "node", format: "cjs", write: false, external: ["*.node"] });
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  const m = module.exports, ids = [], goalIds = [], marker = randomUUID();
  const { db, pool, eq, inArray } = m;
  async function call(router, method, path, actor, body, params = {}, key = randomUUID()) {
    const layer = router.stack.find(l => l.route?.path === path && l.route.stack.some(h => h.method === method));
    assert(layer, path);
    const res = { locals: { principal: { userId: ids[actor], roles: [actor >= 2 ? "parent" : "student"] } },
      status(c) { this.code = c; return this; }, set() { return this; },
      json(data) { this.data = data; return this; }, sendStatus(c) { this.code = c; return this; } };
    await layer.route.stack.find(l => l.method === method).handle({ body, params, res, get: () => key }, res);
    return res.data ?? { status: res.code };
  }
  const g = (...args) => call(m.goalsRouter, ...args);
  const f = (...args) => call(m.financeRouter, ...args);
  const p = (...args) => call(m.planningRouter, ...args);
  const input = { name: "Laptop", target: { minor: 1001, currency: "JOD" }, targetDate: new Date().toISOString().slice(0, 10), category: "Education", priority: "high", notes: "private" };
  const fund = (goal, minor, key) => g("post", "/goals/:id/contributions", 0, { accountId: account.id, amount: { minor, currency: "JOD" } }, { id: goal.id }, key);
  let account;
  try {
    for (let i = 0; i < 4; i++) {
      const [u] = await db.insert(m.users).values({ name: "Goal isolated test", email: `${marker}-${i}@example.invalid`, role: i >= 2 ? "parent" : "student", passwordHash: "synthetic-not-login" }).returning();
      ids.push(u.id);
    }
    account = await f("post", "/finance/accounts", 0, { type: "wallet", name: "Test", currency: "JOD" });
    await f("post", "/finance/movements", 0, { accountId: account.id, kind: "add", amount: { minor: 2000, currency: "JOD" } });
    const goal = await g("post", "/goals", 0, input); goalIds.push(goal.id);
    assert.equal(goal.current.minor, 0);
    assert.equal(goal.requiredContributionMonthly.minor, 1001);
    assert.equal(goal.estimatedCompletion, null);
    const historyBeforeStatus = await g("get", "/goals/:id/history", 0, null, { id: goal.id });
    const statusKey = randomUUID();
    await assert.rejects(
      g("post", "/goals/:id/status", 0, { action: "pause", userId: ids[1] }, { id: goal.id }, statusKey),
      { code: "BAD_REQUEST", status: 400 },
    );
    assert.deepEqual(await g("get", "/goals/:id", 0, null, { id: goal.id }), goal);
    assert.deepEqual(await g("get", "/goals/:id/history", 0, null, { id: goal.id }), historyBeforeStatus);
    assert.equal((await db.select().from(m.financeIdempotency).where(eq(m.financeIdempotency.key, statusKey))).length, 0);
    await assert.rejects(g("get", "/goals/:id", 1, null, { id: goal.id }), { code: "NOT_FOUND" });
    await assert.rejects(g("get", "/goals", 2), { code: "FORBIDDEN" });
    await assert.rejects(g("post", "/goals", 0, { ...input, current: 40 }), { code: "BAD_REQUEST" });
    await assert.rejects(g("post", "/goals", 0, { ...input, target: { minor: 0, currency: "JOD" } }), { code: "BAD_REQUEST" });
    await assert.rejects(g("post", "/goals", 0, { ...input, target: { minor: 1.2, currency: "JOD" } }), { code: "BAD_REQUEST" });
    await assert.rejects(g("post", "/goals", 0, { ...input, target: { minor: 1, currency: "JOD", current: 1 } }), { code: "BAD_REQUEST" });
    await assert.rejects(g("post", "/goals/:id/invitations", 0, { limitedConsentAcknowledged: false }, { id: goal.id }), { code: "BAD_REQUEST" });
    await assert.rejects(g("post", "/goals/:id/contributions", 0, { accountId: account.id, amount: { minor: 1, currency: "JOD" }, source: "parent_simulated" }, { id: goal.id }), { code: "BAD_REQUEST" });
    const key = randomUUID();
    const receipts = await Promise.all([fund(goal, 301, key), fund(goal, 301, key)]);
    assert.deepEqual(receipts[0], receipts[1]);
    assert.equal(receipts[0].transactions.length, 2);
    assert.equal(receipts[0].goal.current.minor, 301);
    await assert.rejects(fund(goal, 302, key), { code: "CONFLICT" });
    await assert.rejects(g("put", "/goals/:id", 0, { ...input, target: { minor: 200, currency: "JOD" } }, { id: goal.id }), { code: "CONFLICT" });
    await assert.rejects(g("put", "/goals/:id", 0, { ...input, target: { minor: 1001, currency: "USD" } }, { id: goal.id }), { code: "CONFLICT" });
    const reserveId = receipts[0].transactions[1].accountId;
    assert.equal((await f("get", "/finance/accounts", 0)).length, 1);
    await assert.rejects(f("get", "/finance/accounts/:id", 0, null, { id: reserveId }), { code: "NOT_FOUND" });
    await assert.rejects(f("get", "/finance/recipients/:id", 1, null, { id: reserveId }), { code: "NOT_FOUND" });
    for (const kind of ["add", "receive", "deposit", "withdrawal", "payment"]) {
      await assert.rejects(f("post", "/finance/movements", 0, { kind, accountId: reserveId, amount: { minor: 1, currency: "JOD" } }), { code: "NOT_FOUND" });
    }
    await assert.rejects(f("post", "/finance/movements", 0, { kind: "transfer", accountId: account.id, recipientAccountId: reserveId, amount: { minor: 1, currency: "JOD" } }), { code: "NOT_FOUND" });
    await assert.rejects(db.transaction(tx => m.lockedAccounts(tx, [reserveId])), { code: "NOT_FOUND" }); // same guard used by campus payments
    await assert.rejects(f("post", "/finance/requests", 1, { recipientAccountId: reserveId, payerAccountId: account.id, amount: { minor: 1, currency: "JOD" } }), { code: "NOT_FOUND" });
    const budget = await p("post", "/planning/budgets", 0, { category: "savings", period: "monthly", limit: { minor: 1000, currency: "JOD" } });
    assert.equal(budget.actualSpent.minor, 301);
    await p("post", "/planning/lines", 0, { category: "savings", type: "savings", amount: { minor: 500, currency: "JOD" }, description: "Envelope" });
    let plan = await p("get", "/planning", 0);
    assert.equal(plan.totals[0].plannedSavings.minor, 700);
    assert.equal(plan.totals[0].expectedIncome.minor, 0);
    const invitation = await g("post", "/goals/:id/invitations", 0, { limitedConsentAcknowledged: true }, { id: goal.id });
    assert.equal(invitation.token.length, 43);
    const [stored] = await db.select().from(m.goalInvitations).where(eq(m.goalInvitations.id, invitation.invitation.id));
    assert.notEqual(stored.tokenHash, invitation.token);
    const redeem = actor => g("post", "/parent/goal-invitations/redeem", actor, { token: invitation.token, limitedConsentAcknowledged: true });
    await assert.rejects(redeem(0), { code: "FORBIDDEN" });
    const shared = await redeem(2);
    assert.deepEqual(Object.keys(shared).sort(), ["current", "id", "name", "remaining", "status", "target", "targetDate"].sort());
    await assert.rejects(redeem(3), { code: "NOT_FOUND" });
    assert.deepEqual(await redeem(2), shared);
    const parentKey = randomUUID(), parentBody = { amount: { minor: 200, currency: "JOD" }, simulatedFundingAcknowledged: true };
    await assert.rejects(g("post", "/parent/goals/:id/contributions", 2, { ...parentBody, userId: ids[0] }, { id: goal.id }), { code: "BAD_REQUEST" });
    await assert.rejects(g("post", "/parent/goals/:id/contributions", 2, { ...parentBody, simulatedFundingAcknowledged: false }, { id: goal.id }), { code: "BAD_REQUEST" });
    const parentFund = (actor = 2, k = parentKey) => g("post", "/parent/goals/:id/contributions", actor, parentBody, { id: goal.id }, k);
    await assert.rejects(parentFund(3), { code: "NOT_FOUND" });
    const parentReceipt = await parentFund();
    assert.equal(parentReceipt.goal.current.minor, 501);
    assert(!JSON.stringify(parentReceipt).includes(reserveId));
    assert.deepEqual(await parentFund(), parentReceipt);
    await assert.rejects(g("delete", "/goals/:id/invitations/:invitationId", 0, { userId: ids[1] },
      { id: goal.id, invitationId: invitation.invitation.id }), { code: "BAD_REQUEST", status: 400 });
    assert.equal((await db.select().from(m.goalInvitations).where(eq(m.goalInvitations.id, invitation.invitation.id)))[0].revokedAt, null);
    await g("delete", "/goals/:id/invitations/:invitationId", 0, null, { id: goal.id, invitationId: invitation.invitation.id });
    await assert.rejects(parentFund(), { code: "NOT_FOUND" });
    await assert.rejects(redeem(2), { code: "NOT_FOUND" });
    assert.deepEqual(await g("get", "/parent/goals", 2), []);
    const expiring = await g("post", "/goals/:id/invitations", 0, { limitedConsentAcknowledged: true }, { id: goal.id });
    await db.update(m.goalInvitations).set({ expiresAt: new Date(0) }).where(eq(m.goalInvitations.id, expiring.invitation.id));
    await assert.rejects(g("post", "/parent/goal-invitations/redeem", 2, { token: expiring.token, limitedConsentAcknowledged: true }), { code: "NOT_FOUND" });
    await g("post", "/goals/:id/status", 0, { action: "pause" }, { id: goal.id });
    assert.equal((await g("get", "/goals/:id", 0, null, { id: goal.id })).requiredContributionMonthly, null);
    await assert.rejects(fund(goal, 1), { code: "CONFLICT" });
    await assert.rejects(g("post", "/goals/:id/status", 0, { action: "complete" }, { id: goal.id }), { code: "CONFLICT" });
    await g("post", "/goals/:id/status", 0, { action: "resume" }, { id: goal.id });
    const concurrent = await Promise.allSettled([fund(goal, 500), fund(goal, 500)]);
    assert.equal(concurrent.filter(r => r.status === "fulfilled").length, 1);
    await g("post", "/goals/:id/status", 0, { action: "complete" }, { id: goal.id });
    await g("post", "/goals/:id/status", 0, { action: "archive" }, { id: goal.id });
    await assert.rejects(g("post", "/goals/:id/status", 0, { action: "resume" }, { id: goal.id }), { code: "CONFLICT" });
    const summary = await f("get", "/finance/summary", 0);
    assert.equal(summary.cashflow[0].balance.minor, 1199);
    assert.equal(summary.cashflow[0].reservedBalance.minor, 1001);
    assert.equal(summary.cashflow[0].netBalance.minor, 2200);
    assert.equal(summary.cashflow[0].monthlyIncome.minor, 2200);
    assert.equal(summary.cashflow[0].monthlySpending.minor, 0);
    plan = await p("get", "/planning", 0);
    assert.equal(plan.budgets[0].actualSpent.minor, 1001);
    assert.equal(plan.totals[0].plannedSavings.minor, 500);
    const more = await g("post", "/goals", 0, { ...input, target: { minor: 10000, currency: "JOD" } }); goalIds.push(more.id);
    const overspend = await Promise.allSettled([fund(more, 1000), fund(more, 1000)]);
    assert.equal(overspend.filter(r => r.status === "fulfilled").length, 1);
    const metrics = m.goalMetrics(1001n, 301n, "active", "2026-03-31", [], new Date("2026-01-15"));
    assert.equal(metrics.required, 234);
    assert.equal(metrics.estimatedCompletion, null);
    assert.equal(m.goalMetrics(1000n, 500n, "active", null, [{ amountMinor: 100n, createdAt: new Date("2026-01-01") }, { amountMinor: 400n, createdAt: new Date("2026-01-05") }], new Date("2026-01-05")).estimatedCompletion, "2026-01-10");
  } finally {
    if (ids.length) {
      const owned = await db.select({ id: m.savingsGoals.id }).from(m.savingsGoals).where(inArray(m.savingsGoals.userId, ids));
      const gids = owned.map(g => g.id);
      if (gids.length) {
        await db.delete(m.goalInvitations).where(inArray(m.goalInvitations.goalId, gids));
        await db.delete(m.goalHistory).where(inArray(m.goalHistory.goalId, gids));
        await db.delete(m.savingsGoals).where(inArray(m.savingsGoals.id, gids));
      }
      for (const t of [m.financeEvents, m.financeIdempotency, m.financeTransactions, m.planningBudgets, m.planningLines, m.financeAccounts]) await db.delete(t).where(inArray(t.userId, ids));
      await db.delete(m.users).where(inArray(m.users.id, ids));
    }
    await pool.end();
  }
});