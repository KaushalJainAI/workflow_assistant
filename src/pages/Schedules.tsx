/**
 * Schedules — what is set to run without you, and whether it actually is.
 *
 * This page used to be read-only: it listed triggers, toggled them, and deleted
 * them, but the only way to *make* a schedule was a bare cron textbox in the
 * agent builder, one per agent, evaluated in UTC. So the page that exists to
 * answer "what runs without me" could not answer "and make it run at seven"
 * without sending the user somewhere else to type five numbers in an order they
 * had to remember.
 *
 * It is now the place schedules are made. An agent may have several — a weekday
 * briefing and a Friday wrap-up are two schedules, not one cron expression
 * nobody can read — and each one carries the three things that make it
 * checkable: what it says in words, when it fires next, and what happened last
 * time it fired.
 *
 * The run-now button still goes through `sweep.fire`, the same path the
 * scheduler uses, and reports the sweep's own one-word outcome. A test button
 * that took a shortcut past the overlap policy and the unattended gate would
 * prove the button works and nothing else.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Clock,
  Copy,
  Globe,
  Loader2,
  Pencil,
  Play,
  Plus,
  Trash2,
  Webhook,
  X,
  Zap,
} from 'lucide-react';
import {
  triggersService,
  type FireOutcome,
  type Trigger,
} from '../api';
// `api/index.ts` does not re-export the agents service; the agent picker is the
// only thing on this page that needs it.
import agentsService from '../api/agents';
import { cn } from '../lib/utils';
import { apiErrorMessage } from '../lib/apiError';
import PageHeader from '../components/layout/PageHeader';
import Select from '../components/ui/Select';
import ScheduleEditor from '../components/schedules/ScheduleEditor';
import {
  emptyDraft,
  type ScheduleDraft,
} from '../components/schedules/scheduleDraft';

/**
 * What each sweep outcome means in words the user can act on. `fired` is the
 * only unambiguously good one; the rest each have a different fix, which is
 * exactly why the backend returns a word rather than a boolean.
 */
const OUTCOME_COPY: Record<FireOutcome, { label: string; hint: string; tone: string }> = {
  fired: {
    label: 'Started',
    hint: 'The run is under way — watch it on Runs.',
    tone: 'text-success',
  },
  queued: {
    label: 'Waiting its turn',
    hint: "Another run is in progress. This one will start when it's done.",
    tone: 'text-muted-foreground',
  },
  dropped: {
    label: 'Dropped — waited too long',
    hint: 'Queued for over 6 hours without the agent freeing up, so it was abandoned rather than delivered late.',
    tone: 'text-warning',
  },
  busy: {
    label: 'Skipped — already running',
    hint: 'It was skipped because another run was in progress and a previous run is still going.',
    tone: 'text-muted-foreground',
  },
  late: {
    label: 'Skipped — too late',
    hint: 'More than an hour past due, so it was re-armed for the next slot instead.',
    tone: 'text-muted-foreground',
  },
  waiting: {
    label: 'Not started yet',
    hint: 'Its start date is in the future. Nothing is wrong; it is simply not live.',
    tone: 'text-muted-foreground',
  },
  expired: {
    label: 'Ended',
    hint: 'Past its end date, so it switched itself off rather than staying armed for a run that will never come.',
    tone: 'text-muted-foreground',
  },
  stopped: {
    label: 'Stopped — no next run',
    hint: 'This schedule has no future dates. Check the days and months.',
    tone: 'text-destructive',
  },
  skipped: {
    label: 'Nothing to ask',
    hint: 'No instructions — add a goal to this schedule or a description to the agent.',
    tone: 'text-warning',
  },
  refused: {
    label: 'Blocked',
    hint: "Usually the spend cap, or automatic runs aren't allowed.",
    tone: 'text-destructive',
  },
  failed: {
    label: 'Failed to start',
    hint: 'something went wrong before it could begin.',
    tone: 'text-destructive',
  },
};

const MODE_COPY = {
  schedule: { icon: CalendarClock, label: 'Schedule' },
  webhook: { icon: Webhook, label: 'Webhook' },
  event: { icon: Zap, label: 'Event' },
} as const;

/** Relative time, past or future, in the coarsest unit that is still useful. */
function relative(iso: string | null): string {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - Date.now();
  const future = ms > 0;
  const abs = Math.abs(ms);
  const mins = Math.round(abs / 60_000);
  if (mins < 1) return future ? 'in under a minute' : 'just now';
  if (mins < 60) return future ? `in ${mins}m` : `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return future ? `in ${hrs}h` : `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return future ? `in ${days}d` : `${days}d ago`;
}

function absolute(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

function OutcomeBanner({ outcome }: { outcome: FireOutcome }) {
  const copy = OUTCOME_COPY[outcome];
  if (!copy) return null;
  return (
    <div className="mt-3 rounded-lg border border-border/60 bg-secondary/40 px-3 py-2">
      <p className={cn('text-[13px] font-semibold', copy.tone)}>{copy.label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{copy.hint}</p>
    </div>
  );
}

/** A trigger as the editor's draft, so opening one to edit is not a re-type. */
function draftOf(t: Trigger): ScheduleDraft {
  return {
    cron: t.schedule_cron || t.config?.cron || '',
    timezone: t.timezone || 'UTC',
    name: t.name || '',
    goal: t.goal || '',
    overlap: t.overlap,
    startsAt: t.starts_at,
    endsAt: t.ends_at,
  };
}

function ScheduleModal({
  trigger,
  agentId,
  agentAllowsUnattended,
  onClose,
}: {
  /** null when creating. */
  trigger: Trigger | null;
  agentId: number;
  agentAllowsUnattended: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<ScheduleDraft>(
    () => (trigger ? draftOf(trigger) : emptyDraft()),
  );
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        cron: draft.cron,
        timezone: draft.timezone,
        name: draft.name,
        goal: draft.goal,
        overlap: draft.overlap,
        starts_at: draft.startsAt,
        ends_at: draft.endsAt,
      };
      return trigger
        ? triggersService.update(trigger.id, payload)
        : triggersService.create({
          ...payload, subagent: agentId, mode: 'schedule',
        });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['triggers'] });
      onClose();
    },
    onError: (err: unknown) => {
      // The server's own words. Its validation is stricter than the form's —
      // it refuses an expression that never comes round, which no amount of
      // field-level checking here can catch. `apiErrorMessage` knows the DRF
      // field-error shape, so `{"cron": ["..."]}` reads as the sentence rather
      // than the fallback.
      setError(apiErrorMessage(err, 'Could not save this schedule.'));
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border/60 bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <h2 className="text-[15px] font-semibold">
            {trigger ? 'Edit schedule' : 'New schedule'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4">
          <ScheduleEditor
            value={draft}
            onChange={(next) => { setDraft(next); setError(''); }}
            agentAllowsUnattended={agentAllowsUnattended}
          />
        </div>

        {error && (
          <p className="flex items-start gap-1.5 border-t border-border/60 px-4 py-2 text-[12px] text-destructive">
            <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-border/60 px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || !draft.cron.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground disabled:opacity-50"
          >
            {save.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {trigger ? 'Save' : 'Create schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TriggerCard({ trigger, onEdit }: {
  trigger: Trigger; onEdit: () => void;
}) {
  const qc = useQueryClient();
  const [outcome, setOutcome] = useState<FireOutcome | null>(null);
  const [copied, setCopied] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['triggers'] });

  const runNow = useMutation({
    mutationFn: () => triggersService.runNow(trigger.id),
    onSuccess: (res) => {
      setOutcome(res.outcome);
      invalidate();
    },
  });

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => triggersService.update(trigger.id, { enabled }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: () => triggersService.remove(trigger.id),
    onSuccess: invalidate,
  });

  const mode = MODE_COPY[trigger.mode];
  const ModeIcon = mode.icon;
  const isSchedule = trigger.mode === 'schedule';

  // A trigger disables itself after five consecutive failures. Saying only
  // "disabled" would hide the reason, and the reason is the whole story.
  const selfDisabled = !trigger.enabled && trigger.consecutive_failures >= 5;
  const lastCopy = trigger.last_outcome ? OUTCOME_COPY[trigger.last_outcome] : null;

  const copyHook = async () => {
    if (!trigger.webhook_url) return;
    await navigator.clipboard.writeText(
      `${window.location.origin.replace(/\/$/, '')}${trigger.webhook_url}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn(
      'rounded-xl border border-border/60 bg-card p-4',
      !trigger.enabled && 'opacity-70',
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ModeIcon className="w-4 h-4 text-primary shrink-0" />
            <Link
              to={`/agents/${trigger.subagent}`}
              className="text-[14px] font-semibold truncate hover:underline"
            >
              {trigger.name || trigger.agent_name}
            </Link>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {mode.label}
            </span>
          </div>
          {trigger.name && (
            <p className="text-[12px] text-muted-foreground">{trigger.agent_name}</p>
          )}

          {/* The reading, not the syntax. The cron string is still shown, but
              second — it is the detail, not the headline. */}
          {trigger.description && (
            <p className="mt-1 text-[13px]">{trigger.description}</p>
          )}
          {isSchedule && (
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {trigger.schedule_cron || trigger.config?.cron}
            </p>
          )}
          {trigger.goal && (
            <p className="mt-1 text-[12px] text-muted-foreground line-clamp-2">
              {trigger.goal}
            </p>
          )}
        </div>

        <label className="flex items-center gap-2 shrink-0 cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={trigger.enabled}
            disabled={toggle.isPending}
            onChange={(e) => toggle.mutate(e.target.checked)}
          />
          <span className="w-9 h-5 rounded-full bg-secondary peer-checked:bg-primary transition-colors relative after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
        </label>
      </div>

      {isSchedule && (
        <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <p className="text-muted-foreground">Next due</p>
            <p className="font-medium flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {trigger.enabled ? relative(trigger.next_due_at) : 'paused'}
            </p>
            {trigger.enabled && trigger.upcoming[0] && (
              <p className="text-muted-foreground">{absolute(trigger.upcoming[0])}</p>
            )}
          </div>
          <div>
            <p className="text-muted-foreground">Last run</p>
            <p className="font-medium">{relative(trigger.last_fired_at)}</p>
            {lastCopy && (
              <p className={cn('truncate', lastCopy.tone)}>{lastCopy.label}</p>
            )}
          </div>
        </div>
      )}

      {isSchedule && trigger.timezone && trigger.timezone !== 'UTC' && (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Globe className="w-3 h-3" /> {trigger.timezone}
        </p>
      )}

      {trigger.queued_for && (
        <p className="mt-2 text-[12px] text-muted-foreground">
          A scheduled run from {absolute(trigger.queued_for)} is waiting for the current
          run to finish.
        </p>
      )}

      {trigger.webhook_url && (
        <button
          onClick={copyHook}
          className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy webhook URL'}
        </button>
      )}

      {/* The reason a run failed is stored on the row now, not only in a
          server log the user has no access to. */}
      {trigger.last_error && trigger.last_outcome !== 'fired' && (
        <p className="mt-3 rounded-lg border border-border/60 bg-secondary/40 px-3 py-2 text-[12px] text-muted-foreground">
          {trigger.last_error}
        </p>
      )}

      {!trigger.agent_allows_unattended && trigger.enabled && (
        <div className="mt-3 flex gap-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <p className="text-[12px] text-warning">
            <Link to={`/agents/${trigger.subagent}`} className="underline">
              {trigger.agent_name}
            </Link>{' '}
            can't run automatically, so every run is
            refused.
          </p>
        </div>
      )}

      {selfDisabled && (
        <div className="mt-3 flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-[12px] text-destructive">
            Disabled itself after {trigger.consecutive_failures} failures in a row.
            Re-enabling clears the count — but fix the cause first, or it will
            switch itself off again.
          </p>
        </div>
      )}
      {trigger.enabled && trigger.consecutive_failures > 0 && (
        <p className="mt-3 text-[12px] text-warning">
          {trigger.consecutive_failures} failure
          {trigger.consecutive_failures === 1 ? '' : 's'} in a row — disables itself at 5.
        </p>
      )}

      {outcome && <OutcomeBanner outcome={outcome} />}

      <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
        {isSchedule && (
          <button
            onClick={() => runNow.mutate()}
            disabled={runNow.isPending || !trigger.enabled}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground disabled:opacity-50"
          >
            {runNow.isPending
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <Play className="w-3 h-3" />}
            Run now
          </button>
        )}
        {isSchedule && (
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-[12px] hover:bg-secondary"
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>
        )}
        <button
          onClick={() => remove.mutate()}
          disabled={remove.isPending}
          className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] text-muted-foreground hover:text-destructive disabled:opacity-50"
        >
          <Trash2 className="w-3 h-3" />
          Delete
        </button>
      </div>
    </div>
  );
}

/** Picking which agent a new schedule belongs to. */
function AgentPicker({ onPick, onCancel }: {
  onPick: (id: number, allowsUnattended: boolean) => void;
  onCancel: () => void;
}) {
  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => agentsService.list(),
  });
  const [selected, setSelected] = useState('');

  const chosen = agents.find((a) => String(a.id) === selected);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border/60 bg-card p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[15px] font-semibold">Schedule which agent?</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          An agent can have as many schedules as you need.
        </p>

        <div className="mt-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading agents…
            </div>
          ) : agents.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              You have no agents yet. <Link to="/agents" className="underline">
                Make one first
              </Link>.
            </p>
          ) : (
            <Select
              value={selected}
              onChange={setSelected}
              options={agents.map((a) => ({
                value: String(a.id),
                label: a.name,
              }))}
              placeholder="Pick an agent…"
              showSearch
            />
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            disabled={!chosen}
            onClick={() => chosen && onPick(chosen.id, chosen.allowUnattended)}
            className="rounded-lg bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Schedules() {
  const { data: triggers = [], isLoading } = useQuery({
    queryKey: ['triggers'],
    queryFn: () => triggersService.list(),
    // The sweep runs every minute; anything much slower than this would show a
    // "next due" that has already passed.
    refetchInterval: 30_000,
  });

  // Three states rather than a boolean: picking an agent, editing a draft, or
  // closed. Creating needs an agent chosen first, editing already has one.
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<
    { trigger: Trigger | null; agentId: number; unattended: boolean } | null
  >(null);

  return (
    <div className="min-h-full bg-background">
      <PageHeader
        title="Schedules"
        subtitle="What runs without you, and whether it is actually running"
        icon={CalendarClock}
      />

      <div className="px-4 py-6 md:px-8">
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setPicking(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground"
          >
            <Plus className="w-4 h-4" />
            New schedule
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : triggers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-8 text-center">
            <CalendarClock className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium">Nothing is scheduled yet</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Pick an agent, choose when it should run, and check the next few
              dates before you save. The agent also needs &ldquo;may run with
              nobody watching&rdquo; turned on — without it every run is
              refused.
            </p>
            <button
              onClick={() => setPicking(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground"
            >
              <Plus className="w-4 h-4" />
              New schedule
            </button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {triggers.map((t) => (
              <TriggerCard
                key={t.id}
                trigger={t}
                onEdit={() => setEditing({
                  trigger: t,
                  agentId: t.subagent,
                  unattended: t.agent_allows_unattended,
                })}
              />
            ))}
          </div>
        )}
      </div>

      {picking && (
        <AgentPicker
          onCancel={() => setPicking(false)}
          onPick={(agentId, unattended) => {
            setPicking(false);
            setEditing({ trigger: null, agentId, unattended });
          }}
        />
      )}

      {editing && (
        <ScheduleModal
          trigger={editing.trigger}
          agentId={editing.agentId}
          agentAllowsUnattended={editing.unattended}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
