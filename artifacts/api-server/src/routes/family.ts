import { Router, type IRouter, type Request } from "express";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db, familyLinks, financeAccounts, financeTransactions, users, allowances, allowanceOccurrences,
  savingsGoals, incomes, planningRecurring, planningLines, type FamilyLink } from "@workspace/db";
import * as V from "@workspace/api-zod";
import { requireRole } from "../lib/authorization";
import { ApiError } from "../lib/http-errors";
import { accountDto, amount, lockedAccounts, once, post, semanticType, transactionDto, type Tx } from "../lib/finance";
import { allowanceDto, cancelAllowance, cancelLinkAllowances, lockedAllowance, lockedFamily, processOccurrence, todayUtc } from "../lib/allowances";
import { allowanceProjection, allowanceUpcoming, manualAllowanceUpcomingCovered } from "../lib/allowance-projection";
import { parentGoalDto, readGoal } from "../lib/goals";
import { canonicalCategory, validDate, safeMinor } from "../lib/planning";

const router: IRouter = Router();
const student = (r: Request) => requireRole(r.res?.locals.principal, "student").userId;
const parent = (r: Request) => requireRole(r.res?.locals.principal, "parent").userId;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const key = (r: Request) => r.get("Idempotency-Key");
async function serialMap<T, R>(rows: T[], map: (row: T) => Promise<R>) {
  const result: R[] = [];
  for (const row of rows) result.push(await map(row));
  return result;
}
function rejectUnknown(raw: unknown, parsed: unknown): void {
  if (!raw || !parsed || typeof raw !== "object" || typeof parsed !== "object") return;
  for (const k of Object.keys(raw)) {
    if (!Object.hasOwn(parsed, k)) throw new ApiError("BAD_REQUEST");
    rejectUnknown((raw as Record<string, unknown>)[k], (parsed as Record<string, unknown>)[k]);
  }
}
function parse<T>(schema: { parse(value: unknown): T }, value: unknown): T {
  try { const result = schema.parse(value); rejectUnknown(value, result); return result; }
  catch { throw new ApiError("BAD_REQUEST"); }
}
function id(r: Request, field = "id") {
  const value = r.params[field];
  if (typeof value !== "string" || !/^[\da-f]{8}-([\da-f]{4}-){3}[\da-f]{12}$/i.test(value)) throw new ApiError("BAD_REQUEST");
  return value;
}
async function linkDto(tx: Tx, link: FamilyLink) {
  let parentName: string | undefined;
  if (link.status === "accepted" && link.parentId) {
    const [p] = await tx.select({ name: users.name }).from(users).where(eq(users.id, link.parentId));
    parentName = p?.name;
  }
  return { id: link.id, status: link.status, permissions: link.permissions, receivingAccountId: link.receivingAccountId,
    createdAt: link.createdAt.toISOString(), expiresAt: link.expiresAt.toISOString(), ...(parentName ? { parentName } : {}) };
}
async function checkReceiving(tx: Tx, userId: string, input: V.FamilyConsentInput) {
  if (input.permissions.allowance && !input.receivingAccountId) throw new ApiError("BAD_REQUEST");
  if (input.receivingAccountId) {
    const [a] = await tx.select().from(financeAccounts).where(and(eq(financeAccounts.id, input.receivingAccountId),
      eq(financeAccounts.userId, userId), ne(financeAccounts.type, "goal_reserve")));
    if (!a) throw new ApiError("NOT_FOUND");
    return a;
  }
  return undefined;
}
router.get("/family", async (req, res) => {
  const userId = student(req);
  const data = await db.transaction(async tx => {
    const links = await tx.select().from(familyLinks).where(eq(familyLinks.studentId, userId));
    const rows = await tx.select().from(allowances).where(eq(allowances.studentId, userId)).orderBy(desc(allowances.createdAt));
    return { links: await serialMap(links, l => linkDto(tx, l)),
      allowances: await serialMap(rows, r => allowanceDto(tx, r, true)),
      projection: (await allowanceProjection(userId)).dto };
  });
  res.set("Cache-Control", "no-store").json(V.GetStudentFamilyResponse.parse(data));
});
router.post("/family/invitations", async (req, res) => {
  const userId = student(req), input = parse(V.CreateFamilyInvitationBody, req.body);
  const receipt = await db.transaction(async tx => {
    await checkReceiving(tx, userId, input);
    const token = randomBytes(32).toString("base64url");
    const [link] = await tx.insert(familyLinks).values({ studentId: userId, ...input,
      tokenHash: hash(token), expiresAt: new Date(Date.now() + 7 * 86400000) }).returning();
    return { link: await linkDto(tx, link!), token };
  });
  res.set("Cache-Control", "no-store").status(201).json(V.CreateFamilyInvitationResponse.parse(receipt));
});
router.put("/family/links/:id", async (req, res) => {
  const userId = student(req), linkId = id(req), input = parse(V.UpdateFamilyConsentBody, req.body);
  const result = await db.transaction(async tx => {
    const [link] = await tx.select().from(familyLinks).where(and(eq(familyLinks.id, linkId), eq(familyLinks.studentId, userId))).for("update");
    if (!link) throw new ApiError("NOT_FOUND");
    if (!["pending", "accepted"].includes(link.status)) throw new ApiError("CONFLICT");
    const account = await checkReceiving(tx, userId, input);
    if (link.permissions.allowance && !input.permissions.allowance) await cancelLinkAllowances(tx, link.id);
    if (account && input.permissions.allowance && account.id !== link.receivingAccountId) {
      const schedules = await tx.select().from(allowances).where(eq(allowances.familyLinkId, link.id));
      if (schedules.some(s => ["active", "paused"].includes(s.status) && s.currency !== account.currency)) throw new ApiError("CONFLICT");
    }
    const [updated] = await tx.update(familyLinks).set(input).where(eq(familyLinks.id, link.id)).returning();
    return linkDto(tx, updated!);
  });
  res.json(V.UpdateFamilyConsentResponse.parse(result));
});
router.delete("/family/links/:id", async (req, res) => {
  const userId = student(req), linkId = id(req);
  if (req.body != null && (typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).length)) throw new ApiError("BAD_REQUEST");
  await db.transaction(async tx => {
    const [link] = await tx.select().from(familyLinks).where(and(eq(familyLinks.id, linkId), eq(familyLinks.studentId, userId))).for("update");
    if (!link) throw new ApiError("NOT_FOUND");
    await cancelLinkAllowances(tx, link.id);
    await tx.update(familyLinks).set({ status: "revoked" }).where(eq(familyLinks.id, link.id));
  });
  res.sendStatus(204);
});
router.post("/parent/family-invitations/decide", async (req, res) => {
  const parentId = parent(req), input = parse(V.DecideFamilyInvitationBody, req.body);
  const result = await db.transaction(async tx => {
    // Serialize acceptance per parent: partial unique index is a final backstop for duplicate pair invitations.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`family:accept:${parentId}`}, 0))`);
    const [link] = await tx.select().from(familyLinks).where(eq(familyLinks.tokenHash, hash(input.token))).for("update");
    if (!link || link.status === "revoked" || link.parentId && link.parentId !== parentId ||
        link.status === "pending" && link.expiresAt <= new Date()) throw new ApiError("NOT_FOUND");
    const status = input.action === "accept" ? "accepted" : "declined";
    if (link.status !== "pending" && link.status !== status) throw new ApiError("CONFLICT");
    if (link.status === "pending" && status === "accepted") {
      const [existing] = await tx.select().from(familyLinks).where(and(eq(familyLinks.studentId, link.studentId),
        eq(familyLinks.parentId, parentId), eq(familyLinks.status, "accepted")));
      if (existing) throw new ApiError("CONFLICT");
    }
    await tx.update(familyLinks).set({ parentId, status }).where(eq(familyLinks.id, link.id));
    if (status === "declined") return { status };
    const [child] = await tx.select({ name: users.name }).from(users).where(eq(users.id, link.studentId));
    return { status, childId: link.studentId, childName: child!.name };
  });
  res.set("Cache-Control", "no-store").json(V.DecideFamilyInvitationResponse.parse(result));
});

router.get("/parent/wallet", async (req, res) => {
  const userId = parent(req);
  const [accounts, transactions] = await Promise.all([
    db.select().from(financeAccounts).where(and(eq(financeAccounts.userId, userId), ne(financeAccounts.type, "goal_reserve"))),
    db.select().from(financeTransactions).where(eq(financeTransactions.userId, userId)).orderBy(desc(financeTransactions.createdAt)).limit(100),
  ]);
  res.json(V.GetParentWalletResponse.parse({ accounts: accounts.map(accountDto), transactions: transactions.map(t => transactionDto(t)), simulated: true }));
});
router.post("/parent/wallet/accounts", async (req, res) => {
  const userId = parent(req), input = parse(V.CreateParentAccountBody, req.body);
  if (!input.name.trim()) throw new ApiError("BAD_REQUEST");
  const result = await once(userId, key(req), "parent:account", input, async tx => {
    const [row] = await tx.insert(financeAccounts).values({ ...input, name: input.name.trim(), userId }).returning();
    return accountDto(row!);
  });
  res.status(201).json(V.CreateParentAccountResponse.parse(result));
});
router.post("/parent/wallet/topups", async (req, res) => {
  const userId = parent(req), input = parse(V.TopUpParentWalletBody, req.body);
  const result = await once(userId, key(req), "parent:topup", input, async tx => {
    const account = (await lockedAccounts(tx, [input.accountId])).get(input.accountId)!;
    if (account.userId !== userId) throw new ApiError("NOT_FOUND");
    if (account.currency !== input.amount.currency) throw new ApiError("BAD_REQUEST");
    return post(tx, account, BigInt(input.amount.minor), { kind: "add", category: "external_income" });
  });
  res.status(201).json(V.TopUpParentWalletResponse.parse(result));
});
async function scheduleInput(tx: Tx, link: FamilyLink, input: V.AllowanceInput) {
  if (!validDate(input.nextPayment) || !validDate(input.startDate) || input.endDate && !validDate(input.endDate) ||
      input.nextPayment < todayUtc() || input.nextPayment < input.startDate || input.endDate && input.nextPayment > input.endDate ||
      input.kind === "oneTime" && (input.frequency !== null || input.startDate !== input.nextPayment) ||
      input.kind === "recurring" && input.frequency === null) throw new ApiError("BAD_REQUEST");
  if (!link.receivingAccountId) throw new ApiError("CONFLICT");
  const accounts = await lockedAccounts(tx, [input.parentAccountId, link.receivingAccountId]);
  const sender = accounts.get(input.parentAccountId)!, recipient = accounts.get(link.receivingAccountId)!;
  if (sender.userId !== link.parentId || recipient.userId !== link.studentId) throw new ApiError("NOT_FOUND");
  if (sender.currency !== input.amount.currency || recipient.currency !== input.amount.currency) throw new ApiError("BAD_REQUEST");
  const { amount: value, ...rest } = input;
  return { ...rest, amountMinor: BigInt(value.minor), currency: value.currency };
}
router.get("/parent/children/:childId/allowances", async (req, res) => {
  const parentId = parent(req), childId = id(req, "childId");
  const result = await db.transaction(async tx => {
    const link = await lockedFamily(tx, parentId, childId, "allowance");
    const rows = await tx.select().from(allowances).where(eq(allowances.familyLinkId, link.id)).orderBy(desc(allowances.createdAt));
    return serialMap(rows, r => allowanceDto(tx, r));
  });
  res.set("Cache-Control", "no-store").json(V.ListChildAllowancesResponse.parse(result));
});
router.post("/parent/children/:childId/allowances", async (req, res) => {
  const parentId = parent(req), childId = id(req, "childId"), input = parse(V.CreateAllowanceBody, req.body);
  const result = await db.transaction(async tx => {
    const link = await lockedFamily(tx, parentId, childId, "allowance");
    return once(parentId, key(req), `allowance:create:${childId}:${link.id}`, input, async inner => {
      const values = await scheduleInput(inner, link, input);
      const [row] = await inner.insert(allowances).values({ ...values, familyLinkId: link.id, parentId, studentId: childId }).returning();
      return allowanceDto(inner, row!);
    }, tx);
  });
  res.status(201).json(V.CreateAllowanceResponse.parse(result));
});
router.put("/parent/children/:childId/allowances/:id", async (req, res) => {
  const parentId = parent(req), childId = id(req, "childId"), allowanceId = id(req), input = parse(V.UpdateAllowanceBody, req.body);
  const result = await db.transaction(async tx => {
    const link = await lockedFamily(tx, parentId, childId, "allowance");
    return once(parentId, key(req), `allowance:edit:${childId}:${link.id}:${allowanceId}`, input, async inner => {
      const row = await lockedAllowance(inner, allowanceId, link);
      if (!["active", "paused"].includes(row.status)) throw new ApiError("CONFLICT");
      const values = await scheduleInput(inner, link, input);
      const events = await inner.select().from(allowanceOccurrences).where(eq(allowanceOccurrences.allowanceId, row.id));
      // Never move a schedule back into an already posted/cancelled date. An unresolved failed occurrence
      // must be retried or cancelled, not silently skipped or rewritten by editing.
      if (events.some(e => e.status === "failed") || events.some(e => e.scheduledDate >= input.nextPayment)) throw new ApiError("CONFLICT");
      const [updated] = await inner.update(allowances).set(values).where(eq(allowances.id, row.id)).returning();
      return allowanceDto(inner, updated!);
    }, tx);
  });
  res.json(V.UpdateAllowanceResponse.parse(result));
});
router.post("/parent/children/:childId/allowances/:id/status", async (req, res) => {
  const parentId = parent(req), childId = id(req, "childId"), allowanceId = id(req), input = parse(V.ChangeAllowanceStatusBody, req.body);
  const result = await db.transaction(async tx => {
    const link = await lockedFamily(tx, parentId, childId, "allowance");
    return once(parentId, key(req), `allowance:status:${childId}:${link.id}:${allowanceId}`, input, async inner => {
      const row = await lockedAllowance(inner, allowanceId, link);
      if (input.action === "cancel") {
        if (!["active", "paused"].includes(row.status)) throw new ApiError("CONFLICT");
        await cancelAllowance(inner, row);
      } else {
        if (input.action === "pause" ? row.status !== "active" : row.status !== "paused") throw new ApiError("CONFLICT");
        await inner.update(allowances).set({ status: input.action === "pause" ? "paused" : "active" }).where(eq(allowances.id, row.id));
      }
      return allowanceDto(inner, await lockedAllowance(inner, row.id, link));
    }, tx);
  });
  res.json(V.ChangeAllowanceStatusResponse.parse(result));
});
router.post("/parent/children/:childId/allowances/:id/retry", async (req, res) => {
  const parentId = parent(req), childId = id(req, "childId"), allowanceId = id(req), input = parse(V.RetryAllowanceBody, req.body);
  const result = await db.transaction(async tx => {
    const link = await lockedFamily(tx, parentId, childId, "allowance");
    return once(parentId, key(req), `allowance:retry:${childId}:${link.id}:${allowanceId}`, input, async inner => {
      const row = await lockedAllowance(inner, allowanceId, link);
      if (row.status !== "active" || row.nextPayment > todayUtc()) throw new ApiError("CONFLICT");
      return allowanceDto(inner, await processOccurrence(inner, link, row));
    }, tx);
  });
  res.json(V.RetryAllowanceResponse.parse(result));
});

const campusCategory = (category: string) => ["cafeteria", "bookstore", "campus_transportation", "fees"].includes(category) || category.startsWith("campus");
// Planning canonicalizes aliases and retains no merchant/location provenance. Conservatively
// withhold campus-capable categories here only, rather than rewriting student planning data.
const campusCapablePlanningCategory = (category: string) => campusCategory(category) ||
  ["food", "books", "transportation", "university_fees"].includes(canonicalCategory(category));
export function isCampusRow(row: { serviceId?: string | null; campusId?: string | null; universityId?: string | null; category: string }) {
  return !!(row.serviceId || row.campusId || row.universityId || campusCategory(row.category));
}
function grouped(rows: { currency: string; minor: bigint }[]) {
  const totals = new Map<string, bigint>();
  for (const row of rows) totals.set(row.currency, (totals.get(row.currency) ?? 0n) + row.minor);
  return [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currency, minor]) => ({ currency, minor: safeMinor(minor) }));
}
async function childDto(tx: Tx, link: FamilyLink) {
  const p = link.permissions, childId = link.studentId;
  const [child] = await tx.select({ name: users.name }).from(users).where(eq(users.id, childId));
  const result: Record<string, unknown> = { childId, name: child!.name, permissions: p };
  if (p.balance) {
    const rows = await tx.select().from(financeAccounts).where(and(eq(financeAccounts.userId, childId), ne(financeAccounts.type, "goal_reserve")));
    result.balance = grouped(rows.map(r => ({ currency: r.currency, minor: r.balanceMinor })));
  }
  if (p.transactions || p.monthlySummary || p.campusSpending) {
    const rows = await tx.select().from(financeTransactions).where(eq(financeTransactions.userId, childId)).orderBy(desc(financeTransactions.createdAt));
    const visible = rows.filter(r => p.campusSpending || !isCampusRow(r));
    const month = todayUtc().slice(0, 7);
    const monthly = visible.filter(r => r.createdAt.toISOString().startsWith(month));
    if (p.transactions) result.transactions = visible.slice(0, 50).map(r => ({
      id: r.id, type: semanticType(r), amount: amount(r.amountMinor, r.currency), direction: r.direction, createdAt: r.createdAt.toISOString(),
    }));
    if (p.monthlySummary) {
      const cash = monthly.filter(r => r.category !== "transfer" && r.goalFundingSource !== "student_account");
      const currencies = [...new Set(cash.map(r => r.currency))].sort();
      const summary = currencies.map(currency => {
        const sum = (direction: string) => ({ currency, minor: safeMinor(cash.filter(r => r.currency === currency && r.direction === direction).reduce((n, r) => n + r.amountMinor, 0n)) });
        return { currency, income: sum("credit"), spending: sum("debit"), campusIncluded: p.campusSpending };
      });
      result.monthlySummary = summary;
      result.income = summary.map(s => s.income);
    }
    if (p.campusSpending) result.campusSpending = grouped(rows.filter(r => isCampusRow(r) && r.direction === "debit" && r.createdAt.toISOString().startsWith(month))
      .map(r => ({ currency: r.currency, minor: r.amountMinor })));
  }
  if (p.goals) {
    const goals = await tx.select().from(savingsGoals).where(eq(savingsGoals.userId, childId));
    result.goals = await serialMap(goals, async g => parentGoalDto(await readGoal(tx, g)));
  }
  if (p.allowance) {
    if (link.receivingAccountId) {
      const [receiving] = await tx.select({ currency: financeAccounts.currency }).from(financeAccounts)
        .where(and(eq(financeAccounts.id, link.receivingAccountId), eq(financeAccounts.userId, childId), ne(financeAccounts.type, "goal_reserve")));
      if (receiving) result.allowanceCurrency = receiving.currency;
    }
    const rows = await tx.select().from(allowances).where(eq(allowances.familyLinkId, link.id)).orderBy(desc(allowances.createdAt));
    result.allowances = await serialMap(rows, r => allowanceDto(tx, r));
  }
  if (p.requests) result.requests = { status: "coming_soon", items: [] };
  if (p.upcomingPayments) {
    const today = todayUtc();
    const recurring = await tx.select().from(planningRecurring).where(and(eq(planningRecurring.userId, childId), eq(planningRecurring.active, true)));
    const lines = await tx.select().from(planningLines).where(eq(planningLines.userId, childId));
    const incomeRows = await tx.select().from(incomes).where(eq(incomes.userId, childId));
    // A parent only sees this parent's own allowance details, never another guardian's identity.
    const schedules = p.allowance
      ? await tx.select().from(allowances).where(and(eq(allowances.familyLinkId, link.id), eq(allowances.status, "active")))
      : [];
    const scheduledUpcoming = allowanceUpcoming(schedules, today);
    const upcoming: { id: string; date: string; amount: { minor: number; currency: string }; source: string }[] = [];
    for (const r of recurring) if (r.nextDate >= today && (p.campusSpending || !campusCapablePlanningCategory(r.category))) upcoming.push({ id: r.id, date: r.nextDate, amount: amount(r.amountMinor, r.currency), source: "recurring" });
    for (const r of lines) if (r.upcomingDate && r.upcomingDate >= today && (p.campusSpending || !campusCapablePlanningCategory(r.category))) upcoming.push({ id: r.id, date: r.upcomingDate, amount: amount(r.amountMinor, r.currency), source: "line" });
    for (const r of incomeRows) {
      const data = r.data as { active: boolean; expectedDate?: string; amount: { minor: number; currency: string }; source: string };
      if (data.active && data.expectedDate && data.expectedDate >= today && validDate(data.expectedDate) &&
          !manualAllowanceUpcomingCovered(data, scheduledUpcoming)) upcoming.push({ id: r.id, date: data.expectedDate, amount: data.amount, source: "income" });
    }
    upcoming.push(...scheduledUpcoming);
    result.upcomingPayments = upcoming.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 100);
  }
  return result;
}
router.get("/parent/children/:childId", async (req, res) => {
  const parentId = parent(req), childId = id(req, "childId");
  const data = await db.transaction(async tx => childDto(tx, await lockedFamily(tx, parentId, childId)));
  res.set("Cache-Control", "no-store").json(V.GetParentChildResponse.parse(data));
});
router.get("/parent/dashboard", async (req, res) => {
  const parentId = parent(req);
  const children = await db.transaction(async tx => {
    // Lock links in stable order; revocation serializes with the entire disclosure.
    const links = await tx.select().from(familyLinks).where(and(eq(familyLinks.parentId, parentId), eq(familyLinks.status, "accepted")))
      .orderBy(familyLinks.id).for("update");
    const result = [];
    for (const link of links) result.push(await childDto(tx, link));
    return result;
  });
  res.set("Cache-Control", "no-store").json(V.GetParentDashboardResponse.parse({ children, simulated: true, requestsStatus: "coming_soon", goalFundingPath: "/goals/fund" }));
});
export default router;