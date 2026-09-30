import { safeMinor } from "./planning";

const DAY = 86400000n;
export const ceiling = (n: bigint, d: bigint) => (n + d - 1n) / d;
export function goalMetrics(target: bigint, current: bigint, status: string, targetDate: string | null,
  contributions: { amountMinor: bigint | null; createdAt: Date }[], now = new Date()) {
  const remaining = target - current;
  let required: bigint | null = null;
  if (status === "active" && targetDate) {
    const date = new Date(`${targetDate}T00:00:00Z`);
    const months = Math.max(1, (date.getUTCFullYear() - now.getUTCFullYear()) * 12 + date.getUTCMonth() - now.getUTCMonth() + 1);
    required = ceiling(remaining, BigInt(months));
  }
  let estimatedCompletion: string | null = null;
  const rows = [...contributions].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const first = rows[0], last = rows.at(-1);
  if (status === "active" && first && last) {
    if (remaining === 0n) estimatedCompletion = last.createdAt.toISOString().slice(0, 10);
    else if (first.createdAt.toISOString().slice(0, 10) !== last.createdAt.toISOString().slice(0, 10)) {
      const saved = rows.slice(1).reduce((n, row) => n + (row.amountMinor ?? 0n), 0n);
      const elapsed = BigInt(Math.max(1, now.getTime() - first.createdAt.getTime()));
      if (saved > 0n) {
        const days = ceiling(remaining * elapsed, saved * DAY);
        const timestamp = BigInt(now.getTime()) + days * DAY;
        // Stay within ISO calendar dates supported by the API; no invented fallback.
        if (timestamp <= 253402214400000n) estimatedCompletion = new Date(Number(timestamp)).toISOString().slice(0, 10);
      }
    }
  }
  return { remaining: safeMinor(remaining), required: required === null ? null : safeMinor(required),
    percentage: Number(current * 10000n / target) / 100, estimatedCompletion };
}