import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { build } from "esbuild";

// This exercises the real PostgreSQL transaction helpers, not an HTTP server.
// The bundle resolves TS workspace imports exactly as the managed API build does.
test("simulated ledger is atomic, concurrency-safe and retry-idempotent", { skip: !process.env.DATABASE_URL }, async () => {
  const compiled = await build({
    stdin: {
      contents: `export { once, move, lockedAccounts, post } from "./src/lib/finance.ts";
        export { db, pool, users, financeAccounts, financeTransactions, financeEvents, financeIdempotency } from "@workspace/db";
        export { eq, inArray, and } from "drizzle-orm";`,
      resolveDir: new URL("..", import.meta.url).pathname,
      loader: "ts",
    },
    bundle: true, platform: "node", format: "cjs", write: false, external: ["*.node"],
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  const { db, pool, users, financeAccounts: accounts, financeTransactions: entries, financeEvents: events,
    financeIdempotency: keys, eq, inArray, once, move, lockedAccounts, post } = module.exports;
  const marker = randomUUID();
  const userIds = [], accountIds = [];
  try {
    for (const name of ["payer", "recipient"]) {
      const [user] = await db.insert(users).values({
        name: `Integration ${name}`, email: `${marker}-${name}@example.invalid`,
        role: "student", passwordHash: "test-fixture-not-a-credential",
      }).returning();
      userIds.push(user.id);
      const [account] = await db.insert(accounts).values({
        userId: user.id, type: "wallet", name: "Integration wallet", currency: "ILS",
      }).returning();
      accountIds.push(account.id);
    }
    const [payer, recipient] = accountIds;
    await once(userIds[0], "seed-" + marker, "seed", { minor: 1000 }, async tx => {
      const a = (await lockedAccounts(tx, [payer])).get(payer);
      return post(tx, a, 1000n, { kind: "receive", category: "external_income" });
    });
    const duplicateKey = "send-" + marker;
    const payload = { payer, recipient, minor: 100 };
    const retry = () => once(userIds[0], duplicateKey, "transfer", payload,
      tx => move(tx, payer, recipient, 100n, "send"));
    const [first, second] = await Promise.all([retry(), retry()]);
    assert.equal(first.id, second.id);
    let [a, b] = await Promise.all(accountIds.map(id => db.select().from(accounts).where(eq(accounts.id, id)).then(r => r[0])));
    assert.equal(a.balanceMinor, 900n);
    assert.equal(b.balanceMinor, 100n);
    await assert.rejects(
      once(userIds[0], duplicateKey, "transfer", { ...payload, minor: 101 }, tx => move(tx, payer, recipient, 101n, "send")),
      { code: "CONFLICT" },
    );
    const results = await Promise.allSettled([1, 2].map(n => once(userIds[0], `race-${n}-${marker}`, "transfer", { n },
      tx => move(tx, payer, recipient, 600n, "send"))));
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    assert.equal(results.filter(r => r.status === "rejected" && r.reason.code === "INSUFFICIENT_FUNDS").length, 1);
    [a, b] = await Promise.all(accountIds.map(id => db.select().from(accounts).where(eq(accounts.id, id)).then(r => r[0])));
    assert.equal(a.balanceMinor, 300n);
    assert.equal(b.balanceMinor, 700n);
    await assert.rejects(
      once(userIds[0], "fail-payment-" + marker, "payment", { minor: 301 }, async tx => {
        const current = (await lockedAccounts(tx, [payer])).get(payer);
        return post(tx, current, -301n, { kind: "payment", category: "other" });
      }),
      { code: "INSUFFICIENT_FUNDS" },
    );
    const receipt = await once(userIds[0], "payment-" + marker, "payment", { minor: 50 }, async tx => {
      const current = (await lockedAccounts(tx, [payer])).get(payer);
      return post(tx, current, -50n, { kind: "payment", category: "other" });
    });
    assert.equal(receipt.status, "simulated_payment");
    assert.equal(receipt.amount.minor, 50);
    assert.equal(receipt.balanceAfter.minor, 250);
    const ledger = await db.select().from(entries).where(inArray(entries.userId, userIds));
    assert.equal(ledger.length, 6); // one seed, two sends (four legs), one payment
    assert.equal((await db.select().from(events).where(inArray(events.userId, userIds))).length, ledger.length);
    assert.equal((await db.select().from(keys).where(eq(keys.key, "fail-payment-" + marker))).length, 0);
    await once(userIds[1], "overflow-seed-" + marker, "receive", { recipient }, async tx => {
      const current = (await lockedAccounts(tx, [recipient])).get(recipient);
      return post(tx, current, BigInt(Number.MAX_SAFE_INTEGER) - current.balanceMinor, { kind: "receive", category: "external_income" });
    });
    await assert.rejects(
      once(userIds[0], "overflow-" + marker, "transfer", { minor: 1 },
        tx => move(tx, payer, recipient, 1n, "send")),
      { code: "CONFLICT" },
    );
    [a, b] = await Promise.all(accountIds.map(id => db.select().from(accounts).where(eq(accounts.id, id)).then(r => r[0])));
    assert.equal(a.balanceMinor, 250n); // first debit rolled back when recipient credit overflowed
    assert.equal(b.balanceMinor, BigInt(Number.MAX_SAFE_INTEGER));
    assert.equal((await db.select().from(entries).where(inArray(entries.userId, userIds))).length, 7);
    assert.equal((await db.select().from(keys).where(eq(keys.key, "overflow-" + marker))).length, 0);
  } finally {
    if (userIds.length) {
      const txRows = await db.select({ id: entries.id }).from(entries).where(inArray(entries.userId, userIds));
      if (txRows.length) await db.delete(events).where(inArray(events.transactionId, txRows.map(r => r.id)));
      await db.delete(entries).where(inArray(entries.userId, userIds));
      await db.delete(keys).where(inArray(keys.userId, userIds));
    }
    if (accountIds.length) await db.delete(accounts).where(inArray(accounts.id, accountIds));
    if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
    await pool.end();
  }
});