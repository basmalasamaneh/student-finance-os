import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Request } from "express";
import { and, eq } from "drizzle-orm";
import { db, familyLinks, familyMoneyRequests } from "@workspace/db";
import * as V from "@workspace/api-zod";
import { requireRole } from "../lib/authorization";
import { ApiError } from "../lib/http-errors";
import { lockedAccounts, once, post } from "../lib/finance";
import { familyRequestDto, guardedRequest, lockedRequestLink, requestsForLink } from "../lib/family-requests";
import { notifyFamily } from "../lib/notifications";
import { validDate } from "../lib/planning";

const router: IRouter = Router();
const actor = (r: Request, student: boolean) => requireRole(r.res?.locals.principal, student ? "student" : "parent").userId;
function rejectUnknown(raw: unknown, parsed: unknown): void {
  if (!raw || !parsed || typeof raw !== "object" || typeof parsed !== "object") return;
  for (const k of Object.keys(raw)) {
    if (!Object.hasOwn(parsed, k)) throw new ApiError("BAD_REQUEST");
    rejectUnknown((raw as Record<string, unknown>)[k], (parsed as Record<string, unknown>)[k]);
  }
}
function parse<T>(schema: { parse(v: unknown): T }, value: unknown): T {
  try { const result = schema.parse(value); rejectUnknown(value, result); return result; }
  catch { throw new ApiError("BAD_REQUEST"); }
}
function requestId(r: Request) {
  const value = r.params.id;
  if (typeof value !== "string" || !/^[\da-f]{8}-([\da-f]{4}-){3}[\da-f]{12}$/i.test(value)) throw new ApiError("BAD_REQUEST");
  return value;
}
function emptyBody(r: Request) {
  if (r.body != null && (typeof r.body !== "object" || Array.isArray(r.body) || Object.keys(r.body).length)) throw new ApiError("BAD_REQUEST");
}
router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
for (const student of [true, false]) {
  const prefix = student ? "/family/requests" : "/parent/requests";
  router.get(prefix, async (req, res) => {
    const userId = actor(req, student);
    const result = await db.transaction(async tx => {
      const links = await tx.select().from(familyLinks).where(and(
        eq(student ? familyLinks.studentId : familyLinks.parentId, userId), eq(familyLinks.status, "accepted"),
      )).orderBy(familyLinks.id).for("update");
      const rows = [];
      for (const link of links) if (link.permissions.requests) rows.push(...await requestsForLink(tx, link.id, student));
      return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    });
    res.json(V.ListStudentFamilyRequestsResponse.parse(result));
  });
  router.get(`${prefix}/:id`, async (req, res) => {
    const userId = actor(req, student), id = requestId(req);
    const result = await db.transaction(async tx => familyRequestDto((await guardedRequest(tx, id, userId, student)).row, student));
    res.json(V.GetStudentFamilyRequestResponse.parse(result));
  });
}
router.post("/family/requests", async (req, res) => {
  const studentId = actor(req, true), input = parse(V.CreateFamilyMoneyRequestBody, req.body);
  if (!input.reason.trim() || !validDate(input.date)) throw new ApiError("BAD_REQUEST");
  const result = await db.transaction(async tx => {
    const link = await lockedRequestLink(tx, input.familyLinkId, studentId, true);
    return once(studentId, req.get("Idempotency-Key"), `family-request:create:${link.id}`, input, async inner => {
      // Request receiving account is student-selected, independent of allowance permission/settings.
      const account = (await lockedAccounts(inner, [input.receivingAccountId])).get(input.receivingAccountId)!;
      if (account.userId !== studentId) throw new ApiError("NOT_FOUND");
      if (account.currency !== input.amount.currency) throw new ApiError("BAD_REQUEST");
      const [row] = await inner.insert(familyMoneyRequests).values({ familyLinkId: link.id, studentId,
        parentId: link.parentId!, receivingAccountId: account.id, amountMinor: BigInt(input.amount.minor),
        currency: input.amount.currency, reason: input.reason.trim(), note: input.note, date: input.date }).returning();
      await notifyFamily(inner, [link.parentId!], { type: "request", sourceId: row!.id, targetId: row!.id,
        familyLinkId: link.id, amountMinor: row!.amountMinor, currency: row!.currency });
      return familyRequestDto(row!, true);
    }, tx);
  });
  res.status(201).json(V.CreateFamilyMoneyRequestResponse.parse(result));
});
for (const action of ["approve", "decline", "ask-details", "reply", "cancel"] as const) {
  const student = action === "reply" || action === "cancel";
  router.post(`${student ? "/family" : "/parent"}/requests/:id/${action}`, async (req, res) => {
    const userId = actor(req, student), id = requestId(req);
    const input: { parentAccountId?: string; message?: string } = action === "approve" ? parse(V.ApproveFamilyRequestBody, req.body) :
      action === "ask-details" || action === "reply" ? parse(V.ReplyToFamilyRequestBody, req.body) : (emptyBody(req), {});
    if (input.message !== undefined && !input.message.trim()) throw new ApiError("BAD_REQUEST");
    const result = await db.transaction(async tx => {
      // Every mutation and cached replay first locks and reauthorizes ORIGINAL link, then request.
      const { link, row } = await guardedRequest(tx, id, userId, student);
      return once(userId, req.get("Idempotency-Key"), `family-request:${action}:${id}`, input, async inner => {
        if (!["pending", "details_requested"].includes(row.status) ||
          action === "reply" && row.status !== "details_requested" ||
          action === "ask-details" && row.status !== "pending") throw new ApiError("CONFLICT");
        let transferId = row.parentTransferId, transactionIds = row.transactionIds;
        const history = [...row.history];
        let sourceId = row.id;
        if (input.message !== undefined) {
          sourceId = randomUUID();
          history.push({ id: sourceId, role: student ? "student" : "parent", message: input.message.trim(), createdAt: new Date().toISOString() });
        }
        if (action === "approve" && input.parentAccountId !== undefined) {
          const accounts = await lockedAccounts(inner, [input.parentAccountId, row.receivingAccountId]);
          const sender = accounts.get(input.parentAccountId)!, receiver = accounts.get(row.receivingAccountId)!;
          if (sender.userId !== userId || receiver.userId !== row.studentId) throw new ApiError("NOT_FOUND");
          if (sender.currency !== row.currency || receiver.currency !== row.currency) throw new ApiError("BAD_REQUEST");
          transferId = randomUUID();
          // Not peer transfer: credit is actual parent-funded income, consistent with allowances.
          const details = { kind: "family_request", category: "parent_allowance", parentTransferId: transferId };
          // The parent's permanent financial receipt must not retain revocable student data.
          // Pair by parentTransferId, not by copying the student's account ID or private note.
          const debit = await post(inner, sender, -row.amountMinor, details);
          const credit = await post(inner, receiver, row.amountMinor, { ...details, note: row.note, counterpartyAccountId: sender.id });
          transactionIds = [debit.id, credit.id];
        }
        const status = { approve: "approved", decline: "declined", "ask-details": "details_requested", reply: "pending", cancel: "cancelled" }[action];
        const [updated] = await inner.update(familyMoneyRequests).set({
          status, history, parentTransferId: transferId, transactionIds, updatedAt: new Date(),
        }).where(eq(familyMoneyRequests.id, id)).returning();
        if (action !== "cancel") {
          const type = { approve: "approval", decline: "decline", "ask-details": "ask_details", reply: "reply" }[action];
          await notifyFamily(inner, action === "approve" || action === "decline" ? [row.studentId, row.parentId] :
            [student ? row.parentId : row.studentId], { type, sourceId, targetId: id, familyLinkId: link.id,
            amountMinor: row.amountMinor, currency: row.currency });
        }
        return familyRequestDto(updated!, student);
      }, tx);
    });
    res.json(V.GetStudentFamilyRequestResponse.parse(result));
  });
}
export default router;