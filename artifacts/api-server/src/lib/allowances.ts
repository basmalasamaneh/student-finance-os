import { and, asc, desc, eq } from "drizzle-orm";
import { allowances, allowanceOccurrences, familyLinks, type Allowance, type FamilyLink } from "@workspace/db";
import { amount, lockedAccounts, post, type Tx } from "./finance";
import { ApiError } from "./http-errors";
import { notifyFamily } from "./notifications";

export const todayUtc = () => new Date().toISOString().slice(0, 10);
export async function lockedFamily(tx: Tx, parentId: string, childId: string, permission?: keyof FamilyLink["permissions"]) {
  const [link] = await tx.select().from(familyLinks).where(and(
    eq(familyLinks.parentId, parentId), eq(familyLinks.studentId, childId), eq(familyLinks.status, "accepted"),
  )).for("update");
  if (!link || permission && !link.permissions[permission]) throw new ApiError("NOT_FOUND");
  return link;
}
export async function lockedAllowance(tx: Tx, id: string, link: FamilyLink) {
  const [row] = await tx.select().from(allowances).where(and(eq(allowances.id, id), eq(allowances.familyLinkId, link.id))).for("update");
  if (!row) throw new ApiError("NOT_FOUND");
  return row;
}
export async function allowanceDto(tx: Tx, row: Allowance, student = false) {
  const events = await tx.select().from(allowanceOccurrences).where(eq(allowanceOccurrences.allowanceId, row.id))
    .orderBy(desc(allowanceOccurrences.scheduledDate));
  return {
    id: row.id, ...(student ? {} : { childId: row.studentId, parentAccountId: row.parentAccountId, createdAt: row.createdAt.toISOString() }),
    amount: amount(row.amountMinor, row.currency), kind: row.kind, frequency: row.frequency,
    nextPayment: row.nextPayment, startDate: row.startDate, endDate: row.endDate, note: row.note,
    status: row.status, lastFailure: row.lastFailure,
    occurrences: events.map(e => ({
      id: e.id, scheduledDate: e.scheduledDate, amount: amount(e.amountMinor, e.currency),
      status: e.status, failure: e.failure,
      transactionIds: student ? e.transactionIds.slice(1) : e.transactionIds.slice(0, 1),
      attemptedAt: e.attemptedAt.toISOString(),
    })),
  };
}
export async function cancelLinkAllowances(tx: Tx, linkId: string) {
  // Link lock must already be held. Same lock order as scheduler and parent mutations.
  const rows = await tx.select().from(allowances).where(eq(allowances.familyLinkId, linkId)).orderBy(asc(allowances.id)).for("update");
  for (const row of rows) if (row.status === "active" || row.status === "paused") {
    await cancelAllowance(tx, row);
  }
}
export async function cancelAllowance(tx: Tx, row: Allowance) {
  await tx.update(allowances).set({ status: "cancelled", lastFailure: null }).where(eq(allowances.id, row.id));
  await tx.update(allowanceOccurrences).set({ status: "cancelled" }).where(and(
    eq(allowanceOccurrences.allowanceId, row.id), eq(allowanceOccurrences.status, "failed"),
  ));
}
export function nextAllowanceDate(current: string, frequency: string, anchor: string): string {
  const date = new Date(current + "T00:00:00Z");
  if (frequency === "monthly") {
    const year = date.getUTCFullYear(), month = date.getUTCMonth() + 1;
    const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(Number(anchor.slice(8)), last))).toISOString().slice(0, 10);
  }
  date.setUTCDate(date.getUTCDate() + (frequency === "weekly" ? 7 : 14));
  return date.toISOString().slice(0, 10);
}

// Called with the link then allowance row locked. All receipt, balance, ledger and outbox changes commit together.
export async function processOccurrence(tx: Tx, link: FamilyLink, row: Allowance, today = todayUtc()) {
  if (link.status !== "accepted" || !link.permissions.allowance || !link.receivingAccountId ||
      row.familyLinkId !== link.id || row.status !== "active" || row.nextPayment > today || row.startDate > today) return row;
  if (row.endDate && row.nextPayment > row.endDate) {
    const [done] = await tx.update(allowances).set({ status: "completed", lastFailure: null }).where(eq(allowances.id, row.id)).returning();
    return done!;
  }
  const [existing] = await tx.select().from(allowanceOccurrences).where(and(
    eq(allowanceOccurrences.allowanceId, row.id), eq(allowanceOccurrences.scheduledDate, row.nextPayment),
  ));
  // Posted dates are immutable, never recreated by a retry, edit or a concurrent worker.
  if (existing?.status === "posted" || existing?.status === "cancelled") throw new ApiError("CONFLICT");
  const accounts = await lockedAccounts(tx, [row.parentAccountId, link.receivingAccountId]);
  const parent = accounts.get(row.parentAccountId)!, student = accounts.get(link.receivingAccountId)!;
  if (parent.userId !== row.parentId || student.userId !== row.studentId) throw new ApiError("NOT_FOUND");
  if (parent.currency !== row.currency || student.currency !== row.currency) throw new ApiError("CONFLICT");
  const failure = parent.balanceMinor < row.amountMinor ? "insufficient_funds" :
    student.balanceMinor + row.amountMinor > BigInt(Number.MAX_SAFE_INTEGER) ? "balance_limit" : null;
  const values = { amountMinor: row.amountMinor, currency: row.currency, status: failure ? "failed" : "posted",
    failure, attemptedAt: new Date() };
  const [occurrence] = existing
    ? await tx.update(allowanceOccurrences).set(values).where(eq(allowanceOccurrences.id, existing.id)).returning()
    : await tx.insert(allowanceOccurrences).values({ ...values, allowanceId: row.id, scheduledDate: row.nextPayment }).returning();
  if (failure) {
    const [failed] = await tx.update(allowances).set({ lastFailure: failure }).where(eq(allowances.id, row.id)).returning();
    return failed!;
  }
  const details = { kind: "allowance", category: "parent_allowance", parentTransferId: occurrence!.id, note: row.note };
  const debit = await post(tx, parent, -row.amountMinor, details);
  const credit = await post(tx, student, row.amountMinor, { ...details, counterpartyAccountId: parent.id });
  await tx.update(allowanceOccurrences).set({ transactionIds: [debit.id, credit.id] }).where(eq(allowanceOccurrences.id, occurrence!.id));
  await notifyFamily(tx, [row.studentId, row.parentId], { type: "allowance_posted", sourceId: occurrence!.id,
    targetId: row.id, familyLinkId: link.id, amountMinor: row.amountMinor, currency: row.currency });
  const next = row.kind === "oneTime" ? row.nextPayment : nextAllowanceDate(row.nextPayment, row.frequency!, row.startDate);
  const completed = row.kind === "oneTime" || row.endDate !== null && next > row.endDate;
  const [updated] = await tx.update(allowances).set({
    nextPayment: completed ? row.nextPayment : next, status: completed ? "completed" : "active", lastFailure: null,
  }).where(eq(allowances.id, row.id)).returning();
  return updated!;
}
