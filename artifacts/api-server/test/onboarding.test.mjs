import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, normalizeEmail, newSessionToken, tokenHash, estimateCommute, isTrustedMutationOrigin, hasValidOptionalDates, isStudentProfileComplete, signupLimitReached } from "../src/lib/credentials.ts";
import { requireOwner, requireRole } from "../src/lib/authorization.ts";
import { SignUpBody, CreateIncomeBody, CreateScholarshipBody, SaveProfileBody } from "../../../lib/api-zod/src/generated/api.ts";

test("password hashes are salted, versioned and only match the right password", async () => {
  const first = await hashPassword("correct horse battery staple");
  const second = await hashPassword("correct horse battery staple");
  assert.notEqual(first, second);
  assert.match(first, /^scrypt-v1:[a-f0-9]{64}:[a-f0-9]{128}$/);
  assert.equal(await verifyPassword("correct horse battery staple", first), true);
  assert.equal(await verifyPassword("incorrect password", first), false);
  assert.equal(await verifyPassword("correct horse battery staple"), false);
  assert.equal(await verifyPassword("correct horse battery staple", "corrupted"), false);
});

test("session tokens are unguessable opaque values with secret-dependent hashes", () => {
  const token1 = newSessionToken();
  const token2 = newSessionToken();
  assert.notEqual(token1, token2);
  assert.notEqual(tokenHash(token1, "a".repeat(32)), tokenHash(token1, "b".repeat(32)));
  assert.equal(tokenHash(token1, "a".repeat(32)).length, 64);
});

test("mutating cookie requests need exact same origin and anti-CSRF header", () => {
  assert.equal(isTrustedMutationOrigin("https://student.example", "student.example", "1", true), true);
  assert.equal(isTrustedMutationOrigin("https://attacker.example", "student.example", "1", true), false);
  assert.equal(isTrustedMutationOrigin("http://student.example", "student.example", "1", true), false);
  assert.equal(isTrustedMutationOrigin("https://student.example", "student.example", undefined, true), false);
  assert.equal(isTrustedMutationOrigin(undefined, "student.example", "1", true), false);
  assert.equal(isTrustedMutationOrigin("https://student.example@attacker.example", "student.example", "1", true), false);
});

test("principal authorization cannot be assigned by a supplied role or owner", () => {
  const principal = { userId: "alice", roles: ["student"] };
  assert.equal(requireOwner(principal, "alice"), principal);
  assert.throws(() => requireOwner(principal, "bob"), /Access denied/);
  assert.throws(() => requireRole(principal, "admin"), /Access denied/);
  assert.throws(() => requireOwner(null, "alice"), /Authentication required/);
});

test("registration excludes admin and normalize email, validated onboarding enums/money", () => {
  assert.equal(normalizeEmail("  STUDENT@Example.com "), "student@example.com");
  const input = { name: "Student", email: "student@example.com", password: "twelveletters!", role: "student" };
  assert.equal(SignUpBody.safeParse(input).success, true);
  assert.equal(SignUpBody.safeParse({ ...input, role: "admin" }).success, false);
  assert.equal(CreateIncomeBody.safeParse({ source: "salary", amount: { minor: 5, currency: "ILS" }, frequency: "monthly", stability: "stable", active: true }).success, true);
  assert.equal(CreateIncomeBody.safeParse({ source: "salary", amount: { minor: 0.5, currency: "ILS" }, frequency: "monthly", stability: "stable", active: true }).success, false);
  assert.equal(CreateScholarshipBody.safeParse({ name: "Aid", provider: "College", type: "financial_aid", percentage: 101 }).success, false);
  assert.equal(SaveProfileBody.safeParse({ residence: { type: "invalid", city: "Nablus" } }).success, false);
});

test("52/12 month convention uses integer minor units and explicit round-trip multiplier", () => {
  assert.deepEqual(estimateCommute(5, { minor: 175, currency: "ILS" }, false), { minor: 3792, currency: "ILS" });
  assert.deepEqual(estimateCommute(5, { minor: 175, currency: "ILS" }, true), { minor: 7583, currency: "ILS" });
  assert.deepEqual(estimateCommute(0, { minor: 0, currency: "JOD" }, false), { minor: 0, currency: "JOD" });
  assert.throws(() => estimateCommute(5.5, { minor: 100, currency: "ILS" }, false));
  assert.throws(() => estimateCommute(100, { minor: Number.MAX_SAFE_INTEGER, currency: "ILS" }, true));
});

test("malformed optional date bodies are bad requests, not server errors", () => {
  assert.equal(hasValidOptionalDates(null, ["expectedDate"]), false);
  assert.equal(hasValidOptionalDates(undefined, ["expectedDate"]), false);
  assert.equal(hasValidOptionalDates([], ["expectedDate"]), false);
  assert.equal(hasValidOptionalDates({ expectedDate: "2026-02-30" }, ["expectedDate"]), false);
  assert.equal(hasValidOptionalDates({ expectedDate: "2026-03-01" }, ["expectedDate"]), true);
  assert.equal(hasValidOptionalDates({}, ["expectedDate"]), true);
});

test("signup attempt counter caps successful registrations too", () => {
  for (let attempts = 1; attempts < 10; attempts++) assert.equal(signupLimitReached(attempts), false);
  assert.equal(signupLimitReached(10), true);
  assert.equal(signupLimitReached(11), true);
});

test("school student can finish without a university/campus commute", () => {
  const school = { studentType: "school", school: "School", city: "Ramallah", grade: "11", allowanceFrequency: "weekly", typicalAllowance: { minor: 500, currency: "ILS" } };
  const residence = { type: "family", city: "Ramallah" };
  const commute = { homeCity: "Ramallah", method: "bus", tripsPerWeek: 5, costPerTrip: { minor: 100, currency: "ILS" }, roundTrip: true, monthlyEstimate: { minor: 4333, currency: "ILS" } };
  assert.equal(SaveProfileBody.safeParse({ education: school, residence, commute }).success, true);
  assert.equal(isStudentProfileComplete(school, residence, commute), true);
  assert.equal(isStudentProfileComplete({ ...school, studentType: "university" }, residence, commute), false);
  assert.equal(isStudentProfileComplete(school, residence, null), false);
});