import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, financeAccounts, financeTransactions, financeEvents, financeIdempotency, moneyRequests } from "@workspace/db";
import { ApiError } from "./http-errors";
import { positive, checked } from "./finance-money";
export { positive, checked } from "./finance-money";

export const amount = (minor: bigint, currency: string) => ({ minor: Number(minor), currency });
export const accountDto = (a: typeof financeAccounts.$inferSelect) => ({
  id: a.id, type: a.type, name: a.name, currency: a.currency, balance: amount(a.balanceMinor, a.currency),
});
export function semanticType(t: Pick<typeof financeTransactions.$inferSelect, "kind" | "serviceId" | "direction">) {
  if (t.serviceId && t.kind === "payment") return "campus_payment";
  if (t.kind === "transfer" || t.kind === "send" || t.kind === "request_fulfillment") return "transfer";
  if (t.kind === "withdrawal") return "withdrawal";
  if (t.kind === "deposit") return "deposit";
  if (t.kind === "payment") return "payment";
  if (t.kind === "allowance" || t.kind === "refund" || t.kind === "savings") return t.kind;
  return t.direction === "credit" ? "income" : "expense";
}
export const transactionDto = (t: typeof financeTransactions.$inferSelect, context?: {
  accountName?: string; counterpartyName?: string; campusId?: string | null;
  universityId?: string | null; campusName?: string | null; universityName?: string | null;
}) => ({
  id: t.id, userId: t.userId, accountId: t.accountId, kind: t.kind, type: semanticType(t), category: t.category, direction: t.direction,
  amount: amount(t.amountMinor, t.currency), balanceAfter: amount(t.balanceAfterMinor, t.currency),
  status: t.status, ...(t.counterpartyAccountId ? { counterpartyAccountId: t.counterpartyAccountId } : {}),
  ...(t.serviceId ? { serviceId: t.serviceId } : {}), ...(t.merchantName ? { merchantName: t.merchantName } : {}),
  ...(t.items ? { items: t.items } : {}), ...(t.note ? { note: t.note } : {}), createdAt: t.createdAt.toISOString(),
  ...(context?.accountName ? { accountName: context.accountName } : {}),
  description: t.merchantName ? `Payment to ${t.merchantName}` : ({
    add: "Simulated funds added", receive: "Simulated funds received", deposit: "Simulated deposit",
    withdrawal: "Simulated withdrawal", payment: "Simulated payment", transfer: "Account transfer",
    send: "Student transfer", request_fulfillment: "Fulfilled money request",
  } as Record<string, string>)[t.kind] ?? "Ledger transaction",
  source: t.direction === "credit"
    ? t.counterpartyAccountId ? context?.counterpartyName ?? "Another account" : "External (simulated)"
    : context?.accountName ?? "Account",
  destination: t.direction === "debit"
    ? t.counterpartyAccountId ? context?.counterpartyName ?? "Another account" : t.merchantName ?? "External (simulated)"
    : context?.accountName ?? "Account",
  relatedGoalId: t.relatedGoalId, relatedBudgetId: t.relatedBudgetId,
  parentTransferId: t.parentTransferId, campusServiceId: t.serviceId,
  universityId: t.universityId ?? context?.universityId ?? null,
  campusId: t.campusId ?? context?.campusId ?? null,
  universityName: t.universityName ?? context?.universityName ?? null,
  campusName: t.campusName ?? context?.campusName ?? null,
  recurringExpenseId: t.recurringExpenseId,
});
export const requestDto = (r: typeof moneyRequests.$inferSelect) => ({
  id: r.id, issuerId: r.issuerId, payerId: r.payerId, recipientAccountId: r.recipientAccountId,
  payerAccountId: r.payerAccountId, amount: amount(r.amountMinor, r.currency), status: r.status,
  ...(r.note ? { note: r.note } : {}), ...(r.transactionId ? { transactionId: r.transactionId } : {}),
  createdAt: r.createdAt.toISOString(),
});
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function lockedAccounts(tx: Tx, ids: string[]) {
  // Stable lock ordering prevents cycles when two senders exchange money.
  const rows = [];
  for (const id of [...new Set(ids)].sort()) {
    const [row] = await tx.select().from(financeAccounts).where(eq(financeAccounts.id, id)).for("update");
    if (!row) throw new ApiError("NOT_FOUND");
    rows.push(row);
  }
  return new Map(rows.map(row => [row.id, row]));
}
export async function post(tx: Tx, account: typeof financeAccounts.$inferSelect, delta: bigint, details: {
  kind: string; category: string; counterpartyAccountId?: string; serviceId?: string;
  merchantName?: string; items?: unknown; note?: string;
  universityId?: string; campusId?: string; universityName?: string; campusName?: string;
}) {
  if (delta < 0n && account.balanceMinor < -delta) throw new ApiError("INSUFFICIENT_FUNDS");
  const next = checked(account.balanceMinor + delta);
  await tx.update(financeAccounts).set({ balanceMinor: next }).where(eq(financeAccounts.id, account.id));
  const [entry] = await tx.insert(financeTransactions).values({
    userId: account.userId, accountId: account.id, kind: details.kind, category: details.category,
    direction: delta >= 0n ? "credit" : "debit", amountMinor: delta >= 0n ? delta : -delta,
    currency: account.currency, balanceAfterMinor: next, status: details.kind === "payment" ? "simulated_payment" : "simulated",
    counterpartyAccountId: details.counterpartyAccountId, serviceId: details.serviceId,
    merchantName: details.merchantName, items: details.items, note: details.note,
    universityId: details.universityId, campusId: details.campusId,
    universityName: details.universityName, campusName: details.campusName,
  }).returning();
  await tx.insert(financeEvents).values({
    transactionId: entry!.id, userId: account.userId, eventType: "finance.transaction.posted",
    payload: { transactionId: entry!.id, accountId: account.id, category: details.category, currency: account.currency },
  });
  return transactionDto(entry!);
}
export async function move(tx: Tx, senderId: string, recipientId: string, value: bigint, kind: string, note?: string) {
  if (senderId === recipientId) throw new ApiError("BAD_REQUEST");
  const accounts = await lockedAccounts(tx, [senderId, recipientId]);
  const sender = accounts.get(senderId)!;
  const recipient = accounts.get(recipientId)!;
  if (sender.currency !== recipient.currency) throw new ApiError("BAD_REQUEST");
  const sent = await post(tx, sender, -value, { kind, category: "transfer", counterpartyAccountId: recipient.id, note });
  await post(tx, recipient, value, { kind, category: "transfer", counterpartyAccountId: sender.id, note });
  return sent;
}
export async function once<T>(owner: string, key: string | undefined, operation: string, input: unknown, run: (tx: Tx) => Promise<T>): Promise<T> {
  if (!key || !/^[a-zA-Z0-9_:.~-]{8,128}$/.test(key)) throw new ApiError("BAD_REQUEST");
  const digest = createHash("sha256").update(JSON.stringify({ operation, input })).digest("hex");
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${owner + ":" + key}, 0))`);
    const [existing] = await tx.select().from(financeIdempotency).where(and(eq(financeIdempotency.userId, owner), eq(financeIdempotency.key, key)));
    if (existing) {
      if (existing.fingerprint !== digest) throw new ApiError("CONFLICT");
      return existing.response as T;
    }
    const result = await run(tx);
    await tx.insert(financeIdempotency).values({ userId: owner, key, fingerprint: digest, response: result });
    return result;
  });
}