import { bigint, check, date, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./onboarding";

export const scheduledItems = pgTable("scheduled_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
  currency: text("currency").notNull(),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  category: text("category").notNull(),
  kind: text("kind").notNull(),
  notes: text("notes").notNull().default(""),
  recurrence: text("recurrence").notNull(),
  endDate: date("end_date", { mode: "string" }),
  status: text("status").notNull().default("planned"),
}, t => [
  index("scheduled_items_owner").on(t.userId),
  check("scheduled_items_amount", sql`${t.amountMinor} BETWEEN 1 AND 9007199254740991`),
  check("scheduled_items_currency", sql`${t.currency} IN ('ILS','USD','JOD')`),
  check("scheduled_items_kind", sql`${t.kind} IN ('expense','income','savings')`),
  check("scheduled_items_status", sql`${t.status} IN ('planned','completed','cancelled') AND (${t.recurrence} = 'none' OR ${t.status} <> 'completed')`),
  check("scheduled_items_recurrence", sql`${t.recurrence} IN ('none','daily','weekly','biweekly','monthly','quarterly','yearly')`),
  check("scheduled_items_dates", sql`${t.endDate} IS NULL OR ${t.endDate} >= ${t.dueDate}`),
]);
export const scheduledOccurrenceOverrides = pgTable("scheduled_occurrence_overrides", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").notNull().references(() => scheduledItems.id, { onDelete: "cascade" }),
  date: date("date", { mode: "string" }).notNull(),
  status: text("status").notNull(),
}, t => [
  uniqueIndex("scheduled_occurrence_item_date").on(t.itemId, t.date),
  check("scheduled_occurrence_status", sql`${t.status} IN ('planned','completed','cancelled')`),
]);