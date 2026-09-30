import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  education: jsonb("education"),
  residence: jsonb("residence"),
  commute: jsonb("commute"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("users_email_unique").on(table.email)]);

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("sessions_user_idx").on(table.userId)]);

export const loginAttempts = pgTable("login_attempts", {
  key: text("key").primaryKey(),
  failures: integer("failures").notNull().default(0),
  blockedUntil: timestamp("blocked_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const incomes = pgTable("incomes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
}, (table) => [index("incomes_user_idx").on(table.userId)]);

export const scholarships = pgTable("scholarships", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
}, (table) => [index("scholarships_user_idx").on(table.userId)]);