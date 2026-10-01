import { and, eq, gte, lt, or, sql } from "drizzle-orm";
import { db, financeAccounts, financeTransactions } from "@workspace/db";
import { QueryAssistantBody, QueryAssistantResponse, type AssistantAnswer, type AssistantFact, type AssistantQuery } from "@workspace/api-zod";
import { requireRole, type TrustedPrincipal } from "./authorization";
import { ApiError } from "./http-errors";
import { forecastSnapshot } from "./forecast";
import { ownerGoals } from "./goals";
import { PlanSchema, planAssistant, type AssistantPlan, AssistantUnavailable } from "./assistant-planner";
import { categoryLabel, ledgerFacts, periods, text } from "./assistant-math";

export function assistantInput(body: unknown): AssistantQuery {
  const parsed = QueryAssistantBody.safeParse(body);
  if (!parsed.success || !body || typeof body !== "object" ||
    Object.keys(body).some(k => !["question", "language", "lastQuestion", "goalId"].includes(k)) ||
    !parsed.data.question.trim() || parsed.data.lastQuestion !== undefined && !parsed.data.lastQuestion.trim()) throw new ApiError("BAD_REQUEST");
  return { ...parsed.data, question: parsed.data.question.trim(),
    ...(parsed.data.lastQuestion ? { lastQuestion: parsed.data.lastQuestion.trim() } : {}) };
}
// All buckets expire; full maps reject rather than evicting live buckets and defeating limits.
export class AssistantLimiter {
  private buckets = new Map<string, { start: number; count: number; active: boolean }>();
  private active = 0;
  acquire(owner: string, now = Date.now()): () => void {
    for (const [key, row] of this.buckets) if (!row.active && now - row.start >= 60_000) this.buckets.delete(key);
    const row = this.buckets.get(owner) ?? { start: now, count: 0, active: false };
    if (row.active || row.count >= 8 || this.active >= 32 || !this.buckets.has(owner) && this.buckets.size >= 2048) throw new ApiError("RATE_LIMITED");
    row.count++; row.active = true; this.active++; this.buckets.set(owner, row);
    let released = false;
    return () => { if (!released) { released = true; row.active = false; this.active--; } };
  }
}
const limiter = new AssistantLimiter();
type Reader = Pick<typeof db, "select">;
const adapters = { goals: ownerGoals, forecast: forecastSnapshot };
export async function executeAssistant(reader: Reader, owner: string, input: AssistantQuery, rawPlan: AssistantPlan, now: Date,
  source = adapters): Promise<AssistantAnswer> {
  const plan = PlanSchema.parse(rawPlan);
  const language = input.language, t = (en: string, ar: string) => text(language, en, ar);
  const answer: AssistantAnswer = {
    status: "answered", language, intent: plan.intent, message: "", asOf: now.toISOString(),
    period: null, comparisonPeriod: null, facts: [], goalChoices: [], simulated: true,
    links: [{ href: "/transactions", label: t("Transaction history", "سجل المعاملات") }],
    policy: t("Read-only. Recorded app data is simulated, not real-bank money. Currencies are separate; no FX. Transfers and student goal reserves are not spending.",
      "للقراءة فقط. بيانات التطبيق المسجلة محاكاة وليست أموالاً مصرفية حقيقية. العملات منفصلة دون تحويل. التحويلات وحجز أموال الطالب للأهداف ليست إنفاقاً."),
    warnings: [],
  };
  const clarify = (en: string, ar: string) => {
    answer.status = "clarify"; answer.message = t(en, ar); return answer;
  };
  if (input.goalId && plan.intent !== "goal_monthly") return clarify(
    "Goal selection only applies to a monthly goal question. Remove the goal selection for another question.",
    "اختيار الهدف ينطبق فقط على سؤال المتطلب الشهري للهدف. أزل اختيار الهدف عند طرح سؤال آخر.");
  if (plan.intent === "unsupported" || ["investment", "product", "high_risk", "guarantee"].includes(plan.reason)) {
    answer.status = "refused";
    answer.message = t("I can explain your recorded finances and estimates, but cannot recommend investments or financial products, provide high-risk advice, promise outcomes, access others' data, or move money.",
      "يمكنني شرح بياناتك المالية المسجلة وتقديراتك، لكن لا يمكنني التوصية باستثمارات أو منتجات مالية أو تقديم نصائح عالية المخاطر أو ضمان نتائج أو الوصول لبيانات الآخرين أو نقل الأموال.");
    return answer;
  }
  if (plan.qualifierStatus !== "none" ||
    plan.category !== "all" && plan.intent !== "spending" ||
    plan.mode === "estimate" && !["forecast", "upcoming", "income", "goal_monthly"].includes(plan.intent) ||
    plan.mode === "pattern" && !["spending", "categories", "summary"].includes(plan.intent)) return clarify(
      "I cannot apply every requested filter or scope. Ask one supported question without account, merchant, currency, location or exclusion filters. Only recorded spending supports a category filter.",
      "لا يمكنني تطبيق كل المرشحات أو النطاق المطلوب. اطرح سؤالاً مدعوماً واحداً دون تحديد حساب أو تاجر أو عملة أو موقع أو استثناءات. يدعم الإنفاق المسجل وحده مرشح الفئة.");
  if (plan.intent === "clarify" || plan.reason !== "none") return clarify(
    "Please specify one supported question and a clear period (up to 366 days). I will not invent missing information.",
    "يرجى تحديد سؤال واحد مدعوم وفترة واضحة (حتى ٣٦٦ يوماً). لن أختلق معلومات مفقودة.");
  if (plan.intent === "saved" || plan.intent === "goal_monthly") {
    if (plan.from || plan.to || plan.compareFrom || plan.compareTo || plan.mode === "compare") return clarify(
      "Savings and goal requirements are current snapshots, not historical comparisons. Ask about your current goal.",
      "المدخرات ومتطلبات الأهداف لقطة حالية وليست مقارنة تاريخية. اسأل عن هدفك الحالي.");
    const goals = await source.goals(owner, reader);
    answer.links = [{ href: "/goals", label: t("Savings goals", "أهداف الادخار") }];
    answer.policy += t(" Saved means all reserved goal funds, including archived goals; not cumulative deposits or income minus spending. Reserves cannot be spent.",
      " المدخرات تعني جميع الأموال المحجوزة للأهداف بما فيها المؤرشفة، وليست مجموع الإيداعات أو الدخل ناقص الإنفاق. الأموال المحجوزة غير متاحة للإنفاق.");
    if (plan.intent === "saved") {
      answer.facts = goals.totals.map(g => ({ key: `saved:${g.currency}`, label: categoryLabel("saved", language),
        minor: String(g.reserved.minor), currency: g.currency as AssistantFact["currency"], basis: "actual", provenance: "goals", policy: "all_goal_reserves_including_archived" }));
      answer.message = t("These are your currently reserved savings by currency.", "هذه مدخراتك المحجوزة حالياً حسب العملة.");
      if (!answer.facts.length) answer.warnings.push(t("No recorded goal reserves are available.", "لا توجد أموال محجوزة للأهداف في السجل."));
    } else {
      const candidates = goals.goals.filter(g => g.status === "active");
      const selected = input.goalId ? candidates.find(g => g.id === input.goalId) : candidates.length === 1 ? candidates[0] : undefined;
      if (!selected) {
        answer.goalChoices = candidates.map(g => ({ id: g.id, name: g.name }));
        return clarify(candidates.length ? "Choose one active goal to calculate its monthly requirement." : "No active goal is available. Create a goal with a target date first.",
          candidates.length ? "اختر هدفاً نشطاً واحداً لحساب متطلبه الشهري." : "لا يوجد هدف نشط. أنشئ هدفاً بتاريخ مستهدف أولاً.");
      }
      if (!selected.requiredContributionMonthly) return clarify("This goal needs a target date before its monthly requirement can be calculated.",
        "يحتاج هذا الهدف إلى تاريخ مستهدف قبل حساب المتطلب الشهري.");
      answer.facts = [{ key: "goal_monthly", label: categoryLabel("goal_monthly", language),
        minor: String(selected.requiredContributionMonthly.minor), currency: selected.currency as AssistantFact["currency"],
        basis: "estimated", provenance: "goals", policy: "existing_goal_required_monthly_ceiling" }];
      answer.message = t("Monthly requirement for your selected goal, using its remaining amount and target date. This is a plan, not a guarantee.",
        "المتطلب الشهري لهدفك المحدد باستخدام المبلغ المتبقي والتاريخ المستهدف. هذه خطة وليست ضماناً.");
    }
    return answer;
  }
  const bounds = periods(plan, now);
  if (!bounds) return clarify("Use an inclusive period of at most 366 days. Actuals cannot include future days; forecasts must start today. Comparison is supported for recorded spending and cashflow only.",
    "استخدم فترة شاملة لا تتجاوز ٣٦٦ يوماً. لا تشمل القيم الفعلية أياماً مستقبلية، ويجب أن تبدأ التوقعات اليوم. المقارنة مدعومة للإنفاق والتدفقات المسجلة فقط.");
  answer.period = bounds.period; answer.comparisonPeriod = bounds.comparisonPeriod;
  if (["spending", "categories", "summary"].includes(plan.intent)) {
    const accounts = await reader.select().from(financeAccounts).where(eq(financeAccounts.userId, owner));
    const inPeriod = (range: { from: string; to: string }) => and(
      gte(financeTransactions.createdAt, new Date(range.from + "T00:00:00Z")),
      lt(financeTransactions.createdAt, new Date(Date.parse(range.to + "T00:00:00Z") + 86_400_000)));
    // Full selected owner ledger, no pagination or latest-N truncation; account names/notes are not selected.
    const rows = await reader.select({
      userId: financeTransactions.userId, accountId: financeTransactions.accountId, category: financeTransactions.category,
      direction: financeTransactions.direction, amountMinor: financeTransactions.amountMinor, currency: financeTransactions.currency,
      serviceId: financeTransactions.serviceId, kind: financeTransactions.kind, goalFundingSource: financeTransactions.goalFundingSource,
      createdAt: financeTransactions.createdAt,
    }).from(financeTransactions).where(and(eq(financeTransactions.userId, owner),
      bounds.comparisonPeriod ? or(inPeriod(bounds.period), inPeriod(bounds.comparisonPeriod)) : inPeriod(bounds.period)));
    answer.facts = ledgerFacts(owner, rows, accounts, plan, bounds.period, bounds.comparisonPeriod, language);
    answer.message = plan.mode === "compare"
      ? t("Recorded totals compared with the stated previous period. Positive change means a larger total, not necessarily improvement.",
        "مقارنة الإجماليات المسجلة بالفترة السابقة المحددة. التغير الموجب يعني زيادة القيمة وليس بالضرورة تحسناً.")
      : t("Here are your recorded totals for the stated period, separated by currency.", "هذه إجمالياتك المسجلة للفترة المحددة، مفصولة حسب العملة.");
    if (plan.intent === "categories") answer.message = t("Spending categories ranked largest first within each currency. Campus food and bookstore remain distinct categories.",
      "فئات الإنفاق مرتبة من الأكبر داخل كل عملة. تبقى الكافتيريا ومكتبة الحرم فئتين منفصلتين.");
    if (plan.intent === "spending" && ["food", "cafeteria", "books", "bookstore", "transportation"].includes(plan.category)) {
      const definitions: Record<string, [string, string]> = {
        food: ["Food includes general food and campus cafeteria payments.", "يشمل الطعام الإنفاق العام على الطعام ومدفوعات كافتيريا الحرم."],
        cafeteria: ["Cafeteria is the campus food subset, not all food spending.", "الكافتيريا جزء الطعام داخل الحرم وليست جميع نفقات الطعام."],
        books: ["Books includes general books purchases and campus bookstore payments.", "تشمل الكتب مشتريات الكتب العامة ومدفوعات مكتبة الحرم."],
        bookstore: ["Bookstore is campus bookstore payments, not every books purchase.", "مكتبة الحرم تشمل مدفوعات مكتبة الحرم وليست جميع مشتريات الكتب."],
        transportation: ["Transportation includes general and campus transportation.", "تشمل المواصلات النقل العام ونقل الحرم."],
      };
      const definition = definitions[plan.category]!;
      answer.warnings.push(t(definition[0], definition[1]));
    }
    if (["explain", "pattern"].includes(plan.mode)) answer.warnings.push(t(
      "Rankings show where recorded spending is concentrated, not why it happened or what will happen next. Ask to compare periods for a measured trend.",
      "يوضح الترتيب أين يتركز الإنفاق المسجل، وليس سبب حدوثه أو ما سيحدث مستقبلاً. اطلب مقارنة فترات لقياس الاتجاه."));
    if (!rows.length) answer.warnings.push(t("No recorded transactions in this period; zero is a recorded total, not evidence about unrecorded spending.",
      "لا توجد معاملات مسجلة في هذه الفترة؛ الصفر إجمالي السجل وليس دليلاً على إنفاق غير مسجل."));
    if (bounds.comparisonPeriod && Date.parse(bounds.period.to) - Date.parse(bounds.period.from) !==
      Date.parse(bounds.comparisonPeriod.to) - Date.parse(bounds.comparisonPeriod.from)) answer.warnings.push(t(
        "These periods have different lengths; totals are not normalized per day.", "الفترتان مختلفتان في الطول؛ لم تُحوّل الإجماليات إلى متوسط يومي."));
    return answer;
  }
  const forecast = await source.forecast(reader, owner, bounds.period.from, bounds.period.to);
  answer.links = [{ href: "/plan", label: t("Financial plan", "الخطة المالية") },
    { href: "/upcoming", label: t("Upcoming payments", "المدفوعات القادمة") }];
  answer.policy += t(" Forecast uses the existing reconciled planning policy; envelopes replace overlapping recurring/profile costs. Monthly allocations have no invented due date. Savings use max(manual envelope, goal requirements).",
    " تستخدم التوقعات سياسة التخطيط الحالية؛ تحل المخصصات محل المصروفات الدورية وتكاليف الملف المتداخلة. ليس للتوزيعات الشهرية تاريخ استحقاق مختلق. الادخار هو الأكبر بين المخصص اليدوي ومتطلبات الأهداف.");
  answer.warnings = language === "en" ? forecast.assumptions : [
    "الدخل العادي المتوقع اليوم غير مرتبط بإيداعات السجل؛ ربما يكون ضمن الرصيد الافتتاحي وقد يُحسب مرتين. راجع التوقع الأصلي.",
    "الفترة شاملة بتوقيت UTC وحتى ٣٦٦ يوماً. المصروف الأبوي المودع ضمن الرصيد الافتتاحي ولا يُحسب دخلاً مستقبلياً.",
    "تُضبط التكرارات إلى نهاية الشهر دون تغيير مرساة التكرار. الدخل المؤرخ لمرة واحدة لا يتكرر؛ بيانات المنح ليست دخلاً.",
    "تحل المخصصات اليدوية محل المصروفات الدورية والملف في الفئة والعملة نفسيهما. المؤشرات اليدوية المؤرخة مشمولة بالمخصص وليست دفعة إضافية.",
    "تظل تكاليف السكن والتنقل ومتطلبات الأهداف الحالية ثابتة في المستقبل. الادخار هو الأكبر من اليدوي والأهداف دون حجز تلقائي.",
    "التوزيع الشهري بالأجزاء الصحيحة الدقيقة حسب أيام الشهر، دون اختلاق تواريخ فواتير أو ضمان الأموال.",
    "يُضاف فقط المتبقي من توقع المصروف الأبوي بعد تغطية الجداول المعتمدة والمبالغ المودعة؛ لا جمع مزدوج للمخصصات.",
    "العناصر المكتملة والملغاة لا تؤثر في التوقعات. المصروف غير المودع تقدير غير مؤكد وليس وعداً بالدفع. المتأخرات السابقة لا تُرحّل.",
  ];
  const add = (key: string, minor: number | bigint, currency: AssistantFact["currency"], policy: string,
    extra: Partial<AssistantFact> = {}) => answer.facts.push({ key, label: categoryLabel(key, language), minor: String(minor), currency,
      basis: "estimated", provenance: "forecast", policy, ...extra });
  for (const c of forecast.currencies) {
    if (plan.intent === "forecast") {
      add("opening", c.availableOpening.minor, c.currency, "available_excludes_goal_reserves", { basis: "actual" });
      add("forecast", c.projectedBalance.minor, c.currency, "existing_forecast_equation");
      add("savings", c.plannedSavings.minor, c.currency, "max_manual_goal_requirements");
    }
    if (plan.intent !== "upcoming") add("income", c.expectedIncome.minor, c.currency, "reconciled_expected_income");
    if (plan.intent !== "income") add("spending", BigInt(c.upcomingExpenses.minor) + BigInt(c.recurringExpenses.minor),
      c.currency, "upcoming_plus_recurring_and_monthly_allocations");
  }
  if (plan.intent !== "forecast") {
    const kind = plan.intent === "income" ? "income" : "expense";
    for (const occurrence of forecast.occurrences.filter(o => o.kind === kind && o.status === "planned" && o.includedInForecast)) {
      add(`occurrence:${occurrence.id}`, occurrence.amount.minor, occurrence.amount.currency, occurrence.policy,
        { label: categoryLabel(occurrence.category, language), date: occurrence.date, category: occurrence.category });
    }
    for (const allocation of forecast.monthlyAllocations.filter(a => a.kind === kind)) {
      add(`allocation:${allocation.id}`, allocation.allocatedAmount.minor, allocation.allocatedAmount.currency, allocation.policy,
        { label: t("Undated monthly allocation", "توزيع شهري دون تاريخ استحقاق"), category: allocation.category });
    }
    answer.warnings.push(t("Summary totals already include the dated items and undated allocations below; do not add them together again.",
      "تشمل الإجماليات العناصر المؤرخة والتوزيعات غير المؤرخة أدناه؛ لا تجمعها مرة أخرى."));
  }
  answer.message = t("Estimated / projected, using your existing plan. Expected payments and income are not posted transactions or guaranteed outcomes.",
    "تقديري / متوقع باستخدام خطتك الحالية. المدفوعات والدخل المتوقعان ليسا معاملات مودعة أو نتائج مضمونة.");
  return answer;
}

export async function queryAssistant(principal: TrustedPrincipal | undefined, body: unknown,
  dependencies: { planner?: typeof planAssistant; now?: Date } = {}): Promise<AssistantAnswer> {
  const owner = requireRole(principal, "student").userId;
  const input = assistantInput(body);
  const release = limiter.acquire(owner);
  try {
    const now = dependencies.now ?? new Date();
    const plan = await (dependencies.planner ?? planAssistant)(input, now);
    const answer = await db.transaction(async tx => {
      await tx.execute(sql`set local statement_timeout = '10000'`);
      return executeAssistant(tx, owner, input, plan, now);
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
    const validated = QueryAssistantResponse.safeParse(answer);
    if (!validated.success) throw new AssistantUnavailable();
    return validated.data;
  } finally { release(); }
}