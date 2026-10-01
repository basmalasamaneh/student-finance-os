import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { build } from "esbuild";

const compiled = await build({ stdin: { contents: 'export * from "./src/lib/forecast-math.ts";',
  resolveDir: new URL("..", import.meta.url).pathname, loader: "ts" }, bundle: true, platform: "node", format: "cjs", write: false });
const module = { exports: {} };
new Function("require", "module", "exports", compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const { recurrenceDates, assertRange, monthAllocations, forecastTotals } = module.exports;

test("forecast UTC ranges reject invalid, reversed, oversized dates and accept inclusive 366 days", () => {
  for (const [from, to] of [["0000-01-01", "0000-01-02"], ["2025-02-29", "2025-03-01"], ["2026-01-02", "2026-01-01"], ["2024-01-01", "2025-01-01"], ["2026-01-01T00:00:00Z", "2026-01-01"]]) {
    assert.throws(() => assertRange(from, to), { code: "BAD_REQUEST" });
  }
  assertRange("2024-01-01", "2024-12-31");
  assertRange("2026-01-01", "2027-01-01");
});
test("original recurrence anchors clamp across leap February without drift and inclusive end dates", () => {
  assert.deepEqual(recurrenceDates("2024-01-31", "monthly", "2024-03-31", "2024-01-01", "2024-04-30"), ["2024-01-31", "2024-02-29", "2024-03-31"]);
  assert.deepEqual(recurrenceDates("2023-01-31", "monthly", null, "2023-02-01", "2023-04-30"), ["2023-02-28", "2023-03-31", "2023-04-30"]);
  assert.deepEqual(recurrenceDates("2024-02-29", "yearly", null, "2025-01-01", "2025-12-31"), ["2025-02-28"]);
  assert.deepEqual(recurrenceDates("2024-02-29", "yearly", null, "2028-01-01", "2028-12-31"), ["2028-02-29"]);
  assert.deepEqual(recurrenceDates("2024-01-31", "quarterly", null, "2024-01-01", "2024-12-31"), ["2024-01-31", "2024-04-30", "2024-07-31", "2024-10-31"]);
  assert.deepEqual(recurrenceDates("2026-01-01", "weekly", "2026-01-08", "2026-01-01", "2026-01-31"), ["2026-01-01", "2026-01-08"]);
  assert.deepEqual(recurrenceDates("2026-01-01", "biweekly", null, "2026-01-01", "2026-01-31"), ["2026-01-01", "2026-01-15", "2026-01-29"]);
  assert.equal(recurrenceDates("1900-01-01", "daily", null, "2026-01-01", "2026-12-31").length, 365);
  assert.deepEqual(recurrenceDates("2026-01-01", "none", null, "2026-01-02", "2026-01-31"), []);
});
test("monthly allocation is exact, remainder-distributed, leap aware and bounded at maximum date", () => {
  const input = { id: "test", source: "manual", category: "food", kind: "expense", amount: { minor: 100, currency: "JOD" } };
  const amounts = Array.from({ length: 29 }, (_, i) => {
    const day = `2024-02-${String(i + 1).padStart(2, "0")}`;
    return monthAllocations(input, day, day)[0].allocatedAmount.minor;
  });
  assert.equal(amounts.reduce((a, b) => a + b), 100);
  assert.equal(monthAllocations(input, "2024-02-01", "2024-02-29")[0].allocatedAmount.minor, 100);
  assert.equal(monthAllocations(input, "9999-12-31", "9999-12-31").length, 1);
  const max = { ...input, amount: { minor: Number.MAX_SAFE_INTEGER, currency: "ILS" } };
  assert.equal(monthAllocations(max, "2026-01-01", "2026-01-31")[0].allocatedAmount.minor, Number.MAX_SAFE_INTEGER);
});
test("forecast equation is signed, per currency, status aware and rejects aggregate overflow", () => {
  const occurrence = { kind: "expense", recurrence: "none", includedInForecast: true, status: "planned", amount: { minor: 120, currency: "ILS" } };
  const totals = forecastTotals([{ minor: 100, currency: "ILS" }, { minor: 500, currency: "USD" }], [
    occurrence, { ...occurrence, status: "completed" }, { ...occurrence, status: "cancelled" },
    { ...occurrence, kind: "income", status: "posted" }, { ...occurrence, includedInForecast: false },
  ], []);
  assert.equal(totals[0].projectedBalance.minor, -20);
  assert.equal(totals[1].projectedBalance.minor, 500);
  assert.throws(() => forecastTotals([{ minor: Number.MAX_SAFE_INTEGER, currency: "ILS" }, { minor: 1, currency: "ILS" }], [], []), { code: "BAD_REQUEST" });
  assert.throws(() => forecastTotals([], [{ ...occurrence, amount: { minor: Number.MAX_SAFE_INTEGER, currency: "ILS" } }, occurrence], []), { code: "BAD_REQUEST" });
});