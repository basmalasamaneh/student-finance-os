import { bigint, check, date, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { users } from "./onboarding";
import { financeAccounts } from "./finance";

export const NO_FAMILY_PERMISSIONS = {
  monthlySummary: false, balance: false, goals: false, allowance: false,
  requests: false, transactions: false, upcomingPayments: false, campusSpending: false,
};
export type FamilyPermissions = typeof NO_FAMILY_PERMISSIONS;
export const familyLinks = pgTable("family_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").notNull().references(() => users.id),
  parentId: uuid("parent_id").references(() => users.id),
  tokenHash: text("token_hash").notNull(),
  status: text("status").notNull().default("pending"),
  permissions: jsonb("permissions").$type<FamilyPermissions>().notNull().default(NO_FAMILY_PERMISSIONS),
  receivingAccountId: uuid("receiving_account_id").references(() => financeAccounts.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex("family_token_unique").on(t.tokenHash),
  uniqueIndex("family_accepted_pair_unique").on(t.studentId, t.parentId).where(sql`${t.status} = 'accepted'`),
  index("family_student_idx").on(t.studentId), index("family_parent_idx").on(t.parentId),
  check("family_status_valid", sql`${t.status} IN ('pending','accepted','declined','revoked')`),
  check("family_accepted_parent", sql`${t.status} <> 'accepted' OR ${t.parentId} IS NOT NULL`),
]);
export const allowances = pgTable("allowances", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyLinkId: uuid("family_link_id").notNull().references(() => familyLinks.id),
  studentId: uuid("student_id").notNull().references(() => users.id),
  parentId: uuid("parent_id").notNull().references(() => users.id),
  parentAccountId: uuid("parent_account_id").notNull().references(() => financeAccounts.id),
  amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
  currency: text("currency").notNull(),
  kind: text("kind").notNull(),
  frequency: text("frequency"),
  nextPayment: date("next_payment", { mode: "string" }).notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }),
  note: text("note").notNull().default(""),
  status: text("status").notNull().default("active"),
  lastFailure: text("last_failure"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("allowances_due_idx").on(t.status, t.nextPayment),
  index("allowances_student_idx").on(t.studentId), index("allowances_parent_idx").on(t.parentId),
  check("allowance_positive", sql`${t.amountMinor} BETWEEN 1 AND 9007199254740991`),
  check("allowance_currency", sql`${t.currency} IN ('ILS','USD','JOD')`),
  check("allowance_frequency", sql`(${t.kind} = 'oneTime' AND ${t.frequency} IS NULL) OR (${t.kind} = 'recurring' AND ${t.frequency} IN ('weekly','biweekly','monthly'))`),
  check("allowance_status", sql`${t.status} IN ('active','paused','cancelled','completed')`),
  check("allowance_dates", sql`${t.nextPayment} >= ${t.startDate} AND (${t.endDate} IS NULL OR ${t.endDate} >= ${t.startDate})`),
]);
export const allowanceOccurrences = pgTable("allowance_occurrences", {
  id: uuid("id").primaryKey().defaultRandom(),
  allowanceId: uuid("allowance_id").notNull().references(() => allowances.id),
  scheduledDate: date("scheduled_date", { mode: "string" }).notNull(),
  amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull(),
  failure: text("failure"),
  transactionIds: jsonb("transaction_ids").$type<string[]>().notNull().default([]),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex("allowance_occurrence_unique").on(t.allowanceId, t.scheduledDate),
  check("allowance_occurrence_status", sql`${t.status} IN ('posted','failed','cancelled')`),
  check("allowance_occurrence_amount", sql`${t.amountMinor} BETWEEN 1 AND 9007199254740991`),
]);
export const insertFamilyLinkSchema = createInsertSchema(familyLinks);
export const insertAllowanceSchema = createInsertSchema(allowances);
export const insertAllowanceOccurrenceSchema = createInsertSchema(allowanceOccurrences);
export type FamilyLink = typeof familyLinks.$inferSelect;
export type Allowance = typeof allowances.$inferSelect;
export type AllowanceOccurrence = typeof allowanceOccurrences.$inferSelect;