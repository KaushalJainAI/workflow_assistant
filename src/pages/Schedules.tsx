/**
 * Schedules — what is set to run without you, and whether it actually is.
 *
 * The backend has had a full trigger surface since triggers shipped, and this
 * app never called it. So a schedule could be set on an agent and then vanish:
 * no list of what was armed, no next-due time, no sign that a trigger had
 * disabled itself after five consecutive failures. For a feature whose entire
 * promise is "it runs while you are not looking", having nowhere to look is
 * the gap that matters most.
 *
 * The run-now button goes through `sweep.fire`, the same path the scheduler
 * uses, and reports the sweep's own one-word outcome. A test button that took
 * a shortcut past the overlap policy and the unattended gate would prove the
 * button works and nothing else.
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
  Loader2,
  Play,
  Trash2,
  Webhook,
  Zap,
} from 'lucide-react';
import {
  triggersService,
  type FireOutcome,
  type Trigger,
} from '../api';
import { cn } from '../lib/utils';
import PageHeader from '../components/layout/PageHeader';

/**
 * What each sweep outcome means in words the user can act on. `fired` is the
 * only unambiguously good one; the rest each have a different fix, which is
 * exactly why the backend returns six words rather than a boolean.
 */
const OUTCOME_COPY: Record<FireOutcome, { label: string; hint: string; tone: string }> = {
  fired: {
    label: 'Started',
    hint: 'The run is under way — watch it on Runs.',
    tone: 'text-success',
  },
  busy: {
    label: 'Skipped — already running',
    hint: 'Its overlap policy is "skip" and a previous run is still going.',
    tone: 'text-muted-foreground',
  },
  late: {
    label: 'Skipped — too late',
    hint: 'More than an hour past due, so it was re-armed for the next slot instead.',
    tone: 'text-muted-foreground',
  },
  skipped: {
    label: 'Nothing to ask',
    hint: 'This trigger has no goal and its agent has no brief, so there is no instruction to run.',
    tone: 'text-warning',
  },
  refused: {
    label: 'Refused by a guardrail',
    hint: 'Usually the spend cap, or the agent is not cleared to run unattended.',
    tone: 'text-destructive',
  },
  failed: {
    label: 'Failed to start',
    hint: 'Something broke before the first model call. Check the server log.',
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

function OutcomeBanner({ outcome }: { outcome: FireOutcome }) {
  const copy = OUTCOME_COPY[outcome];
  return (
    <div className="mt-3 rounded-lg border border-border/60 bg-secondary/40 px-3 py-2">
      <p className={cn('text-[13px] font-semibold', copy.tone)}>{copy.label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{copy.hint}</p>
    </div>
  );
}

function TriggerCard({ trigger }: { trigger: Trigger }) {
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
  const cron = trigger.config?.cron ?? '';

  // A trigger disables itself after five consecutive failures. Saying only
  // "disabled" would hide the reason, and the reason is the whole story.
  const selfDisabled = !trigger.enabled && trigger.consecutive_failures >= 5;

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
              {trigger.agent_name}
            </Link>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {mode.label}
            </span>
          </div>

          {cron && (
            <p className="mt-1 font-mono text-[12px] text-muted-foreground">
              {cron} <span className="font-sans">· UTC</span>
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

      {trigger.mode === 'schedule' && (
        <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <p className="text-muted-foreground">Next due</p>
            <p className="font-medium flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {trigger.enabled ? relative(trigger.next_due_at) : 'paused'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Last fired</p>
            <p className="font-medium">{relative(trigger.last_fired_at)}</p>
          </div>
        </div>
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
        {trigger.mode === 'schedule' && (
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

export default function Schedules() {
  const { data: triggers = [], isLoading } = useQuery({
    queryKey: ['triggers'],
    queryFn: triggersService.list,
    // The sweep runs every minute; anything much slower than this would show a
    // "next due" that has already passed.
    refetchInterval: 30_000,
  });

  return (
    <div className="min-h-full bg-background">
      <PageHeader
        title="Schedules"
        subtitle="What runs without you, and whether it is actually running"
        icon={CalendarClock}
      />

      <div className="px-4 py-6 md:px-8">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : triggers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-8 text-center">
            <CalendarClock className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium">Nothing is scheduled yet</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Give an agent a schedule in its builder, and tick &ldquo;may run with
              nobody watching&rdquo;. Without that second setting every firing is
              refused.
            </p>
            <Link
              to="/agents"
              className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground"
            >
              Go to agents
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {triggers.map((t) => <TriggerCard key={t.id} trigger={t} />)}
          </div>
        )}
      </div>
    </div>
  );
}
