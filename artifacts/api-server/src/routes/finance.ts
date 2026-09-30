import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { db, financeAccounts, financeTransactions, moneyRequests, users } from "@workspace/db";
import {
  CreateFinanceAccountBody, CreateFinanceAccountResponse, ListFinanceAccountsResponse, GetFinanceAccountResponse,
  LookupFinanceRecipientResponse, ListFinanceTransactionsResponse, GetFinanceTransactionResponse,
  CreateFinanceMovementBody, CreateFinanceMovementResponse, CreateMoneyRequestBody, CreateMoneyRequestResponse,
  ListMoneyRequestsResponse, DecideMoneyRequestBody, DecideMoneyRequestResponse, GetFinanceSummaryResponse,
} from "@workspace/api-zod";
import { requireRole, type TrustedPrincipal } from "../lib/authorization";
import { ApiError } from "../lib/http-errors";
import { accountDto, requestDto, positive, once, lockedAccounts, move, post, checked } from "../lib/finance";
import historyRouter, { enrichedTransactions, historyDetail } from "./finance-history";

const router: IRouter = Router();
function owner(req: Request) { return requireRole(req.res?.locals.principal as TrustedPrincipal | undefined, "student").userId; }
function parse<T>(schema: { parse: (v: unknown) => T }, v: unknown): T {
  try { return schema.parse(v); } catch { throw new ApiError("BAD_REQUEST"); }
}
function id(req: Request): string {
  const raw = req.params.id;
  if (typeof raw !== "string" || !/^[\da-f]{8}-([\da-f]{4}-){3}[\da-f]{12}$/i.test(raw)) throw new ApiError("BAD_REQUEST");
  return raw;
}
const key = (req: Request) => req.get("Idempotency-Key");
router.use(historyRouter);

router.get("/finance/accounts", async (req, res) => {
  const rows = await db.select().from(financeAccounts).where(eq(financeAccounts.userId, owner(req)));
  res.json(ListFinanceAccountsResponse.parse(rows.map(accountDto)));
});
router.post("/finance/accounts", async (req, res) => {
  const userId = owner(req), input = parse(CreateFinanceAccountBody, req.body);
  if (!input.name.trim()) throw new ApiError("BAD_REQUEST");
  const result = await once(userId, key(req), "account", input, async tx => {
    const [row] = await tx.insert(financeAccounts).values({ ...input, name: input.name.trim(), userId }).returning();
    return accountDto(row!);
  });
  res.status(201).json(CreateFinanceAccountResponse.parse(result));
});
router.get("/finance/accounts/:id", async (req, res) => {
  const [row] = await db.select().from(financeAccounts).where(and(eq(financeAccounts.id, id(req)), eq(financeAccounts.userId, owner(req))));
  if (!row) throw new ApiError("NOT_FOUND");
  res.json(GetFinanceAccountResponse.parse(accountDto(row)));
});
router.get("/finance/recipients/:id", async (req, res) => {
  owner(req);
  const [row] = await db.select({ accountId: financeAccounts.id, currency: financeAccounts.currency, name: users.name, role: users.role })
    .from(financeAccounts).innerJoin(users, eq(financeAccounts.userId, users.id)).where(eq(financeAccounts.id, id(req)));
  if (!row || row.role !== "student") throw new ApiError("NOT_FOUND");
  res.json(LookupFinanceRecipientResponse.parse({ accountId: row.accountId, currency: row.currency, name: row.name }));
});
router.get("/finance/transactions", async (req, res) => {
  const rows = await db.select().from(financeTransactions).where(eq(financeTransactions.userId, owner(req)))
    .orderBy(desc(financeTransactions.createdAt), desc(financeTransactions.id)).limit(100);
  res.json(ListFinanceTransactionsResponse.parse(await enrichedTransactions(owner(req), rows)));
});
router.get("/finance/transactions/:id", async (req, res) => {
  const result = await historyDetail(owner(req), id(req));
  if (!result) throw new ApiError("NOT_FOUND");
  res.json(GetFinanceTransactionResponse.parse(result));
});
router.post("/finance/movements", async (req, res) => {
  const userId = owner(req), input = parse(CreateFinanceMovementBody, req.body), value = positive(input.amount);
  const result = await once(userId, key(req), "movement", input, async tx => {
    const [source] = await tx.select().from(financeAccounts).where(eq(financeAccounts.id, input.accountId));
    if (!source || source.userId !== userId) throw new ApiError("NOT_FOUND");
    if (source.currency !== input.amount.currency) throw new ApiError("BAD_REQUEST");
    if (input.kind === "send" || input.kind === "transfer") {
      if (!input.recipientAccountId) throw new ApiError("BAD_REQUEST");
      const [recipient] = await tx.select({ role: users.role, userId: financeAccounts.userId })
        .from(financeAccounts).innerJoin(users, eq(financeAccounts.userId, users.id)).where(eq(financeAccounts.id, input.recipientAccountId));
      if (!recipient || recipient.role !== "student") throw new ApiError("NOT_FOUND");
      if (input.kind === "send" && recipient.userId === userId || input.kind === "transfer" && recipient.userId !== userId) throw new ApiError("BAD_REQUEST");
      return move(tx, source.id, input.recipientAccountId, value, input.kind, input.note);
    }
    if (input.recipientAccountId) throw new ApiError("BAD_REQUEST");
    const row = (await lockedAccounts(tx, [source.id])).get(source.id)!;
    const credit = ["add", "deposit", "receive"].includes(input.kind);
    return post(tx, row, credit ? value : -value, {
      kind: input.kind,
      category: input.kind === "payment" ? "other" : credit ? "external_income" : "external_outflow",
      note: input.note,
    });
  });
  const current = await historyDetail(userId, result.id);
  if (!current) throw new ApiError("NOT_FOUND");
  res.status(201).json(CreateFinanceMovementResponse.parse(current));
});
router.get("/finance/requests", async (req, res) => {
  const userId = owner(req);
  const rows = await db.select().from(moneyRequests).where(or(eq(moneyRequests.issuerId, userId), eq(moneyRequests.payerId, userId)))
    .orderBy(desc(moneyRequests.createdAt)).limit(100);
  res.json(ListMoneyRequestsResponse.parse(rows.map(requestDto)));
});
router.post("/finance/requests", async (req, res) => {
  const userId = owner(req), input = parse(CreateMoneyRequestBody, req.body), value = positive(input.amount);
  const result = await once(userId, key(req), "request", input, async tx => {
    const [recipient, payer] = await Promise.all([
      tx.select().from(financeAccounts).where(eq(financeAccounts.id, input.recipientAccountId)).then(r => r[0]),
      tx.select().from(financeAccounts).where(eq(financeAccounts.id, input.payerAccountId)).then(r => r[0]),
    ]);
    if (!recipient || recipient.userId !== userId || !payer) throw new ApiError("NOT_FOUND");
    if (payer.userId === userId || recipient.currency !== payer.currency || payer.currency !== input.amount.currency) throw new ApiError("BAD_REQUEST");
    const [payerUser] = await tx.select({ role: users.role }).from(users).where(eq(users.id, payer.userId));
    if (payerUser?.role !== "student") throw new ApiError("NOT_FOUND");
    const [row] = await tx.insert(moneyRequests).values({
      issuerId: userId, payerId: payer.userId, recipientAccountId: recipient.id, payerAccountId: payer.id,
      currency: input.amount.currency, amountMinor: value, note: input.note,
    }).returning();
    return requestDto(row!);
  });
  res.status(201).json(CreateMoneyRequestResponse.parse(result));
});
router.post("/finance/requests/:id/decision", async (req, res) => {
  const userId = owner(req), requestId = id(req), input = parse(DecideMoneyRequestBody, req.body);
  const result = await once(userId, key(req), "decision:" + requestId, input, async tx => {
    const [row] = await tx.select().from(moneyRequests).where(eq(moneyRequests.id, requestId)).for("update");
    if (!row || (row.issuerId !== userId && row.payerId !== userId)) throw new ApiError("NOT_FOUND");
    if (row.status !== "pending") throw new ApiError("CONFLICT");
    if (input.action === "cancel" ? row.issuerId !== userId : row.payerId !== userId) throw new ApiError("FORBIDDEN");
    let transactionId: string | undefined;
    if (input.action === "fulfill") {
      const accounts = await lockedAccounts(tx, [row.payerAccountId, row.recipientAccountId]);
      const payer = accounts.get(row.payerAccountId)!, receiver = accounts.get(row.recipientAccountId)!;
      if (payer.userId !== row.payerId || receiver.userId !== row.issuerId || payer.currency !== row.currency || receiver.currency !== row.currency) throw new ApiError("CONFLICT");
      const entry = await move(tx, payer.id, receiver.id, row.amountMinor, "request_fulfillment");
      transactionId = entry.id;
    }
    const [updated] = await tx.update(moneyRequests).set({
      status: input.action === "fulfill" ? "fulfilled" : input.action === "cancel" ? "cancelled" : "declined",
      transactionId,
    }).where(eq(moneyRequests.id, row.id)).returning();
    return requestDto(updated!);
  });
  res.json(DecideMoneyRequestResponse.parse(result));
});
router.get("/finance/summary", async (req, res) => {
  const userId = owner(req);
  const [accounts, txs, requests] = await Promise.all([
    db.select().from(financeAccounts).where(eq(financeAccounts.userId, userId)),
    db.select().from(financeTransactions).where(eq(financeTransactions.userId, userId)).orderBy(desc(financeTransactions.createdAt), desc(financeTransactions.id)),
    db.select().from(moneyRequests).where(and(or(eq(moneyRequests.issuerId, userId), eq(moneyRequests.payerId, userId)), eq(moneyRequests.status, "pending"))).orderBy(desc(moneyRequests.createdAt)).limit(20),
  ]);
  const since = new Date(); since.setUTCDate(1); since.setUTCHours(0, 0, 0, 0);
  const totals = new Map<string, { balance: bigint; income: bigint; spending: bigint }>();
  for (const a of accounts) { const t = totals.get(a.currency) ?? { balance: 0n, income: 0n, spending: 0n }; t.balance = checked(t.balance + a.balanceMinor); totals.set(a.currency, t); }
  const categories = new Map<string, bigint>();
  for (const tx of txs) {
    if (tx.createdAt < since) continue;
    const t = totals.get(tx.currency) ?? { balance: 0n, income: 0n, spending: 0n };
    // Transfers are movements between accounts, not earned income or spending.
    if (tx.category !== "transfer") {
      if (tx.direction === "credit") t.income = checked(t.income + tx.amountMinor);
      else {
        t.spending = checked(t.spending + tx.amountMinor);
        const categoryKey = tx.currency + ":" + tx.category;
        categories.set(categoryKey, checked((categories.get(categoryKey) ?? 0n) + tx.amountMinor));
      }
    }
    totals.set(tx.currency, t);
  }
  const recentRows = txs.slice(0, 20);
  const campusRows = txs.filter(t => t.kind === "payment" && t.serviceId !== null).slice(0, 10);
  const enriched = await enrichedTransactions(userId, [...new Map([...recentRows, ...campusRows].map(row => [row.id, row])).values()]);
  const byId = new Map(enriched.map(row => [row.id, row]));
  res.json(GetFinanceSummaryResponse.parse({
    cashflow: [...totals].map(([currency, t]) => ({
      currency, balance: { currency, minor: Number(t.balance) },
      monthlyIncome: { currency, minor: Number(t.income) }, monthlySpending: { currency, minor: Number(t.spending) },
    })),
    categoryTotals: [...categories].map(([k, v]) => {
      const [currency, category] = k.split(":"); return { currency, category, spending: { currency, minor: Number(v) } };
    }),
    upcomingRequests: requests.map(requestDto), recentTransactions: recentRows.map(row => byId.get(row.id)),
    campusActivity: campusRows.map(row => byId.get(row.id)),
  }));
});
export default router;