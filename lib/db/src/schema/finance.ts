import { bigint, boolean, check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./onboarding";

export const financeAccounts = pgTable("finance_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  name: text("name").notNull(),
  currency: text("currency").notNull(),
  balanceMinor: bigint("balance_minor", { mode: "bigint" }).notNull().default(sql`0`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("finance_accounts_user_idx").on(t.userId), check("finance_accounts_balance_nonnegative", sql`${t.balanceMinor} >= 0 AND ${t.balanceMinor} <= 9007199254740991`)]);

export const financeTransactions = pgTable("finance_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  accountId: uuid("account_id").notNull().references(() => financeAccounts.id),
  kind: text("kind").notNull(),
  category: text("category").notNull(),
  direction: text("direction").notNull(),
  amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
  currency: text("currency").notNull(),
  balanceAfterMinor: bigint("balance_after_minor", { mode: "bigint" }).notNull(),
  status: text("status").notNull().default("simulated"),
  counterpartyAccountId: uuid("counterparty_account_id"),
  serviceId: uuid("service_id"),
  merchantName: text("merchant_name"),
  items: jsonb("items"),
  note: text("note"),
  // Optional, server-owned provenance. Existing ledger rows remain untouched.
  universityId: uuid("university_id"),
  campusId: uuid("campus_id"),
  universityName: text("university_name"),
  campusName: text("campus_name"),
  relatedGoalId: uuid("related_goal_id"),
  relatedBudgetId: uuid("related_budget_id"),
  parentTransferId: uuid("parent_transfer_id"),
  recurringExpenseId: uuid("recurring_expense_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("finance_tx_user_time_idx").on(t.userId, t.createdAt), check("finance_tx_positive", sql`${t.amountMinor} > 0`)]);

export const financeEvents = pgTable("finance_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  transactionId: uuid("transaction_id").notNull().references(() => financeTransactions.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
}, t => [index("finance_events_pending_idx").on(t.publishedAt, t.createdAt)]);

export const financeIdempotency = pgTable("finance_idempotency", {
  userId: uuid("user_id").notNull().references(() => users.id),
  key: text("key").notNull(),
  fingerprint: text("fingerprint").notNull(),
  response: jsonb("response").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("finance_idempotency_unique").on(t.userId, t.key)]);

export const moneyRequests = pgTable("money_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  issuerId: uuid("issuer_id").notNull().references(() => users.id),
  payerId: uuid("payer_id").notNull().references(() => users.id),
  recipientAccountId: uuid("recipient_account_id").notNull().references(() => financeAccounts.id),
  payerAccountId: uuid("payer_account_id").notNull().references(() => financeAccounts.id),
  amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
  currency: text("currency").notNull(),
  note: text("note"),
  status: text("status").notNull().default("pending"),
  transactionId: uuid("transaction_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("money_requests_issuer_idx").on(t.issuerId), index("money_requests_payer_idx").on(t.payerId)]);

export const universities = pgTable("campus_universities", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  arabicName: text("arabic_name").notNull(),
  demo: boolean("demo").notNull().default(false),
}, t => [uniqueIndex("campus_university_name_unique").on(t.name)]);
export const campuses = pgTable("campus_locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  universityId: uuid("university_id").notNull().references(() => universities.id),
  name: text("name").notNull(),
  arabicName: text("arabic_name").notNull(),
}, t => [uniqueIndex("campus_location_unique").on(t.universityId, t.name)]);
export const campusServices = pgTable("campus_services", {
  id: uuid("id").primaryKey().defaultRandom(),
  campusId: uuid("campus_id").notNull().references(() => campuses.id),
  name: text("name").notNull(),
  arabicName: text("arabic_name").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  location: text("location").notNull(),
  active: boolean("active").notNull(),
  paymentEnabled: boolean("payment_enabled").notNull(),
  integrationStatus: text("integration_status").notNull().default("simulated"),
});
export const campusProducts = pgTable("campus_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceId: uuid("service_id").notNull().references(() => campusServices.id),
  name: text("name").notNull(),
  arabicName: text("arabic_name").notNull(),
  priceMinor: bigint("price_minor", { mode: "bigint" }).notNull(),
  currency: text("currency").notNull(),
  active: boolean("active").notNull(),
}, t => [check("campus_product_price_nonnegative", sql`${t.priceMinor} >= 0 AND ${t.priceMinor} <= 9007199254740991`)]);