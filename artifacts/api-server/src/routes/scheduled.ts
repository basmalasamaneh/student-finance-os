import { Router, type IRouter, type Request } from "express";
import { and, eq } from "drizzle-orm";
import { db, scheduledItems, scheduledOccurrenceOverrides } from "@workspace/db";
import {
  CreateScheduledItemBody, CreateScheduledItemResponse, GetScheduledItemParams, GetScheduledItemResponse,
  ListScheduledItemsResponse, UpdateScheduledItemResponse, SetScheduledOccurrenceStatusBody,
  SetScheduledOccurrenceStatusParams, SetScheduledOccurrenceStatusResponse,
  GetPlanningCalendarQueryParams, GetPlanningCalendarResponse, GetPlanningForecastQueryParams, GetPlanningForecastResponse,
  type ScheduledItemInput,
} from "@workspace/api-zod";
import { requireRole, type TrustedPrincipal } from "../lib/authorization";
import { ApiError } from "../lib/http-errors";
import { safeMinor } from "../lib/planning";
import { assertRange, recurrenceDates, validScheduledDate } from "../lib/forecast-math";
import { planningCalendar, planningForecast } from "../lib/forecast";

const router: IRouter = Router();
const own = (req: Request) => requireRole(req.res?.locals.principal as TrustedPrincipal | undefined, "student").userId;
function parse<T>(schema: { safeParse: (value: unknown) => { success: boolean; data?: T } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError("BAD_REQUEST");
  if (value && typeof value === "object" && Object.keys(value).some(k => !Object.hasOwn(result.data as object, k))) throw new ApiError("BAD_REQUEST");
  return result.data as T;
}
function input(value: unknown) {
  const data = parse(CreateScheduledItemBody, value);
  if (!data.name.trim() || !validScheduledDate(data.dueDate) || data.endDate && (!validScheduledDate(data.endDate) || data.endDate < data.dueDate) ||
      data.recurrence !== "none" && data.status === "completed") throw new ApiError("BAD_REQUEST");
  // Generated schemas strip unknown nested fields: reject them rather than accepting owner/provenance injection.
  if (Object.keys((value as { amount: object }).amount).some(k => k !== "minor" && k !== "currency")) throw new ApiError("BAD_REQUEST");
  return data;
}
const values = (data: ScheduledItemInput) => ({ name: data.name.trim(), amountMinor: BigInt(data.amount.minor),
  currency: data.amount.currency, dueDate: data.dueDate, category: data.category, kind: data.kind,
  notes: data.notes, recurrence: data.recurrence, endDate: data.endDate ?? null, status: data.status });
const dto = (row: typeof scheduledItems.$inferSelect) => ({ id: row.id, name: row.name,
  amount: { minor: safeMinor(row.amountMinor), currency: row.currency }, dueDate: row.dueDate, category: row.category,
  kind: row.kind, notes: row.notes, recurrence: row.recurrence, ...(row.endDate ? { endDate: row.endDate } : {}),
  status: row.status, commitmentPolicy: "additional_commitment" });

router.get("/scheduled-items", async (req, res) => {
  const userId = own(req);
  const rows = await db.select().from(scheduledItems).where(eq(scheduledItems.userId, userId));
  res.json(ListScheduledItemsResponse.parse(rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id)).map(dto)));
});
router.post("/scheduled-items", async (req, res) => {
  const userId = own(req), data = input(req.body);
  const [row] = await db.insert(scheduledItems).values({ userId, ...values(data) }).returning();
  res.status(201).json(CreateScheduledItemResponse.parse(dto(row!)));
});
router.get("/scheduled-items/:id", async (req, res) => {
  const userId = own(req), { id } = parse(GetScheduledItemParams, req.params);
  const [row] = await db.select().from(scheduledItems).where(and(eq(scheduledItems.id, id), eq(scheduledItems.userId, userId)));
  if (!row) throw new ApiError("NOT_FOUND");
  res.json(GetScheduledItemResponse.parse(dto(row)));
});
router.put("/scheduled-items/:id", async (req, res) => {
  const userId = own(req), { id } = parse(GetScheduledItemParams, req.params), data = input(req.body);
  const row = await db.transaction(async tx => {
    const [existing] = await tx.select().from(scheduledItems).where(and(eq(scheduledItems.id, id), eq(scheduledItems.userId, userId))).for("update");
    if (!existing) throw new ApiError("NOT_FOUND");
    if (existing.dueDate !== data.dueDate || existing.recurrence !== data.recurrence || existing.endDate !== (data.endDate ?? null)) {
      const overrides = await tx.select({ id: scheduledOccurrenceOverrides.id }).from(scheduledOccurrenceOverrides).where(eq(scheduledOccurrenceOverrides.itemId, id)).limit(1);
      if (overrides.length) throw new ApiError("CONFLICT");
    }
    return (await tx.update(scheduledItems).set(values(data)).where(eq(scheduledItems.id, id)).returning())[0]!;
  });
  res.json(UpdateScheduledItemResponse.parse(dto(row)));
});
router.delete("/scheduled-items/:id", async (req, res) => {
  const userId = own(req), { id } = parse(GetScheduledItemParams, req.params);
  const rows = await db.delete(scheduledItems).where(and(eq(scheduledItems.id, id), eq(scheduledItems.userId, userId))).returning({ id: scheduledItems.id });
  if (!rows.length) throw new ApiError("NOT_FOUND");
  res.sendStatus(204);
});
router.put("/scheduled-items/:id/occurrences/:date", async (req, res) => {
  const userId = own(req), { id, date } = parse(SetScheduledOccurrenceStatusParams, req.params);
  const { status } = parse(SetScheduledOccurrenceStatusBody, req.body);
  await db.transaction(async tx => {
    const [item] = await tx.select().from(scheduledItems).where(and(eq(scheduledItems.id, id), eq(scheduledItems.userId, userId))).for("update");
    if (!item) throw new ApiError("NOT_FOUND");
    if (!recurrenceDates(item.dueDate, item.recurrence as ScheduledItemInput["recurrence"], item.endDate, date, date).length) throw new ApiError("BAD_REQUEST");
    await tx.insert(scheduledOccurrenceOverrides).values({ itemId: id, date, status }).onConflictDoUpdate({
      target: [scheduledOccurrenceOverrides.itemId, scheduledOccurrenceOverrides.date], set: { status },
    });
  });
  res.json(SetScheduledOccurrenceStatusResponse.parse({ itemId: id, date, status }));
});
router.get("/planning/calendar", async (req, res) => {
  const userId = own(req), { from, to } = parse(GetPlanningCalendarQueryParams, req.query);
  assertRange(from, to);
  res.json(GetPlanningCalendarResponse.parse(await planningCalendar(userId, from, to)));
});
router.get("/planning/forecast", async (req, res) => {
  const userId = own(req), { through } = parse(GetPlanningForecastQueryParams, req.query);
  const today = new Date().toISOString().slice(0, 10);
  assertRange(today, through);
  res.json(GetPlanningForecastResponse.parse(await planningForecast(userId, today, through)));
});
export default router;