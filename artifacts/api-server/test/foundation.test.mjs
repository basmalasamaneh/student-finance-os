import test from "node:test";
import assert from "node:assert/strict";
import { ApiError, toPublicError } from "../src/lib/http-errors.ts";
import { requirePrincipal, requireRole, requireOwner } from "../src/lib/authorization.ts";

test("authorization is deny by default and checks trusted principal values", () => {
  const trusted = { userId: "user-1", roles: ["student"] };
  assert.equal(requirePrincipal(trusted), trusted);
  assert.equal(requireRole(trusted, "student"), trusted);
  assert.equal(requireOwner(trusted, "user-1"), trusted);
  for (const invalid of [null, undefined, { userId: "", roles: ["student"] },
    { userId: "user-1" }, { userId: "user-1", roles: "student" }]) {
    assert.throws(() => requirePrincipal(invalid), { code: "UNAUTHENTICATED" });
  }
  assert.throws(() => requireRole(null, "student"), { code: "UNAUTHENTICATED" });
  assert.throws(() => requireRole(trusted, "admin"), { code: "FORBIDDEN" });
  assert.throws(() => requireOwner(trusted, "user-2"), { code: "FORBIDDEN" });
});

test("public errors have a stable sanitized envelope", () => {
  assert.deepEqual(toPublicError(new ApiError("NOT_FOUND"), "req-1"), {
    status: 404, body: { error: { code: "NOT_FOUND", message: "Resource not found", requestId: "req-1" } },
  });
  assert.deepEqual(toPublicError(new Error("database password: secret")), {
    status: 500, body: { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
  });
  const malformed = Object.assign(new SyntaxError("sensitive request contents"), { status: 400 });
  assert.deepEqual(toPublicError(malformed).body, {
    error: { code: "BAD_REQUEST", message: "Invalid request" },
  });
});