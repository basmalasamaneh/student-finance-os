import { and, desc, eq, inArray } from "drizzle-orm";
import { familyLinks, familyMoneyRequests, type FamilyMoneyRequestRow } from "@workspace/db";
import { amount, type Tx } from "./finance";
import { ApiError } from "./http-errors";

export function familyRequestDto(row: FamilyMoneyRequestRow, student: boolean) {
  return {
    id: row.id, familyLinkId: row.familyLinkId, studentId: row.studentId, parentId: row.parentId,
    ...(student ? { receivingAccountId: row.receivingAccountId } : {}),
    amount: amount(row.amountMinor, row.currency), reason: row.reason, note: row.note, date: row.date,
    status: row.status, history: row.history, parentTransferId: row.parentTransferId,
    transactionIds: student ? row.transactionIds.slice(1) : row.transactionIds.slice(0, 1),
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}
export async function lockedRequestLink(tx: Tx, linkId: string, actorId: string, student: boolean) {
  const [link] = await tx.select().from(familyLinks).where(and(eq(familyLinks.id, linkId),
    eq(student ? familyLinks.studentId : familyLinks.parentId, actorId))).for("update");
  if (!link || link.status !== "accepted" || !link.permissions.requests || !link.parentId) throw new ApiError("NOT_FOUND");
  return link;
}
export async function guardedRequest(tx: Tx, id: string, actorId: string, student: boolean) {
  // The initial lookup discloses nothing, and only locates the immutable original link.
  const [candidate] = await tx.select({ familyLinkId: familyMoneyRequests.familyLinkId }).from(familyMoneyRequests)
    .where(and(eq(familyMoneyRequests.id, id), eq(student ? familyMoneyRequests.studentId : familyMoneyRequests.parentId, actorId)));
  if (!candidate) throw new ApiError("NOT_FOUND");
  const link = await lockedRequestLink(tx, candidate.familyLinkId, actorId, student);
  const [row] = await tx.select().from(familyMoneyRequests).where(and(eq(familyMoneyRequests.id, id),
    eq(familyMoneyRequests.familyLinkId, link.id))).for("update");
  if (!row || row.studentId !== link.studentId || row.parentId !== link.parentId) throw new ApiError("NOT_FOUND");
  return { link, row };
}
export async function requestsForLink(tx: Tx, linkId: string, student = false) {
  const rows = await tx.select().from(familyMoneyRequests).where(eq(familyMoneyRequests.familyLinkId, linkId))
    .orderBy(desc(familyMoneyRequests.createdAt), desc(familyMoneyRequests.id));
  return rows.map(r => familyRequestDto(r, student));
}
export async function cancelLinkRequests(tx: Tx, linkId: string) {
  // Caller holds link lock, which also serializes approvals and cached replays.
  await tx.update(familyMoneyRequests).set({ status: "cancelled", updatedAt: new Date() }).where(and(
    eq(familyMoneyRequests.familyLinkId, linkId), inArray(familyMoneyRequests.status, ["pending", "details_requested"]),
  ));
}