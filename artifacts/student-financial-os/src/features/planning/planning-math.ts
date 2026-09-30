/** Pure exact helpers (no floats). Kept dependency-free so node --test can run them directly. */
export const minorDigits = (currency: string) => (currency === 'JOD' ? 3 : 2);

/** Integer minor units → editable decimal string, e.g. 1250 ILS → "12.50". */
export function minorToInput(minor: number, currency: string): string {
  const d = minorDigits(currency);
  const neg = minor < 0;
  const s = BigInt(Math.abs(minor)).toString().padStart(d + 1, '0');
  return `${neg ? '-' : ''}${s.slice(0, -d)}.${s.slice(-d)}`;
}

/** Share of limit used, clamped 0..100, integer percent via BigInt. Zero limit with spend → 100. */
export function barPercent(actual: number, limit: number): number {
  if (limit <= 0) return actual > 0 ? 100 : 0;
  const p = (BigInt(actual) * 100n) / BigInt(limit);
  return Number(p > 100n ? 100n : p);
}
