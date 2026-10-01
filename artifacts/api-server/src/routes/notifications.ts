import { Router, type IRouter, type Request } from "express";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, inAppNotifications } from "@workspace/db";
import * as V from "@workspace/api-zod";
import { requirePrincipal } from "../lib/authorization";
import { ApiError } from "../lib/http-errors";
import { notificationDto, visibleNotifications } from "../lib/notifications";

const router: IRouter = Router();
function principal(req: Request) {
  const p = requirePrincipal(req.res?.locals.principal);
  if (!p.roles.includes("student") && !p.roles.includes("parent")) throw new ApiError("FORBIDDEN");
  return { userId: p.userId, parent: p.roles.includes("parent") };
}
function emptyBody(req: Request) {
  if (req.body != null && (typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).length)) throw new ApiError("BAD_REQUEST");
}
router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
for (const countOnly of [false, true]) router.get(countOnly ? "/notifications/unread-count" : "/notifications", async (req, res) => {
  const p = principal(req);
  const result = await db.transaction(async tx => {
    const rows = await visibleNotifications(tx, p.userId, p.parent);
    const unreadCount = rows.filter(r => !r.readAt).length;
    return countOnly ? { unreadCount } : { unreadCount, items: rows.map(r => notificationDto(r, p.parent)) };
  });
  res.json(countOnly ? V.GetNotificationUnreadCountResponse.parse(result) : V.ListNotificationsResponse.parse(result));
});
router.post("/notifications/:id/read", async (req, res) => {
  const p = principal(req), id = req.params.id;
  emptyBody(req);
  if (typeof id !== "string" || !/^[\da-f]{8}-([\da-f]{4}-){3}[\da-f]{12}$/i.test(id)) throw new ApiError("BAD_REQUEST");
  const result = await db.transaction(async tx => {
    const rows = await visibleNotifications(tx, p.userId, p.parent);
    const row = rows.find(r => r.id === id);
    if (!row) throw new ApiError("NOT_FOUND");
    await tx.update(inAppNotifications).set({ readAt: new Date() }).where(and(eq(inAppNotifications.id, id),
      eq(inAppNotifications.recipientId, p.userId), isNull(inAppNotifications.readAt)));
    const [updated] = await tx.select().from(inAppNotifications).where(eq(inAppNotifications.id, id));
    return notificationDto(updated!, p.parent);
  });
  res.json(V.MarkNotificationReadResponse.parse(result));
});
router.post("/notifications/read-all", async (req, res) => {
  const p = principal(req); emptyBody(req);
  const result = await db.transaction(async tx => {
    const rows = await visibleNotifications(tx, p.userId, p.parent);
    const ids = rows.filter(r => !r.readAt).map(r => r.id);
    if (ids.length) await tx.update(inAppNotifications).set({ readAt: new Date() }).where(and(
      eq(inAppNotifications.recipientId, p.userId), inArray(inAppNotifications.id, ids), isNull(inAppNotifications.readAt),
    ));
    return { unreadCount: 0 };
  });
  res.json(V.MarkAllNotificationsReadResponse.parse(result));
});
export default router;