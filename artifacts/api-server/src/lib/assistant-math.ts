import type { AssistantFact, AssistantPeriod } from "@workspace/api-zod";
import type { AssistantPlan } from "./assistant-planner";
export type Language = "en" | "ar";
export const text = (language: Language, en: string, ar: string) => language === "ar" ? ar : en;
const DAY = 86_400_000;
export function validPeriod(from: string, to: string) {
  const valid = (s: string) => /^\d{4}-\d\d-\d\d$/.test(s) && !s.startsWith("0000") &&
    Number.isFinite(Date.parse(s + "T00:00:00Z")) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
  return valid(from) && valid(to) && from <= to && (Date.parse(to) - Date.parse(from)) / DAY < 366;
}
export function periods(plan: AssistantPlan, now: Date): { period: AssistantPeriod; comparisonPeriod: AssistantPeriod | null } | null {
  const today = now.toISOString().slice(0, 10);
  const future = ["forecast", "income", "upcoming"].includes(plan.intent);
  if (!!plan.from !== !!plan.to || !!plan.compareFrom !== !!plan.compareTo) return null;
  const period = { from: plan.from ?? (future ? today : today.slice(0, 8) + "01"),
    to: plan.to ?? (future ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10) : today) };
  if (!validPeriod(period.from, period.to) || (future ? period.from !== today : period.to > today)) return null;
  if ((plan.compareFrom || plan.compareTo) && plan.mode !== "compare") return null;
  if (plan.mode !== "compare") return { period, comparisonPeriod: null };
  if (!["spending", "categories", "summary"].includes(plan.intent)) return null;
  const duration = Date.parse(period.to) - Date.parse(period.from) + DAY;
  const comparisonPeriod = { from: plan.compareFrom ?? new Date(Date.parse(period.from) - duration).toISOString().slice(0, 10),
    to: plan.compareTo ?? new Date(Date.parse(period.from) - DAY).toISOString().slice(0, 10) };
  if (!validPeriod(comparisonPeriod.from, comparisonPeriod.to) || comparisonPeriod.to > today) return null;
  return { period, comparisonPeriod };
}
export function percentChange(current: bigint, previous: bigint): string | null {
  if (previous === 0n) return null;
  const delta = current - previous, negative = delta < 0n;
  const denominator = previous < 0n ? -previous : previous;
  const scaled = ((negative ? -delta : delta) * 10_000n + denominator / 2n) / denominator;
  return `${negative && scaled !== 0n ? "-" : ""}${scaled / 100n}.${String(scaled % 100n).padStart(2, "0")}`;
}
export type LedgerRow = {
  userId: string; accountId: string; category: string; direction: string; amountMinor: bigint;
  currency: string; serviceId: string | null; kind: string; goalFundingSource: string | null; createdAt: Date;
};
export type AccountRow = { id: string; userId: string; type: string; currency: string };
export function categoryLabel(category: string, language: Language): string {
  const labels: Record<string, [string, string]> = {
    food: ["Food", "الطعام"], cafeteria: ["Cafeteria", "الكافتيريا"], bookstore: ["Bookstore", "مكتبة الحرم"],
    books: ["Books", "الكتب"], transportation: ["Transportation", "المواصلات"],
    campus_transportation: ["Campus transportation", "مواصلات الحرم"], fees: ["Fees", "الرسوم"],
    university_fees: ["University fees", "الرسوم الجامعية"], printing: ["Printing", "الطباعة"],
    other: ["Other", "أخرى"], income: ["Income", "الدخل"], spending: ["Spending", "الإنفاق"],
    saved: ["Reserved savings", "المدخرات المحجوزة"], goal_monthly: ["Required monthly contribution", "المساهمة الشهرية المطلوبة"],
    opening: ["Available opening", "الرصيد المتاح الافتتاحي"], forecast: ["Projected balance", "الرصيد المتوقع"],
    savings: ["Planned savings", "الادخار المخطط"], net: ["Net cashflow", "صافي التدفق النقدي"],
    housing: ["Housing", "السكن"], rent: ["Rent", "الإيجار"], accommodation: ["Accommodation", "السكن"],
    utilities: ["Utilities", "المرافق"], internet: ["Internet", "الإنترنت"], subscriptions: ["Subscriptions", "الاشتراكات"],
    shopping: ["Shopping", "التسوق"], entertainment: ["Entertainment", "الترفيه"], health: ["Health", "الصحة"],
    personal: ["Personal", "شخصي"], social: ["Social", "الاجتماعيات"], tuition: ["Tuition", "الرسوم الدراسية"],
    registration: ["Registration", "التسجيل"], academic_supplies: ["Academic supplies", "اللوازم الأكاديمية"],
    school_supplies: ["School supplies", "اللوازم المدرسية"], school_activities: ["School activities", "الأنشطة المدرسية"],
    external_outflow: ["External outflow", "سحب خارجي"], other_campus: ["Other campus", "أخرى في الحرم"],
  };
  const entry = labels[category];
  return entry ? entry[language === "ar" ? 1 : 0] : text(language, "Other recorded category", "فئة مسجلة أخرى");
}
export function ledgerCategory(row: LedgerRow): string {
  if (row.serviceId && row.kind === "payment") {
    return ({ food: "cafeteria", books: "bookstore", transportation: "campus_transportation" } as Record<string, string>)[row.category] ?? row.category;
  }
  return row.category;
}
function matches(row: LedgerRow, category: AssistantPlan["category"]) {
  const c = ledgerCategory(row);
  return category === "all" || category === "food" && ["food", "cafeteria"].includes(c) ||
    category === "books" && ["books", "bookstore"].includes(c) ||
    category === "cafeteria" && c === "cafeteria" || category === "bookstore" && c === "bookstore" ||
    category === "transportation" && ["transportation", "campus_transportation"].includes(c);
}
export function ledgerFacts(owner: string, rows: LedgerRow[], accounts: AccountRow[], plan: AssistantPlan,
  period: AssistantPeriod, comparison: AssistantPeriod | null, language: Language): AssistantFact[] {
  const ownAccounts = new Set(accounts.filter(a => a.userId === owner && a.type !== "goal_reserve").map(a => a.id));
  const eligible = rows.filter(r => r.userId === owner && ownAccounts.has(r.accountId) &&
    r.category !== "transfer" && r.goalFundingSource !== "student_account");
  const currencies = new Set(accounts.filter(a => a.userId === owner && a.type !== "goal_reserve").map(a => a.currency));
  const aggregate = (range: AssistantPeriod) => {
    const result = new Map<string, bigint>();
    for (const currency of currencies) {
      if (plan.intent === "summary") for (const key of ["income", "spending", "net"]) result.set(`${currency}:${key}`, 0n);
      else if (plan.intent === "spending") result.set(`${currency}:${plan.category === "all" ? "spending" : plan.category}`, 0n);
    }
    const add = (key: string, n: bigint) => result.set(key, (result.get(key) ?? 0n) + n);
    for (const row of eligible) {
      const day = row.createdAt.toISOString().slice(0, 10);
      if (day < range.from || day > range.to) continue;
      if (plan.intent === "summary") {
        add(`${row.currency}:${row.direction === "credit" ? "income" : "spending"}`, row.amountMinor);
        add(`${row.currency}:net`, row.direction === "credit" ? row.amountMinor : -row.amountMinor);
      } else if (row.direction === "debit" && matches(row, plan.category)) {
        add(`${row.currency}:${plan.intent === "categories" ? ledgerCategory(row) : plan.category === "all" ? "spending" : plan.category}`, row.amountMinor);
      }
    }
    return result;
  };
  const current = aggregate(period), previous = comparison ? aggregate(comparison) : null;
  const facts: AssistantFact[] = [...new Set([...current.keys(), ...(previous?.keys() ?? [])])].map(key => {
    const [currency, category] = key.split(":") as [AssistantFact["currency"], string];
    const value = current.get(key) ?? 0n, before = previous?.get(key) ?? 0n;
    return { key, label: categoryLabel(category, language), category, minor: String(value), currency,
      basis: "actual", provenance: "ledger", policy: "recorded_cashflow_excludes_transfers_and_goal_reserves",
      ...(previous ? { previousMinor: String(before), deltaMinor: String(value - before), changePercent: percentChange(value, before) } : {}) };
  });
  facts.sort((a, b) => a.currency.localeCompare(b.currency) ||
    (BigInt(a.minor) === BigInt(b.minor) ? a.key.localeCompare(b.key) : BigInt(a.minor) > BigInt(b.minor) ? -1 : 1));
  if (plan.intent === "categories") {
    const ranks = new Map<string, number>();
    for (const fact of facts) { fact.rank = (ranks.get(fact.currency) ?? 0) + 1; ranks.set(fact.currency, fact.rank); }
  }
  return facts;
}