import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, gt, sql } from "drizzle-orm";
import { db, users, sessions, loginAttempts, incomes, scholarships } from "@workspace/db";
import {
  SignUpBody, SignUpResponse, LogInBody, LogInResponse, GetMeResponse,
  SaveProfileBody, GetProfileResponse, SaveProfileResponse, CompleteProfileResponse,
  CreateIncomeBody, UpdateIncomeBody, CreateIncomeResponse, UpdateIncomeResponse,
  CreateScholarshipBody, UpdateScholarshipBody, CreateScholarshipResponse, UpdateScholarshipResponse,
  type Education,
} from "@workspace/api-zod";
import { ApiError } from "../lib/http-errors";
import { estimateCommute, hashPassword, hasValidOptionalDates, isStudentProfileComplete, isTrustedMutationOrigin, newSessionToken, normalizeEmail, signupLimitReached, tokenHash, verifyPassword } from "../lib/credentials";
import { requireOwner, requirePrincipal, type TrustedPrincipal } from "../lib/authorization";
import { allowanceProjection } from "../lib/allowance-projection";
import { canonicalEducation } from "../lib/campus";

const router: IRouter = Router();
const secret = process.env.SESSION_SECRET;
if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
const cookieName = "sfos_session";
const sessionLifetimeMs = 1000 * 60 * 60 * 24 * 7;
const cookieOptions = {
  httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production",
  path: "/api", maxAge: sessionLifetimeMs,
};

function parse<T>(schema: { safeParse: (value: unknown) => { success: boolean; data?: T } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ApiError("BAD_REQUEST");
  return result.data as T;
}
function own(req: Request): TrustedPrincipal {
  return requirePrincipal(req.res?.locals.principal as TrustedPrincipal | undefined);
}
function key(value: string): string {
  return tokenHash(value, secret!);
}
async function throttled(bucket: string): Promise<boolean> {
  const rows = await db.select().from(loginAttempts).where(eq(loginAttempts.key, key(bucket))).limit(1);
  return !!rows[0]?.blockedUntil && rows[0].blockedUntil > new Date();
}
let lastAttemptCleanup = 0;
async function pruneAttempts(): Promise<void> {
  if (Date.now() - lastAttemptCleanup < 60 * 60 * 1000) return;
  await db.delete(loginAttempts).where(sql`${loginAttempts.updatedAt} < now() - interval '1 day'`);
  lastAttemptCleanup = Date.now();
}
async function failure(bucket: string, threshold: number): Promise<number> {
  await pruneAttempts();
  const now = new Date();
  const [attempt] = await db.insert(loginAttempts).values({
    key: key(bucket), failures: 1, updatedAt: now,
  }).onConflictDoUpdate({
    target: loginAttempts.key,
    set: {
      failures: sql`case when ${loginAttempts.updatedAt} < now() - interval '15 minutes' then 1 else ${loginAttempts.failures} + 1 end`,
      updatedAt: now,
      blockedUntil: sql`case when ${loginAttempts.updatedAt} < now() - interval '15 minutes' then null when ${loginAttempts.failures} + 1 >= ${threshold} then now() + interval '15 minutes' else ${loginAttempts.blockedUntil} end`,
    },
  }).returning({ failures: loginAttempts.failures });
  return attempt!.failures;
}
function clientIp(req: Request): string {
  // Express req.ip uses trusted proxy configuration only, never raw X-Forwarded-For.
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}
function cookieToken(req: Request): string | undefined {
  const token = (req as Request & { cookies?: Record<string, unknown> }).cookies?.[cookieName];
  return typeof token === "string" && /^[\w-]{40,64}$/.test(token) ? token : undefined;
}
async function rotateSession(req: Request, res: Response, userId: string): Promise<void> {
  const previous = cookieToken(req);
  if (previous) await db.delete(sessions).where(eq(sessions.tokenHash, key(previous)));
  const token = newSessionToken();
  await db.insert(sessions).values({
    tokenHash: key(token), userId, expiresAt: new Date(Date.now() + sessionLifetimeMs),
  });
  res.cookie(cookieName, token, cookieOptions);
}
function account(user: typeof users.$inferSelect) {
  return {
    id: user.id, name: user.name, email: user.email, role: user.role,
    onboardingCompleted: user.onboardingCompleted,
  };
}
async function current(req: Request) {
  const principal = own(req);
  const [user] = await db.select().from(users).where(eq(users.id, principal.userId)).limit(1);
  if (!user) throw new ApiError("UNAUTHENTICATED");
  requireOwner(principal, user.id);
  return user;
}
async function profile(req: Request) {
  const user = await current(req);
  const [incomeRows, scholarshipRows] = await Promise.all([
    db.select().from(incomes).where(eq(incomes.userId, user.id)),
    db.select().from(scholarships).where(eq(scholarships.userId, user.id)),
  ]);
  return {
    ...account(user),
    ...(user.role === "student" ? { allowanceProjection: (await allowanceProjection(user.id)).dto } : {}),
    ...(user.education ? { education: await canonicalEducation(user.education as Education) } : {}),
    ...(user.residence ? { residence: user.residence } : {}),
    ...(user.commute ? { commute: user.commute } : {}),
    incomes: incomeRows.map((row) => ({ ...(row.data as object), id: row.id })),
    scholarships: scholarshipRows.map((row) => ({ ...(row.data as object), id: row.id })),
  };
}
function safeDates(body: unknown, keys: string[]) {
  if (!hasValidOptionalDates(body, keys)) throw new ApiError("BAD_REQUEST");
}
function validScholarship(input: { amount?: { currency: string }; percentage?: number; remainingCoverage?: { currency: string }; startDate?: string; endDate?: string }): boolean {
  return (input.amount !== undefined || input.percentage !== undefined) &&
    (!input.remainingCoverage || !input.amount || input.remainingCoverage.currency === input.amount.currency) &&
    (!input.startDate || !input.endDate || input.endDate >= input.startDate);
}
function cleanScholarship<T extends { name: string; provider: string; amount?: { currency: string }; percentage?: number; remainingCoverage?: { currency: string }; startDate?: string; endDate?: string }>(input: T): T {
  const cleaned = { ...input, name: input.name.trim(), provider: input.provider.trim() };
  if (!cleaned.name || !cleaned.provider || !validScholarship(cleaned)) throw new ApiError("BAD_REQUEST");
  return cleaned;
}

// Enforce same-origin AND a non-simple custom header on every mutation. SameSite
// is additional defense, not a replacement for origin/CSRF validation.
router.use((req, _res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (!isTrustedMutationOrigin(req.get("origin"), req.get("host"), req.get("x-csrf-intent"), process.env.NODE_ENV === "production")) {
    return next(new ApiError("FORBIDDEN"));
  }
  next();
});

router.use(async (req, res, next) => {
  try {
    const token = cookieToken(req);
    if (token) {
      const [row] = await db.select({ userId: sessions.userId, role: users.role })
        .from(sessions).innerJoin(users, eq(sessions.userId, users.id))
        .where(and(eq(sessions.tokenHash, key(token)), gt(sessions.expiresAt, new Date()))).limit(1);
      if (row) res.locals.principal = { userId: row.userId, roles: [row.role] } satisfies TrustedPrincipal;
    }
    next();
  } catch (error) { next(error); }
});

router.post("/auth/signup", async (req, res) => {
  const ipBucket = `signup:${clientIp(req)}`;
  if (await throttled(ipBucket)) throw new ApiError("RATE_LIMITED");
  // Both successful and rejected attempts count. A single IP cannot mint
  // unlimited accounts; stale buckets are pruned independently of success.
  if (signupLimitReached(await failure(ipBucket, 10))) throw new ApiError("RATE_LIMITED");
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? { ...req.body, email: typeof req.body.email === "string" ? normalizeEmail(req.body.email) : req.body.email }
    : req.body;
  const input = parse(SignUpBody, body);
  const name = input.name.trim();
  if (!name) throw new ApiError("BAD_REQUEST");
  const email = normalizeEmail(input.email);
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) throw new ApiError("EMAIL_TAKEN");
  const hash = await hashPassword(input.password);
  let user: typeof users.$inferSelect;
  try {
    [user] = await db.insert(users).values({ email, name, passwordHash: hash, role: input.role }).returning();
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      throw new ApiError("EMAIL_TAKEN");
    }
    throw error;
  }
  await rotateSession(req, res, user!.id);
  res.status(201).json(SignUpResponse.parse(account(user!)));
});

router.post("/auth/login", async (req, res) => {
  // Bound credentials before expensive scrypt. Failure always uses the same
  // message regardless of whether an email exists.
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? { ...req.body, email: typeof req.body.email === "string" ? normalizeEmail(req.body.email) : req.body.email }
    : req.body;
  const input = parse(LogInBody, body);
  if (input.password.length > 128) throw new ApiError("INVALID_CREDENTIALS");
  const email = normalizeEmail(input.email);
  const emailBucket = `login:email:${email}`;
  const ipBucket = `login:ip:${clientIp(req)}`;
  if (await throttled(emailBucket) || await throttled(ipBucket)) throw new ApiError("RATE_LIMITED");
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!await verifyPassword(input.password, user?.passwordHash)) {
    await Promise.all([failure(emailBucket, 5), failure(ipBucket, 30)]);
    throw new ApiError("INVALID_CREDENTIALS");
  }
  await db.delete(loginAttempts).where(eq(loginAttempts.key, key(emailBucket)));
  await rotateSession(req, res, user!.id);
  res.json(LogInResponse.parse(account(user!)));
});

router.post("/auth/logout", async (req, res) => {
  const token = cookieToken(req);
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, key(token)));
  res.clearCookie(cookieName, { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
});
router.get("/auth/me", async (req, res) => res.json(GetMeResponse.parse(account(await current(req)))));

router.get("/profile", async (req, res) => res.json(GetProfileResponse.parse(await profile(req))));
router.put("/profile", async (req, res) => {
  const user = await current(req);
  const input = parse(SaveProfileBody, req.body);
  const changes: Partial<typeof users.$inferInsert> = {};
  if (input.name !== undefined) {
    if (!input.name.trim()) throw new ApiError("BAD_REQUEST");
    changes.name = input.name.trim();
  }
  if (user.role !== "student" && (input.education || input.residence || input.commute)) throw new ApiError("FORBIDDEN");
  if (input.education) changes.education = await canonicalEducation(input.education);
  if (input.residence) {
    const r = input.residence;
    if (r.type !== "family" && r.type !== "other" && !r.monthlyRent) throw new ApiError("BAD_REQUEST");
    changes.residence = r;
  }
  if (input.commute) {
    const c = input.commute;
    let estimate;
    try { estimate = estimateCommute(c.tripsPerWeek, c.costPerTrip, c.roundTrip); }
    catch (error) {
      if (error instanceof RangeError || error instanceof TypeError) throw new ApiError("BAD_REQUEST");
      throw error;
    }
    if (c.monthlyEstimate.currency !== c.costPerTrip.currency ||
        (!c.manualEstimate && c.monthlyEstimate.minor !== estimate.minor)) throw new ApiError("BAD_REQUEST");
    changes.commute = c;
  }
  if (Object.keys(changes).length) await db.update(users).set(changes).where(eq(users.id, user.id));
  res.json(SaveProfileResponse.parse(await profile(req)));
});
router.post("/profile/complete", async (req, res) => {
  const user = await current(req);
  if (user.role === "student") {
    const education = user.education ? await canonicalEducation(user.education as Education) : user.education;
    if (!isStudentProfileComplete(education, user.residence, user.commute)) throw new ApiError("BAD_REQUEST");
  }
  await db.update(users).set({ onboardingCompleted: true }).where(eq(users.id, user.id));
  res.json(CompleteProfileResponse.parse(await profile(req)));
});

function resourceRoutes(path: "incomes" | "scholarships") {
  const table = path === "incomes" ? incomes : scholarships;
  const createResponse = path === "incomes" ? CreateIncomeResponse : CreateScholarshipResponse;
  const updateResponse = path === "incomes" ? UpdateIncomeResponse : UpdateScholarshipResponse;
  router.post(`/profile/${path}`, async (req, res) => {
    const user = await current(req);
    if (user.role !== "student") throw new ApiError("FORBIDDEN");
    if (path === "incomes") safeDates(req.body, ["expectedDate"]);
    else safeDates(req.body, ["startDate", "endDate", "renewalDate"]);
    const data = path === "incomes" ? parse(CreateIncomeBody, req.body) : cleanScholarship(parse(CreateScholarshipBody, req.body));
    const [created] = await db.insert(table).values({ userId: user.id, data }).returning();
    res.status(201).json(createResponse.parse({ ...(created!.data as object), id: created!.id }));
  });
  router.put(`/profile/${path}/:id`, async (req, res) => {
    const user = await current(req);
    if (user.role !== "student") throw new ApiError("FORBIDDEN");
    if (path === "incomes") safeDates(req.body, ["expectedDate"]);
    else safeDates(req.body, ["startDate", "endDate", "renewalDate"]);
    const data = path === "incomes" ? parse(UpdateIncomeBody, req.body) : cleanScholarship(parse(UpdateScholarshipBody, req.body));
    if (!/^[a-f\d]{8}-([a-f\d]{4}-){3}[a-f\d]{12}$/i.test(String(req.params.id))) throw new ApiError("BAD_REQUEST");
    const [updated] = await db.update(table).set({ data })
      .where(and(eq(table.id, String(req.params.id)), eq(table.userId, user.id))).returning();
    if (!updated) throw new ApiError("NOT_FOUND");
    res.json(updateResponse.parse({ ...(updated.data as object), id: updated.id }));
  });
  router.delete(`/profile/${path}/:id`, async (req, res) => {
    const user = await current(req);
    if (user.role !== "student") throw new ApiError("FORBIDDEN");
    if (!/^[a-f\d]{8}-([a-f\d]{4}-){3}[a-f\d]{12}$/i.test(String(req.params.id))) throw new ApiError("BAD_REQUEST");
    const [removed] = await db.delete(table)
      .where(and(eq(table.id, String(req.params.id)), eq(table.userId, user.id))).returning();
    if (!removed) throw new ApiError("NOT_FOUND");
    res.status(204).end();
  });
}
resourceRoutes("incomes");
resourceRoutes("scholarships");

export default router;