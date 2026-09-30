import test from "node:test";
import assert from "node:assert/strict";
import {
  money, parseMoney, assertMoney, addMoney, subtractMoney, multiplyMoney,
  formatMoney, formatNumber, formatPercent, formatDate,
} from "../src/index.ts";

test("parses exact minor units including JOD mills", () => {
  assert.deepEqual(parseMoney("123.45"), { minor: 12345, currency: "ILS" });
  assert.deepEqual(parseMoney("-0.001", "JOD"), { minor: -1, currency: "JOD" });
  assert.deepEqual(parseMoney("0.00", "USD"), money(0, "USD"));
  assert.deepEqual(parseMoney("90071992547409.91"), money(Number.MAX_SAFE_INTEGER));
  for (const invalid of ["1.234", "1e3", " 1", "1.", ".5", "01", "1,000", "NaN"]) {
    assert.throws(() => parseMoney(invalid), { name: /TypeError|RangeError/ });
  }
  assert.throws(() => parseMoney("0.0001", "JOD"), /precision/);
  assert.throws(() => parseMoney("90071992547409.92"), /safe integer/);
  assert.throws(() => parseMoney("1", "EUR"), /currency/);
});

test("validates money values and guards BigInt arithmetic boundaries", () => {
  for (const invalid of [null, {}, Object.create({ minor: 1, currency: "ILS" }),
    { minor: 1.2, currency: "ILS" }, { minor: NaN, currency: "USD" },
    { minor: Number.MAX_SAFE_INTEGER + 1, currency: "JOD" }, { minor: 1, currency: "EUR" }]) {
    assert.throws(() => assertMoney(invalid));
    assert.throws(() => formatMoney(invalid));
  }
  assert.throws(() => money(1.5), /safe integer/);
  assert.deepEqual(addMoney(money(4), money(-9)), money(-5));
  assert.deepEqual(subtractMoney(money(4), money(9)), money(-5));
  assert.deepEqual(multiplyMoney(money(-2, "JOD"), 4), money(-8, "JOD"));
  assert.deepEqual(addMoney(money(Number.MAX_SAFE_INTEGER), money(-1)), money(Number.MAX_SAFE_INTEGER - 1));
  assert.throws(() => addMoney(money(Number.MAX_SAFE_INTEGER), money(1)), /safe integer/);
  assert.throws(() => subtractMoney(money(-Number.MAX_SAFE_INTEGER), money(1)), /safe integer/);
  assert.throws(() => multiplyMoney(money(Number.MAX_SAFE_INTEGER), 2), /safe integer/);
  assert.throws(() => multiplyMoney(money(1), 1.5), /safe integer/);
  assert.throws(() => addMoney(money(1, "ILS"), money(1, "USD")), /mismatch/);
});

test("formats exact amounts without loss of fractional precision", () => {
  assert.equal(formatMoney(money(123456, "USD"), "en-US"), "$1,234.56");
  assert.equal(formatMoney(money(-1, "USD"), "en-US"), "-$0.01");
  assert.equal(formatMoney(money(9007199254740991, "JOD"), "en-US"), "JOD 9,007,199,254,740.991");
  assert.match(formatMoney(money(12345, "ILS")), /123.45/);
  assert.doesNotMatch(formatMoney(money(12345, "ILS")), /[٠-٩]/);
  assert.match(formatNumber(12345), /12[,.]345/);
  assert.doesNotMatch(formatPercent(0.125), /[٠-٩]/);
  assert.match(formatPercent(0.125, "en-US"), /12.5%/);
  assert.match(formatDate(new Date("2025-01-01T00:00:00Z"), "en-US"), /Jan 1, 2025/);
  assert.doesNotMatch(formatDate(new Date("2025-01-01T00:00:00Z")), /[٠-٩]/);
  assert.throws(() => formatDate(new Date("bad")), /Invalid date/);
});