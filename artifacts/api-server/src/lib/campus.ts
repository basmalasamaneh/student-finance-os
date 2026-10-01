import { and, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { db, campuses, campusServices, financeTransactions, universities } from "@workspace/db";
import { GetCampusSpendingSummaryQueryParams, type Education } from "@workspace/api-zod";
import { ApiError } from "./http-errors";
import { checked } from "./finance";

/** Whole-section replacement preserves the established profile update contract. */
export async function canonicalEducation(input: Education): Promise<Education> {
  if (input.studentType === "school") {
    const { universityId, campusId, university, campus, faculty, major, academicYear, studyStatus, ...school } = input;
    return school;
  }
  if (!!input.universityId !== !!input.campusId) throw new ApiError("BAD_REQUEST");
  if (!input.universityId || !input.campusId) return input;
  const [university] = await db.select().from(universities).where(eq(universities.id, input.universityId));
  const [campus] = await db.select().from(campuses).where(eq(campuses.id, input.campusId));
  if (!university || !campus) throw new ApiError("NOT_FOUND");
  if (campus.universityId !== university.id) throw new ApiError("BAD_REQUEST");
  return { ...input, university: university.name, campus: campus.name };
}

export function campusSummaryQuery(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) ||
      Object.entries(raw).some(([key, value]) => !["month", "campusId", "serviceId"].includes(key) || typeof value !== "string")) throw new ApiError("BAD_REQUEST");
  const parsed = GetCampusSpendingSummaryQueryParams.safeParse(raw);
  if (!parsed.success) throw new ApiError("BAD_REQUEST");
  const month = parsed.data.month ?? new Date().toISOString().slice(0, 7);
  if (month.startsWith("0000")) throw new ApiError("BAD_REQUEST");
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) throw new ApiError("BAD_REQUEST");
  return { ...parsed.data, month, start, end };
}

const categories = ["food", "books", "printing", "transportation", "fees", "other"] as const;
type Category = typeof categories[number];

export async function campusSpendingSummary(userId: string, query: ReturnType<typeof campusSummaryQuery>) {
  let resolvedCampusId: string | undefined;
  if (query.campusId) {
    const [campus] = await db.select({ id: campuses.id }).from(campuses).where(eq(campuses.id, query.campusId));
    if (!campus) throw new ApiError("NOT_FOUND");
    resolvedCampusId = campus.id;
  }
  if (query.serviceId) {
    const [service] = await db.select().from(campusServices).where(eq(campusServices.id, query.serviceId));
    if (!service) throw new ApiError("NOT_FOUND");
    if (resolvedCampusId && resolvedCampusId !== service.campusId) throw new ApiError("BAD_REQUEST");
  }
  // Left join only for pre-provenance receipts. Category ALWAYS comes from the
  // immutable ledger, never today's service configuration. No recent-row limit.
  const t = financeTransactions;
  const rows = await db.select({
    currency: t.currency, category: t.category,
    minor: sql<string>`sum(${t.amountMinor})::text`,
  }).from(t).leftJoin(campusServices, eq(t.serviceId, campusServices.id)).where(and(
    eq(t.userId, userId), eq(t.kind, "payment"), eq(t.direction, "debit"),
    isNotNull(t.serviceId), gte(t.createdAt, query.start), lt(t.createdAt, query.end),
    query.campusId ? sql`coalesce(${t.campusId}, ${campusServices.campusId}) = ${query.campusId}::uuid` : undefined,
    query.serviceId ? eq(t.serviceId, query.serviceId) : undefined,
  )).groupBy(t.currency, t.category);
  const grouped = new Map<string, Record<Category | "spending", bigint>>();
  for (const row of rows) {
    const amounts = grouped.get(row.currency) ?? { spending: 0n, food: 0n, books: 0n, printing: 0n, transportation: 0n, fees: 0n, other: 0n };
    const category = categories.includes(row.category as Category) ? row.category as Category : "other";
    const minor = BigInt(row.minor);
    amounts.spending = checked(amounts.spending + minor);
    amounts[category] = checked(amounts[category] + minor);
    grouped.set(row.currency, amounts);
  }
  return {
    month: query.month, campusId: query.campusId ?? null, serviceId: query.serviceId ?? null,
    totals: [...grouped].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amounts]) => ({
      currency,
      ...Object.fromEntries(Object.entries(amounts).map(([key, minor]) => [key, { currency, minor: Number(minor) }])),
    })),
  };
}