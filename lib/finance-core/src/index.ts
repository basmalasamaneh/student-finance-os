export type Currency = "ILS" | "USD" | "JOD";
export type Money = Readonly<{ minor: number; currency: Currency }>;

const scales: Record<Currency, number> = { ILS: 2, USD: 2, JOD: 3 };
const MAX_MINOR = BigInt(Number.MAX_SAFE_INTEGER);

function assertCurrency(value: unknown): asserts value is Currency {
  if (value !== "ILS" && value !== "USD" && value !== "JOD") {
    throw new TypeError("Unsupported currency");
  }
}

function assertInteger(value: unknown, name: string): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new RangeError(`${name} must be a safe integer`);
  }
}

export function assertMoney(value: unknown): asserts value is Money {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Invalid Money object");
  }
  if (!Object.hasOwn(value, "minor") || !Object.hasOwn(value, "currency")) {
    throw new TypeError("Money requires own minor and currency properties");
  }
  const candidate = value as Record<string, unknown>;
  assertCurrency(candidate.currency);
  assertInteger(candidate.minor, "minor");
}

export function money(minor: number, currency: Currency = "ILS"): Money {
  assertCurrency(currency);
  assertInteger(minor, "minor");
  return { minor: Object.is(minor, -0) ? 0 : minor, currency };
}

export function parseMoney(decimalString: string, currency: Currency = "ILS"): Money {
  assertCurrency(currency);
  if (typeof decimalString !== "string" || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(decimalString)) {
    throw new TypeError("Money must be a plain decimal string");
  }
  const scale = scales[currency];
  const negative = decimalString.startsWith("-");
  const [whole, fraction = ""] = (negative ? decimalString.slice(1) : decimalString).split(".");
  if (fraction.length > scale) {
    throw new RangeError(`Excess precision for ${currency}: maximum ${scale} decimal places`);
  }
  const minor = BigInt(whole!) * 10n ** BigInt(scale) +
    BigInt(fraction.padEnd(scale, "0"));
  return money(toSafeMinor(negative ? -minor : minor), currency);
}

function toSafeMinor(value: bigint): number {
  if (value > MAX_MINOR || value < -MAX_MINOR) {
    throw new RangeError("Money exceeds the safe integer range");
  }
  return Number(value);
}

function assertSameCurrency(a: Money, b: Money): void {
  assertMoney(a);
  assertMoney(b);
  if (a.currency !== b.currency) {
    throw new TypeError("Money currency mismatch");
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(toSafeMinor(BigInt(a.minor) + BigInt(b.minor)), a.currency);
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(toSafeMinor(BigInt(a.minor) - BigInt(b.minor)), a.currency);
}

export function multiplyMoney(value: Money, quantity: number): Money {
  assertMoney(value);
  assertInteger(quantity, "quantity");
  return money(toSafeMinor(BigInt(value.minor) * BigInt(quantity)), value.currency);
}

// Trips are outbound one-way journeys per week. A round trip doubles their
// cost; 52 weeks / 12 months, rounded half-up in integral minor units.
export function estimateMonthlyCommute(tripsPerWeek: number, costPerTrip: Money, roundTrip: boolean): Money {
  assertMoney(costPerTrip);
  if (!Number.isSafeInteger(tripsPerWeek) || tripsPerWeek < 0 || tripsPerWeek > 100 ||
      costPerTrip.minor < 0 || typeof roundTrip !== "boolean") {
    throw new RangeError("Invalid commute values");
  }
  const total = (BigInt(tripsPerWeek) * BigInt(costPerTrip.minor) *
    (roundTrip ? 2n : 1n) * 52n + 6n) / 12n;
  return money(toSafeMinor(total), costPerTrip.currency);
}

// Formatting only: Intl receives integral BigInts; fractional digits are inserted
// from the minor-unit string, never from a floating-point monetary value.
export function formatMoney(value: Money, locale = "ar"): string {
  assertMoney(value);
  const scale = scales[value.currency];
  const base = 10n ** BigInt(scale);
  const magnitude = value.minor < 0 ? -BigInt(value.minor) : BigInt(value.minor);
  const whole = magnitude / base;
  const fraction = (magnitude % base).toString().padStart(scale, "0");
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: value.currency,
    numberingSystem: "latn",
    minimumFractionDigits: scale,
    maximumFractionDigits: scale,
  });
  // Use -1 for negative subunits to retain the locale's sign positioning,
  // replacing its integer digits with the correctly grouped zero.
  const parts = formatter.formatToParts(value.minor < 0 ? -(whole || 1n) : whole);
  const zero = formatter.formatToParts(0n).find((part) => part.type === "integer")?.value ?? "0";
  return parts.map((part) => {
    if (part.type === "integer" && whole === 0n) return zero;
    if (part.type === "fraction") return fraction;
    return part.value;
  }).join("");
}

export function formatNumber(value: number, locale = "ar"): string {
  if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
    throw new RangeError("Number must be finite and safe");
  }
  return new Intl.NumberFormat(locale, { numberingSystem: "latn" }).format(value);
}

// value is a ratio (e.g. 0.125 displays as 12.5%).
export function formatPercent(value: number, locale = "ar"): string {
  if (!Number.isFinite(value)) throw new RangeError("Percent must be finite");
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 2,
    numberingSystem: "latn",
  }).format(value);
}

export function formatDate(value: Date, locale = "ar", timeZone = "Asia/Hebron"): string {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new TypeError("Invalid date");
  }
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    numberingSystem: "latn",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(value);
}