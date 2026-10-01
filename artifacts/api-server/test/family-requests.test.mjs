import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { build } from "esbuild";

test("family requests: exact paired income, different-key concurrency, rollback, conversation, revocation and consent-scoped durable inbox", { skip: !process.env.DATABASE_URL }, async () => {
  const compiled = await build({ stdin: { contents: `
    export { default as requestsRouter } from "./src/routes/family-requests.ts";
    export { default as notificationsRouter } from "./src/routes/notifications.ts";
    export { default as familyRouter } from "./src/routes/family.ts";
    export { default as financeRouter } from "./src/routes/finance.ts";
    export { default as goalsRouter } from "./src/routes/goals.ts";
    export { notify, visibleNotifications } from "./src/lib/notifications.ts";
    export { cancelLinkRequests } from "./src/lib/family-requests.ts";
    export * from "@workspace/db"; export { eq, inArray, and } from "drizzle-orm";`,
    resolveDir: new URL("..", import.meta.url).pathname, loader: "ts" },
    bundle: true, platform: "node", format: "cjs", write: false, external: ["*.node"] });
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  const m = module.exports, { db, pool, eq, inArray, and } = m, ids = [], marker = randomUUID();
  const today = new Date().toISOString().slice(0, 10);
  const none = { monthlySummary: false, balance: false, goals: false, allowance: false, requests: false,
    transactions: false, upcomingPayments: false, campusSpending: false };
  const requestConsent = { ...none, requests: true };
  async function call(router, method, path, actor, body, params = {}, key = randomUUID()) {
    const layer = router.stack.find(l => l.route?.path === path && l.route.stack.some(h => h.method === method));
    assert(layer, `${method} ${path}`);
    const res = { locals: { principal: { userId: ids[actor], roles: [actor >= 2 ? "parent" : "student"] } },
      status(c) { this.code = c; return this; }, set() { return this; },
      json(data) { this.data = data; return this; }, sendStatus(c) { this.code = c; return this; } };
    await layer.route.stack.find(l => l.method === method).handle({ body, params, res, get: () => key }, res);
    return res.data ?? { status: res.code };
  }
  const f = (...a) => call(m.familyRouter, ...a);
  const r = (...a) => call(m.requestsRouter, ...a);
  const n = (...a) => call(m.notificationsRouter, ...a);
  const finance = (...a) => call(m.financeRouter, ...a);
  const goals = (...a) => call(m.goalsRouter, ...a);
  const inbox = actor => n("get", "/notifications", actor);
  const count = actor => n("get", "/notifications/unread-count", actor);
  let receiving, alternate, wallet, link;
  const create = (minor = 100, overrides = {}, key) => r("post", "/family/requests", 0, {
    familyLinkId: link.id, receivingAccountId: alternate.id, amount: { minor, currency: "JOD" },
    reason: "Books", note: "Private request note", date: today, ...overrides,
  }, {}, key);
  const approve = (row, key) => r("post", "/parent/requests/:id/approve", 2, { parentAccountId: wallet.id }, { id: row.id }, key);
  const detail = (row, actor = 0) => r("get", actor >= 2 ? "/parent/requests/:id" : "/family/requests/:id", actor, null, { id: row.id });
  const topup = minor => f("post", "/parent/wallet/topups", 2, { accountId: wallet.id, amount: { minor, currency: "JOD" }, simulatedFundingAcknowledged: true });
  const consent = permissions => f("put", "/family/links/:id", 0, { permissions, receivingAccountId: receiving.id }, { id: link.id });
  const ledger = () => db.select().from(m.financeTransactions).where(and(inArray(m.financeTransactions.userId, ids), eq(m.financeTransactions.kind, "family_request")));
  try {
    for (let i = 0; i < 4; i++) {
      const [u] = await db.insert(m.users).values({ name: `Request synthetic ${i}`, email: `${marker}-${i}@example.invalid`,
        role: i >= 2 ? "parent" : "student", passwordHash: "synthetic-not-login" }).returning();
      ids.push(u.id);
    }
    receiving = await finance("post", "/finance/accounts", 0, { type: "wallet", name: "Allowance destination", currency: "JOD" });
    alternate = await finance("post", "/finance/accounts", 0, { type: "bank", name: "Request destination", currency: "JOD" });
    const foreign = await finance("post", "/finance/accounts", 1, { type: "wallet", name: "Other student", currency: "JOD" });
    const usd = await finance("post", "/finance/accounts", 0, { type: "wallet", name: "USD", currency: "USD" });
    wallet = await f("post", "/parent/wallet/accounts", 2, { type: "wallet", name: "Parent", currency: "JOD" });
    const invitation = await f("post", "/family/invitations", 0, { permissions: requestConsent, receivingAccountId: null });
    link = invitation.link;
    // Pending links and roles cannot be used; requests consent works without allowance receiving account.
    await assert.rejects(create(), { code: "NOT_FOUND" });
    await f("post", "/parent/family-invitations/decide", 2, { token: invitation.token, action: "accept" });
    await assert.rejects(r("get", "/family/requests", 2), { code: "FORBIDDEN" });
    await assert.rejects(r("get", "/parent/requests", 0), { code: "FORBIDDEN" });
    await assert.rejects(create(0), { code: "BAD_REQUEST" });
    await assert.rejects(create(1.5), { code: "BAD_REQUEST" });
    await assert.rejects(create(1, { reason: " " }), { code: "BAD_REQUEST" });
    await assert.rejects(create(1, { date: "2026-02-30" }), { code: "BAD_REQUEST" });
    await assert.rejects(create(1, { parentId: ids[3] }), { code: "BAD_REQUEST" });
    await assert.rejects(create(1, { receivingAccountId: foreign.id }), { code: "NOT_FOUND" });
    await assert.rejects(create(1, { receivingAccountId: usd.id }), { code: "BAD_REQUEST" });
    const key = randomUUID();
    const [request, replay] = await Promise.all([create(700, {}, key), create(700, {}, key)]);
    assert.deepEqual(request, replay);
    await assert.rejects(create(701, {}, key), { code: "CONFLICT" });
    assert.equal((await r("get", "/family/requests", 0)).length, 1);
    assert.equal(request.receivingAccountId, alternate.id);
    assert.equal((await ledger()).length, 0);
    assert.equal((await inbox(2)).items.filter(x => x.type === "request").length, 1);
    assert.equal((await count(2)).unreadCount, 1);
    const pdetail = await detail(request, 2);
    assert(!("receivingAccountId" in pdetail));
    assert.equal(pdetail.parentId, ids[2]);
    await assert.rejects(detail(request, 1), { code: "NOT_FOUND" });
    await assert.rejects(detail(request, 3), { code: "NOT_FOUND" });
    const otherInvite = await f("post", "/family/invitations", 0, { permissions: requestConsent, receivingAccountId: null });
    await f("post", "/parent/family-invitations/decide", 3, { token: otherInvite.token, action: "accept" });
    assert.deepEqual(await r("get", "/parent/requests", 3), []);
    await assert.rejects(r("post", "/parent/requests/:id/approve", 3, { parentAccountId: wallet.id }, { id: request.id }), { code: "NOT_FOUND" });
    const dashboard = await f("get", "/parent/dashboard", 2);
    assert.equal(dashboard.requestsStatus, "live");
    assert.equal(dashboard.children[0].requests.status, "live");
    assert.equal(dashboard.children[0].requests.items[0].id, request.id);
    assert.deepEqual((await f("get", "/parent/dashboard", 3)).children[0].requests.items, []);
    // Question/reply are durable history and notifications, no funds.
    const questionKey = randomUUID();
    const ask = () => r("post", "/parent/requests/:id/ask-details", 2, { message: "Which books?" }, { id: request.id }, questionKey);
    const question = await ask();
    assert.equal(question.status, "details_requested");
    assert.deepEqual(await ask(), question);
    assert.equal(question.history.length, 1);
    const replyKey = randomUUID();
    const answer = () => r("post", "/family/requests/:id/reply", 0, { message: "Chemistry textbook" }, { id: request.id }, replyKey);
    const replied = await answer();
    assert.equal(replied.status, "pending");
    assert.deepEqual(await answer(), replied);
    assert.deepEqual(replied.history.map(x => x.role), ["parent", "student"]);
    await assert.rejects(r("post", "/family/requests/:id/reply", 0, { message: "Extra" }, { id: request.id }), { code: "CONFLICT" });
    assert.equal((await ledger()).length, 0);
    assert.equal((await inbox(0)).items.filter(x => x.type === "ask_details").length, 1);
    assert.equal((await inbox(2)).items.filter(x => x.type === "reply").length, 1);
    // Insufficient funds rolls back ledger, status, inbox and key; the SAME key can later succeed.
    const failedKey = randomUUID(), before = await count(2);
    await assert.rejects(approve(request, failedKey), { code: "INSUFFICIENT_FUNDS" });
    assert.equal((await ledger()).length, 0);
    assert.equal((await detail(request)).status, "pending");
    assert.deepEqual(await count(2), before);
    assert.equal((await db.select().from(m.financeIdempotency).where(and(eq(m.financeIdempotency.userId, ids[2]), eq(m.financeIdempotency.key, failedKey)))).length, 0);
    await topup(1000);
    const approved = await approve(request, failedKey);
    assert.equal(approved.status, "approved");
    assert.deepEqual(await approve(request, failedKey), approved);
    await assert.rejects(r("post", "/parent/requests/:id/approve", 2, { parentAccountId: alternate.id },
      { id: request.id }, failedKey), { code: "CONFLICT" });
    await assert.rejects(approve(request), { code: "CONFLICT" });
    const pair = await ledger();
    assert.equal(pair.length, 2);
    assert(pair.every(x => x.parentTransferId === approved.parentTransferId && x.amountMinor === 700n && x.category === "parent_allowance"));
    assert.equal(pair.find(x => x.direction === "credit").accountId, alternate.id);
    assert.equal(pair.find(x => x.direction === "debit").accountId, wallet.id);
    assert.equal(pair.find(x => x.direction === "debit").note, null);
    assert.equal(pair.find(x => x.direction === "debit").counterpartyAccountId, null);
    assert.equal(pair.find(x => x.direction === "credit").note, "Private request note");
    const ownDebit = (await f("get", "/parent/wallet", 2)).transactions.find(t => t.id === approved.transactionIds[0]);
    assert.equal(ownDebit.accountId, wallet.id);
    assert.equal(ownDebit.amount.minor, 700);
    assert.equal(ownDebit.balanceAfter.minor, 300);
    assert(!("note" in ownDebit) && !("counterpartyAccountId" in ownDebit));
    assert.deepEqual(approved.transactionIds, [pair.find(x => x.direction === "debit").id]);
    assert.deepEqual((await detail(request)).transactionIds, [pair.find(x => x.direction === "credit").id]);
    assert.equal((await finance("get", "/finance/summary", 0)).cashflow.find(x => x.currency === "JOD").monthlyIncome.minor, 700);
    assert.equal((await db.select().from(m.incomes).where(eq(m.incomes.userId, ids[0]))).length, 0);
    // Concurrent DIFFERENT keys against one request produce exactly one posting.
    const competing = await create(100);
    const results = await Promise.allSettled([approve(competing), approve(competing)]);
    assert.equal(results.filter(x => x.status === "fulfilled").length, 1);
    assert.equal(results.find(x => x.status === "rejected").reason.code, "CONFLICT");
    assert.equal((await ledger()).length, 4);
    // Concurrent separate requests cannot overdraw a common account.
    const c1 = await create(150), c2 = await create(150);
    const overspend = await Promise.allSettled([approve(c1), approve(c2)]);
    assert.equal(overspend.filter(x => x.status === "fulfilled").length, 1);
    assert.equal(overspend.find(x => x.status === "rejected").reason.code, "INSUFFICIENT_FUNDS");
    assert.equal((await f("get", "/parent/wallet", 2)).accounts[0].balance.minor, 50);
    // Explicit decline/cancel never create ledger entries; terminal guards protect all actions.
    const declined = await create(1), cancelled = await create(1), ledgerCount = (await ledger()).length;
    assert.equal((await r("post", "/parent/requests/:id/decline", 2, null, { id: declined.id })).status, "declined");
    assert.equal((await r("post", "/family/requests/:id/cancel", 0, null, { id: cancelled.id })).status, "cancelled");
    await assert.rejects(approve(declined), { code: "CONFLICT" });
    await assert.rejects(approve(cancelled), { code: "CONFLICT" });
    assert.equal((await ledger()).length, ledgerCount);
    const terminalRace = await create(1);
    const terminalResults = await Promise.allSettled([
      r("post", "/parent/requests/:id/decline", 2, null, { id: terminalRace.id }),
      r("post", "/family/requests/:id/cancel", 0, null, { id: terminalRace.id }),
    ]);
    assert.equal(terminalResults.filter(x => x.status === "fulfilled").length, 1);
    assert.equal(terminalResults.find(x => x.status === "rejected").reason.code, "CONFLICT");
    assert.equal((await detail(terminalRace)).status, terminalResults.find(x => x.status === "fulfilled").value.status);
    assert.equal((await ledger()).length, ledgerCount);
    // Owner-only inbox, durable dedupe, scoped deep links and read idempotency.
    const requestNotice = (await inbox(2)).items.find(x => x.type === "request");
    assert.match(requestNotice.href, /^\/parent\/requests\/[\da-f-]+$/);
    assert(!("sourceId" in requestNotice) && !("familyLinkId" in requestNotice) && !("payload" in requestNotice));
    await assert.rejects(n("post", "/notifications/:id/read", 3, null, { id: requestNotice.id }), { code: "NOT_FOUND" });
    const marked = await n("post", "/notifications/:id/read", 2, null, { id: requestNotice.id });
    assert(marked.readAt);
    assert.deepEqual(await n("post", "/notifications/:id/read", 2, null, { id: requestNotice.id }), marked);
    const [storedNotice] = await db.select().from(m.inAppNotifications).where(eq(m.inAppNotifications.id, requestNotice.id));
    await db.transaction(tx => m.notify(tx, { ...storedNotice, id: randomUUID() }));
    assert.equal((await db.select().from(m.inAppNotifications).where(and(eq(m.inAppNotifications.recipientId, ids[2]),
      eq(m.inAppNotifications.type, storedNotice.type), eq(m.inAppNotifications.sourceId, storedNotice.sourceId)))).length, 1);
    assert.equal((await count(2)).unreadCount, (await inbox(2)).items.filter(x => !x.readAt).length);
    // Toggle ONLY requests permission off while the link remains accepted and balance stays on.
    // This is distinct from removing the link or disabling all sharing permissions.
    const sharingBeforeToggle = { ...requestConsent, balance: true };
    await consent(sharingBeforeToggle);
    const pending = await create(1), awaiting = await create(1);
    const detailsBeforeToggle = await r("post", "/parent/requests/:id/ask-details", 2, { message: "Why?" }, { id: awaiting.id });
    const preservedIds = [request.id, declined.id, cancelled.id];
    const terminalRowsBefore = await db.select().from(m.familyMoneyRequests).where(inArray(m.familyMoneyRequests.id, preservedIds))
      .orderBy(m.familyMoneyRequests.id);
    const cancellationStarted = Date.now();
    const toggled = await consent({ ...sharingBeforeToggle, requests: false });
    assert.equal(toggled.status, "accepted");
    assert.equal(toggled.receivingAccountId, receiving.id);
    assert.deepEqual(toggled.permissions, { ...sharingBeforeToggle, requests: false });
    const cancelledWhileHidden = await db.select().from(m.familyMoneyRequests).where(inArray(m.familyMoneyRequests.id, [pending.id, awaiting.id]));
    assert.equal(cancelledWhileHidden.length, 2);
    for (const row of cancelledWhileHidden) {
      assert.equal(row.status, "cancelled");
      assert(row.updatedAt.getTime() >= cancellationStarted);
      const previous = row.id === pending.id ? pending : detailsBeforeToggle;
      assert(row.updatedAt.getTime() > Date.parse(previous.updatedAt));
    }
    const terminalRowsAfter = await db.select().from(m.familyMoneyRequests).where(inArray(m.familyMoneyRequests.id, preservedIds))
      .orderBy(m.familyMoneyRequests.id);
    assert.deepEqual(terminalRowsAfter, terminalRowsBefore);
    const revokedWallet = await f("get", "/parent/wallet", 2);
    const retainedDebit = revokedWallet.transactions.find(t => t.id === ownDebit.id);
    assert.deepEqual(retainedDebit, ownDebit);
    assert(!JSON.stringify(revokedWallet).includes("Private request note"));
    assert(!JSON.stringify(revokedWallet).includes(alternate.id));
    assert(!JSON.stringify(revokedWallet).includes(receiving.id));
    assert.deepEqual(await r("get", "/parent/requests", 2), []);
    assert.deepEqual(await r("get", "/family/requests", 0), []);
    await assert.rejects(approve(request, failedKey), { code: "NOT_FOUND" });
    await assert.rejects(create(700, {}, key), { code: "NOT_FOUND" });
    await assert.rejects(detail(request), { code: "NOT_FOUND" });
    const hidden = await inbox(2);
    assert(hidden.items.length > 0 && hidden.items.every(x => x.type === "permission_changed"));
    assert(hidden.items.every(x => Object.keys(x).sort().join() === ["id", "type", "title", "createdAt", "readAt"].sort().join()));
    assert.equal((await count(2)).unreadCount, hidden.items.filter(x => !x.readAt).length);
    await assert.rejects(n("post", "/notifications/:id/read", 2, null, { id: requestNotice.id }), { code: "NOT_FOUND" });
    await n("post", "/notifications/read-all", 2);
    assert.equal((await count(2)).unreadCount, 0);
    const unmarkedHidden = await db.select().from(m.inAppNotifications).where(and(eq(m.inAppNotifications.recipientId, ids[2]), eq(m.inAppNotifications.type, "reply")));
    assert(unmarkedHidden.every(x => x.readAt === null));
    await consent(sharingBeforeToggle);
    // Fresh student list after regrant proves cancelled status and the original cancellation
    // timestamps survive; while permission is off, the list intentionally omits denied links.
    const freshlyListed = await r("get", "/family/requests", 0);
    for (const row of cancelledWhileHidden) {
      const fresh = freshlyListed.find(x => x.id === row.id);
      assert.equal(fresh.status, "cancelled");
      assert.equal(fresh.updatedAt, row.updatedAt.toISOString());
    }
    assert.equal((await detail(pending)).status, "cancelled");
    assert.equal((await detail(awaiting)).status, "cancelled");
    await assert.rejects(approve(pending), { code: "CONFLICT" });
    await assert.rejects(approve(awaiting), { code: "CONFLICT" });
    await assert.rejects(r("post", "/family/requests/:id/reply", 0, { message: "Cannot revive" }, { id: awaiting.id }), { code: "CONFLICT" });
    // Requests cannot use an arbitrary student reserve or foreign parent source.
    const goal = await goals("post", "/goals", 0, { name: "Goal", target: { minor: 1000, currency: "JOD" }, targetDate: today, category: "books", priority: "low", notes: "" });
    const [storedGoal] = await db.select().from(m.savingsGoals).where(eq(m.savingsGoals.id, goal.id));
    await assert.rejects(create(1, { receivingAccountId: storedGoal.reserveAccountId }), { code: "NOT_FOUND" });
    const wrongSource = await create(1);
    await assert.rejects(r("post", "/parent/requests/:id/approve", 2, { parentAccountId: alternate.id }, { id: wrongSource.id }), { code: "NOT_FOUND" });
    const parentUsd = await f("post", "/parent/wallet/accounts", 2, { type: "wallet", name: "Parent USD", currency: "USD" });
    const [parentReserve] = await db.insert(m.financeAccounts).values({
      userId: ids[2], type: "goal_reserve", name: "Synthetic inaccessible reserve", currency: "JOD",
    }).returning();
    await assert.rejects(r("post", "/parent/requests/:id/approve", 2, { parentAccountId: parentUsd.id }, { id: wrongSource.id }), { code: "BAD_REQUEST" });
    await assert.rejects(r("post", "/parent/requests/:id/approve", 2, { parentAccountId: parentReserve.id }, { id: wrongSource.id }), { code: "NOT_FOUND" });
    assert.equal((await detail(wrongSource)).status, "pending");
    assert.equal((await ledger()).length, ledgerCount);
    // Original goal funding remains external, not wallet-funded; family consent is insufficient.
    await consent({ ...requestConsent, goals: true });
    const fundingBody = { amount: { minor: 10, currency: "JOD" }, simulatedFundingAcknowledged: true };
    await assert.rejects(goals("post", "/parent/goals/:id/contributions", 2, fundingBody, { id: goal.id }), { code: "NOT_FOUND" });
    const gi = await goals("post", "/goals/:id/invitations", 0, { limitedConsentAcknowledged: true }, { id: goal.id });
    await goals("post", "/parent/goal-invitations/redeem", 2, { token: gi.token, limitedConsentAcknowledged: true });
    const fundKey = randomUUID();
    const funded = await goals("post", "/parent/goals/:id/contributions", 2, fundingBody, { id: goal.id }, fundKey);
    assert.deepEqual(await goals("post", "/parent/goals/:id/contributions", 2, fundingBody, { id: goal.id }, fundKey), funded);
    assert.equal((await f("get", "/parent/wallet", 2)).accounts[0].balance.minor, 50);
    assert.equal((await inbox(2)).items.filter(x => x.type === "goal_funded").length, 1);
    assert.equal((await inbox(0)).items.filter(x => x.type === "goal_funded").length, 1);
    await consent(none);
    const narrow = (await inbox(2)).items.find(x => x.type === "goal_funded");
    assert.equal(narrow.href, `/goals/fund?goalId=${goal.id}`);
    await goals("delete", "/goals/:id/invitations/:invitationId", 0, null, { id: goal.id, invitationId: gi.invitation.id });
    assert(!(await inbox(2)).items.some(x => x.type === "goal_funded"));
    await assert.rejects(n("post", "/notifications/:id/read", 2, null, { id: narrow.id }), { code: "NOT_FOUND" });
    // Replacement exact-goal consent also cannot authorize historical notifications from revoked grant.
    const gi2 = await goals("post", "/goals/:id/invitations", 0, { limitedConsentAcknowledged: true }, { id: goal.id });
    await goals("post", "/parent/goal-invitations/redeem", 2, { token: gi2.token, limitedConsentAcknowledged: true });
    assert(!(await inbox(2)).items.some(x => x.type === "goal_funded"));
    // Allowance notifications are emitted once from occurrence posting, not once for each ledger leg.
    await consent({ ...none, allowance: true });
    const schedule = await f("post", "/parent/children/:childId/allowances", 2, { parentAccountId: wallet.id,
      amount: { minor: 20, currency: "JOD" }, kind: "oneTime", frequency: null,
      nextPayment: today, startDate: today, endDate: null, note: "" }, { childId: ids[0] });
    const allowanceKey = randomUUID(), ap = { childId: ids[0], id: schedule.id };
    const pay = () => f("post", "/parent/children/:childId/allowances/:id/retry", 2, { retry: true }, ap, allowanceKey);
    const paid = await pay();
    assert.deepEqual(await pay(), paid);
    assert.equal((await inbox(2)).items.filter(x => x.type === "allowance_posted").length, 1);
    assert.equal((await inbox(0)).items.filter(x => x.type === "allowance_posted").length, 1);
    await consent({ ...requestConsent, goals: true });
    assert(!(await inbox(2)).items.some(x => x.type === "allowance_posted"));
    // A held revocation scope lock prevents a racing approval from replaying/posting after commit.
    const raced = await create(1);
    let unlock, started;
    const ready = new Promise(resolve => { started = resolve; });
    const gate = new Promise(resolve => { unlock = resolve; });
    const revoke = db.transaction(async tx => {
      await tx.select().from(m.familyLinks).where(eq(m.familyLinks.id, link.id)).for("update");
      await tx.update(m.familyLinks).set({ permissions: none }).where(eq(m.familyLinks.id, link.id));
      await m.cancelLinkRequests(tx, link.id);
      started();
      await gate;
    });
    await ready;
    const racedApproval = approve(raced).then(() => null, error => error);
    unlock();
    await revoke;
    assert.equal((await racedApproval).code, "NOT_FOUND");
    await consent(requestConsent);
    assert.equal((await detail(raced)).status, "cancelled");
    // Removing and replacing a family link never authorizes old requests or notification details.
    await f("delete", "/family/links/:id", 0, null, { id: link.id });
    const replacement = await f("post", "/family/invitations", 0, { permissions: requestConsent, receivingAccountId: null });
    await f("post", "/parent/family-invitations/decide", 2, { token: replacement.token, action: "accept" });
    await assert.rejects(detail(request, 2), { code: "NOT_FOUND" });
    assert.deepEqual(await r("get", "/parent/requests", 2), []);
    assert((await inbox(2)).items.every(x => x.type === "permission_changed"));
    assert.equal((await db.select().from(m.moneyRequests).where(inArray(m.moneyRequests.issuerId, ids))).length, 0);
    // Simulate immutable pre-fix receipts without rewriting any existing ledger entry.
    // Read-time sanitization must cover old requests AND old allowance counterparties.
    const [originalAllowanceDebit] = await db.select().from(m.financeTransactions).where(and(
      eq(m.financeTransactions.userId, ids[2]), eq(m.financeTransactions.kind, "allowance"),
    ));
    const [legacyRequest] = await db.insert(m.financeTransactions).values({
      ...pair.find(x => x.direction === "debit"), id: randomUUID(), parentTransferId: randomUUID(),
      note: "Legacy private student note", counterpartyAccountId: alternate.id,
    }).returning();
    const [legacyAllowance] = await db.insert(m.financeTransactions).values({
      ...originalAllowanceDebit, id: randomUUID(), parentTransferId: randomUUID(),
      note: "Parent-authored own allowance note", counterpartyAccountId: receiving.id,
    }).returning();
    const historicalWallet = await f("get", "/parent/wallet", 2);
    const oldRequestReceipt = historicalWallet.transactions.find(t => t.id === legacyRequest.id);
    assert.equal(oldRequestReceipt.amount.minor, 700);
    assert.equal(oldRequestReceipt.accountId, wallet.id);
    assert.equal(oldRequestReceipt.parentTransferId, legacyRequest.parentTransferId);
    assert.equal(oldRequestReceipt.createdAt, legacyRequest.createdAt.toISOString());
    assert(!("note" in oldRequestReceipt) && !("counterpartyAccountId" in oldRequestReceipt));
    const oldAllowanceReceipt = historicalWallet.transactions.find(t => t.id === legacyAllowance.id);
    assert.equal(oldAllowanceReceipt.amount.minor, 20);
    assert.equal(oldAllowanceReceipt.note, "Parent-authored own allowance note");
    assert(!("counterpartyAccountId" in oldAllowanceReceipt));
    assert(!JSON.stringify(historicalWallet).includes("Legacy private student note"));
    assert(!JSON.stringify(historicalWallet).includes(alternate.id));
    assert(!JSON.stringify(historicalWallet).includes(receiving.id));
    const [unchangedRequest] = await db.select().from(m.financeTransactions).where(eq(m.financeTransactions.id, legacyRequest.id));
    const [unchangedAllowance] = await db.select().from(m.financeTransactions).where(eq(m.financeTransactions.id, legacyAllowance.id));
    assert.deepEqual(unchangedRequest, legacyRequest);
    assert.deepEqual(unchangedAllowance, legacyAllowance);
  } finally {
    if (ids.length) {
      await db.delete(m.inAppNotifications).where(inArray(m.inAppNotifications.recipientId, ids));
      await db.delete(m.familyMoneyRequests).where(inArray(m.familyMoneyRequests.studentId, ids));
      const schedules = await db.select({ id: m.allowances.id }).from(m.allowances).where(inArray(m.allowances.studentId, ids));
      if (schedules.length) await db.delete(m.allowanceOccurrences).where(inArray(m.allowanceOccurrences.allowanceId, schedules.map(r => r.id)));
      await db.delete(m.allowances).where(inArray(m.allowances.studentId, ids));
      await db.delete(m.familyLinks).where(inArray(m.familyLinks.studentId, ids));
      const gs = await db.select({ id: m.savingsGoals.id }).from(m.savingsGoals).where(inArray(m.savingsGoals.userId, ids));
      if (gs.length) for (const t of [m.goalInvitations, m.goalHistory]) await db.delete(t).where(inArray(t.goalId, gs.map(r => r.id)));
      await db.delete(m.savingsGoals).where(inArray(m.savingsGoals.userId, ids));
      for (const t of [m.financeEvents, m.financeIdempotency, m.financeTransactions, m.incomes, m.financeAccounts]) await db.delete(t).where(inArray(t.userId, ids));
      await db.delete(m.users).where(inArray(m.users.id, ids));
    }
    await pool.end();
  }
});