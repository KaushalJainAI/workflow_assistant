/**
 * Missions — long-horizon goals that wake, work and report back.
 *
 * Before this page the only way to start one was the `/goal` slash command
 * (and before that, only the model through `start_mission`). The list, the
 * pause/resume/cancel verbs and the create form all go through the existing
 * `api/missions.ts` — no new transport, so the wiring check covers it.
 * Creating mirrors the `/goal` confirm sheet: fill the goal, pick the agent
 * and the budget, review the summary, then start.
 */
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Check,
  ChevronDown,
  Clock,
  Loader2,
  Pause,
  Play,
  Plus,
  Target,
  X,
} from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { cn } from '../lib/utils';
import missionsService, { type Mission } from '../api/missions';
import agentsService from '../api/agents';

const STATUS_STYLE: Record<Mission['status'], string> = {
  active: 'border-agent-line bg-agent-subtle text-agent',
  waiting: 'border-primary-line bg-primary-subtle text-primary',
  paused: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  done: 'border-border bg-secondary text-muted-foreground',
  failed: 'border-destructive/40 bg-destructive/10 text-destructive',
  cancelled: 'border-border bg-secondary text-muted-foreground',
};

function MissionCard({
  mission,
  expanded,
  onToggle,
  onPause,
  onResume,
  onCancel,
  busy,
}: {
  mission: Mission;
  expanded: boolean;
  onToggle: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const live = mission.status === 'active' || mission.status === 'waiting' || mission.status === 'paused';
  const todos = mission.total_todos
    ? `${(mission.total_todos ?? 0) - (mission.open_todos ?? 0)}/${mission.total_todos} steps`
    : null;

  return (
    <div className="bg-card border border-border rounded flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        className="p-4 flex items-start gap-3 text-left w-full"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded border text-[11px] font-semibold capitalize',
                STATUS_STYLE[mission.status],
              )}
            >
              {mission.status}
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {mission.runs_done}/{mission.max_runs} runs · ₹{mission.spent_inr.toLocaleString('en-IN')} of ₹
              {mission.budget_inr.toLocaleString('en-IN')}
            </span>
            {todos && (
              <span className="text-[11px] text-muted-foreground tabular-nums">{todos}</span>
            )}
          </div>
          <p className="font-medium text-[14px] mt-1.5 leading-snug">{mission.goal}</p>
          {mission.next_wake_at && live && (
            <p className="text-[12px] text-muted-foreground mt-1 inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Next wake {new Date(mission.next_wake_at).toLocaleString()}
            </p>
          )}
        </div>
        <ChevronDown
          className={cn('w-4 h-4 text-muted-foreground shrink-0 mt-1 transition-transform', expanded && 'rotate-180')}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {mission.plan && mission.plan.length > 0 && (
            <ul className="space-y-1">
              {mission.plan.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px]">
                  {step.status === 'done' ? (
                    <Check className="w-3.5 h-3.5 mt-0.5 text-agent shrink-0" />
                  ) : (
                    <span className="w-3.5 h-3.5 mt-0.5 rounded-full border border-border shrink-0" />
                  )}
                  <span className={step.status === 'done' ? 'text-muted-foreground line-through' : ''}>
                    {step.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {mission.last_report && (
            <p className="text-[13px] text-muted-foreground leading-relaxed border-l-2 border-border pl-3">
              {mission.last_report}
            </p>
          )}
          {live && (
            <div className="flex flex-wrap gap-2 pt-1">
              {mission.status === 'paused' ? (
                <button
                  type="button"
                  onClick={onResume}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-card text-[12px] font-semibold hover:bg-secondary disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  Resume
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onPause}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-card text-[12px] font-semibold hover:bg-secondary disabled:opacity-50"
                >
                  <Pause className="w-3.5 h-3.5" />
                  Pause
                </button>
              )}
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-card text-[12px] font-semibold text-destructive hover:bg-secondary disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CreateMissionForm({ onCreated }: { onCreated: () => void }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState('');
  const [agentId, setAgentId] = useState('');
  const [budget, setBudget] = useState('500');
  const [deadlineDays, setDeadlineDays] = useState('7');
  const [confirming, setConfirming] = useState(false);

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: () => agentsService.list(),
    enabled: open,
    staleTime: 30 * 1000,
  });
  const agent = agents.find((a) => String(a.id) === agentId);

  const valid =
    goal.trim().length > 0 &&
    agentId !== '' &&
    Number(budget) > 0 &&
    Number(deadlineDays) > 0;

  const create = useMutation({
    mutationFn: () =>
      missionsService.create({
        goal: goal.trim(),
        agent_id: Number(agentId),
        budget_inr: Number(budget),
        deadline_days: Number(deadlineDays),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      toast.success('Mission started.');
      setOpen(false);
      setGoal('');
      setAgentId('');
      setConfirming(false);
      onCreated();
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      toast.error(detail || 'Could not start that mission.');
      setConfirming(false);
    },
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/90"
      >
        <Plus className="w-3.5 h-3.5" />
        New mission
      </button>
    );
  }

  return (
    <div className="rounded border border-border bg-card p-4 space-y-3">
      <label className="block">
        <span className="text-[12px] font-semibold text-muted-foreground">Goal</span>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="What should keep happening until it is done?"
          rows={2}
          className="mt-1 w-full px-3 py-2 bg-background border border-border rounded text-sm"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-[12px] font-semibold text-muted-foreground">Agent</span>
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="mt-1 w-full px-3 py-2 bg-background border border-border rounded text-sm"
          >
            <option value="">Choose…</option>
            {agents.map((a) => (
              <option key={a.id} value={String(a.id)}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[12px] font-semibold text-muted-foreground">Budget (₹)</span>
          <input
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            inputMode="numeric"
            className="mt-1 w-full px-3 py-2 bg-background border border-border rounded text-sm tabular-nums"
          />
        </label>
        <label className="block">
          <span className="text-[12px] font-semibold text-muted-foreground">Deadline (days)</span>
          <input
            value={deadlineDays}
            onChange={(e) => setDeadlineDays(e.target.value)}
            inputMode="numeric"
            className="mt-1 w-full px-3 py-2 bg-background border border-border rounded text-sm tabular-nums"
          />
        </label>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3 py-1.5 text-[12px] rounded border border-border hover:bg-secondary"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!valid}
          onClick={() => setConfirming(true)}
          className="px-3 py-1.5 text-[12px] rounded bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50"
        >
          Review
        </button>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Start this mission?"
          body={`${agent?.name ?? 'The agent'} will work toward "${goal.trim()}" with up to ₹${Number(budget).toLocaleString('en-IN')} over ${deadlineDays} days. It wakes on its own and reports back here.`}
          confirmLabel="Start mission"
          busy={create.isPending}
          onConfirm={() => create.mutate()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

export default function Missions() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState<Mission | null>(null);

  const { data: missions = [], isLoading, isError } = useQuery({
    queryKey: ['missions'],
    queryFn: missionsService.list,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['missions'] });
  };

  const act = useMutation({
    mutationFn: ({ mission, verb }: { mission: Mission; verb: 'pause' | 'resume' | 'cancel' }) => {
      if (verb === 'pause') return missionsService.pause(mission.id);
      if (verb === 'resume') return missionsService.resume(mission.id);
      return missionsService.cancel(mission.id);
    },
    onSuccess: (_data, { verb }) => {
      invalidate();
      setCancelling(null);
      toast.success(
        verb === 'pause' ? 'Mission paused.' : verb === 'resume' ? 'Mission resumed.' : 'Mission cancelled.',
      );
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      toast.error(detail || 'That did not work.');
      setCancelling(null);
    },
  });

  const live = useMemo(
    () => missions.filter((m) => m.status === 'active' || m.status === 'waiting' || m.status === 'paused'),
    [missions],
  );
  const done = useMemo(
    () => missions.filter((m) => !['active', 'waiting', 'paused'].includes(m.status)),
    [missions],
  );

  const subtitle = isLoading
    ? 'Loading…'
    : `${live.length} live · ${done.length} finished`;

  return (
    <div className="h-full flex flex-col">
      <PageHeader icon={Target} title="Missions" subtitle={subtitle} />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 max-w-3xl">
          <p className="text-[13px] text-muted-foreground leading-relaxed max-w-xl">
            Long-horizon goals: an agent wakes on its own, works a little, and
            reports back here until the goal is done or the budget runs out.
          </p>
          <CreateMissionForm onCreated={() => setExpandedId(null)} />
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        ) : isError ? (
          <p className="text-[13px] text-destructive py-12">
            Could not load missions. Reload the page to try again.
          </p>
        ) : missions.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border/60 rounded-lg bg-card/30 max-w-3xl">
            <Target className="w-6 h-6 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground font-medium">No missions yet</p>
            <p className="text-[12px] text-muted-foreground mt-1 max-w-sm mx-auto px-4">
              Start one above, or type /goal in chat — both arrive here.
            </p>
          </div>
        ) : (
          <div className="space-y-6 max-w-3xl">
            {live.length > 0 && (
              <section>
                <h2 className="font-semibold text-foreground text-[14px] mb-3">Live</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {live.map((m) => (
                    <MissionCard
                      key={m.id}
                      mission={m}
                      expanded={expandedId === m.id}
                      onToggle={() => setExpandedId((id) => (id === m.id ? null : m.id))}
                      onPause={() => act.mutate({ mission: m, verb: 'pause' })}
                      onResume={() => act.mutate({ mission: m, verb: 'resume' })}
                      onCancel={() => setCancelling(m)}
                      busy={act.isPending}
                    />
                  ))}
                </div>
              </section>
            )}
            {done.length > 0 && (
              <section>
                <h2 className="font-semibold text-foreground text-[14px] mb-3">Finished</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {done.map((m) => (
                    <MissionCard
                      key={m.id}
                      mission={m}
                      expanded={expandedId === m.id}
                      onToggle={() => setExpandedId((id) => (id === m.id ? null : m.id))}
                      onPause={() => act.mutate({ mission: m, verb: 'pause' })}
                      onResume={() => act.mutate({ mission: m, verb: 'resume' })}
                      onCancel={() => setCancelling(m)}
                      busy={act.isPending}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {cancelling && (
        <ConfirmDialog
          title="Cancel this mission?"
          body={`"${cancelling.goal}" stops for good. Past runs stay on Activity.`}
          confirmLabel="Cancel mission"
          busy={act.isPending}
          onConfirm={() => act.mutate({ mission: cancelling, verb: 'cancel' })}
          onCancel={() => setCancelling(null)}
        />
      )}
    </div>
  );
}
