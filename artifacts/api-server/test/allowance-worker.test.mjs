import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { build } from "esbuild";

test("actual due worker scopes fixtures, bounds catch-up and excludes paused/cancelled/future/failed schedules", { skip: !process.env.DATABASE_URL }, async () => {
  const compiled = await build({ stdin: { contents: `
    export { processDueAllowances } from "./src/lib/allowance-worker.ts";
    export { post, lockedAccounts } from "./src/lib/finance.ts";
    export * from "@workspace/db"; export { eq, inArray, and } from "drizzle-orm";`,
    resolveDir: new URL("..", import.meta.url).pathname, loader: "ts" },
    bundle: true, platform: "node", format: "cjs", write: false, external: ["*.node", "pino"],
    define: { "process.env.NODE_ENV": '"production"' } });
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  const m = module.exports, { db, pool, eq, inArray, and } = m, ids = [], marker = randomUUID();
  const today = "2040-03-31";
  let studentAccount, parentAccount, link;
  const row = async (overrides = {}) => {
    const [created] = await db.insert(m.allowances).values({
      familyLinkId: link.id, studentId: ids[0], parentId: ids[1], parentAccountId: parentAccount.id,
      amountMinor: 10n, currency: "JOD", kind: "recurring", frequency: "monthly",
      nextPayment: today, startDate: "2040-01-31", ...overrides,
    }).returning();
    return created;
  };
  const occurrences = () => db.select().from(m.allowanceOccurrences)
    .innerJoin(m.allowances, eq(m.allowances.id, m.allowanceOccurrences.allowanceId)).where(eq(m.allowances.studentId, ids[0]));
  const get = async a => (await db.select().from(m.allowances).where(eq(m.allowances.id, a.id)))[0];
  try {
    for (const role of ["student", "parent"]) {
      const [u] = await db.insert(m.users).values({ role, email: `${marker}-${role}@example.invalid`,
        name: "Isolated worker fixture", passwordHash: "synthetic-not-login" }).returning();
      ids.push(u.id);
    }
    [studentAccount] = await db.insert(m.financeAccounts).values({ userId: ids[0], type: "wallet", name: "Worker student", currency: "JOD" }).returning();
    [parentAccount] = await db.insert(m.financeAccounts).values({ userId: ids[1], type: "wallet", name: "Worker parent", currency: "JOD" }).returning();
    await db.transaction(async tx => {
      const account = (await m.lockedAccounts(tx, [parentAccount.id])).get(parentAccount.id);
      await m.post(tx, account, 1000n, { kind: "add", category: "external_income" });
    });
    [link] = await db.insert(m.familyLinks).values({ studentId: ids[0], parentId: ids[1], status: "accepted",
      permissions: { ...m.NO_FAMILY_PERMISSIONS, allowance: true }, receivingAccountId: studentAccount.id,
      tokenHash: marker, expiresAt: new Date("2041-01-01") }).returning();
    const paused = await row({ status: "paused" });
    const cancelled = await row({ status: "cancelled" });
    const futureStart = await row({ startDate: "2040-04-01", nextPayment: "2040-04-01" });
    const futurePayment = await row({ nextPayment: "2040-04-07" });
    const ended = await row({ endDate: "2040-03-30" });
    const final = await row({ endDate: today });
    const failed = await row({ lastFailure: "insufficient_funds" });
    const [priorFailure] = await db.insert(m.allowanceOccurrences).values({ allowanceId: failed.id,
      scheduledDate: today, amountMinor: 10n, currency: "JOD", status: "failed", failure: "insufficient_funds" }).returning();
    const insufficient = await row({ amountMinor: 2000n });
    const catchup = await row({ frequency: "weekly", startDate: "2040-03-01", nextPayment: "2040-03-01" });
    // All real application data is excluded by the explicit fixture owner scope.
    for (const expectedNext of ["2040-03-08", "2040-03-15", "2040-03-22", "2040-03-29", "2040-04-05"]) {
      const before = (await occurrences()).length;
      assert.equal(await m.processDueAllowances(today, 1, ids[0]), 1);
      assert.equal((await occurrences()).length, before + 1);
      assert.equal((await get(catchup)).nextPayment, expectedNext);
    }
    // Remaining due final/end/insufficient schedules: no paused, cancelled, future or prior failure retries.
    assert.equal(await m.processDueAllowances(today, 50, ids[0]), 3);
    assert.equal((await get(final)).status, "completed");
    assert.equal((await get(ended)).status, "completed");
    assert.equal((await get(insufficient)).lastFailure, "insufficient_funds");
    assert.equal((await get(paused)).status, "paused");
    assert.equal((await get(cancelled)).status, "cancelled");
    for (const a of [paused, cancelled, futureStart, futurePayment, ended]) {
      assert.equal((await db.select().from(m.allowanceOccurrences).where(eq(m.allowanceOccurrences.allowanceId, a.id))).length, 0);
    }
    assert.deepEqual((await db.select().from(m.allowanceOccurrences).where(eq(m.allowanceOccurrences.id, priorFailure.id)))[0], priorFailure);
    const count = (await occurrences()).length;
    assert.equal(await m.processDueAllowances(today, 50, ids[0]), 0);
    assert.equal((await occurrences()).length, count);
    assert.equal((await db.select().from(m.financeAccounts).where(eq(m.financeAccounts.id, parentAccount.id)))[0].balanceMinor, 940n);
    assert.equal((await db.select().from(m.financeAccounts).where(eq(m.financeAccounts.id, studentAccount.id)))[0].balanceMinor, 60n);
    const credits = await db.select().from(m.financeTransactions).where(and(eq(m.financeTransactions.userId, ids[0]), eq(m.financeTransactions.kind, "allowance")));
    assert.equal(credits.length, 6);
    assert.equal(new Set(credits.map(r => r.parentTransferId)).size, 6);
  } finally {
    if (ids.length) {
      const rows = await db.select().from(m.allowances).where(inArray(m.allowances.studentId, ids));
      if (rows.length) await db.delete(m.allowanceOccurrences).where(inArray(m.allowanceOccurrences.allowanceId, rows.map(r => r.id)));
      await db.delete(m.allowances).where(inArray(m.allowances.studentId, ids));
      await db.delete(m.familyLinks).where(inArray(m.familyLinks.studentId, ids));
      for (const table of [m.financeEvents, m.financeTransactions, m.financeAccounts]) await db.delete(table).where(inArray(table.userId, ids));
      await db.delete(m.users).where(inArray(m.users.id, ids));
    }
    await pool.end();
  }
});