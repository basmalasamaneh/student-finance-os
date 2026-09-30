import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, financeAccounts, financeTransactions, campusServices, campuses, universities } from "@workspace/db";
import { GetFinanceHistoryQueryParams, GetFinanceHistoryResponse, GetFinanceHistoryFilterOptionsResponse } from "@workspace/api-zod";
import { requireRole, type TrustedPrincipal } from "../lib/authorization";
import { ApiError } from "../lib/http-errors";
import { transactionDto } from "../lib/finance";

const router: IRouter = Router();
const owner = (req: Request) => requireRole(req.res?.locals.principal as TrustedPrincipal | undefined, "student").userId;
const t = financeTransactions;
const ownCounterparty = alias(financeAccounts, "own_counterparty");
const semantic = sql<string>`case
  when ${t.serviceId} is not null and ${t.kind} = 'payment' then 'campus_payment'
  when ${t.kind} in ('transfer','send','request_fulfillment') then 'transfer'
  when ${t.kind} = 'withdrawal' then 'withdrawal'
  when ${t.kind} = 'deposit' then 'deposit'
  when ${t.kind} = 'payment' then 'payment'
  when ${t.kind} in ('allowance','refund','savings') then ${t.kind}
  when ${t.direction} = 'credit' then 'income' else 'expense' end`;
const campusId = sql<string>`coalesce(${t.campusId}, ${campuses.id})`;
const universityId = sql<string>`coalesce(${t.universityId}, ${campuses.universityId})`;

const categoryNames: Record<"university" | "school" | "campus", readonly (readonly [string, string, string])[]> = {
  university: [
    ["tuition", "Tuition", "الرسوم الدراسية"], ["registration", "Registration", "التسجيل"],
    ["university_fees", "University Fees", "رسوم الجامعة"], ["transportation", "Transportation", "المواصلات"],
    ["food", "Food", "الطعام"], ["cafeteria", "Cafeteria", "الكافتيريا"],
    ["accommodation", "Accommodation", "السكن"], ["rent", "Rent", "الإيجار"],
    ["utilities", "Utilities", "المرافق"], ["books", "Books", "الكتب"],
    ["printing", "Printing", "الطباعة"], ["internet", "Internet", "الإنترنت"],
    ["academic_supplies", "Academic Supplies", "اللوازم الأكاديمية"],
    ["subscriptions", "Subscriptions", "الاشتراكات"], ["shopping", "Shopping", "التسوق"],
    ["entertainment", "Entertainment", "الترفيه"], ["health", "Health", "الصحة"],
    ["social", "Social", "الاجتماعيات"], ["personal", "Personal", "شخصي"],
    ["savings", "Savings", "الادخار"], ["other", "Other", "أخرى"],
  ],
  school: [
    ["food", "Food", "الطعام"], ["transportation", "Transportation", "المواصلات"],
    ["school_supplies", "School Supplies", "اللوازم المدرسية"], ["school_activities", "School Activities", "الأنشطة المدرسية"],
    ["books", "Books", "الكتب"], ["personal", "Personal", "شخصي"],
    ["savings", "Savings", "الادخار"], ["other", "Other", "أخرى"],
  ],
  campus: [
    ["cafeteria", "Cafeteria", "الكافتيريا"], ["bookstore", "Bookstore", "مكتبة الحرم"],
    ["printing", "Printing", "الطباعة"], ["campus_transportation", "Campus Transportation", "مواصلات الحرم"],
    ["university_fees", "University Fees", "رسوم الجامعة"], ["other_campus", "Other Campus", "أخرى في الحرم"],
  ],
};
export const historyCategories = [
  ...Object.entries(categoryNames).flatMap(([group, rows]) => rows.map(([key, label, arabicLabel]) => ({ group, key, label, arabicLabel }))),
  ...([
    ["external_income", "External income", "دخل خارجي"], ["external_outflow", "External outflow", "سحب خارجي"],
    ["transfer", "Transfer", "تحويل"], ["fees", "Fees", "رسوم"],
  ] as const).map(([key, label, arabicLabel]) => ({ group: "legacy", key, label, arabicLabel })),
];

export function validateHistoryQuery(raw: Record<string, unknown>) {
  const allowed = new Set(["search", "category", "type", "dateFrom", "dateTo", "amountMin", "amountMax", "amountCurrency",
    "accountId", "parentTransferId", "campusId", "universityId", "goalId", "page", "limit"]);
  for (const [key, value] of Object.entries(raw)) {
    if (!allowed.has(key) || typeof value !== "string") throw new ApiError("BAD_REQUEST");
    if (["amountMin", "amountMax", "page", "limit"].includes(key) && !/^\d+$/.test(value)) throw new ApiError("BAD_REQUEST");
  }
  const parsed = GetFinanceHistoryQueryParams.safeParse(raw);
  if (!parsed.success) throw new ApiError("BAD_REQUEST");
  const q = parsed.data;
  if ((q.amountMin !== undefined || q.amountMax !== undefined) && !q.amountCurrency ||
    q.amountCurrency && q.amountMin === undefined && q.amountMax === undefined ||
    q.amountMin !== undefined && !Number.isSafeInteger(q.amountMin) ||
    q.amountMax !== undefined && !Number.isSafeInteger(q.amountMax) ||
    q.amountMin !== undefined && q.amountMax !== undefined && q.amountMin > q.amountMax ||
    q.dateFrom && q.dateTo && q.dateFrom > q.dateTo ||
    q.search !== undefined && !q.search.trim()) throw new ApiError("BAD_REQUEST");
  return q;
}

function joined() {
  return db.select({
    tx: t, accountName: financeAccounts.name, counterpartyName: ownCounterparty.name,
    fallbackCampusId: campuses.id, fallbackUniversityId: campuses.universityId,
    fallbackCampusName: campuses.name, fallbackUniversityName: universities.name,
    fallbackCampusArabicName: campuses.arabicName, fallbackUniversityArabicName: universities.arabicName,
  }).from(t)
    .innerJoin(financeAccounts, and(eq(financeAccounts.id, t.accountId), eq(financeAccounts.userId, t.userId)))
    .leftJoin(ownCounterparty, and(eq(ownCounterparty.id, t.counterpartyAccountId), eq(ownCounterparty.userId, t.userId)))
    .leftJoin(campusServices, eq(campusServices.id, t.serviceId))
    .leftJoin(campuses, eq(campuses.id, campusServices.campusId))
    .leftJoin(universities, eq(universities.id, campuses.universityId));
}
type JoinedRow = Awaited<ReturnType<ReturnType<typeof joined>["execute"]>>[number];
function dto(row: JoinedRow) {
  return transactionDto(row.tx, {
    accountName: row.accountName, counterpartyName: row.counterpartyName ?? undefined,
    campusId: row.fallbackCampusId, universityId: row.fallbackUniversityId,
    campusName: row.fallbackCampusName, universityName: row.fallbackUniversityName,
  });
}
export async function historyDetail(userId: string, transactionId: string) {
  const [row] = await joined().where(and(eq(t.userId, userId), eq(t.id, transactionId))).limit(1);
  return row ? dto(row) : null;
}
// Same owner-scoped context as history/detail for older list and summary callers.
// One joined query per batch; preserve the original caller's ordering.
export async function enrichedTransactions(userId: string, rows: (typeof t.$inferSelect)[]) {
  if (!rows.length) return [];
  const matches = await joined().where(and(eq(t.userId, userId), inArray(t.id, rows.map(row => row.id))));
  const byId = new Map(matches.map(row => [row.tx.id, dto(row)]));
  return rows.map(row => {
    const enriched = byId.get(row.id);
    if (!enriched) throw new ApiError("NOT_FOUND");
    return enriched;
  });
}

router.get("/finance/history/filter-options", async (req, res) => {
  const userId = owner(req);
  const [accounts, rows] = await Promise.all([
    db.select({ id: financeAccounts.id, name: financeAccounts.name, currency: financeAccounts.currency })
      .from(financeAccounts).where(eq(financeAccounts.userId, userId)).orderBy(financeAccounts.name, financeAccounts.id),
    joined().where(eq(t.userId, userId)),
  ]);
  const campusMap = new Map<string, { id: string; universityId: string; name: string; arabicName: string }>();
  const universityMap = new Map<string, { id: string; name: string; arabicName: string }>();
  for (const row of rows) {
    const cid = row.tx.campusId ?? row.fallbackCampusId, uid = row.tx.universityId ?? row.fallbackUniversityId;
    if (!uid || !cid) continue;
    universityMap.set(uid, { id: uid, name: row.tx.universityName ?? row.fallbackUniversityName ?? "University", arabicName: row.fallbackUniversityArabicName ?? row.tx.universityName ?? "University" });
    campusMap.set(cid, { id: cid, universityId: uid, name: row.tx.campusName ?? row.fallbackCampusName ?? "Campus", arabicName: row.fallbackCampusArabicName ?? row.tx.campusName ?? "Campus" });
  }
  res.json(GetFinanceHistoryFilterOptionsResponse.parse({
    categories: historyCategories, accounts, universities: [...universityMap.values()], campuses: [...campusMap.values()], goals: [],
  }));
});
router.get("/finance/history", async (req, res) => {
  const result = await historyQuery(owner(req), validateHistoryQuery(req.query));
  res.json(GetFinanceHistoryResponse.parse(result));
});
export async function historyQuery(userId: string, q: ReturnType<typeof validateHistoryQuery>) {
  const page = q.page ?? 1, limit = q.limit ?? 20;
  const conditions: SQL[] = [eq(t.userId, userId)];
  // Prompt 4 persisted service categories; retain them while exposing campus taxonomy aliases.
  const campusAlias: Record<string, string> = {
    cafeteria: "food", bookstore: "books", campus_transportation: "transportation",
    university_fees: "fees", other_campus: "other",
  };
  if (q.category) conditions.push(campusAlias[q.category]
    ? or(eq(t.category, q.category), and(sql`${t.serviceId} is not null`, eq(t.category, campusAlias[q.category]!)))!
    : eq(t.category, q.category));
  if (q.type) conditions.push(eq(semantic, q.type));
  if (q.accountId) conditions.push(eq(t.accountId, q.accountId));
  if (q.parentTransferId) conditions.push(eq(t.parentTransferId, q.parentTransferId));
  if (q.goalId) conditions.push(eq(t.relatedGoalId, q.goalId));
  if (q.campusId) conditions.push(eq(campusId, q.campusId));
  if (q.universityId) conditions.push(eq(universityId, q.universityId));
  if (q.dateFrom) conditions.push(gte(t.createdAt, new Date(q.dateFrom + "T00:00:00.000Z")));
  if (q.dateTo) conditions.push(sql`${t.createdAt} < ${new Date(Date.parse(q.dateTo + "T00:00:00.000Z") + 86400000)}`);
  if (q.amountCurrency) conditions.push(eq(t.currency, q.amountCurrency));
  if (q.amountMin !== undefined) conditions.push(gte(t.amountMinor, BigInt(q.amountMin)));
  if (q.amountMax !== undefined) conditions.push(lte(t.amountMinor, BigInt(q.amountMax)));
  if (q.search) {
    const escaped = q.search.trim().replace(/[\\%_]/g, "\\$&");
    const pattern = `%${escaped}%`;
    conditions.push(or(ilike(t.note, pattern), ilike(t.merchantName, pattern), ilike(financeAccounts.name, pattern),
      ilike(t.category, pattern), ilike(t.kind, pattern), ilike(semantic, pattern))!);
  }
  const where = and(...conditions);
  const filtered = joined().where(where).as("filtered");
  const [countRows, rows] = await Promise.all([
    db.select({ total: sql<number>`count(*)::integer` }).from(filtered),
    joined().where(where).orderBy(desc(t.createdAt), desc(t.id)).limit(limit).offset((page - 1) * limit),
  ]);
  const items = rows.map(dto);
  const total = countRows[0]?.total ?? 0;
  return { items, page, limit, total, hasMore: page * limit < total };
}
export default router;