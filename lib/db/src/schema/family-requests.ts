import { bigint, check, date, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { users } from "./onboarding";
import { financeAccounts } from "./finance";
import { familyLinks } from "./family";

export type FamilyRequestConversation = { id: string; role: "student" | "parent"; message: string; createdAt: string }[];
export const familyMoneyRequests = pgTable("family_money_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyLinkId: uuid("family_link_id").notNull().references(() => familyLinks.id),
  studentId: uuid("student_id").notNull().references(() => users.id),
  parentId: uuid("parent_id").notNull().references(() => users.id),
  receivingAccountId: uuid("receiving_account_id").notNull().references(() => financeAccounts.id),
  amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
  currency: text("currency").notNull(),
  reason: text("reason").notNull(),
  note: text("note").notNull().default(""),
  date: date("date", { mode: "string" }).notNull(),
  status: text("status").notNull().default("pending"),
  history: jsonb("history").$type<FamilyRequestConversation>().notNull().default([]),
  parentTransferId: uuid("parent_transfer_id"),
  transactionIds: jsonb("transaction_ids").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("family_requests_link_idx").on(t.familyLinkId),
  index("family_requests_student_idx").on(t.studentId),
  index("family_requests_parent_idx").on(t.parentId),
  uniqueIndex("family_request_transfer_unique").on(t.parentTransferId),
  check("family_request_amount", sql`${t.amountMinor} BETWEEN 1 AND 9007199254740991`),
  check("family_request_currency", sql`${t.currency} IN ('ILS','USD','JOD')`),
  check("family_request_status", sql`${t.status} IN ('pending','details_requested','approved','declined','cancelled')`),
  check("family_request_posted", sql`(${t.status} = 'approved') = (${t.parentTransferId} IS NOT NULL)`),
]);
export const insertFamilyMoneyRequestSchema = createInsertSchema(familyMoneyRequests);
export type FamilyMoneyRequestRow = typeof familyMoneyRequests.$inferSelect;