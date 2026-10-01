import { bigint, check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { users } from "./onboarding";

// Immutable domain references, not a copy of the ledger outbox or arbitrary payload.
// Scope IDs intentionally have no FK: retained inbox history cannot prevent domain cleanup.
export const inAppNotifications = pgTable("in_app_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipientId: uuid("recipient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  sourceId: uuid("source_id").notNull(),
  familyLinkId: uuid("family_link_id"),
  goalId: uuid("goal_id"),
  goalInvitationId: uuid("goal_invitation_id"),
  targetId: uuid("target_id"),
  amountMinor: bigint("amount_minor", { mode: "bigint" }),
  currency: text("currency"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true }),
}, t => [
  uniqueIndex("notification_domain_dedupe").on(t.recipientId, t.type, t.sourceId),
  index("notification_owner_time_idx").on(t.recipientId, t.createdAt),
  check("notification_supported_type", sql`${t.type} IN ('request','approval','decline','ask_details','reply','allowance_posted','goal_funded','permission_changed')`),
]);
export const insertInAppNotificationSchema = createInsertSchema(inAppNotifications);
export type InAppNotificationRow = typeof inAppNotifications.$inferSelect;