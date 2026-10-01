import { and, asc, eq, isNull, lte } from "drizzle-orm";
import { db, allowances, familyLinks } from "@workspace/db";
import { lockedAllowance, processOccurrence, todayUtc } from "./allowances";
import { logger } from "./logger";

// Optional owner scope supports isolated maintenance/tests without touching other users.
// The lifecycle worker always omits it; it is not exposed through any HTTP endpoint.
export async function processDueAllowances(today = todayUtc(), limit = 50, studentId?: string) {
  const due = await db.select().from(allowances).where(and(eq(allowances.status, "active"),
    isNull(allowances.lastFailure), lte(allowances.nextPayment, today), lte(allowances.startDate, today),
    studentId ? eq(allowances.studentId, studentId) : undefined))
    .orderBy(asc(allowances.nextPayment), asc(allowances.id)).limit(Math.min(50, Math.max(1, limit)));
  let processed = 0;
  for (const candidate of due) {
    try {
      await db.transaction(async tx => {
        const [link] = await tx.select().from(familyLinks).where(eq(familyLinks.id, candidate.familyLinkId)).for("update");
        if (!link || link.status !== "accepted" || !link.permissions.allowance) return;
        const row = await lockedAllowance(tx, candidate.id, link);
        if (row.lastFailure) return;
        await processOccurrence(tx, link, row, today);
        processed++;
      });
    } catch (err) {
      logger.error({ err, allowanceId: candidate.id }, "Allowance occurrence processing failed; schedule retained");
    }
  }
  return processed;
}
export function startAllowanceWorker() {
  let active = false, stopped = false;
  const run = async () => {
    if (active || stopped) return;
    active = true;
    try { await processDueAllowances(); }
    catch (err) { logger.error({ err }, "Allowance worker failed; retrying next interval"); }
    finally { active = false; }
  };
  const timer = setInterval(() => void run(), 30_000);
  timer.unref();
  void run();
  return () => { stopped = true; clearInterval(timer); };
}