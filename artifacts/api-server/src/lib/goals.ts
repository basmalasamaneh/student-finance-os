import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, financeAccounts, savingsGoals, goalHistory, goalInvitations, type SavingsGoalRow, type GoalHistoryRow, type GoalInvitationRow } from "@workspace/db";
import { amount, checked, type Tx } from "./finance";
import { ApiError } from "./http-errors";
import { goalMetrics } from "./goal-math";

export const GOAL_POLICY = "Goal funds are reserved, not available to spend. Archiving retains all funds. Contributions do not automatically complete a goal. Parent funding is simulated, not a bank transfer. Monthly savings planning uses the maximum of the manual savings envelope and active dated goal requirements.";
export function historyDto(row: GoalHistoryRow) {
  return { id: row.id, goalId: row.goalId, action: row.action, source: row.source,
    amount: row.amountMinor === null ? null : amount(row.amountMinor, row.currency!),
    transactionIds: row.transactionIds, note: row.note, createdAt: row.createdAt.toISOString() };
}
export function invitationDto(row: GoalInvitationRow) {
  return { id: row.id, goalId: row.goalId, createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(), redeemedAt: row.redeemedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null };
}
export async function lockedGoal(tx: Tx, id: string, ownerId?: string) {
  const [goal] = await tx.select().from(savingsGoals).where(and(eq(savingsGoals.id, id),
    ownerId ? eq(savingsGoals.userId, ownerId) : undefined)).for("update");
  if (!goal) throw new ApiError("NOT_FOUND");
  return goal;
}
export async function parentConsent(tx: Tx, goalId: string, parentId: string) {
  const [grant] = await tx.select().from(goalInvitations).where(and(eq(goalInvitations.goalId, goalId),
    eq(goalInvitations.parentId, parentId), isNull(goalInvitations.revokedAt)));
  if (!grant || !grant.redeemedAt) throw new ApiError("NOT_FOUND");
}
export function goalDto(goal: SavingsGoalRow, reserve: typeof financeAccounts.$inferSelect, history: GoalHistoryRow[], now = new Date()) {
  if (reserve.type !== "goal_reserve" || reserve.userId !== goal.userId || reserve.currency !== goal.currency ||
    reserve.balanceMinor > goal.targetMinor) throw new ApiError("INTERNAL_ERROR");
  const metrics = goalMetrics(goal.targetMinor, reserve.balanceMinor, goal.status, goal.targetDate,
    history.filter(row => row.action === "contribution"), now);
  return { id: goal.id, name: goal.name, target: amount(goal.targetMinor, goal.currency), currency: goal.currency,
    current: amount(reserve.balanceMinor, goal.currency), targetDate: goal.targetDate, category: goal.category,
    priority: goal.priority, notes: goal.notes, status: goal.status, percentage: metrics.percentage,
    remaining: amount(BigInt(metrics.remaining), goal.currency),
    requiredContributionMonthly: metrics.required === null ? null : amount(BigInt(metrics.required), goal.currency),
    estimatedCompletion: metrics.estimatedCompletion, createdAt: goal.createdAt.toISOString(), updatedAt: goal.updatedAt.toISOString() };
}
export function parentGoalDto(goal: ReturnType<typeof goalDto>) {
  return { id: goal.id, name: goal.name, target: goal.target, current: goal.current, remaining: goal.remaining,
    status: goal.status, targetDate: goal.targetDate };
}
export async function readGoal(tx: Tx, goal: SavingsGoalRow) {
  const [reserve] = await tx.select().from(financeAccounts).where(eq(financeAccounts.id, goal.reserveAccountId));
  if (!reserve) throw new ApiError("INTERNAL_ERROR");
  const history = await tx.select().from(goalHistory).where(eq(goalHistory.goalId, goal.id));
  return goalDto(goal, reserve, history);
}
export async function ownerGoals(userId: string) {
  return db.transaction(async tx => {
    const rows = await tx.select().from(savingsGoals).where(eq(savingsGoals.userId, userId)).orderBy(desc(savingsGoals.createdAt), savingsGoals.id);
    const accounts = await tx.select().from(financeAccounts).where(eq(financeAccounts.userId, userId));
    const history = rows.length ? await tx.select().from(goalHistory).where(inArray(goalHistory.goalId, rows.map(r => r.id))) : [];
    const accountMap = new Map(accounts.map(a => [a.id, a]));
    const goals = rows.map(g => {
      const reserve = accountMap.get(g.reserveAccountId);
      if (!reserve) throw new ApiError("INTERNAL_ERROR");
      return goalDto(g, reserve, history.filter(h => h.goalId === g.id));
    });
    const totals = new Map<string, { available: bigint; reserved: bigint; required: bigint }>();
    for (const account of accounts) {
      const bucket = totals.get(account.currency) ?? { available: 0n, reserved: 0n, required: 0n };
      if (account.type === "goal_reserve") bucket.reserved = checked(bucket.reserved + account.balanceMinor);
      else bucket.available = checked(bucket.available + account.balanceMinor);
      totals.set(account.currency, bucket);
    }
    for (const goal of goals) {
      const bucket = totals.get(goal.currency)!;
      bucket.required = checked(bucket.required + BigInt(goal.requiredContributionMonthly?.minor ?? 0));
    }
    return { goals, totals: [...totals].map(([currency, t]) => ({ currency, available: amount(t.available, currency),
      reserved: amount(t.reserved, currency), netBalance: amount(checked(t.available + t.reserved), currency),
      requiredContributionMonthly: amount(t.required, currency) })),
      activeCount: goals.filter(g => g.status === "active").length,
      completedCount: goals.filter(g => g.status === "completed").length, policy: GOAL_POLICY };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}