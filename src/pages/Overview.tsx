/**
 * Overview — what the AI has been doing, from above.
 *
 * This replaces the old live monitor and now also absorbs Inbox functionally.
 * The difference is the ordering: the old feed was ordered by *time* — a feed
 * you had to be watching for it to be worth anything, which is exactly the wrong
 * shape for work that runs while you are asleep. This one is ordered by *whether
 * it needs a human*, so the answer is already here whether or not you were looking.
 *
 * Four questions, in the order they cost you money:
 *   1. Is anything blocked on me?      — stalled HITL requests (Inbox queue inline)
 *   2. How much ran without me?        — the number that says this is agentic
 *   3. Is it healthy, and trending?    — volume + completion over the window
 *   4. What is it reaching for, and    — capability mix, repeat failures,
 *      where is it going wrong?          busiest workflows
 *
 * /inbox now redirects to /overview — deep links stay valid.
 *
 * Tool / Connector / Plugin vocabulary (see Tools page):
 *  Tool      = callable function the model can invoke (Tools library)
 *  Connector = credential that lets a plugin act as you (Credentials)
 *  Plugin    = external MCP pack that brings mcp__* tools at runtime (Connections)
 *
 * Everything is scoped by the single window control in the header; no card
 * carries its own filter.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHitlPending } from '../hooks/useHitlPending';
import {
  Radar,
  Loader2,
  PlayCircle,
  Hand,
  XCircle,
  CheckCircle2,
  Table2,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Repeat,
  Wrench,
  ShieldQuestion,
  HelpCircle,
  AlertTriangle,
  Clock,
  Check,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  logsService,
  type DailyTrendPoint,
  type ExecutionLog,
  type HITLRequest,
  type HITLResponse,
} from '../api';
import { orchestratorService, hitlOption } from '../api';
import { usePersistedState } from '../hooks/usePersistedState';
import PageHeader from '../components/layout/PageHeader';
import MarkdownMessage from '../components/chat/MarkdownMessage';
import { cn } from '../lib/utils';
import { describeCost, formatCost } from '../lib/cost';

const WINDOWS = [7, 30, 90] as const;
type Window = (typeof WINDOWS)[number];

/** A run nobody asked for by hand is a run that happened without you. */
const AUTONOMOUS_TRIGGERS = ['schedule', 'webhook', 'api'];

/* Which option values are a real `HITLResponse.action` rather than free text.
   Mirrors the same set in Inbox — both panes answer the same queue, so a
   button that posts `retry` here must post `retry` there. */
const ACTIONS = new Set(['approve', 'reject', 'retry', 'skip', 'stop']);

function compact(n: number) {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

function ms(v: number) {
  if (!v) return '—';
  return v < 1000 ? `${Math.round(v)}ms` : `${(v / 1000).toFixed(1)}s`;
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function waitedFor(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
function timeLeft(req: HITLRequest) {
  if (!req.timeout_seconds) return null;
  const deadline = new Date(req.created_at).getTime() + req.timeout_seconds * 1000;
  const mins = Math.floor((deadline - Date.now()) / 60000);
  if (mins <= 0) return 'expired';
  if (mins < 60) return `${mins}m left`;
  return `${Math.floor(mins / 60)}h left`;
}

const typeConfig = {
  approval: { icon: ShieldQuestion, label: 'Needs your approval' },
  clarification: { icon: HelpCircle, label: 'Needs an answer' },
  error: { icon: AlertTriangle, label: 'Failed — needs a decision' },
} as const;

/**
 * Collapse an error into something countable: strip ids, numbers and quoted
 * fragments so "timed out after 30s" and "timed out after 45s" land in the same
 * bucket. Three occurrences of one cause is a signal; three log lines are not.
 */
function errorSignature(msg: string) {
  return msg
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    .replace(/\b\d+\b/g, '<n>')
    .replace(/'[^']*'|"[^"]*"/g, '<v>')
    .trim()
    .slice(0, 160);
}

/* ------------------------------------------------------------------ tiles */

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof PlayCircle;
  tone?: 'attention' | 'bad';
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon
          className={cn(
            'w-4 h-4',
            tone === 'attention' ? 'text-primary' : tone === 'bad' ? 'text-destructive' : 'text-muted-foreground'
          )}
        />
        <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="text-[28px] font-semibold leading-none tracking-tight">{value}</div>
      {sub && <p className="text-[12px] text-muted-foreground mt-1.5">{sub}</p>}
    </div>
  );
}

/* ------------------------------------------------------- activity columns */

/**
 * Runs per day, split by whether they finished. Two series, so it carries a
 * legend; the violet/red pair is the validated one (light #6b4fbb/#af0e1c,
 * dark #9074dc/#e0525d) — the obvious green/red is a deutan collision and is
 * not used anywhere a fill has to carry meaning on its own.
 */
function ActivityChart({ points }: { points: DailyTrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const peak = Math.max(...points.map((p) => p.count), 0);
  const scale = Math.max(1, peak);
  const every = Math.max(1, Math.ceil(points.length / 6));
  const peakIndex = points.findIndex((p) => p.count === peak);

  return (
    <div className="relative">
      <div className="flex items-end gap-[2px] h-[168px] pt-4 pb-6 relative">
        <div className="absolute left-0 right-0 bottom-6 border-b border-border" aria-hidden />

        {points.map((p, i) => {
          const failed = Math.max(0, p.count - p.success);
          const total = (p.count / scale) * 100;
          const failedPct = (failed / scale) * 100;
          const donePct = (p.success / scale) * 100;
          const active = hover === i;
          return (
            <button
              key={p.date ?? i}
              type="button"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="flex-1 min-w-0 h-full flex flex-col justify-end items-center group relative outline-none"
              aria-label={`${p.date ? shortDate(p.date) : 'unknown'}: ${p.count} runs, ${p.success} completed`}
            >
              <span
                className={cn(
                  'absolute inset-0 rounded-sm transition-colors',
                  active && 'bg-secondary/60'
                )}
                aria-hidden
              />
              <span
                className="relative w-full max-w-[24px] flex flex-col justify-end"
                style={{ height: `${total}%` }}
              >
                {i === peakIndex && peak > 0 && (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground tabular-nums">
                    {peak}
                  </span>
                )}
                {failed > 0 && (
                  <span
                    className="block w-full bg-chart-fail rounded-t"
                    style={{ height: `${(failedPct / Math.max(total, 0.001)) * 100}%` }}
                  />
                )}
                {p.success > 0 && (
                  <span
                    className={cn(
                      'block w-full bg-chart-work',
                      failed > 0 ? 'mt-[2px]' : 'rounded-t'
                    )}
                    style={{ height: `${(donePct / Math.max(total, 0.001)) * 100}%` }}
                  />
                )}
              </span>
              {i % every === 0 && p.date && (
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground whitespace-nowrap">
                  {shortDate(p.date)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {hover !== null && points[hover] && (
        <div
          className="absolute top-0 -translate-x-1/2 z-10 pointer-events-none bg-popover border border-border rounded-lg shadow-md px-3 py-2 text-[12px] whitespace-nowrap"
          style={{
            left: `${Math.min(88, Math.max(12, ((hover + 0.5) / points.length) * 100))}%`,
          }}
        >
          <div className="font-semibold mb-1">
            {points[hover].date ? shortDate(points[hover].date!) : 'Unknown date'}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="w-2 h-2 rounded-sm bg-chart-work" />
            Completed
            <span className="ml-auto text-foreground tabular-nums">{points[hover].success}</span>
          </div>
              <div className="flex items-center gap-2 text-muted-foreground">
            <span className="w-2 h-2 rounded-sm bg-chart-fail" />
            Failed
            <span className="ml-auto text-foreground tabular-nums">
              {Math.max(0, points[hover].count - points[hover].success)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityTable({ points }: { points: DailyTrendPoint[] }) {
  return (
    <div className="max-h-[168px] overflow-y-auto">
      <table className="w-full text-[12px]">
        <thead className="sticky top-0 bg-card">
          <tr className="text-muted-foreground text-left">
            <th className="font-medium py-1">Day</th>
            <th className="font-medium py-1 text-right">Runs</th>
            <th className="font-medium py-1 text-right">Completed</th>
            <th className="font-medium py-1 text-right">Failed</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {points.map((p, i) => (
            <tr key={p.date ?? i} className="border-t border-border">
              <td className="py-1">{p.date ? shortDate(p.date) : '—'}</td>
              <td className="py-1 text-right">{p.count}</td>
              <td className="py-1 text-right">{p.success}</td>
              <td className="py-1 text-right">{Math.max(0, p.count - p.success)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------- page */

export default function Overview() {
  const [days, setDays] = usePersistedState<Window>('overview.window', 7, {
    validate: (v): v is Window => WINDOWS.includes(v as never),
  });
  const [asTable, setAsTable] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const hold = { placeholderData: <T,>(prev: T) => prev };

  const { data: stats, isLoading, isFetching } = useQuery({
    queryKey: ['overview', 'stats', days],
    queryFn: () => logsService.getStatistics(days),
    refetchInterval: 30_000,
    ...hold,
  });

  const { data: costs } = useQuery({
    queryKey: ['overview', 'costs', days],
    queryFn: () => logsService.getCostBreakdown(days),
    refetchInterval: 60_000,
    ...hold,
  });

  const { data: pending = [] } = useHitlPending();

  const { data: failures } = useQuery({
    queryKey: ['overview', 'failures', days],
    queryFn: () => logsService.listExecutions({ status: 'failed', limit: 100 }),
    refetchInterval: 60_000,
    ...hold,
  });

  const respond = useMutation({
    mutationFn: ({ id, action, response }: { id: string; action: HITLResponse['action']; response?: string }) =>
      orchestratorService.respondToHITL(id, { action, response }),
    onSuccess: () => {
      toast.success('Response sent');
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ['hitl'] });
      queryClient.invalidateQueries({ queryKey: ['nav'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
    onError: () => toast.error('Could not send that response'),
  });

  const summary = stats?.summary;
  const trend = stats?.daily_trend ?? [];

  const autonomy = useMemo(() => {
    const by = stats?.by_trigger ?? {};
    const total = Object.values(by).reduce((a, b) => a + b, 0);
    if (!total) return null;
    const auto = AUTONOMOUS_TRIGGERS.reduce((a, k) => a + (by[k] ?? 0), 0);
    return { pct: Math.round((auto / total) * 100), auto, manual: total - auto, total };
  }, [stats]);

  const repeats = useMemo(() => {
    const runs: ExecutionLog[] = failures?.results ?? [];
    const buckets = new Map<string, { sample: string; count: number; workflows: Set<string>; last: string }>();
    for (const r of runs) {
      if (!r.error_message) continue;
      const key = errorSignature(r.error_message);
      const b = buckets.get(key);
      if (b) {
        b.count += 1;
        if (r.workflow_name) b.workflows.add(r.workflow_name);
        if (r.created_at > b.last) b.last = r.created_at;
      } else {
        buckets.set(key, {
          sample: r.error_message,
          count: 1,
          workflows: new Set(r.workflow_name ? [r.workflow_name] : []),
          last: r.created_at,
        });
      }
    }
    return [...buckets.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  }, [failures]);

  const capabilities = useMemo(() => {
    const all = costs?.by_tool ?? [];
    const top = all.slice(0, 8);
    const rest = all.slice(8).reduce((a, n) => a + n.count, 0);
    return rest > 0 ? [...top, { tool: 'Other', count: rest }] : top;
  }, [costs]);

  const oldestWait = pending.length
    ? pending.reduce((a, b) => (a.created_at < b.created_at ? a : b))
    : null;

  const selected = pending.find((r) => r.request_id === selectedId) ?? pending[0] ?? null;

  if (isLoading && !stats) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  const nothingYet = !summary?.total_executions;

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        icon={Radar}
        title="Overview"
        subtitle={
          nothingYet
            ? 'Nothing has run yet'
            : `${summary!.total_executions} run${summary!.total_executions === 1 ? '' : 's'} in the last ${days} days`
        }
      >
        <div className="flex gap-2">
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setDays(w)}
              className={cn(
                'px-3 py-1.5 text-sm rounded border transition-colors',
                days === w
                  ? 'bg-primary text-primary-foreground border-primary font-semibold'
                  : 'bg-card border-border hover:bg-secondary'
              )}
            >
              {w} days
            </button>
          ))}
        </div>
      </PageHeader>

      <div
        className={cn(
          'flex-1 overflow-y-auto p-4 md:p-6 space-y-6 transition-opacity',
          isFetching && 'opacity-60'
        )}
      >
        {nothingYet && pending.length === 0 ? (
          <div className="text-center py-20">
            <h3 className="text-lg font-semibold mb-1">No activity yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Once your agents run, you’ll see what ran automatically, which tools they used, and where they needed your help.
            </p>
            <Link to="/agents" className="inline-block mt-4 text-sm text-primary hover:underline">
              Build your first agent
            </Link>
          </div>
        ) : (
          <>
            {/* 1 — blocked work: now the full Inbox inline, not a teaser card.
                   This is the only state that costs you time while producing nothing,
                   and it now lives where the analytics already are — one surface. */}
            {pending.length > 0 ? (
              <section className="border border-primary-line bg-card rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-primary-subtle">
                  <Hand className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-semibold text-primary">
                    {pending.length} {pending.length === 1 ? 'request needs' : 'requests need'} your attention
                  </h2>
                  {oldestWait && (
                    <span className="text-[12px] text-primary/80">· longest {waitedFor(oldestWait.created_at)}</span>
                  )}
                  <Link to="/runs" className="ml-auto text-[12px] text-primary hover:underline flex items-center gap-1">
                    All runs <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className={cn(
                  'flex lg:min-h-[280px] lg:max-h-[420px]',
                  // On mobile the two panes stack, so the row must not reserve
                  // 280px of nothing once the queue inside it is hidden.
                  selected ? 'min-h-0' : 'min-h-[280px] max-h-[420px]',
                )}>
                  {/* Queue. Hidden on mobile once something is selected: the
                      detail renders *below* this 420px scroller, so tapping a
                      row scrolled the answer off-screen and read as the tap
                      doing nothing. Phones swap panes; they do not stack them. */}
                  <div className={cn(
                    'w-full lg:w-[380px] border-r border-border overflow-y-auto shrink-0',
                    selected && 'hidden lg:block',
                  )}>
                    {pending.map((req) => {
                      const cfg = typeConfig[req.request_type as keyof typeof typeConfig] ?? typeConfig.approval;
                      const Icon = cfg.icon;
                      const isError = req.request_type === 'error';
                      const active = selected?.request_id === req.request_id;
                      return (
                        <button
                          key={req.request_id}
                          onClick={() => setSelectedId(req.request_id)}
                          className={cn(
                            'w-full text-left px-4 py-3 border-b border-border transition-colors relative',
                            active ? 'bg-primary-subtle' : 'hover:bg-secondary'
                          )}
                        >
                          <span className={cn('absolute left-0 top-0 bottom-0 w-[3px]', isError ? 'bg-destructive' : 'bg-primary')} />
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className={cn('w-4 h-4', isError ? 'text-destructive' : 'text-primary')} />
                            <span className={cn('text-[13px] font-semibold', isError ? 'text-destructive' : 'text-primary')}>
                              {cfg.label}
                            </span>
                            <span className="ml-auto text-[11px] text-muted-foreground">{timeAgo(req.created_at)}</span>
                          </div>
                          <p className="text-sm font-medium text-foreground mb-1 line-clamp-1">{req.title}</p>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            {req.workflow_name && <span className="truncate">{req.workflow_name}</span>}
                            {timeLeft(req) && (
                              <span className="flex items-center gap-1 shrink-0">
                                <Clock className="w-3 h-3" />
                                {timeLeft(req)}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {/* Detail */}
                  <div className="hidden lg:flex flex-1 flex-col overflow-y-auto">
                    {!selected ? (
                      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                        Pick a request to see what the agent wants to do
                      </div>
                    ) : (
                      <div className="p-5 max-w-2xl">
                        <h2 className="text-lg font-semibold mb-1">{selected.title}</h2>
                        {selected.workflow_name && (
                          <p className="text-sm text-muted-foreground mb-3 flex items-center gap-1">
                            {selected.workflow_name}
                            <ChevronRight className="w-3 h-3" />
                            step {selected.node_id}
                          </p>
                        )}
                        <div className="bg-card border border-border rounded p-4 mb-4">
                          <div className="text-[14px] leading-relaxed text-foreground">
                            <MarkdownMessage content={selected.message} variant="compact" />
                          </div>
                        </div>
                        {/* The backend supplies both the wording of each
                            choice and the action it posts — see the same note
                            in Inbox. Reading the action off the button's
                            position was a guess that held only for the
                            two-button case. */}
                        <div className="flex flex-wrap gap-2">
                          {(selected.options?.length
                            ? selected.options.map(hitlOption)
                            : [{ label: 'Approve', value: 'approve' },
                               { label: 'Reject', value: 'reject' }]
                          ).map(({ label, value }, i) => (
                            <button
                              key={`${value}-${label}`}
                              disabled={respond.isPending}
                              onClick={() =>
                                respond.mutate({
                                  id: selected.request_id,
                                  action: ACTIONS.has(value)
                                    ? (value as HITLResponse['action'])
                                    : 'respond',
                                  response: label,
                                })
                              }
                              className={cn(
                                'px-4 py-2 text-sm rounded border transition-colors disabled:opacity-50',
                                i === 0
                                  ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90 font-semibold'
                                  : 'bg-card border-border hover:bg-secondary'
                              )}
                            >
                              {label}
                            </button>
                          ))}
                          <button
                            disabled={respond.isPending}
                            onClick={() => respond.mutate({ id: selected.request_id, action: 'reject' })}
                            className="px-4 py-2 text-sm rounded border border-border hover:bg-secondary text-muted-foreground flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <X className="w-4 h-4" />
                            Stop this run
                          </button>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-3">Nothing has left your account. This step runs only after you answer.</p>
                      </div>
                    )}
                  </div>
                </div>
                {/* Mobile pane: replaces the queue rather than sitting under it. */}
                {selected && (
                  <div className="lg:hidden p-4">
                    <button
                      onClick={() => setSelectedId(null)}
                      className="mb-3 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Back to queue
                    </button>
                    <h3 className="text-sm font-semibold mb-1">{selected.title}</h3>
                    {selected.workflow_name && (
                      <p className="text-[12px] text-muted-foreground mb-2 flex items-center gap-1">
                        <span className="truncate">{selected.workflow_name}</span>
                        <ChevronRight className="w-3 h-3 shrink-0" />
                        <span className="shrink-0">step {selected.node_id}</span>
                      </p>
                    )}
                    <div className="text-[14px] leading-relaxed bg-card border border-border rounded p-3 mb-3">
                      <MarkdownMessage content={selected.message} variant="compact" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(selected.options?.length
                        ? selected.options.map(hitlOption)
                        : [{ label: 'Approve', value: 'approve' },
                           { label: 'Reject', value: 'reject' }]
                      ).map(({ label, value }, i) => (
                        <button
                          key={`${value}-${label}`}
                          disabled={respond.isPending}
                          onClick={() =>
                            respond.mutate({
                              id: selected.request_id,
                              action: ACTIONS.has(value)
                                ? (value as HITLResponse['action'])
                                : 'respond',
                              response: label,
                            })
                          }
                          className={cn(
                            'px-3 py-1.5 text-sm rounded border disabled:opacity-50',
                            i === 0 ? 'bg-primary text-primary-foreground border-primary font-semibold' : 'bg-card border-border'
                          )}
                        >
                          {label}
                        </button>
                      ))}
                      <button
                        disabled={respond.isPending}
                        onClick={() => respond.mutate({ id: selected.request_id, action: 'reject' })}
                        className="px-3 py-1.5 text-sm rounded border border-border text-muted-foreground flex items-center gap-1.5"
                      >
                        <X className="w-3 h-3" /> Stop
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-3">
                      Nothing has left your account. This step runs only after you answer.
                    </p>
                  </div>
                )}
              </section>
            ) : (
              <section className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
                  <Check className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">You're clear — nothing is waiting on you</p>
                  <p className="text-[12px] text-muted-foreground">When an agent reaches a step it isn't allowed to take on its own, it stops and asks here.</p>
                </div>
                <Link to="/runs" className="ml-auto text-[12px] text-primary hover:underline hidden sm:block">See runs →</Link>
              </section>
            )}

            {/* 2 — the hero. Exactly one per view. */}
            {autonomy && (
              <section className="bg-card border border-border rounded-lg p-5">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-8">
                  <div className="shrink-0">
                    <p className="text-[13px] font-medium text-muted-foreground mb-1">Ran without you</p>
                    <div className="text-[52px] font-semibold leading-none tracking-tight">{autonomy.pct}%</div>
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="h-2 rounded-full bg-agent-subtle overflow-hidden">
                      <span className="block h-full rounded-full bg-chart-work" style={{ width: `${autonomy.pct}%` }} />
                    </div>
                    <p className="text-[12px] text-muted-foreground mt-2 leading-relaxed">
                      <span className="tabular-nums text-foreground">{autonomy.auto}</span> run
                      {autonomy.auto === 1 ? '' : 's'} started automatically (schedules or connected apps).{' '}
                      <span className="tabular-nums text-foreground">{autonomy.manual}</span> you started yourself.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* 3 — posture */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatTile
                icon={PlayCircle}
                label="Running"
                value={String(stats?.by_status?.running ?? 0)}
                sub="running now"
              />
              <StatTile
                icon={Hand}
                label="Waiting on you"
                value={String(pending.length)}
                sub={oldestWait ? `longest ${waitedFor(oldestWait.created_at)}` : 'nothing blocked'}
                tone={pending.length ? 'attention' : undefined}
              />
              <StatTile
                icon={XCircle}
                label="Failed"
                value={String(summary!.failed)}
                sub={`of ${summary!.total_executions} runs`}
                tone={summary!.failed ? 'bad' : undefined}
              />
              <StatTile
                icon={CheckCircle2}
                label="Completed"
                value={`${summary!.success_rate}%`}
                sub={`${ms(summary!.avg_duration_ms)} average`}
              />
            </section>

            {/* 4 — volume and health over the window */}
            <section className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center gap-3 mb-5">
                <h2 className="text-sm font-semibold">Activity</h2>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-chart-work" />
                    Completed
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-chart-fail" />
                    Failed
                  </span>
                </div>
                <button
                  onClick={() => setAsTable((v) => !v)}
                  className="ml-auto flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-secondary"
                  aria-label={asTable ? 'Show chart' : 'Show table'}
                >
                  {asTable ? <BarChart3 className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />}
                  {asTable ? 'Chart' : 'Table'}
                </button>
              </div>
              {trend.length === 0 ? (
                <p className="text-[13px] text-muted-foreground py-8 text-center">No runs in this window.</p>
              ) : asTable ? (
                <ActivityTable points={trend} />
              ) : (
                <ActivityChart points={trend} />
              )}
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="bg-card border border-border rounded-lg p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Wrench className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Most used tools</h2>
                </div>
                {capabilities.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">No activity recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {capabilities.map((c) => {
                      const top = capabilities[0].count || 1;
                      return (
                        <div key={c.tool} className="flex items-center gap-3">
                          <span className="text-[12px] w-32 shrink-0 truncate" title={c.tool}>
                            {c.tool}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span
                              className="block h-2 rounded-r bg-chart-work"
                              style={{ width: `${Math.max(1.5, (c.count / top) * 100)}%` }}
                            />
                          </div>
                          <span className="text-[12px] text-muted-foreground tabular-nums w-12 text-right">
                            {compact(c.count)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="bg-card border border-border rounded-lg p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Repeat className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Repeat failures</h2>
                  <Link to="/runs" className="ml-auto text-[12px] text-primary hover:underline">
                    All runs
                  </Link>
                </div>
                {repeats.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">Nothing has failed more than once. Good sign.</p>
                ) : (
                  <div className="space-y-2.5">
                    {repeats.map((r) => (
                      <div key={r.sample} className="flex items-start gap-3">
                        <span className="shrink-0 mt-0.5 text-[11px] font-semibold tabular-nums text-destructive bg-destructive-subtle rounded px-1.5 py-0.5">
                          ×{r.count}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13px] leading-snug line-clamp-2">{r.sample}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                            {[...r.workflows].slice(0, 2).join(', ')}
                            {r.workflows.size > 2 && ` +${r.workflows.size - 2} more`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {costs?.by_workflow?.length ? (
              <section className="bg-card border border-border rounded-lg p-5">
                <h2 className="text-sm font-semibold mb-4">Most active agents</h2>
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-[11px] text-muted-foreground text-left">
                      <th className="font-medium pb-2">Agent</th>
                      <th className="font-medium pb-2 w-28">Runs</th>
                      <th className="font-medium pb-2 text-right w-20">Tokens</th>
                      <th className="font-medium pb-2 text-right w-20">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costs.by_workflow.map((w) => {
                      const top = costs.by_workflow[0].executions || 1;
                      return (
                        <tr key={w.workflow_id} className="border-t border-border">
                          <td className="py-2 pr-3 truncate max-w-0">{w.workflow_name}</td>
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="block h-2 rounded-r bg-chart-work"
                                style={{ width: `${Math.max(6, (w.executions / top) * 72)}px` }}
                              />
                              <span className="text-[12px] text-muted-foreground tabular-nums">{w.executions}</span>
                            </div>
                          </td>
                          <td className="py-2 text-right tabular-nums text-muted-foreground">{compact(w.tokens ?? 0)}</td>
                          {/* Was `credits`, a column nothing ever wrote, so this
                              read 0 for every agent. Now what the runs cost. */}
                          <td
                            className="py-2 text-right tabular-nums text-muted-foreground"
                            title={describeCost(w.cost_usd, w.cost_source)}
                          >
                            {formatCost(w.cost_usd, w.cost_source)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
