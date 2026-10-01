import { and, desc, eq, inArray } from "drizzle-orm";
import { familyLinks, goalInvitations, inAppNotifications, savingsGoals, type InAppNotificationRow } from "@workspace/db";
import { amount, type Tx } from "./finance";

export async function notify(tx: Tx, data: typeof inAppNotifications.$inferInsert) {
  await tx.insert(inAppNotifications).values(data).onConflictDoNothing({
    target: [inAppNotifications.recipientId, inAppNotifications.type, inAppNotifications.sourceId],
  });
}
export async function notifyFamily(tx: Tx, recipients: string[], data: Omit<typeof inAppNotifications.$inferInsert, "recipientId">) {
  for (const recipientId of [...new Set(recipients)].sort()) await notify(tx, { ...data, recipientId });
}
const titles: Record<string, string> = {
  request: "New money request", approval: "Money request approved", decline: "Money request declined",
  ask_details: "More details requested", reply: "Money request reply", allowance_posted: "Allowance posted",
  goal_funded: "Goal contribution posted", permission_changed: "Sharing settings changed",
};
export function notificationDto(row: InAppNotificationRow, parent: boolean) {
  const base = { id: row.id, type: row.type, title: titles[row.type]!, createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null };
  // Always identity-free, including after revocation: no names, amounts, IDs or scoped links.
  if (row.type === "permission_changed") return base;
  const href = row.type === "goal_funded"
    ? parent ? `/goals/fund?goalId=${row.goalId}` : `/goals/${row.goalId}`
    : row.type === "allowance_posted" ? parent ? "/parent/allowances" : "/family"
    : `${parent ? "/parent" : "/family"}/requests/${row.targetId}`;
  return { ...base, href, ...(row.amountMinor !== null && row.currency ? { amount: amount(row.amountMinor, row.currency) } : {}) };
}
export async function visibleNotifications(tx: Tx, userId: string, parent: boolean) {
  const rows = await tx.select().from(inAppNotifications).where(eq(inAppNotifications.recipientId, userId))
    .orderBy(desc(inAppNotifications.createdAt), desc(inAppNotifications.id));
  if (!parent) return rows;
  // Stable scope locks precede any inbox updates; producers hold the same original scope locks.
  const linkIds = [...new Set(rows.flatMap(r => r.familyLinkId ? [r.familyLinkId] : []))].sort();
  const links = linkIds.length ? await tx.select().from(familyLinks).where(inArray(familyLinks.id, linkIds))
    .orderBy(familyLinks.id).for("update") : [];
  const goalIds = [...new Set(rows.flatMap(r => r.goalId ? [r.goalId] : []))].sort();
  if (goalIds.length) await tx.select({ id: savingsGoals.id }).from(savingsGoals).where(inArray(savingsGoals.id, goalIds))
    .orderBy(savingsGoals.id).for("update");
  const grantIds = [...new Set(rows.flatMap(r => r.goalInvitationId ? [r.goalInvitationId] : []))];
  const grants = grantIds.length ? await tx.select().from(goalInvitations).where(and(
    inArray(goalInvitations.id, grantIds), eq(goalInvitations.parentId, userId),
  )) : [];
  return rows.filter(row => {
    if (row.type === "permission_changed") return true;
    if (row.type === "goal_funded") return grants.some(g => g.id === row.goalInvitationId &&
      g.goalId === row.goalId && g.redeemedAt !== null && g.revokedAt === null);
    const link = links.find(l => l.id === row.familyLinkId && l.parentId === userId && l.status === "accepted");
    return !!link && (row.type === "allowance_posted" ? link.permissions.allowance : link.permissions.requests);
  });
}