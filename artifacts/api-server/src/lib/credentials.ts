import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { estimateMonthlyCommute, type Money } from "../../../../lib/finance-core/src/index.ts";

const settings = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, 64, settings, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}
const dummySalt = Buffer.alloc(32, 1);
const dummyHash = Buffer.alloc(64, 2);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
export function signupLimitReached(attemptsInWindow: number): boolean {
  return !Number.isSafeInteger(attemptsInWindow) || attemptsInWindow >= 10;
}

export function hasValidOptionalDates(body: unknown, keys: readonly string[]): boolean {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return false;
  return keys.every((field) => {
    const value = (body as Record<string, unknown>)[field];
    return value === undefined || typeof value === "string" && /^\d{4}-\d\d-\d\d$/.test(value) &&
      !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  });
}

export function isStudentProfileComplete(education: unknown, residence: unknown, commute: unknown): boolean {
  if (!education || typeof education !== "object" || !residence || typeof residence !== "object" ||
      !commute || typeof commute !== "object") return false;
  const e = education as Record<string, unknown>;
  const r = residence as Record<string, unknown>;
  const c = commute as Record<string, unknown>;
  const requiredEducation = e.studentType === "school"
    ? ["school", "city", "grade", "allowanceFrequency", "typicalAllowance"]
    : e.studentType === "university"
      ? ["university", "campus", "city", "faculty", "major", "academicYear", "studyStatus"]
      : [];
  return requiredEducation.length > 0 &&
    requiredEducation.every((field) => e[field] !== undefined && e[field] !== "") &&
    !!r.city && !!r.type && !!c.homeCity && !!c.method &&
    (e.studentType === "school" || !!c.university && !!c.campus);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(32);
  const hash = await scrypt(password, salt);
  return `scrypt-v1:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored?: string): Promise<boolean> {
  const parts = stored?.split(":");
  const valid = parts?.length === 3 && parts[0] === "scrypt-v1" &&
    /^[a-f0-9]{64}$/.test(parts[1]!) && /^[a-f0-9]{128}$/.test(parts[2]!);
  const salt = valid ? Buffer.from(parts![1]!, "hex") : dummySalt;
  const expected = valid ? Buffer.from(parts![2]!, "hex") : dummyHash;
  const computed = await scrypt(password, salt);
  return timingSafeEqual(computed, expected) && !!valid;
}

export function tokenHash(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("hex");
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isTrustedMutationOrigin(origin: string | undefined, host: string | undefined, csrfIntent: string | undefined, production: boolean): boolean {
  if (!origin || !host || csrfIntent !== "1") return false;
  try {
    const parsed = new URL(origin);
    return ["https:", "http:"].includes(parsed.protocol) && parsed.host === host &&
      (!production || parsed.protocol === "https:") && parsed.pathname === "/" &&
      !parsed.search && !parsed.hash && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

// 52 weeks / 12 months, half-up to nearest minor unit; roundTrip doubles a
// one-way trip. BigInt protects multiplication before checking the safe range.
export function estimateCommute(tripsPerWeek: number, costPerTrip: Money, roundTrip: boolean): Money {
  return estimateMonthlyCommute(tripsPerWeek, costPerTrip, roundTrip);
}