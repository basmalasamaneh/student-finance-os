/**
 * Prompt 12 — personal student financial assistant (/assistant).
 * Contract: docs/prompt12-api.md · generated plain queryAssistant() (returns AssistantAnswer directly).
 * Deliberately NOT the useQueryAssistant hook: TanStack's global MutationCache would retain question
 * variables and answers beyond this screen. Requests are aborted on clear/unmount/account switch.
 * - Session-only: conversation lives in component memory, never storage; cleared on account change/unmount.
 * - No frontend financial math: server facts are exact signed minor strings, parsed with BigInt and
 *   formatted via finance-core (MoneyDisplay) when within safe-integer bounds, exact BigInt otherwise.
 * - Server-localized prose rendered as plain text (never markdown/HTML). No automatic POST retries.
 */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'wouter';
import { ArrowUp, RefreshCw, ShieldCheck, Trash2, Target } from 'lucide-react';
import {
  ApiError, queryAssistant,
  type AssistantAnswer, type AssistantFact, type AssistantQuery, type AssistantPeriod,
} from '@workspace/api-client-react';
import { Page } from '@/components/layout/page';
import { MoneyDisplay } from '@/components/finance/money-display';
import { StatePanel, RetryButton } from '@/components/states/state-panel';
import { PullToRefresh } from '@/components/gestures/pull-to-refresh';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAccount } from '@/features/auth/account';
import { useI18n } from '@/features/i18n/i18n-provider';
import type { TranslationKey } from '@/features/i18n/dictionary';
import { money, formatDate } from '@/lib/money';

/** Local destinations the UI will link to; anything else renders as plain text. */
const LINK_ALLOWLIST = ['/', '/transactions', '/plan', '/upcoming', '/goals', '/campus', '/family', '/money', '/profile', '/learn'];
function allowedHref(href: string) {
  if (!href.startsWith('/') || href.startsWith('//')) return false;
  const path = href.split(/[?#]/)[0];
  return LINK_ALLOWLIST.some((p) => path === p || (p !== '/' && path.startsWith(`${p}/`)));
}

const SUGGESTIONS: { id: string; key: TranslationKey }[] = [
  { id: 'food', key: 'as.q.food' }, { id: 'cafeteria', key: 'as.q.cafeteria' }, { id: 'bookstore', key: 'as.q.bookstore' },
  { id: 'books', key: 'as.q.books' }, { id: 'transport', key: 'as.q.transport' }, { id: 'ranking', key: 'as.q.ranking' },
  { id: 'upcoming', key: 'as.q.upcoming' }, { id: 'income', key: 'as.q.income' }, { id: 'saved', key: 'as.q.saved' },
  { id: 'goal', key: 'as.q.goal' }, { id: 'projected', key: 'as.q.projected' },
];

interface Turn { id: number; request: AssistantQuery; answer: AssistantAnswer }

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const MINOR_RE = /^-?[0-9]+$/;
/** Minor-unit scale per currency, mirroring finance-core's internal table (not exported). */
const MINOR_SCALE: Record<AssistantFact['currency'], number> = { ILS: 2, USD: 2, JOD: 3 };

/** Exact amount: BigInt-validated; finance-core formatting inside safe bounds, exact BigInt fallback beyond. */
function ExactAmount({ minor, currency, tone, signed, testId }: { minor: string; currency: AssistantFact['currency']; tone?: 'default' | 'projected'; signed?: boolean; testId?: string }) {
  const { locale } = useI18n();
  if (!MINOR_RE.test(minor)) return <span className="type-label text-muted-foreground">—</span>;
  const b = BigInt(minor);
  const abs = b < 0n ? -b : b;
  if (abs <= MAX_SAFE) {
    return <MoneyDisplay value={money(Number(b), currency)} tone={tone} showPlus={signed} testId={testId} />;
  }
  // Exact BigInt path: scale per currency (matches finance-core: ILS/USD 2, JOD 3). No Number() on amounts.
  const scale = MINOR_SCALE[currency];
  const base = 10n ** BigInt(scale);
  const int = abs / base;
  const fracDigits = (abs % base).toString().padStart(scale, '0');
  const sign = b < 0n ? '−' : signed ? '+' : '';
  const intText = new Intl.NumberFormat(locale, { useGrouping: true }).format(int);
  const digit = new Intl.NumberFormat(locale, { useGrouping: false });
  const fracText = fracDigits.split('').map((c) => digit.format(Number(c))).join('');
  const dec = new Intl.NumberFormat(locale).formatToParts(1.1).find((p) => p.type === 'decimal')?.value ?? '.';
  return <bdi dir="ltr" className="tabular type-label font-semibold" data-testid={testId}>{sign}{intText}{dec}{fracText} {currency}</bdi>;
}

function useFmtDate() {
  const { locale } = useI18n();
  return (iso: string) => {
    const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
    return Number.isNaN(d.getTime()) ? iso : formatDate(d, locale, 'UTC');
  };
}

function errorKey(e: unknown): TranslationKey {
  if (e instanceof ApiError) {
    if (e.status === 503) return 'as.errUnavailable';
    if (e.status === 429) return 'as.errRate';
    if (e.status === 401) return 'as.errSession';
    if (e.status === 403) return 'as.errForbidden';
    if (e.status === 400) return 'as.errInvalid';
  }
  return 'as.errorBody';
}

export default function AssistantPage() {
  const account = useAccount();
  const { t, lang } = useI18n();

  const [turns, setTurns] = useState<Turn[]>([]);
  const [failed, setFailed] = useState<{ request: AssistantQuery; replaceId: number | null; key: TranslationKey } | null>(null);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const seq = useRef(0);
  const epoch = useRef(0); // invalidates in-flight answers after clear/account change
  const abortRef = useRef<AbortController | null>(null);
  const invalidate = () => { epoch.current += 1; abortRef.current?.abort(); abortRef.current = null; };

  // Privacy: wipe the session conversation whenever the signed-in account changes.
  useEffect(() => {
    invalidate();
    setTurns([]); setFailed(null); setDraft(''); setPending(false);
  }, [account.id]);
  // Unmount: abort and drop anything in flight; state is discarded with the component.
  useEffect(() => () => invalidate(), []);

  const run = async (request: AssistantQuery, replaceId: number | null) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const myEpoch = epoch.current;
    setPending(true); setFailed(null);
    try {
      const answer = await queryAssistant(request, { signal: controller.signal });
      if (myEpoch !== epoch.current) return;
      setTurns((prev) => {
        if (replaceId !== null) return prev.map((x) => (x.id === replaceId ? { ...x, request, answer } : x));
        seq.current += 1;
        return [...prev, { id: seq.current, request, answer }];
      });
    } catch (e) {
      if (myEpoch !== epoch.current || controller.signal.aborted) return;
      setFailed({ request, replaceId, key: errorKey(e) });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (myEpoch === epoch.current) setPending(false);
    }
  };

  const lastQuestion = turns.length ? turns[turns.length - 1].request.question : undefined;
  const askNew = (question: string, goalId?: string) => {
    const q = question.trim().slice(0, 1000);
    if (!q || pending) return;
    const req: AssistantQuery = { question: q, language: lang };
    if (lastQuestion && lastQuestion !== q) req.lastQuestion = lastQuestion;
    if (goalId) req.goalId = goalId;
    void run(req, null);
  };
  const latest = turns[turns.length - 1];
  const refreshLatest = async () => {
    if (!latest || pending) return;
    await run({ ...latest.request, language: lang }, latest.id);
  };
  const submit = (e: FormEvent) => { e.preventDefault(); if (!draft.trim() || pending) return; askNew(draft); setDraft(''); };
  const clearAll = () => { invalidate(); setTurns([]); setFailed(null); setPending(false); };

  const empty = turns.length === 0 && !pending && !failed;

  return (
    <Page>
      <PullToRefresh onRefresh={refreshLatest} label={t('as.pull')}>
        <div className="flex min-h-[70dvh] flex-col gap-5">
          <header className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h1 className="type-display" data-testid="text-assistant-title">{t('as.title')}</h1>
              <p className="type-body text-muted-foreground">{t('as.lede')}</p>
            </div>
            {turns.length > 0 && (
              <Button variant="ghost" className="min-h-11 shrink-0" onClick={() => setConfirmOpen(true)} data-testid="button-assistant-clear">
                <Trash2 className="size-4" /> {t('as.clear')}
              </Button>
            )}
          </header>

          <Card className="flex items-start gap-3 p-4 bg-surface-sunken" data-testid="text-assistant-privacy">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-gold-ink" aria-hidden />
            <p className="type-caption text-muted-foreground">{t('as.privacy')}</p>
          </Card>

          {empty && <StatePanel tone="empty" title={t('as.welcomeTitle')} body={t('as.welcomeBody')} />}

          <ol className="flex flex-col gap-5" aria-live="polite">
            {turns.map((turn) => (
              <li key={turn.id}>
                <AnswerView turn={turn} latest={turn.id === latest?.id} pending={pending}
                  onRefresh={() => void refreshLatest()} onChooseGoal={(id) => askNew(turn.request.question, id)} />
              </li>
            ))}
            {pending && (
              <li data-testid="state-assistant-pending" role="status" aria-label={t('as.loading')}>
                <Card className="space-y-3 p-4">
                  <Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-11/12" /><Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-12 w-full" />
                </Card>
              </li>
            )}
          </ol>

          {failed && !pending && (
            <StatePanel tone="error" title={t('as.errorTitle')} body={t(failed.key)}
              action={failed.key === 'as.errSession' || failed.key === 'as.errForbidden' ? undefined
                : <RetryButton label={t('as.retry')} busyLabel={t('as.retrying')} onClick={() => void run(failed.request, failed.replaceId)} />} />
          )}

          <section aria-label={t('as.suggestions')} className="space-y-2">
            <h2 className="eyebrow">{t('as.suggestions')}</h2>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:flex-wrap" data-no-ptr>
              {SUGGESTIONS.map((s) => (
                <Button key={s.id} variant="outline" className="min-h-11 shrink-0 rounded-full" disabled={pending}
                  onClick={() => askNew(t(s.key))} data-testid={`button-suggestion-${s.id}`}>{t(s.key)}</Button>
              ))}
            </div>
          </section>

          <form onSubmit={submit} className="sticky bottom-0 z-10 mt-auto flex items-end gap-2 bg-background pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('as.placeholder')} rows={1} maxLength={1000}
              aria-label={t('as.placeholder')} className="min-h-11 flex-1 resize-none"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e); }}
              data-testid="input-assistant-question" />
            <Button type="submit" size="icon" className="size-11 shrink-0" disabled={pending || !draft.trim()} aria-label={t('as.send')} data-testid="button-assistant-send">
              <ArrowUp className="size-5" />
            </Button>
          </form>
        </div>
      </PullToRefresh>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('as.clearTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('as.clearBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" data-testid="button-assistant-cancel-clear">{t('as.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="min-h-11" onClick={clearAll} data-testid="button-assistant-confirm-clear">{t('as.confirmClear')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}

function AnswerView({ turn, latest, pending, onRefresh, onChooseGoal }: {
  turn: Turn; latest: boolean; pending: boolean; onRefresh: () => void; onChooseGoal: (id: string) => void;
}) {
  const { t } = useI18n();
  const fmt = useFmtDate();
  const a = turn.answer;
  const period = (p: AssistantPeriod) => ({ from: fmt(p.from), to: fmt(p.to) });
  const provenances = Array.from(new Set(a.facts.map((f) => f.provenance)));
  const dir = a.language === 'ar' ? 'rtl' : 'ltr';

  return (
    <div className="space-y-2 motion-rise">
      <div className="ms-auto w-fit max-w-[88%] rounded-card bg-accent px-4 py-2">
        <span className="sr-only">{t('as.you')}: </span>
        <p className="type-label whitespace-pre-wrap break-words" data-testid={`text-question-${turn.id}`}>{turn.request.question}</p>
      </div>
      <Card className="space-y-4 p-4" data-testid={`card-answer-${turn.id}`} dir={dir}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" data-testid={`text-asof-${turn.id}`}>{t('as.asOf', { date: fmt(a.asOf) })}</Badge>
          {a.simulated && <Badge variant="secondary">{t('as.simulated')}</Badge>}
          {a.status === 'refused' && <Badge variant="outline">{t('as.refused')}</Badge>}
          {a.status === 'clarify' && <Badge variant="outline">{t('as.clarify')}</Badge>}
          {latest && (
            <Button variant="ghost" className="ms-auto min-h-11" disabled={pending} onClick={onRefresh} data-testid="button-assistant-refresh">
              <RefreshCw className="size-4" /> {pending ? t('as.refreshing') : t('as.refresh')}
            </Button>
          )}
        </div>

        <p className="type-body whitespace-pre-wrap break-words" data-testid={`text-message-${turn.id}`}>{a.message}</p>

        {(a.period || a.comparisonPeriod) && (
          <div className="type-caption flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
            {a.period && <span>{t('as.period', period(a.period))}</span>}
            {a.comparisonPeriod && <span>{t('as.comparison', period(a.comparisonPeriod))}</span>}
          </div>
        )}

        {a.goalChoices.length > 0 && (
          <Block title={t('as.chooseGoal')}>
            <div className="flex flex-wrap gap-2">
              {a.goalChoices.map((g) => (
                <Button key={g.id} variant="outline" className="min-h-11" disabled={pending} onClick={() => onChooseGoal(g.id)} data-testid={`button-goal-choice-${g.id}`}>
                  <Target className="size-4" /> {g.name}
                </Button>
              ))}
            </div>
          </Block>
        )}

        {a.status === 'answered' && (a.facts.length > 0 ? (
          <Block title={t('as.facts')}>
            <ul className="divide-y divide-border">
              {a.facts.map((f, i) => <FactRow key={`${f.key}-${f.currency}-${i}`} f={f} id={`${turn.id}-${i}`} />)}
            </ul>
          </Block>
        ) : <p className="type-caption text-muted-foreground">{t('as.noFigures')}</p>)}

        {a.warnings.length > 0 && (
          <Block title={t('as.warnings')}>
            <ul className="type-caption list-disc space-y-1 ps-5 text-muted-foreground">{a.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </Block>
        )}

        {a.links.some((l) => allowedHref(l.href)) && (
          <Block title={t('as.links')}>
            <ul className="flex flex-wrap gap-2">
              {a.links.filter((l) => allowedHref(l.href)).map((l, i) => (
                <li key={i}>
                  <Link href={l.href} className="type-label inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-gold-ink hover-elevate" data-testid={`link-assistant-${turn.id}-${i}`}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </Block>
        )}

        {(a.policy || provenances.length > 0) && (
          <details className="group rounded-lg bg-surface-sunken px-3 py-2">
            <summary className="type-label flex min-h-11 cursor-pointer items-center">{t('as.policy')}</summary>
            {provenances.length > 0 && <p className="type-caption text-muted-foreground">{t('as.sources', { list: provenances.map((p) => t(`as.src.${p}` as TranslationKey)).join(' · ') })}</p>}
            {a.policy && <p className="type-caption mt-1 whitespace-pre-wrap text-muted-foreground">{a.policy}</p>}
          </details>
        )}
      </Card>
    </div>
  );
}

function FactRow({ f, id }: { f: AssistantFact; id: string }) {
  const { t } = useI18n();
  const fmt = useFmtDate();
  const est = f.basis === 'estimated';
  const hasCompare = f.previousMinor !== undefined || f.deltaMinor !== undefined || f.changePercent !== undefined;
  return (
    <li className="space-y-1 py-3" data-testid={`row-fact-${id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="type-label break-words">{f.rank !== undefined && <span className="tabular text-muted-foreground">{f.rank}. </span>}{f.label}</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={est ? 'outline' : 'secondary'}>{est ? t('as.estimated') : t('as.actual')}</Badge>
            {f.date && <span className="type-caption text-muted-foreground">{fmt(f.date)}</span>}
          </div>
        </div>
        <ExactAmount minor={f.minor} currency={f.currency} tone={est ? 'projected' : 'default'} testId={`text-fact-amount-${id}`} />
      </div>
      {hasCompare && (
        <dl className="type-caption grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
          {f.previousMinor !== undefined && <><dt>{t('as.previous')}</dt><dd className="text-end"><ExactAmount minor={f.previousMinor} currency={f.currency} /></dd></>}
          {(f.deltaMinor !== undefined || f.changePercent !== undefined) && (
            <><dt>{t('as.change')}</dt>
              <dd className="flex flex-wrap items-center justify-end gap-2">
                {f.deltaMinor !== undefined && <ExactAmount minor={f.deltaMinor} currency={f.currency} signed />}
                {f.changePercent === null ? <span>{t('as.unknownPct')}</span>
                  : f.changePercent !== undefined && <bdi dir="ltr" className="tabular">{f.changePercent.startsWith('-') ? f.changePercent : `+${f.changePercent}`}%</bdi>}
              </dd></>
          )}
        </dl>
      )}
    </li>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-2"><h3 className="eyebrow">{title}</h3>{children}</section>;
}
