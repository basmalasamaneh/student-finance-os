import { bigint, boolean, check, date, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./onboarding";

export const planningBudgets = pgTable("planning_budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  period: text("period").notNull(),
  currency: text("currency").notNull(),
  limitMinor: bigint("limit_minor", { mode: "bigint" }).notNull(),
}, t => [
  uniqueIndex("planning_budget_owner_category_period_currency").on(t.userId, t.category, t.period, t.currency),
  check("planning_budget_limit_valid", sql`${t.limitMinor} >= 0 AND ${t.limitMinor} <= 9007199254740991`),
]);

export const planningRecurring = pgTable("planning_recurring", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  currency: text("currency").notNull(),
  amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
  frequency: text("frequency").notNull(),
  nextDate: date("next_date", { mode: "string" }).notNull(),
  description: text("description").notNull(),
  active: boolean("active").notNull(),
}, t => [index("planning_recurring_owner").on(t.userId), check("planning_recurring_amount_valid", sql`${t.amountMinor} >= 0 AND ${t.amountMinor} <= 9007199254740991`)]);

export const planningLines = pgTable("planning_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  type: text("type").notNull(),
  currency: text("currency").notNull(),
  amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
  description: text("description").notNull(),
  upcomingDate: date("upcoming_date", { mode: "string" }),
}, t => [index("planning_lines_owner").on(t.userId), check("planning_lines_amount_valid", sql`${t.amountMinor} >= 0 AND ${t.amountMinor} <= 9007199254740991`)]);

export const planningSettings = pgTable("planning_settings", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  commuteOverrideEnabled: boolean("commute_override_enabled").notNull().default(false),
  commuteOverrideMinor: bigint("commute_override_minor", { mode: "bigint" }),
  commuteOverrideCurrency: text("commute_override_currency"),
}, t => [check("planning_override_valid", sql`(${t.commuteOverrideEnabled} = false AND ${t.commuteOverrideMinor} IS NULL AND ${t.commuteOverrideCurrency} IS NULL) OR (${t.commuteOverrideEnabled} = true AND ${t.commuteOverrideMinor} BETWEEN 0 AND 9007199254740991 AND ${t.commuteOverrideCurrency} IN ('ILS', 'USD', 'JOD'))`)]);