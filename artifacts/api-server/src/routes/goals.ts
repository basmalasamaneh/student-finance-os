import { Router, type IRouter, type Request } from "express";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, financeAccounts, savingsGoals, goalHistory, goalInvitations } from "@workspace/db";
import * as V from "@workspace/api-zod";
import { requireRole } from "../lib/authorization";
import { ApiError } from "../lib/http-errors";
import { once, lockedAccounts, post, type Tx } from "../lib/finance";
import { validDate } from "../lib/planning";
import { historyDto, invitationDto, lockedGoal, ownerGoals, parentConsent, parentGoalDto, readGoal } from "../lib/goals";
import { notifyFamily } from "../lib/notifications";

const router: IRouter = Router();
const owner = (r: Request) => requireRole(r.res?.locals.principal, "student").userId;
const parent = (r: Request) => requireRole(r.res?.locals.principal, "parent").userId;
function rejectUnknown(raw: unknown, parsed: unknown): void {
  if (!raw || typeof raw !== "object" || !parsed || typeof parsed !== "object") return;
  for (const key of Object.keys(raw)) {
    if (!Object.hasOwn(parsed, key)) throw new ApiError("BAD_REQUEST");
    rejectUnknown((raw as Record<string, unknown>)[key], (parsed as Record<string, unknown>)[key]);
  }
}
function parse<T>(schema: { parse(v: unknown): T }, value: unknown): T {
  try {
    const out = schema.parse(value);
    rejectUnknown(value, out);
    return out;
  } catch { throw new ApiError("BAD_REQUEST"); }
}
function id(r: Request, key = "id") {
  const v = r.params[key];
  if (typeof v !== "string" || !/^[\da-f]{8}-([\da-f]{4}-){3}[\da-f]{12}$/i.test(v)) throw new ApiError("BAD_REQUEST");
  return v;
}
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const inputGoal = (r: Request) => {
  const input = parse(V.CreateSavingsGoalBody, r.body);
  if (!input.name.trim() || !input.category.trim() || input.targetDate && !validDate(input.targetDate)) throw new ApiError("BAD_REQUEST");
  return input;
};
async function event(tx: Tx, goalId: string, actorId: string, action: string) {
  await tx.insert(goalHistory).values({ goalId, actorId, action });
}
router.get("/goals", async (req, res) => res.json(V.ListSavingsGoalsResponse.parse(await ownerGoals(owner(req)))));
router.post("/goals", async (req, res) => {
  const userId = owner(req), input = inputGoal(req);
  const result = await once(userId, req.get("Idempotency-Key"), "goal:create", input, async tx => {
    const [reserve] = await tx.insert(financeAccounts).values({ userId, type: "goal_reserve", name: `Reserved: ${input.name}`, currency: input.target.currency }).returning();
    const [goal] = await tx.insert(savingsGoals).values({ userId, reserveAccountId: reserve!.id, name: input.name.trim(),
      targetMinor: BigInt(input.target.minor), currency: input.target.currency, targetDate: input.targetDate,
      category: input.category.trim(), priority: input.priority, notes: input.notes }).returning();
    await event(tx, goal!.id, userId, "created");
    return readGoal(tx, goal!);
  });
  res.status(201).json(V.CreateSavingsGoalResponse.parse(result));
});
router.get("/goals/:id", async (req, res) => {
  const userId = owner(req), goalId = id(req);
  res.json(V.GetSavingsGoalResponse.parse(await db.transaction(async tx => readGoal(tx, await lockedGoal(tx, goalId, userId)))));
});
router.put("/goals/:id", async (req, res) => {
  const userId = owner(req), goalId = id(req), input = inputGoal(req);
  const result = await once(userId, req.get("Idempotency-Key"), `goal:edit:${goalId}`, input, async tx => {
    const goal = await lockedGoal(tx, goalId, userId), dto = await readGoal(tx, goal);
    if (["completed", "archived"].includes(goal.status) || input.target.minor < dto.current.minor ||
      dto.current.minor > 0 && input.target.currency !== goal.currency) throw new ApiError("CONFLICT");
    await tx.update(financeAccounts).set({ currency: input.target.currency, name: `Reserved: ${input.name}` }).where(eq(financeAccounts.id, goal.reserveAccountId));
    const [updated] = await tx.update(savingsGoals).set({ name: input.name.trim(), targetMinor: BigInt(input.target.minor),
      currency: input.target.currency, targetDate: input.targetDate, category: input.category.trim(), priority: input.priority,
      notes: input.notes, updatedAt: new Date() }).where(eq(savingsGoals.id, goalId)).returning();
    await event(tx, goalId, userId, "edited");
    return readGoal(tx, updated!);
  });
  res.json(V.UpdateSavingsGoalResponse.parse(result));
});
router.post("/goals/:id/status", async (req, res) => {
  const userId = owner(req), goalId = id(req), input = parse(V.ChangeSavingsGoalStatusBody, req.body);
  const result = await once(userId, req.get("Idempotency-Key"), `goal:status:${goalId}`, input, async tx => {
    const goal = await lockedGoal(tx, goalId, userId), dto = await readGoal(tx, goal);
    const allowed = input.action === "pause" ? goal.status === "active" : input.action === "resume" ? goal.status === "paused" :
      input.action === "complete" ? ["active", "paused"].includes(goal.status) && dto.remaining.minor === 0 : goal.status !== "archived";
    if (!allowed) throw new ApiError("CONFLICT");
    const status = { pause: "paused", resume: "active", complete: "completed", archive: "archived" }[input.action];
    const [updated] = await tx.update(savingsGoals).set({ status, updatedAt: new Date() }).where(eq(savingsGoals.id, goalId)).returning();
    await event(tx, goalId, userId, input.action === "resume" ? "resumed" : status);
    return readGoal(tx, updated!);
  });
  res.json(V.ChangeSavingsGoalStatusResponse.parse(result));
});
async function contribute(req: Request, isParent: boolean) {
  const actorId = isParent ? parent(req) : owner(req), goalId = id(req);
  const input = isParent ? parse(V.FundSavingsGoalAsParentBody, req.body) : parse(V.ContributeToSavingsGoalBody, req.body);
  // Recheck consent even when an old idempotent response is replayed, under the same goal lock.
  return db.transaction(async guard => {
    if (isParent) { await lockedGoal(guard, goalId); await parentConsent(guard, goalId, actorId); }
    // Reuse this transaction (including its goal lock) for idempotency and postings.
    return once(actorId, req.get("Idempotency-Key"), `goal:fund:${goalId}`, input, async tx => {
      const goal = await lockedGoal(tx, goalId, isParent ? undefined : actorId);
      const grant = isParent ? await parentConsent(tx, goalId, actorId) : undefined;
      if (goal.status !== "active") throw new ApiError("CONFLICT");
      const sourceId = "accountId" in input ? input.accountId : undefined;
      const accounts = await lockedAccounts(tx, [goal.reserveAccountId, ...(sourceId ? [sourceId] : [])], true);
      const reserve = accounts.get(goal.reserveAccountId)!;
      const value = BigInt(input.amount.minor);
      if (input.amount.currency !== goal.currency || value <= 0n) throw new ApiError("BAD_REQUEST");
      if (reserve.balanceMinor + value > goal.targetMinor) throw new ApiError("CONFLICT");
      const source = isParent ? "parent_simulated" as const : "student_account" as const;
      const details = { kind: "savings", category: "savings", relatedGoalId: goalId, goalFundingSource: source, goalFundingActorId: actorId, note: input.note };
      const transactions = [];
      if (sourceId) {
        const account = accounts.get(sourceId)!;
        if (account.userId !== actorId || account.type === "goal_reserve") throw new ApiError("NOT_FOUND");
        if (account.currency !== goal.currency) throw new ApiError("BAD_REQUEST");
        transactions.push(await post(tx, account, -value, { ...details, counterpartyAccountId: reserve.id }));
      }
      transactions.push(await post(tx, reserve, value, { ...details, counterpartyAccountId: sourceId }));
      const [entry] = await tx.insert(goalHistory).values({ goalId, actorId, action: "contribution", source,
        amountMinor: value, currency: goal.currency, transactionIds: transactions.map(t => t.id), note: input.note }).returning();
      await notifyFamily(tx, [goal.userId, ...(isParent ? [actorId] : [])], { type: "goal_funded",
        sourceId: entry!.id, goalId, goalInvitationId: grant?.id, targetId: goalId, amountMinor: value, currency: goal.currency });
      const [updated] = await tx.update(savingsGoals).set({ updatedAt: new Date() }).where(eq(savingsGoals.id, goalId)).returning();
      const dto = await readGoal(tx, updated!);
      return isParent ? { id: entry!.id, goal: parentGoalDto(dto), amount: input.amount, source, createdAt: entry!.createdAt.toISOString() } :
        { goal: dto, entry: historyDto(entry!), transactions };
    }, guard);
  });
}
router.post("/goals/:id/contributions", async (req, res) => res.status(201).json(V.ContributeToSavingsGoalResponse.parse(await contribute(req, false))));
router.post("/parent/goals/:id/contributions", async (req, res) => res.status(201).json(V.FundSavingsGoalAsParentResponse.parse(await contribute(req, true))));
router.get("/goals/:id/history", async (req, res) => {
  const userId = owner(req), goalId = id(req);
  const rows = await db.transaction(async tx => {
    await lockedGoal(tx, goalId, userId);
    return tx.select().from(goalHistory).where(eq(goalHistory.goalId, goalId)).orderBy(desc(goalHistory.createdAt), desc(goalHistory.id));
  });
  res.json(V.GetSavingsGoalHistoryResponse.parse(rows.map(historyDto)));
});
router.get("/goals/:id/invitations", async (req, res) => {
  const userId = owner(req), goalId = id(req);
  const rows = await db.transaction(async tx => {
    await lockedGoal(tx, goalId, userId);
    return tx.select().from(goalInvitations).where(eq(goalInvitations.goalId, goalId));
  });
  res.json(V.ListGoalInvitationsResponse.parse(rows.map(invitationDto)));
});
router.post("/goals/:id/invitations", async (req, res) => {
  const userId = owner(req), goalId = id(req); parse(V.CreateGoalInvitationBody, req.body);
  const result = await db.transaction(async tx => {
    const goal = await lockedGoal(tx, goalId, userId);
    if (goal.status === "archived" || goal.status === "completed") throw new ApiError("CONFLICT");
    const token = randomBytes(32).toString("base64url");
    const [row] = await tx.insert(goalInvitations).values({ goalId, tokenHash: hash(token), expiresAt: new Date(Date.now() + 7 * 86400000) }).returning();
    return { invitation: invitationDto(row!), token };
  });
  res.set("Cache-Control", "no-store").status(201).json(V.CreateGoalInvitationResponse.parse(result));
});
router.delete("/goals/:id/invitations/:invitationId", async (req, res) => {
  const userId = owner(req), goalId = id(req), invitationId = id(req, "invitationId");
  // This mutation has no request-body fields in the contract.
  if (req.body != null && (typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).length > 0)) throw new ApiError("BAD_REQUEST");
  await db.transaction(async tx => {
    await lockedGoal(tx, goalId, userId);
    const [row] = await tx.select().from(goalInvitations).where(and(eq(goalInvitations.id, invitationId), eq(goalInvitations.goalId, goalId)));
    if (!row) throw new ApiError("NOT_FOUND");
    if (!row.revokedAt) await tx.update(goalInvitations).set({ revokedAt: new Date() }).where(eq(goalInvitations.id, invitationId));
  });
  res.sendStatus(204);
});
router.post("/parent/goal-invitations/redeem", async (req, res) => {
  const parentId = parent(req), input = parse(V.RedeemGoalInvitationBody, req.body);
  const result = await db.transaction(async tx => {
    const [candidate] = await tx.select().from(goalInvitations).where(eq(goalInvitations.tokenHash, hash(input.token)));
    if (!candidate) throw new ApiError("NOT_FOUND");
    const goal = await lockedGoal(tx, candidate.goalId);
    const [row] = await tx.select().from(goalInvitations).where(eq(goalInvitations.id, candidate.id));
    if (!row || row.revokedAt || row.parentId && row.parentId !== parentId || !row.redeemedAt && row.expiresAt <= new Date()) throw new ApiError("NOT_FOUND");
    if (!row.redeemedAt) await tx.update(goalInvitations).set({ parentId, redeemedAt: new Date() }).where(eq(goalInvitations.id, row.id));
    return parentGoalDto(await readGoal(tx, goal));
  });
  res.json(V.RedeemGoalInvitationResponse.parse(result));
});
router.get("/parent/goals", async (req, res) => {
  const parentId = parent(req);
  const result = await db.transaction(async tx => {
    const grants = await tx.select().from(goalInvitations).where(and(eq(goalInvitations.parentId, parentId), isNull(goalInvitations.revokedAt)));
    const rows = [];
    for (const goalId of [...new Set(grants.map(g => g.goalId))].sort()) {
      const goal = await lockedGoal(tx, goalId);
      const [current] = await tx.select().from(goalInvitations).where(and(eq(goalInvitations.goalId, goalId), eq(goalInvitations.parentId, parentId), isNull(goalInvitations.revokedAt)));
      if (current) rows.push(parentGoalDto(await readGoal(tx, goal)));
    }
    return rows;
  });
  res.json(V.ListParentFundingGoalsResponse.parse(result));
});
export default router;