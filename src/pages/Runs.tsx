/**
 * Runs — every execution, and what happened inside one.
 *
 * The trace is the point: per-node status, duration bars and the agent's own
 * narrative, so you can answer "why did it do that?" without reading logs.
 * `/executions` used to redirect to `/workflows`, so none of this was reachable.
 */
import { useState } from 'react';
import { usePersistedState } from '../hooks/usePersistedState';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  CircleSlash,
  Clock,
  Radio,
  ChevronRight,
} from 'lucide-react';
import { logsService, type ExecutionLog, type NodeLog } from '../api';
import { cn } from '../lib/utils';
import PageHeader from '../components/layout/PageHeader';

const statusConfig = {
  completed: { icon: CheckCircle2, cls: 'text-success', bg: 'bg-success-subtle', label: 'Succeeded' },
  failed: { icon: XCircle, cls: 'text-destructive', bg: 'bg-destructive-subtle', label: 'Failed' },
  running: { icon: Loader2, cls: 'text-agent', bg: 'bg-agent-subtle', label: 'Running', spin: true },
  pending: { icon: Clock, cls: 'text-muted-foreground', bg: 'bg-secondary', label: 'Queued' },
  cancelled: { icon: CircleSlash, cls: 'text-muted-foreground', bg: 'bg-secondary', label: 'Cancelled' },
} as const;

const FILTERS = ['all', 'completed', 'failed', 'running'] as const;

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

/** Duration bars are laid out against the slowest node, so the hot spot is obvious. */
function Trace({ nodes }: { nodes: NodeLog[] }) {
  const slowest = Math.max(1, ...nodes.map((n) => n.duration_ms || 0));
  return (
    <div className="space-y-1">
      {nodes.map((n) => {
        const cfg = statusConfig[n.status as keyof typeof statusConfig] ?? statusConfig.pending;
        return (
          <div key={n.id} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-secondary">
            <cfg.icon className={cn('w-4 h-4 shrink-0', cfg.cls, 'spin' in cfg && cfg.spin && 'animate-spin')} />
            <span className="text-[13px] w-48 truncate">{n.node_name || n.node_id}</span>
            <span className="text-[11px] text-muted-foreground w-24 truncate">{n.node_type}</span>
            <div className="flex-1 h-1.5 bg-secondary rounded overflow-hidden">
              {/* block, not inline — an inline element ignores width/height */}
              <span
                className={cn('block h-full rounded', n.status === 'failed' ? 'bg-destructive' : 'bg-agent')}
                style={{ width: `${Math.max(2, ((n.duration_ms || 0) / slowest) * 100)}%` }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground w-14 text-right tabular-nums">
              {ms(n.duration_ms)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function Runs() {
  const [filter, setFilter] = usePersistedState<(typeof FILTERS)[number]>('runs.filter', 'all', {
    validate: (v): v is (typeof FILTERS)[number] => FILTERS.includes(v as never),
  });
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['runs', filter],
    queryFn: () => logsService.listExecutions(filter === 'all' ? { limit: 50 } : { status: filter, limit: 50 }),
    refetchInterval: 20_000,
  });
  const runs: ExecutionLog[] = data?.results ?? [];

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['run', openId],
    enabled: !!openId,
    queryFn: () => logsService.getExecution(openId!),
  });

  const { data: narrative } = useQuery({
    queryKey: ['run-narrative', openId],
    enabled: !!openId,
    queryFn: () => logsService.getNarrative(openId!).catch(() => null),
  });

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        icon={Activity}
        title="Runs"
        subtitle={`${runs.length} recent execution${runs.length === 1 ? '' : 's'}`}
        actions={
          <Link
            to="/orchestrator"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-border hover:bg-secondary"
          >
            <Radio className="w-4 h-4 text-agent" />
            Live monitor
          </Link>
        }
      >
        <div className="flex gap-2">
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
              {f === 'all' ? 'All runs' : f}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-20">
            <h3 className="text-lg font-semibold mb-1">No runs yet</h3>
            <p className="text-sm text-muted-foreground">
              Executions appear here the moment a workflow starts, whether you triggered it or a schedule did.
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
                    <span className="font-medium text-sm flex-1 truncate">{run.workflow_name}</span>
                    <StatusPill status={run.status} />
                    <span className="text-[12px] text-muted-foreground w-20 text-right">{run.trigger_type}</span>
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
                      {narrative && (
                        <p className="text-[13px] leading-relaxed text-foreground mb-3 border-l-2 border-agent-line pl-3">
                          {typeof narrative === 'string' ? narrative : JSON.stringify(narrative)}
                        </p>
                      )}
                      {detailLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : detail?.node_logs?.length ? (
                        <Trace nodes={detail.node_logs} />
                      ) : (
                        <p className="text-[13px] text-muted-foreground">No step detail recorded for this run.</p>
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
  );
}
