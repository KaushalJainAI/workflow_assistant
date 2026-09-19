/**
 * Runs — every execution, and what the agent was thinking inside one.
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
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  CircleSlash,
  Clock,
  Radar,
  ChevronRight,
  Brain,
  CornerDownRight,
  GitBranch,
  Settings2,
  Coins,
  Hand,
} from 'lucide-react';
import {
  logsService,
  type AgentStep,
  type AgentTurn,
  type ExecutionLog,
} from '../api';
import { cn } from '../lib/utils';
import { describeCost, formatCost } from '../lib/cost';
import PageHeader from '../components/layout/PageHeader';
import MarkdownMessage from '../components/chat/MarkdownMessage';
import ChartArtifact from '../components/chat/ChartArtifact';
import TodoPanel from '../components/chat/TodoPanel';
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
        (detail.output_data.todos as TodoItem[]).length > 0 && (
          <TodoPanel todos={detail.output_data.todos as TodoItem[]} />
        )}

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
  // The open run lives in the URL (`?run=<id>`), so a run can be linked to.
  // "Open that run" on a delegated run and the builder's Run button both link
  // here, and the id used to be dropped on arrival: the page opened with
  // nothing expanded and the user had to find the run by eye.
  const [params, setParams] = useSearchParams();
  const openId = params.get('run');
  const setOpenId = (id: string | null) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set('run', id);
      else next.delete('run');
      return next;
    }, { replace: true });
  };

  // One agent's runs, from `?agent=<id>` — the builder links here with it.
  const agentFilter = Number(params.get('agent')) || null;
  const { data, isLoading } = useQuery({
    queryKey: ['runs', filter, agentFilter, showEval],
    queryFn: () => logsService.listExecutions({
      limit: 50,
      ...(filter === 'all' ? {} : { status: filter }),
      ...(agentFilter ? { workflow_id: agentFilter } : {}),
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
        title="Runs"
        subtitle={`${runs.length} recent execution${runs.length === 1 ? '' : 's'}`}
        actions={
          <Link
            to="/overview"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-border hover:bg-secondary"
          >
            <Radar className="w-4 h-4 text-agent" />
            Overview
          </Link>
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
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
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
            <h3 className="text-lg font-semibold mb-1">No runs yet</h3>
            <p className="text-sm text-muted-foreground">
              Runs appear here as soon as they start, whether you started them or a schedule did.
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
