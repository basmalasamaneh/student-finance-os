import { useMemo, useState } from 'react';
import { getGetProfileQueryKey, useGetProfile } from '@workspace/api-client-react';
import { PullToRefresh } from '@/components/gestures/pull-to-refresh';
import { RetryButton, SkeletonRows, StatePanel } from '@/components/states/state-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { inputClass } from '@/components/money/fields';
import { BookOpen, CalendarClock, Search, ChevronRight, Compass, Flag, PiggyBank, Repeat, Scale, Wallet, type LucideIcon } from 'lucide-react';
import { Page, PageHeader } from '@/components/layout/page';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useI18n } from '@/features/i18n/i18n-provider';

/** Static, bilingual educational content. Not financial data, not advice, never personalised figures. */
type Bi = [string, string];
interface Topic { id: string; icon: LucideIcon; title: Bi; summary: Bi; points: Bi[]; tryIt: Bi }

const TOPICS: Topic[] = [
  { id: 'saving', icon: PiggyBank, title: ['Saving', 'الادخار'], summary: ['Setting money aside first, so it is there when you need it.', 'أن تضع جزءاً من المال جانباً أولاً ليكون موجوداً عند الحاجة.'],
    points: [['Save a small part as soon as money arrives, before spending starts.', 'ادّخر جزءاً صغيراً فور وصول المال، قبل أن يبدأ الإنفاق.'], ['Consistency matters more than size — small regular amounts add up.', 'الانتظام أهم من الحجم — المبالغ الصغيرة المنتظمة تتراكم.'], ['Keeping savings separate makes them easier not to spend.', 'فصل المدخرات يجعل عدم إنفاقها أسهل.']],
    tryIt: ['Pick one amount you could set aside each time you receive money.', 'اختر مبلغاً واحداً يمكنك وضعه جانباً كلما وصلك مال.'] },
  { id: 'budgeting', icon: Wallet, title: ['Budgeting', 'إعداد الميزانية'], summary: ['A plan for where your money goes, decided before it goes.', 'خطة لوجهة مالك تُقرَّر قبل أن يُنفق.'],
    points: [['Start from what you actually receive, not what you hope to.', 'ابدأ مما تتلقاه فعلاً، لا مما تتمنى.'], ['Group spending into a few categories you recognise.', 'قسّم الإنفاق إلى فئات قليلة تعرفها.'], ['A budget is a guide you can adjust, not a test you pass or fail.', 'الميزانية دليل يمكنك تعديله، وليست اختباراً تنجح فيه أو ترسب.']],
    tryIt: ['Choose one category and set a weekly limit for it.', 'اختر فئة واحدة وضع لها حداً أسبوعياً.'] },
  { id: 'needs-wants', icon: Scale, title: ['Needs and wants', 'الحاجات والرغبات'], summary: ['Telling apart what you must pay for and what would be nice to have.', 'التمييز بين ما يجب دفعه وما يُستحسن امتلاكه.'],
    points: [['Needs keep daily life going: food, transport, school supplies.', 'الحاجات تُبقي الحياة اليومية مستمرة: الطعام، التنقل، اللوازم الدراسية.'], ['Wants are fine — they just come after needs are covered.', 'الرغبات لا بأس بها — لكنها تأتي بعد تغطية الحاجات.'], ['Waiting a day before a want purchase often makes the choice clearer.', 'الانتظار يوماً قبل شراء رغبة يوضّح القرار غالباً.']],
    tryIt: ['Look at your last few purchases and sort each into need or want.', 'راجع آخر مشترياتك وصنّف كلاً منها حاجةً أو رغبة.'] },
  { id: 'recurring', icon: Repeat, title: ['Recurring costs', 'التكاليف المتكررة'], summary: ['Costs that come back every week, month or term.', 'تكاليف تعود كل أسبوع أو شهر أو فصل.'],
    points: [['Subscriptions, transport passes and phone plans are common examples.', 'الاشتراكات وبطاقات النقل وباقات الهاتف أمثلة شائعة.'], ['Small repeating amounts can grow large over a year.', 'المبالغ الصغيرة المتكررة قد تصبح كبيرة خلال سنة.'], ['Reviewing them now and then helps you keep only what you use.', 'مراجعتها من حين لآخر تساعدك على إبقاء ما تستخدمه فقط.']],
    tryIt: ['List every cost that repeats and note how often it comes.', 'اكتب كل تكلفة متكررة ومدى تكرارها.'] },
  { id: 'goals', icon: Flag, title: ['Goals', 'الأهداف'], summary: ['Giving your saving a clear purpose and a finish line.', 'إعطاء ادخارك هدفاً واضحاً وخط نهاية.'],
    points: [['A named goal with a target is easier to stay motivated for.', 'الهدف المسمى بمبلغ محدد يسهل الالتزام به.'], ['A target date turns a large amount into smaller steps.', 'الموعد المستهدف يحوّل المبلغ الكبير إلى خطوات أصغر.'], ['Changing a goal when life changes is part of planning.', 'تعديل الهدف عندما تتغير الظروف جزء من التخطيط.']],
    tryIt: ['Name one thing you would like to save for and when.', 'سمِّ شيئاً واحداً تود الادخار له ومتى.'] },
  { id: 'income', icon: Compass, title: ['Income', 'الدخل'], summary: ['Understanding where your money comes from and how steady it is.', 'فهم مصادر مالك ومدى انتظامها.'],
    points: [['Allowance, gifts, part-time work and aid are all kinds of income.', 'المصروف والهدايا والعمل الجزئي والمساعدات كلها أنواع من الدخل.'], ['Regular income is easier to plan around than irregular income.', 'الدخل المنتظم أسهل في التخطيط من غير المنتظم.'], ['Plan with income you expect to receive, not one-off surprises.', 'خطط بالدخل الذي تتوقعه، لا بالمفاجآت لمرة واحدة.']],
    tryIt: ['Write down each source of money you receive and how often.', 'دوّن كل مصدر مال يصلك ومدى تكراره.'] },
  { id: 'planning', icon: CalendarClock, title: ['Planning ahead', 'التخطيط للمستقبل'], summary: ['Looking forward so upcoming costs do not arrive as surprises.', 'النظر إلى الأمام كي لا تفاجئك التكاليف القادمة.'],
    points: [['Note known costs coming up: trips, books, events, fees.', 'سجّل التكاليف المعروفة القادمة: رحلات، كتب، مناسبات، رسوم.'], ['Expected income minus planned costs shows what may remain.', 'الدخل المتوقع ناقص التكاليف المخططة يبيّن ما قد يتبقى.'], ['A plan is an estimate — checking it regularly keeps it useful.', 'الخطة تقدير — مراجعتها بانتظام تبقيها مفيدة.']],
    tryIt: ['Think of one cost in the next month and how you will cover it.', 'فكّر في تكلفة واحدة خلال الشهر القادم وكيف ستغطيها.'] },
];

export default function LearnPage() {
  const { lang } = useI18n();
  const tx = (b: Bi) => (lang === 'ar' ? b[1] : b[0]);
  const [open, setOpen] = useState<Topic | null>(null);
  const [search, setSearch] = useState('');
  const profileQ = useGetProfile({ query: { queryKey: getGetProfileQueryKey(), staleTime: 30_000 } });
  const term = search.trim().toLowerCase();
  const topics = useMemo(() => (term ? TOPICS.filter((x) => [x.title, x.summary, ...x.points].some((b) => b[0].toLowerCase().includes(term) || b[1].includes(term))) : TOPICS), [term]);
  const school = profileQ.data?.education?.studentType === 'school';

  if (profileQ.isPending) return <Page><div className="mb-8 space-y-3" data-testid="state-learn-loading"><Skeleton className="h-9 w-2/3 max-w-sm" /><Skeleton className="h-4 w-4/5 max-w-lg" /></div><SkeletonRows rows={7} label={tx(['Loading…', 'جارٍ التحميل…'])} /></Page>;
  if (profileQ.isError) return <Page><StatePanel tone="error" title={tx(['Learn did not load', 'تعذّر تحميل صفحة التعلّم'])} body={tx(['We could not confirm your account. Try again.', 'تعذّر التحقق من حسابك. حاول مجدداً.'])} action={<RetryButton label={tx(['Retry', 'إعادة المحاولة'])} busyLabel="…" busy={profileQ.isRefetching} onClick={() => profileQ.refetch()} />} /></Page>;

  return (
    <Page>
    <PullToRefresh onRefresh={() => profileQ.refetch()} label={tx(['Refreshing…', 'جارٍ التحديث…'])}>
      <PageHeader eyebrow={school ? tx(['LEARN · FOR SCHOOL STUDENTS', 'تعلّم · لطلاب المدارس']) : tx(['LEARN', 'تعلّم'])} title={tx(['Money basics, one idea at a time', 'أساسيات المال، فكرة في كل مرة'])}
        lede={tx(['Short, general explanations. Educational only — not financial advice, and never based on your account data.', 'شروحات قصيرة وعامة. للتعلّم فقط — ليست نصيحة مالية، ولا تعتمد على بيانات حسابك.'])} />
      <label className="relative mb-4 block">
        <span className="sr-only">{tx(['Search topics', 'ابحث في المواضيع'])}</span>
        <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tx(['Search topics', 'ابحث في المواضيع'])} className={`${inputClass} ps-10`} data-testid="input-learn-search" />
      </label>
      {!topics.length ? <StatePanel tone="empty" title={tx(['No topics match', 'لا مواضيع مطابقة'])} body={tx(['Try another word, like "save" or "budget".', 'جرّب كلمة أخرى مثل «ادخار» أو «ميزانية».'])} action={<button type="button" className="type-label min-h-11 text-gold-ink underline-offset-4 hover:underline" onClick={() => setSearch('')} data-testid="button-clear-search">{tx(['Clear search', 'مسح البحث'])}</button>} /> :
      <ul className="stagger divide-y divide-divider border-y border-divider" data-testid="list-learn-topics">
        {topics.map((topic) => {
          const Icon = topic.icon;
          return (
            <li key={topic.id}>
              <button type="button" onClick={() => setOpen(topic)} data-testid={`button-topic-${topic.id}`} className="flex min-h-[64px] w-full items-center gap-4 py-4 text-start transition-colors hover:bg-muted/50">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-gold-ink"><Icon className="size-[18px]" aria-hidden /></span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5"><span className="type-subtitle">{tx(topic.title)}</span><span className="type-caption text-muted-foreground">{tx(topic.summary)}</span></span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>}
      <p className="type-caption flex items-center gap-2 pt-6 text-muted-foreground"><BookOpen className="size-4" aria-hidden />{tx([`${TOPICS.length} topics · available in English and Arabic`, `${TOPICS.length} مواضيع · متاحة بالعربية والإنجليزية`])}</p>

      <Dialog open={open !== null} onOpenChange={(v) => { if (!v) setOpen(null); }}>
        <DialogContent data-testid="sheet-learn-topic">
          {open ? <>
            <DialogHeader>
              <DialogTitle>{tx(open.title)}</DialogTitle>
              <DialogDescription>{tx(open.summary)}</DialogDescription>
            </DialogHeader>
            <ul className="flex flex-col gap-3 py-2">
              {open.points.map((p, i) => (
                <li key={i} className="flex gap-3"><span className="tabular type-label mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-gold-ink">{i + 1}</span><span className="type-body">{tx(p)}</span></li>
              ))}
            </ul>
            <div className="rounded-card bg-surface-sunken p-4">
              <p className="eyebrow pb-1">{tx(['Try it', 'جرّبها'])}</p>
              <p className="type-body">{tx(open.tryIt)}</p>
            </div>
          </> : null}
        </DialogContent>
      </Dialog>
    </PullToRefresh>
    </Page>
  );
}
