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
 *
 * It is also where **webhooks** are made. That half of the trigger model has
 * been complete on the server since triggers shipped — a secret-in-path
 * receiver, refusals that are indistinguishable from outside, a capped body
 * added as context and never as the instruction — and no screen could create
 * one, so the whole feature was reachable only from curl. This page's creation
 * path hardcoded `mode: 'schedule'` while its cards already rendered a *Copy
 * webhook URL* button for a row nothing could produce.
 *
 * A webhook is offered fewer controls than a schedule, deliberately: the
 * receiver calls `start_agent_run` directly, so it never reads `overlap`,
 * `timezone` or the live window, and offering those would be four more
 * switches that move nothing. What it gets instead is the one thing a schedule
 * does not need — a URL that is the only credential, and therefore a way to
 * replace it when it leaks. See `Backend/docs/WEBHOOK_TRIGGERS.md`.
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
  KeyRound,
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
  type TriggerMode,
} from '../api';
// `api/index.ts` does not re-export the agents service; the agent picker is the
// only thing on this page that needs it.
import agentsService from '../api/agents';
import { cn } from '../lib/utils';
import { apiErrorMessage } from '../lib/apiError';
import PageHeader from '../components/layout/PageHeader';
import Select from '../components/ui/Select';
import ScheduleEditor from '../components/schedules/ScheduleEditor';
import WebhookEditor from '../components/schedules/WebhookEditor';
import {
  emptyDraft,
  type ScheduleDraft,
} from '../components/schedules/scheduleDraft';
import {
  emptyWebhookDraft,
  type WebhookDraft,
} from '../components/schedules/webhookDraft';
import { absoluteHookUrl, curlFor } from '../lib/webhooks';

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

/** A webhook trigger as its own editor's draft. */
function webhookDraftOf(t: Trigger): WebhookDraft {
  return { name: t.name || '', goal: t.goal || '' };
}

/**
 * One modal, two forms. Which one is decided by `mode`, and the payloads are
 * genuinely different shapes — a schedule PATCHes a cron, a zone, an overlap
 * policy and a window; a webhook PATCHes a name and a goal, because those are
 * the only two fields anything on its path reads.
 */
function TriggerModal({
  trigger,
  mode,
  agentId,
  agentAllowsUnattended,
  agentHasPrompt,
  onClose,
}: {
  /** null when creating. */
  trigger: Trigger | null;
  mode: TriggerMode;
  agentId: number;
  agentAllowsUnattended: boolean;
  agentHasPrompt: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isWebhook = mode === 'webhook';
  const [draft, setDraft] = useState<ScheduleDraft>(
    () => (trigger && !isWebhook ? draftOf(trigger) : emptyDraft()),
  );
  const [hook, setHook] = useState<WebhookDraft>(
    () => (trigger && isWebhook ? webhookDraftOf(trigger) : emptyWebhookDraft()),
  );
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: async () => {
      const payload = isWebhook
        ? { name: hook.name, goal: hook.goal }
        : {
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
        : triggersService.create({ ...payload, subagent: agentId, mode });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['triggers'] });
      onClose();
    },
    onError: (err: unknown) => {
      // The server's own words. Its validation is stricter than the form's —
      // it refuses an expression that never comes round, and a webhook with
      // nothing to ask, neither of which field-level checking here can catch.
      // `apiErrorMessage` knows the DRF field-error shape, so `{"cron": ["..."]}`
      // reads as the sentence rather than the fallback.
      setError(apiErrorMessage(err, 'Could not save this trigger.'));
    },
  });

  // A schedule with no cron cannot be saved; a webhook whose agent is silent
  // needs a goal, which is the server's rule stated before the round trip.
  const incomplete = isWebhook
    ? (!agentHasPrompt && !hook.goal.trim())
    : !draft.cron.trim();

  const title = trigger
    ? (isWebhook ? 'Edit webhook' : 'Edit schedule')
    : (isWebhook ? 'New webhook' : 'New schedule');

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
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4">
          {isWebhook ? (
            <>
              <WebhookEditor
                value={hook}
                onChange={(next) => { setHook(next); setError(''); }}
                agentAllowsUnattended={agentAllowsUnattended}
                agentHasPrompt={agentHasPrompt}
              />
              {!trigger && (
                <p className="mt-4 text-[12px] text-muted-foreground">
                  The URL is generated when you save, and shown on the card. It is
                  the only credential &mdash; anyone who has it can start a run.
                </p>
              )}
            </>
          ) : (
            <ScheduleEditor
              value={draft}
              onChange={(next) => { setDraft(next); setError(''); }}
              agentAllowsUnattended={agentAllowsUnattended}
            />
          )}
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
            disabled={save.isPending || incomplete}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground disabled:opacity-50"
          >
            {save.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {trigger ? 'Save' : (isWebhook ? 'Create webhook' : 'Create schedule')}
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
  // Two copy buttons, so one flag would flash the wrong tick.
  const [copied, setCopied] = useState<'url' | 'curl' | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);

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

  // Rotation is instant and there is no grace period: a leaked credential that
  // keeps working for an hour is a leaked credential. So it is confirmed
  // first — every caller pointed at the old URL breaks the moment it lands.
  const rotate = useMutation({
    mutationFn: () => triggersService.rotateSecret(trigger.id),
    onSuccess: () => { setConfirmRotate(false); invalidate(); },
  });

  const mode = MODE_COPY[trigger.mode];
  const ModeIcon = mode.icon;
  const isSchedule = trigger.mode === 'schedule';
  const isWebhook = trigger.mode === 'webhook';
  const hookUrl = absoluteHookUrl(trigger.webhook_url, window.location.origin);

  // A trigger disables itself after five consecutive failures. Saying only
  // "disabled" would hide the reason, and the reason is the whole story.
  const selfDisabled = !trigger.enabled && trigger.consecutive_failures >= 5;
  const lastCopy = trigger.last_outcome ? OUTCOME_COPY[trigger.last_outcome] : null;

  const copy = async (what: 'url' | 'curl') => {
    if (!hookUrl) return;
    await navigator.clipboard.writeText(what === 'url' ? hookUrl : curlFor(hookUrl));
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
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

      {isWebhook && hookUrl && (
        <div className="mt-3 rounded-lg border border-border/60 bg-secondary/40 p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            POST to this URL
          </p>
          {/* `break-all` because the secret is 48 hex characters with nowhere
              to wrap, and a card that grows a horizontal scrollbar hides it. */}
          <p className="mt-1 break-all font-mono text-[11px]">{hookUrl}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => copy('url')}
              className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
            >
              {copied === 'url'
                ? <Check className="w-3 h-3 text-success" />
                : <Copy className="w-3 h-3" />}
              {copied === 'url' ? 'Copied' : 'Copy URL'}
            </button>
            {/* Offered instead of a Run now button: `trigger_run_now` refuses
                non-schedules, because a test that skipped the public path
                would prove the button works and nothing else. */}
            <button
              onClick={() => copy('curl')}
              className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
            >
              {copied === 'curl'
                ? <Check className="w-3 h-3 text-success" />
                : <Copy className="w-3 h-3" />}
              {copied === 'curl' ? 'Copied' : 'Copy test request'}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            This URL is the only credential. Anyone who has it can start a run
            and spend your credits.
          </p>
        </div>
      )}

      {confirmRotate && (
        <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">
          <p className="text-[12px] text-destructive">
            A new URL is issued immediately and this one stops working. Anything
            already pointed at it will start getting 404s until you update it.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => rotate.mutate()}
              disabled={rotate.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1 text-[12px] font-medium text-destructive-foreground disabled:opacity-50"
            >
              {rotate.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
              Issue a new URL
            </button>
            <button
              onClick={() => setConfirmRotate(false)}
              className="rounded-lg px-2 py-1 text-[12px] text-muted-foreground hover:text-foreground"
            >
              Keep this one
            </button>
          </div>
        </div>
      )}

      {/* `last_outcome` is the sweep's vocabulary and the sweep never sees a
          webhook, so a hook reports only when it was last called. */}
      {isWebhook && (
        <p className="mt-3 text-[12px] text-muted-foreground">
          Last request: {trigger.last_fired_at ? relative(trigger.last_fired_at) : 'never'}
        </p>
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
        {trigger.mode !== 'event' && (
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-[12px] hover:bg-secondary"
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>
        )}
        {isWebhook && (
          <button
            onClick={() => setConfirmRotate(true)}
            disabled={rotate.isPending || confirmRotate}
            className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-[12px] hover:bg-secondary disabled:opacity-50"
            title="Issue a new URL and revoke this one"
          >
            <KeyRound className="w-3 h-3" />
            New URL
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

/** What a new trigger needs before there is a form to fill in: which agent, and
 *  which way it starts. Both in one step, because two modals to answer two
 *  questions is a wizard nobody asked for. */
function NewTriggerPicker({ onPick, onCancel }: {
  onPick: (choice: {
    mode: TriggerMode; agentId: number;
    allowsUnattended: boolean; hasPrompt: boolean;
  }) => void;
  onCancel: () => void;
}) {
  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => agentsService.list(),
  });
  const [selected, setSelected] = useState('');
  const [mode, setMode] = useState<TriggerMode>('schedule');

  const chosen = agents.find((a) => String(a.id) === selected);

  const MODES: { value: TriggerMode; label: string; hint: string; icon: typeof CalendarClock }[] = [
    {
      value: 'schedule', icon: CalendarClock, label: 'On a schedule',
      hint: 'Runs at times you choose, in your own timezone.',
    },
    {
      value: 'webhook', icon: Webhook, label: 'When something calls a URL',
      hint: 'Runs whenever another system POSTs to a secret URL.',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border/60 bg-card p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[15px] font-semibold">What should start a run?</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          An agent can have as many of each as you need.
        </p>

        <div className="mt-3 space-y-2">
          {MODES.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={cn(
                  'flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
                  mode === m.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border/60 hover:bg-secondary',
                )}
              >
                <Icon className={cn('mt-0.5 h-4 w-4 shrink-0',
                  mode === m.value ? 'text-primary' : 'text-muted-foreground')} />
                <span>
                  <span className="block text-[13px] font-medium">{m.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{m.hint}</span>
                </span>
              </button>
            );
          })}
        </div>

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
            onClick={() => chosen && onPick({
              mode,
              agentId: chosen.id,
              allowsUnattended: chosen.allowUnattended,
              // `brief` is the agent's own instruction — `SubAgent.prompt`.
              // A webhook with no goal falls back to it, so whether it is
              // blank decides whether the goal field is optional.
              hasPrompt: Boolean((chosen.brief || '').trim()),
            })}
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
  const [editing, setEditing] = useState<{
    trigger: Trigger | null;
    mode: TriggerMode;
    agentId: number;
    unattended: boolean;
    hasPrompt: boolean;
  } | null>(null);

  return (
    <div className="min-h-full bg-background">
      <PageHeader
        title="Triggers"
        subtitle="What starts a run without you, and whether it is actually running"
        icon={CalendarClock}
      />

      <div className="px-4 py-6 md:px-8">
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setPicking(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground"
          >
            <Plus className="w-4 h-4" />
            New trigger
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : triggers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-8 text-center">
            <CalendarClock className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium">Nothing runs on its own yet</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Pick an agent and choose what starts it: a schedule, checked
              against the next few dates before you save, or a webhook URL
              another system can call. Either way the agent needs &ldquo;may run
              with nobody watching&rdquo; turned on — without it every run is
              refused.
            </p>
            <button
              onClick={() => setPicking(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground"
            >
              <Plus className="w-4 h-4" />
              New trigger
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
                  mode: t.mode,
                  agentId: t.subagent,
                  unattended: t.agent_allows_unattended,
                  hasPrompt: t.agent_has_prompt,
                })}
              />
            ))}
          </div>
        )}
      </div>

      {picking && (
        <NewTriggerPicker
          onCancel={() => setPicking(false)}
          onPick={({ mode, agentId, allowsUnattended, hasPrompt }) => {
            setPicking(false);
            setEditing({
              trigger: null, mode, agentId,
              unattended: allowsUnattended, hasPrompt,
            });
          }}
        />
      )}

      {editing && (
        <TriggerModal
          trigger={editing.trigger}
          mode={editing.mode}
          agentId={editing.agentId}
          agentAllowsUnattended={editing.unattended}
          agentHasPrompt={editing.hasPrompt}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
