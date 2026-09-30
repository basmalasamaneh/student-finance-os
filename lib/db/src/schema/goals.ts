import { bigint, check, date, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { users } from "./onboarding";
import { financeAccounts } from "./finance";

export const savingsGoals = pgTable("savings_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  reserveAccountId: uuid("reserve_account_id").notNull().references(() => financeAccounts.id),
  name: text("name").notNull(),
  targetMinor: bigint("target_minor", { mode: "bigint" }).notNull(),
  currency: text("currency").notNull(),
  targetDate: date("target_date", { mode: "string" }),
  category: text("category").notNull(),
  priority: text("priority").notNull(),
  notes: text("notes").notNull().default(""),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("savings_goals_owner_idx").on(t.userId),
  uniqueIndex("savings_goal_reserve_unique").on(t.reserveAccountId),
  check("savings_goal_target_positive", sql`${t.targetMinor} > 0 AND ${t.targetMinor} <= 9007199254740991`),
  check("savings_goal_status_valid", sql`${t.status} in ('active','paused','completed','archived')`),
]);
export const goalHistory = pgTable("goal_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  goalId: uuid("goal_id").notNull().references(() => savingsGoals.id),
  actorId: uuid("actor_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  source: text("source"),
  amountMinor: bigint("amount_minor", { mode: "bigint" }),
  currency: text("currency"),
  transactionIds: jsonb("transaction_ids").$type<string[]>().notNull().default([]),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("goal_history_goal_time_idx").on(t.goalId, t.createdAt)]);
export const goalInvitations = pgTable("goal_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  goalId: uuid("goal_id").notNull().references(() => savingsGoals.id),
  tokenHash: text("token_hash").notNull(),
  parentId: uuid("parent_id").references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex("goal_invitation_hash_unique").on(t.tokenHash),
  index("goal_invitation_goal_idx").on(t.goalId),
  index("goal_invitation_parent_idx").on(t.parentId),
]);
export const insertSavingsGoalSchema = createInsertSchema(savingsGoals).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGoalHistorySchema = createInsertSchema(goalHistory).omit({ id: true, createdAt: true });
export const insertGoalInvitationSchema = createInsertSchema(goalInvitations).omit({ id: true, createdAt: true });
export type SavingsGoalRow = typeof savingsGoals.$inferSelect;
export type GoalHistoryRow = typeof goalHistory.$inferSelect;
export type GoalInvitationRow = typeof goalInvitations.$inferSelect;