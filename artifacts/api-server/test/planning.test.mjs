import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { build } from "esbuild";

async function load(contents) {
  const compiled = await build({
    stdin: { contents, resolveDir: new URL("..", import.meta.url).pathname, loader: "ts" },
    bundle: true, platform: "node", format: "cjs", write: false, external: ["*.node"],
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  return module.exports;
}

test("canonical aliases, exact annual aggregation, priority and UTC periods", async () => {
  const { canonicalCategory, halfUp, monthlyNumerator, resolveCosts, periodBounds, validDate, isBudgetDebit, safeMinor } =
    await load('export * from "./src/lib/planning.ts"');
  for (const [alias, canonical] of Object.entries({
    cafeteria: "food", bookstore: "books", campus_transportation: "transportation",
    fees: "university_fees", rent: "housing", accommodation: "housing",
  })) assert.equal(canonicalCategory(alias), canonical);
  assert.equal(halfUp(13n, 12n), 1n);
  assert.equal(halfUp(18n, 12n), 2n);
  assert.equal(monthlyNumerator({ minor: 1, currency: "ILS" }, "weekly"), 52n);
  assert.equal(monthlyNumerator({ minor: 1, currency: "ILS" }, "biweekly"), 26n);
  assert.equal(monthlyNumerator({ minor: 1, currency: "ILS" }, "quarterly"), 4n);
  assert.equal(monthlyNumerator({ minor: 1, currency: "ILS" }, "irregular"), null);
  assert.equal(monthlyNumerator({ minor: 1, currency: "ILS" }, "one_time"), null);
  const a = (category, minor, source, numerator) => ({
    category, source, amount: { currency: "ILS", minor }, ...(numerator === undefined ? {} : { numerator }),
  });
  assert.deepEqual(resolveCosts(
    [a("housing", 200, "profile"), a("utilities", 30, "profile"), a("transportation", 50, "profile")],
    [a("rent", 60, "recurring", 720n), a("cafeteria", 3, "recurring", 36n), a("food", 2, "recurring", 24n)],
    [a("accommodation", 80, "manual"), a("housing", 20, "manual")],
  ), [
    { category: "food", source: "recurring", amount: { currency: "ILS", minor: 5 } },
    { category: "housing", source: "manual", amount: { currency: "ILS", minor: 100 } },
    { category: "transportation", source: "profile", amount: { currency: "ILS", minor: 50 } },
    { category: "utilities", source: "profile", amount: { currency: "ILS", minor: 30 } },
  ]);
  assert.deepEqual([periodBounds("weekly", new Date("2026-05-03T23:59:00Z")).periodStart,
    periodBounds("weekly", new Date("2026-05-03T23:59:00Z")).periodEnd], ["2026-04-27", "2026-05-03"]);
  assert.equal(periodBounds("weekly", new Date("2026-05-04T00:01:00Z")).periodStart, "2026-05-04");
  assert.equal(periodBounds("monthly", new Date("2024-02-29T12:00:00Z")).periodEnd, "2024-02-29");
  assert.equal(validDate("2025-02-30"), false);
  assert.equal(validDate("2024-02-29"), true);
  assert.equal(isBudgetDebit({ direction: "debit", kind: "payment" }), true);
  assert.equal(isBudgetDebit({ direction: "debit", kind: "send" }), false);
  assert.equal(isBudgetDebit({ direction: "credit", kind: "payment" }), false);
  assert.throws(() => safeMinor(BigInt(Number.MAX_SAFE_INTEGER) + 1n), { code: "BAD_REQUEST" });
});