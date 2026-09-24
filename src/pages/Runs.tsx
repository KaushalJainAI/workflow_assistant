/**
 * Activity — what needs you, then what happened.
 *
 * One surface ordered by whether it needs a human: the approval inbox first
 * (the only place a paused run can be answered — /inbox and /overview
 * redirect here), then every execution with the turn-by-turn trace of what
 * the agent was thinking inside it. Fleet analytics (trends, tool mix,
 * repeat failures, per-agent spend) live in Settings → Insights, not here.
 *
 * A run is drawn as the loop it is: a sequence of **turns**, each showing the
 * model's reasoning and the tool calls that reasoning produced. Calls under one
 * turn were issued together; a flat list would imply each waited on the last,
 * which is a claim about causality the trace cannot support.
 *
 * Three things are answerable here that were not before: what the agent thought
 * at each step, which configuration revision it ran under, and — for a
 * delegated run — who asked for it and why.
 */
import { usePersistedState } from '../hooks/usePersistedState';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  Loader2,
  CircleSlash,
  Clock,
  ChevronRight,
  Brain,
  CornerDownRight,
  GitBranch,
  Settings2,
  Coins,
  Hand,
  HelpCircle,
  ShieldQuestion,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useHitlPending } from '../hooks/useHitlPending';
import {
  logsService,
  orchestratorService,
  hitlOption,
  type AgentStep,
  type AgentTurn,
  type ExecutionLog,
  type HITLRequest,
  type HITLResponse,
} from '../api';
import { cn } from '../lib/utils';
import { describeCost, formatCost } from '../lib/cost';
import PageHeader from '../components/layout/PageHeader';
import MarkdownMessage from '../components/chat/MarkdownMessage';
import ChartArtifact from '../components/chat/ChartArtifact';
import TodoPanel from '../components/chat/TodoPanel';
import PlanPanel from '../components/orchestration/PlanPanel';
import { planFromOutput } from '../lib/planStream';
import FileCards from '../components/files/FileCards';
import FilePreviewProvider from '../components/files/FilePreviewProvider';
import RunControls from '../components/runs/RunControls';
import FeedbackControl from '../components/runs/FeedbackControl';
import { useLiveRun } from '../hooks/useLiveRun';
import evalsService from '../api/evals';
import type { ChartSpec, FileCardData, TodoItem } from '../api/chat';

const statusConfig = {
  completed: { icon: CheckCircle2, cls: 'text-success', bg: 'bg-success-subtle', label: 'Succeeded' },
  failed: { icon: XCircle, cls: 'text-destructive', bg: 'bg-destructive-subtle', label: 'Failed' },
  running: { icon: Loader2, cls: 'text-agent', bg: 'bg-agent-subtle', label: 'Running', spin: true },
  pending: { icon: Clock, cls: 'text-muted-foreground', bg: 'bg-secondary', label: 'Queued' },
  cancelled: { icon: CircleSlash, cls: 'text-muted-foreground', bg: 'bg-secondary', label: 'Cancelled' },
  // A run held for approval. It fell through to `pending` and read "Queued",
  // which says "wait" to the one person the run is waiting on.
  paused: { icon: Hand, cls: 'text-warning', bg: 'bg-warning-subtle', label: 'Needs you' },
} as const;

/** Statuses whose detail can still change, so an open run keeps refreshing. */
const LIVE_STATUSES = new Set(['running', 'pending', 'paused']);

// `paused` is the one that needs someone: a run waiting on an approval.
const FILTERS = ['all', 'running', 'paused', 'completed', 'failed'] as const;

const FILTER_LABELS: Record<(typeof FILTERS)[number], string> = {
  all: 'All runs', running: 'Running', paused: 'Needs you',
  completed: 'Completed', failed: 'Failed',
};

/** What started a run. `trigger_type` says how it arrived; this says who asked.
 *  A delegated worker and a direct API call both arrive as `api`, and telling
 *  them apart is the difference between "you asked for this" and "an agent
 *  decided to spend your credits on it". */
const CALLER_LABELS: Record<string, string> = {
  api: 'API',
  chat: 'Chat',
  orchestrator: 'By another agent',
  trigger: 'Trigger',
  eval: 'Evaluation',
};

/* ------------------------------------------------- approval inbox pieces */

/* Which option values are a real `HITLResponse.action` rather than free text.
   A button that posts `retry` here must post `retry` everywhere this queue is
   answered, so the set lives next to the queue. */
const ACTIONS = new Set(['approve', 'reject', 'retry', 'skip', 'stop']);

const typeConfig = {
  approval: { icon: ShieldQuestion, label: 'Needs your approval' },
  clarification: { icon: HelpCircle, label: 'Needs an answer' },
  error: { icon: AlertTriangle, label: 'Failed — needs a decision' },
} as const;

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

function ms(v: number | null) {
  if (v == null) return '—';
  return v < 1000 ? `${v}ms` : `${(v / 1000).toFixed(1)}s`;
}

function when(iso: string) {
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function StatusPill({ status }: { status: string }) {
  const cfg = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.pending;
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[12px] font-semibold', cfg.bg, cfg.cls)}>
      <Icon className={cn('w-3.5 h-3.5', 'spin' in cfg && cfg.spin && 'animate-spin')} />
      {cfg.label}
    </span>
  );
}

/** One tool call. Duration bars are scaled to the slowest call in the run, so
 *  the hot spot is obvious without reading numbers. */
function Step({ step, slowest }: { step: AgentStep; slowest: number }) {
  const cfg = statusConfig[step.status as keyof typeof statusConfig] ?? statusConfig.pending;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-secondary">
        <cfg.icon className={cn('w-4 h-4 shrink-0', cfg.cls, 'spin' in cfg && cfg.spin && 'animate-spin')} />
        <span className="text-[13px] w-48 truncate" title={step.tool}>{step.tool}</span>
        <div className="flex-1 h-1.5 bg-secondary rounded overflow-hidden">
          {/* block, not inline — an inline element ignores width/height */}
          <span
            className={cn('block h-full rounded', step.status === 'failed' ? 'bg-destructive' : 'bg-agent')}
            style={{ width: `${Math.max(2, ((step.duration_ms || 0) / slowest) * 100)}%` }}
          />
        </div>
        <span className="text-[11px] text-muted-foreground w-14 text-right tabular-nums">
          {ms(step.duration_ms)}
        </span>
      </div>

      {step.error_message && (
        <p className="ml-7 text-[12px] text-destructive">{step.error_message}</p>
      )}

      {/* Runs this call delegated. Each is a real run with its own trace, so it
          links out rather than trying to inline someone else's loop. */}
      {step.delegated_runs.length > 0 && (
        <div className="ml-7 space-y-1 border-l-2 border-agent-line pl-3">
          {step.delegated_runs.map((child) => (
            <div key={child.execution_id} className="flex items-center gap-2 text-[12px]">
              <CornerDownRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              <span className="font-medium">{child.workflow_name ?? 'Deleted agent'}</span>
              <span className="text-muted-foreground truncate flex-1" title={child.task}>
                {child.task}
              </span>
              <StatusPill status={child.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** One pass of the model: why it did what it did, then what it did. */
function Turn({ turn, slowest }: { turn: AgentTurn; slowest: number }) {
  return (
    <div className="border-l-2 border-border pl-3 py-1">
      <div className="flex items-center gap-2 mb-1">
        <Brain className="w-3.5 h-3.5 text-agent shrink-0" />
        <span className="text-[12px] font-semibold">Step {turn.index}</span>
        {turn.model_id && (
          <span className="text-[11px] text-muted-foreground truncate" title={turn.model_id}>
            {turn.model_id}
          </span>
        )}
        <span
          className="text-[11px] text-muted-foreground ml-auto tabular-nums"
          title={describeCost(turn.cost_usd, turn.cost_source, turn)}
        >
          {turn.tokens.toLocaleString()} tokens ·{' '}
          <span className={cn(turn.cost_source === 'unpriced' && 'opacity-60')}>
            {formatCost(turn.cost_usd, turn.cost_source)}
          </span>{' '}
          · {ms(turn.duration_ms)}
        </span>
      </div>

      {turn.reasoning ? (
        <div className="prose prose-sm dark:prose-invert max-w-none mb-2 text-muted-foreground prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:text-[13px]">
          <MarkdownMessage content={turn.reasoning} variant="compact" className="text-[13px] leading-relaxed" />
          {/* A trimmed thought and a genuinely brief one must not look alike. */}
          {turn.reasoning_truncated && (
            <span className="text-[11px] italic opacity-70"> […trimmed]</span>
          )}
        </div>
      ) : (
        <p className="text-[12px] italic text-muted-foreground/60 mb-2">
          This model does not expose its reasoning.
        </p>
      )}

      {turn.steps.map((step) => (
        <Step key={step.id} step={step} slowest={slowest} />
      ))}

      {turn.decision === 'answer' && turn.content && (
        <div className="mt-3 prose prose-sm dark:prose-invert max-w-none rounded-lg border border-border bg-card px-4 py-3 shadow-sm prose-headings:font-semibold prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-strong:text-foreground prose-p:text-[13.5px] prose-p:leading-relaxed prose-li:text-[13.5px] prose-ul:my-2 prose-ol:my-2">
          <MarkdownMessage
            content={turn.content + (turn.content_truncated ? "\n\n*\u2026 trimmed \u2014 open the full trace to see more*" : "")}
            variant="full"
          />
        </div>
      )}
    </div>
  );
}

/** Who delegated this run, and what they were thinking when they did. */
function OrchestratorBanner({ detail }: { detail: { delegated_by: NonNullable<import('../api').ExecutionDetail['delegated_by']> } }) {
  const by = detail.delegated_by;
  return (
    <div className="mb-3 px-3 py-2 rounded bg-agent-subtle border border-agent-line">
      <div className="flex items-center gap-2 text-[12px] mb-1">
        <GitBranch className="w-3.5 h-3.5 text-agent shrink-0" />
        <span>
          Started by <span className="font-semibold">{by.workflow_name ?? 'a deleted agent'}</span>
          {by.turn_index != null && ` — step ${by.turn_index}`}
        </span>
        <Link
          to={`/runs?run=${by.execution_id}`}
          className="ml-auto text-agent hover:underline"
        >
          Open that run
        </Link>
      </div>
      {by.task && <p className="text-[12px] text-foreground mb-1">Task: {by.task}</p>}
      {by.reasoning && (
        <div className="text-[12px] italic text-muted-foreground leading-relaxed">
          <MarkdownMessage content={by.reasoning} variant="compact" />
        </div>
      )}
    </div>
  );
}

/**
 * What the run cost, and what it was made of.
 *
 * The delegated total is shown as a separate figure rather than folded in: an
 * orchestrator's own spend is usually a rounding error beside its workers', so
 * one blended number would hide which of the two you are reading.
 */
function RunCostSummary({ detail }: { detail: import('../api').ExecutionDetail }) {
  const unpriced = detail.cost_source === 'unpriced';
  const delegated = detail.delegated_run_count > 0;

  return (
    <div className="flex items-center gap-2 text-[12px] text-muted-foreground flex-wrap">
      <Coins className="w-3.5 h-3.5 shrink-0" />
      <span title={describeCost(detail.cost_usd, detail.cost_source, detail)}>
        {unpriced ? (
          /* Never a number here: no price on record is not the same as free. */
          <>Cost unknown — no price on record for this model</>
        ) : (
          <>
            <span className="font-semibold text-foreground">
              {formatCost(detail.cost_usd, detail.cost_source)}
            </span>
            {detail.cost_source === 'estimated' && ' estimated'}
            {detail.cost_source === 'billed' && ' charged'}
          </>
        )}
      </span>
      {!unpriced && (
        <span className="tabular-nums">
          · {detail.input_tokens.toLocaleString()} in
          {detail.cached_read_tokens > 0 && (
            <> ({detail.cached_read_tokens.toLocaleString()} cached)</>
          )}
          {' '}· {detail.output_tokens.toLocaleString()} out
        </span>
      )}
      {delegated && (
        <span title={describeCost(detail.cost_usd_total, detail.cost_source_total)}>
          · with {detail.delegated_run_count} delegated{' '}
          <span className="font-semibold text-foreground">
            {formatCost(detail.cost_usd_total, detail.cost_source_total)}
          </span>
        </span>
      )}
    </div>
  );
}

/** Everything inside one run: how it was configured, who asked for it, and the
 *  loop it actually ran. */
function RunActions({ detail }: { detail: import('../api').ExecutionDetail }) {
  const saveAsCase = async () => {
    try {
      const c = await evalsService.caseFromRun({ execution_id: detail.execution_id });
      window.location.href = `/evals?case=${c.id}`;
    } catch {
      // toast is overkill for a best-effort bridge; the console carries it.
      console.warn('Could not save run as eval case');
    }
  };
  return (
    <div className="flex items-center gap-3">
      <FeedbackControl
        target="execution"
        id={detail.execution_id}
        initial={(detail as { feedback?: { rating: number; reason: string; comment: string } | null }).feedback ?? null}
      />
      <button
        onClick={saveAsCase}
        className="text-[12px] px-2 py-1 rounded border border-border hover:bg-secondary"
        title="Save this run as an eval case for the same agent"
      >
        Save as eval case
      </button>
    </div>
  );
}

function RunDetail({ detail }: { detail: import('../api').ExecutionDetail }) {
  // One scale across the whole run, so a bar means the same thing in every
  // turn. Scaling per turn would make a 20ms call in a fast turn look as
  // expensive as a 4s call in a slow one.
  const allSteps = [
    ...detail.turns.flatMap((t) => t.steps),
    ...detail.unattributed_steps,
  ];
  const slowest = Math.max(1, ...allSteps.map((s) => s.duration_ms || 0));

  return (
    <div className="space-y-3">
      {detail.delegated_by && (
        <OrchestratorBanner detail={{ delegated_by: detail.delegated_by }} />
      )}

      <RunActions detail={detail} />

      <RunCostSummary detail={detail} />

      {/* The plan the run worked to, and anything it drew. Both live on
          `output_data` because a run's metadata dies with the graph — without
          this, an agent that charted its findings produced something no reader
          could ever see, and a run that reported blocked steps reported them
          only to itself. */}
      {Array.isArray(detail.output_data?.todos) &&
        (detail.output_data.todos as TodoItem[]).length > 0 &&
        !Array.isArray(detail.output_data?.tasks) && (
          <TodoPanel todos={detail.output_data.todos as TodoItem[]} />
        )}

      {/* A team run redraws its panel after the fact from `output_data.tasks`
          — the lanes, owners and final states, read-only. Runs that never
          dispatched keep the inline todo list above. */}
      {Array.isArray(detail.output_data?.tasks) &&
        (detail.output_data.tasks as unknown[]).length > 0 && (() => {
          const replay = planFromOutput(detail.output_data);
          return (
            <PlanPanel
              todos={(detail.output_data.todos as TodoItem[]) ?? []}
              tasks={replay.tasks}
              leases={[]}
              changes={[]}
              readOnly
            />
          );
        })()}

      {Array.isArray(detail.output_data?.files) && (
        <FileCards files={detail.output_data.files as FileCardData[]} />
      )}

      {Array.isArray(detail.output_data?.charts) &&
        (detail.output_data.charts as ChartSpec[]).map((chart, i) => (
          <ChartArtifact key={`run-chart-${i}`} chart={chart} />
        ))}

      {detail.revision && (
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Settings2 className="w-3.5 h-3.5 shrink-0" />
          <span>
            Ran on configuration <span className="font-semibold">v{detail.revision.number}</span>
            {detail.revision.summary && ` — ${detail.revision.summary}`}
          </span>
        </div>
      )}

      {detail.turns.length > 0 ? (
        <div className="space-y-3">
          {detail.turns.map((turn) => (
            <Turn key={turn.index} turn={turn} slowest={slowest} />
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          No steps recorded for this run.
        </p>
      )}

      {/* Steps whose turn is missing — a run older than turn tracking, or a
          write that failed. The agent still did the work, so it still shows. */}
      {detail.unattributed_steps.length > 0 && (
        <div>
          <p className="text-[12px] text-muted-foreground mb-1">
            Other steps
          </p>
          {detail.unattributed_steps.map((step) => (
            <Step key={step.id} step={step} slowest={slowest} />
          ))}
        </div>
      )}

      {detail.steps_truncated && (
        <p className="text-[12px] italic text-muted-foreground">
          Showing the first {allSteps.length} of {detail.step_total} steps.
        </p>
      )}
    </div>
  );
}

export default function Runs() {
  const [filter, setFilter] = usePersistedState<(typeof FILTERS)[number]>('runs.filter', 'all', {
    validate: (v): v is (typeof FILTERS)[number] => FILTERS.includes(v as never),
  });
  const [showEval, setShowEval] = usePersistedState<boolean>('runs.showEval', false);
  // The approval queue above the list: the only state that costs time while
  // producing nothing. Same query (and timer) the nav badge reads.
  const queryClient = useQueryClient();
  const { data: pending = [] } = useHitlPending();
  // The open run lives in the URL (`?run=<id>`), so a run can be linked to.
  // "Open that run" on a delegated run and the builder's Run button both link
  // here, and the id used to be dropped on arrival: the page opened with
  // nothing expanded and the user had to find the run by eye.
  // The selected approval lives in the URL (`?request=<id>`) next to `?run=`:
  // a notification's "Open" selects the request it is about instead of
  // dropping the user on the queue top. Read from `useSearchParams` directly
  // rather than mirrored into state — the two sync effects that kept a copy
  // chased each other and tripped the set-state-in-effect rule. Adopted and
  // published with `replace` so following a link never spams history.
  const [params, setParams] = useSearchParams();
  const openId = params.get('run');
  const selectedId = params.get('request');
  const setSelectedId = (id: string | null) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set('request', id);
      else next.delete('request');
      return next;
    }, { replace: true });
  };
  const respond = useMutation({
    mutationFn: ({ id, action, response }: { id: string; action: HITLResponse['action']; response?: string }) =>
      orchestratorService.respondToHITL(id, { action, response }),
    onSuccess: () => {
      toast.success('Response sent');
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ['hitl'] });
      queryClient.invalidateQueries({ queryKey: ['nav'] });
      queryClient.invalidateQueries({ queryKey: ['runs'] });
    },
    onError: () => toast.error('Could not send that response'),
  });
  const oldestWait = pending.length
    ? pending.reduce((a, b) => (a.created_at < b.created_at ? a : b))
    : null;
  const selected = pending.find((r) => r.request_id === selectedId) ?? pending[0] ?? null;
  const setOpenId = (id: string | null) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set('run', id);
      else next.delete('run');
      return next;
    }, { replace: true });
  };

  // One agent's runs, from `?agent=<id>` — the builder and Insights link here
  // with it. `?status=` / `?failure_category=` arrive the same way from the
  // Insights "What to fix" card, so a linked failure list opens filtered
  // rather than as "All runs" the user must re-filter by eye.
  const agentFilter = Number(params.get('agent')) || null;
  const urlStatus = params.get('status');
  const urlFailure = params.get('failure_category');
  const effectiveFilter = (FILTERS as readonly string[]).includes(urlStatus ?? '')
    ? (urlStatus as (typeof FILTERS)[number])
    : filter;
  const { data, isLoading } = useQuery({
    queryKey: ['runs', effectiveFilter, agentFilter, urlFailure, showEval],
    queryFn: () => logsService.listExecutions({
      limit: 50,
      ...(effectiveFilter === 'all' ? {} : { status: effectiveFilter }),
      ...(agentFilter ? { workflow_id: agentFilter } : {}),
      ...(urlFailure ? { failure_category: urlFailure } : {}),
      ...(showEval ? { caller: 'eval' } : {}),
    }),
    // Only poll while something can still change. A finished list is finished:
    // new runs arrive from a user action or a schedule, and window focus
    // revalidates on return, so an idle tab does not need a timer at all.
    refetchInterval: (q) =>
      (q.state.data?.results ?? []).some((r) => r.status === 'running' || r.status === 'pending')
        ? 10_000
        : false,
  });
  const runs: ExecutionLog[] = data?.results ?? [];

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['run', openId],
    enabled: !!openId,
    queryFn: () => logsService.getExecution(openId!),
    // A run opened from the Run button is seconds old; without this its
    // detail was a snapshot of the first step and never moved.
    // With the socket up, frames drive refreshes (`useLiveRun`) and this is
    // only a slow safety net; without it, this is how the run stays current.
    refetchInterval: (q) =>
      LIVE_STATUSES.has(q.state.data?.status ?? '') ? (liveSocket ? 30_000 : 5_000) : false,
  });
  const { isConnected: liveSocket } = useLiveRun(
    openId, LIVE_STATUSES.has(detail?.status ?? ''),
  );
  // A linked run the current filter hides (or that is older than the list's
  // 50) still has to be shown, or following a link opens nothing.
  const linkedRunHidden = !!openId && !isLoading
    && !runs.some((r) => r.execution_id === openId);

  return (
    <FilePreviewProvider>
    <div className="h-full flex flex-col">
      <PageHeader
        icon={Activity}
        title="Activity"
        subtitle={
          pending.length
            ? `${pending.length} need${pending.length === 1 ? 's' : ''} you · ${runs.length} recent execution${runs.length === 1 ? '' : 's'}`
            : `${runs.length} recent execution${runs.length === 1 ? '' : 's'}`
        }
      >
        <div className="flex gap-2 items-center flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 text-sm rounded border transition-colors first-letter:uppercase',
                filter === f
                  ? 'bg-primary text-primary-foreground border-primary font-semibold'
                  : 'bg-card border-border hover:bg-secondary'
              )}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
          <label className="ml-2 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showEval}
              onChange={(e) => setShowEval(e.target.checked)}
              className="accent-current"
            />
            Show evaluation runs
          </label>
          {agentFilter && (
            <button
              onClick={() => setParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete('agent');
                return next;
              }, { replace: true })}
              title="Show every agent's runs"
              className="px-3 py-1.5 text-sm rounded border border-primary text-primary bg-primary/10"
            >
              {runs[0]?.workflow_name ?? 'One agent'} ×
            </button>
          )}
          {urlFailure && (
            <button
              onClick={() => setParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete('failure_category');
                return next;
              }, { replace: true })}
              title="Clear failure filter"
              className="px-3 py-1.5 text-sm rounded border border-primary text-primary bg-primary/10"
            >
              {urlFailure.replace('_', ' ')} ×
            </button>
          )}
          {urlStatus && (FILTERS as readonly string[]).includes(urlStatus) && urlStatus !== filter && (
            <button
              onClick={() => {
                setFilter(urlStatus as (typeof FILTERS)[number]);
                setParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.delete('status');
                  return next;
                }, { replace: true });
              }}
              title="Apply linked status as filter"
              className="px-3 py-1.5 text-sm rounded border border-primary text-primary bg-primary/10"
            >
              {urlStatus} ×
            </button>
          )}
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {/* Blocked work first: a run waiting on an approval is the only
            state that costs time while producing nothing. Rendered only
            when something is actually waiting — the nav badge carries the
            count the rest of the time. */}
        {pending.length > 0 && (
          <section className="mb-4 border border-primary-line bg-card rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-primary-subtle">
              <Hand className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-primary">
                {pending.length} {pending.length === 1 ? 'request needs' : 'requests need'} your attention
              </h2>
              {oldestWait && (
                <span className="text-[12px] text-primary/80">· longest {waitedFor(oldestWait.created_at)}</span>
              )}
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
                        choice and the action it posts — reading the action
                        off the button's position was a guess that held only
                        for the two-button case. */}
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
        )}
        {linkedRunHidden && (
          <div className="mb-4 border border-primary/40 rounded bg-card">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <span className="font-medium text-sm flex-1 truncate">
                {detail?.workflow_name ?? 'Linked run'}
              </span>
              {detail && <StatusPill status={detail.status} />}
              <button onClick={() => setOpenId(null)}
                className="text-[12px] text-muted-foreground hover:text-foreground">
                Close
              </button>
            </div>
            <div className="px-4 py-4 bg-bg-1">
              {detailLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : detail ? (
                <>
                  {detail.error_message && (
                    <div className="mb-3 px-3 py-2 rounded bg-destructive-subtle border border-red-200 text-[13px] text-destructive">
                      {detail.error_message}
                    </div>
                  )}
                  <>
                  {LIVE_STATUSES.has(detail.status) && (
                    <RunControls executionId={detail.execution_id}
                      agentId={detail.workflow_id ?? null} status={detail.status} />
                  )}
                  <RunDetail detail={detail} />
                </>
                </>
              ) : (
                <p className="text-[13px] text-muted-foreground">That run could not be found.</p>
              )}
            </div>
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-20">
            <h3 className="text-lg font-semibold mb-1">
              {pending.length > 0 ? 'No runs yet' : 'No activity yet'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {pending.length > 0
                ? 'Runs appear here as soon as they start, whether you started them or a schedule did.'
                : 'Once your agents run, they appear here — and when one reaches a step it isn\u2019t allowed to take on its own, it stops and asks at the top of this page.'}
            </p>
          </div>
        ) : (
          <div className="border border-border rounded overflow-hidden bg-card">
            {runs.map((run) => {
              const open = openId === run.execution_id;
              return (
                <div key={run.execution_id} className="border-b border-border last:border-b-0">
                  <button
                    onClick={() => setOpenId(open ? null : run.execution_id)}
                    className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-secondary transition-colors"
                  >
                    <ChevronRight className={cn('w-4 h-4 text-muted-foreground shrink-0 transition-transform', open && 'rotate-90')} />
                    <span className="font-medium text-sm flex-1 truncate">{run.workflow_name ?? 'Deleted agent'}</span>
                    {run.is_delegated && (
                      <GitBranch className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-label="Started by another agent" />
                    )}
                    <StatusPill status={run.status} />
                    <span className="text-[12px] text-muted-foreground w-24 text-right">{CALLER_LABELS[run.caller] ?? run.trigger_type}</span>
                    <span
                      className={cn(
                        'text-[12px] w-20 text-right tabular-nums',
                        run.cost_source === 'unpriced'
                          ? 'text-muted-foreground/50'
                          : 'text-muted-foreground',
                      )}
                      title={describeCost(run.cost_usd, run.cost_source, run)}
                    >
                      {formatCost(run.cost_usd, run.cost_source)}
                    </span>
                    <span className="text-[12px] text-muted-foreground w-16 text-right tabular-nums">{ms(run.duration_ms)}</span>
                    <span className="text-[12px] text-muted-foreground w-20 text-right">{when(run.created_at)}</span>
                  </button>

                  {open && (
                    <div className="px-4 pb-4 pl-12 bg-bg-1">
                      {run.error_message && (
                        <div className="mb-3 px-3 py-2 rounded bg-destructive-subtle border border-red-200 text-[13px] text-destructive">
                          {run.error_message}
                        </div>
                      )}
                      {detailLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : detail ? (
                        <>
                  {LIVE_STATUSES.has(detail.status) && (
                    <RunControls executionId={detail.execution_id}
                      agentId={detail.workflow_id ?? null} status={detail.status} />
                  )}
                  <RunDetail detail={detail} />
                </>
                      ) : (
                        <p className="text-[13px] text-muted-foreground">No details recorded for this run.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </FilePreviewProvider>
  );
}
