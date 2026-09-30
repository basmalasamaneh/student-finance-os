/**
 * Pure transaction-history filter model (no React / no aliases) so it runs under node --test.
 * URL <-> form state <-> GetFinanceHistoryParams. Money bounds are parsed with string/BigInt
 * arithmetic only — never floating point.
 */
export type HistoryCurrency = 'ILS' | 'USD' | 'JOD';
export const HISTORY_CURRENCIES: readonly HistoryCurrency[] = ['ILS', 'USD', 'JOD'];
export const SEMANTIC_TYPES = ['income', 'expense', 'transfer', 'allowance', 'refund', 'savings', 'withdrawal', 'deposit', 'payment', 'campus_payment'] as const;
export type SemanticType = (typeof SEMANTIC_TYPES)[number];

export interface HistoryFilters {
  search: string;
  category: string;
  type: string;
  dateFrom: string;
  dateTo: string;
  amountMin: string; // decimal text as typed, e.g. "12.50"
  amountMax: string;
  amountCurrency: HistoryCurrency;
  accountId: string;
  parentTransferId: string;
  campusId: string;
  universityId: string;
  goalId: string;
  page: number;
}

export const EMPTY_FILTERS: HistoryFilters = {
  search: '', category: '', type: '', dateFrom: '', dateTo: '', amountMin: '', amountMax: '', amountCurrency: 'ILS',
  accountId: '', parentTransferId: '', campusId: '', universityId: '', goalId: '', page: 1,
};

export const PAGE_SIZE = 20;
const DECIMALS: Record<HistoryCurrency, number> = { ILS: 2, USD: 2, JOD: 3 };
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ARABIC_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/g;

export type AmountParse = { ok: true; minor: number | undefined } | { ok: false; reason: 'format' | 'precision' | 'range' };

/** "12.5" ILS -> 1250. Empty -> undefined. Zero allowed (a lower bound of 0 is valid). */
export function parseBound(raw: string, currency: HistoryCurrency): AmountParse {
  const s = raw.replace(ARABIC_DIGITS, (d) => String((d.charCodeAt(0) & 0xf) % 10)).replace(/\u066B/g, '.').replace(/[\s,\u066C]/g, '').trim();
  if (!s) return { ok: true, minor: undefined };
  const m = /^(\d+)(?:\.(\d*))?$/.exec(s);
  if (!m) return { ok: false, reason: 'format' };
  const dec = DECIMALS[currency];
  const frac = (m[2] ?? '').replace(/0+$/, '');
  if (frac.length > dec) return { ok: false, reason: 'precision' };
  const minor = BigInt(m[1]) * 10n ** BigInt(dec) + BigInt((frac || '0').padEnd(dec, '0'));
  if (minor > MAX_SAFE) return { ok: false, reason: 'range' };
  return { ok: true, minor: Number(minor) };
}

export function isValidDay(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
export const isUuid = (s: string) => UUID.test(s);

export type FilterError = 'amountMin' | 'amountMax' | 'amountOrder' | 'dateFrom' | 'dateTo' | 'dateOrder' | 'parentTransferId' | 'goalId' | 'campusId' | 'universityId' | 'accountId' | 'type' | 'search';
export interface Built { params: Record<string, string | number>; errors: FilterError[]; amountReasons: Partial<Record<'amountMin' | 'amountMax', string>> }

/** Build API params. Any error → caller must NOT query (server would 400 anyway). */
export function buildParams(f: HistoryFilters): Built {
  const params: Record<string, string | number> = {};
  const errors: FilterError[] = [];
  const amountReasons: Built['amountReasons'] = {};
  const search = f.search.trim();
  if (search) { if (search.length > 120) errors.push('search'); else params.search = search; }
  if (f.category) params.category = f.category;
  if (f.type) { if ((SEMANTIC_TYPES as readonly string[]).includes(f.type)) params.type = f.type; else errors.push('type'); }
  if (f.dateFrom) { if (isValidDay(f.dateFrom)) params.dateFrom = f.dateFrom; else errors.push('dateFrom'); }
  if (f.dateTo) { if (isValidDay(f.dateTo)) params.dateTo = f.dateTo; else errors.push('dateTo'); }
  if (params.dateFrom && params.dateTo && String(params.dateFrom) > String(params.dateTo)) errors.push('dateOrder');
  const min = parseBound(f.amountMin, f.amountCurrency);
  const max = parseBound(f.amountMax, f.amountCurrency);
  if (!min.ok) { errors.push('amountMin'); amountReasons.amountMin = min.reason; }
  if (!max.ok) { errors.push('amountMax'); amountReasons.amountMax = max.reason; }
  if (min.ok && min.minor !== undefined) params.amountMin = min.minor;
  if (max.ok && max.minor !== undefined) params.amountMax = max.minor;
  if (params.amountMin !== undefined && params.amountMax !== undefined && Number(params.amountMin) > Number(params.amountMax)) errors.push('amountOrder');
  if (params.amountMin !== undefined || params.amountMax !== undefined) params.amountCurrency = f.amountCurrency;
  for (const k of ['accountId', 'parentTransferId', 'campusId', 'universityId', 'goalId'] as const) {
    const v = f[k].trim();
    if (v) { if (isUuid(v)) params[k] = v.toLowerCase(); else errors.push(k); }
  }
  params.page = Math.max(1, Math.floor(f.page) || 1);
  params.limit = PAGE_SIZE;
  return { params, errors, amountReasons };
}

const KEYS = ['search', 'category', 'type', 'dateFrom', 'dateTo', 'amountMin', 'amountMax', 'accountId', 'parentTransferId', 'campusId', 'universityId', 'goalId'] as const;

export function filtersFromSearch(search: string): HistoryFilters {
  const q = new URLSearchParams(search);
  const f: HistoryFilters = { ...EMPTY_FILTERS };
  for (const k of KEYS) f[k] = (q.get(k) ?? '').slice(0, 200);
  const cur = q.get('currency');
  if (cur && (HISTORY_CURRENCIES as readonly string[]).includes(cur)) f.amountCurrency = cur as HistoryCurrency;
  const p = Number(q.get('page'));
  f.page = Number.isInteger(p) && p >= 1 && p <= 100000 ? p : 1;
  return f;
}

export function filtersToSearch(f: HistoryFilters): string {
  const q = new URLSearchParams();
  for (const k of KEYS) if (f[k]) q.set(k, f[k]);
  if ((f.amountMin || f.amountMax) && f.amountCurrency !== 'ILS') q.set('currency', f.amountCurrency);
  if (f.page > 1) q.set('page', String(f.page));
  return q.toString();
}

/** Count of active non-search, non-page filters (for the Filters button badge). */
export function activeFilterCount(f: HistoryFilters): number {
  return (['category', 'type', 'accountId', 'parentTransferId', 'campusId', 'universityId', 'goalId'] as const).filter((k) => !!f[k]).length
    + (f.dateFrom || f.dateTo ? 1 : 0) + (f.amountMin || f.amountMax ? 1 : 0);
}

export const pageCount = (total: number, limit: number) => Math.max(1, Math.ceil(total / Math.max(1, limit)));
