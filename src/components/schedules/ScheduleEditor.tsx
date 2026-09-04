/**
 * The schedule configurator: pickers, a timezone, and proof.
 *
 * What this replaces is a text input containing `0 9 * * 1`. That field asked
 * every user to be fluent in cron, offered no validation until save, and — the
 * part that actually cost people runs — was evaluated in UTC while reading like
 * local time, so "9am" fired at 2:30pm for anyone in India.
 *
 * Three things make this checkable rather than merely prettier:
 *
 * - **A zone, defaulted to the viewer's own.** A schedule typed as 9am means
 *   9am where the person typing it is. The stored `next_due_at` stays UTC.
 * - **The server's reading, not ours.** `lib/cron.ts` renders a description the
 *   instant a picker moves, so the form never feels laggy — but the moment
 *   `/triggers/preview/` answers, its description and its dates replace the
 *   local draft. Two cron implementations agree until the day they do not, and
 *   the one that matters is the one the sweep runs.
 * - **Dates, in the reader's own clock.** "Every Monday at 09:00" is a claim;
 *   three timestamps are evidence. It is the only way to catch a transposed
 *   minute and hour before the schedule is live.
 *
 * `custom` keeps raw cron reachable, so a schedule the pickers cannot model is
 * still editable here rather than being locked out by its own UI.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarClock, Check, Globe, Loader2 } from 'lucide-react';
import { triggersService, type OverlapPolicy, type SchedulePreview } from '../../api';
import {
  DAY_NAMES,
  HOUR_INTERVALS,
  KIND_LABELS,
  MINUTE_INTERVALS,
  allZones,
  describe as describeLocally,
  fromCron,
  toCron,
  zoneOffsetLabel,
  type ScheduleKind,
  type ScheduleSpec,
} from '../../lib/cron';
import { cn } from '../../lib/utils';
import Select from '../ui/Select';
import type { ScheduleDraft } from './scheduleDraft';

/** How long to sit still before asking the server. Long enough that holding a
 *  number key does not fire a request per repeat, short enough to feel live. */
const PREVIEW_DEBOUNCE_MS = 350;

const OVERLAP_COPY: Record<OverlapPolicy, { label: string; hint: string }> = {
  skip: {
    label: 'Skip this firing',
    hint: 'Leave the running one alone and wait for the next slot.',
  },
  queue: {
    label: 'Run after the current one',
    hint: 'Hold the firing and start it as soon as the agent is free. Dropped if it waits more than six hours.',
  },
  cancel: {
    label: 'Cancel the running one',
    hint: 'Stop what is in flight — including a run paused for your approval — and start fresh.',
  },
};

/** A datetime-local value from an ISO string, in the reader's own clock. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function Field({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">
        {label}
        {hint && <span className="ml-1.5 font-normal opacity-70">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full h-9 px-3 rounded-lg border border-input bg-background text-sm ' +
  'focus:outline-none focus:ring-1 focus:ring-primary';

export default function ScheduleEditor({
  value,
  onChange,
  agentAllowsUnattended = true,
  showAdvanced = true,
}: {
  value: ScheduleDraft;
  onChange: (next: ScheduleDraft) => void;
  /**
   * When false the editor says the schedule cannot fire. Not a guess at the
   * backend's rule — it is the same gate `_check_unattended` enforces, and
   * saying it here is the difference between one sentence and five silent
   * refusals followed by a self-disabled trigger.
   */
  agentAllowsUnattended?: boolean;
  /**
   * Whether to offer name, window, goal and overlap. False in the agent
   * builder, where this editor writes back only `cron` and `timezone` — the
   * rest belong to a schedule *row*, and rendering controls whose values are
   * silently discarded on save is worse than not offering them.
   */
  showAdvanced?: boolean;
}) {
  // The spec is derived from the cron the parent holds, so this component has
  // no second source of truth to keep in step — `cron` is the only state.
  const [spec, setSpec] = useState<ScheduleSpec>(() => fromCron(value.cron));
  const [preview, setPreview] = useState<SchedulePreview | null>(null);
  const [checking, setChecking] = useState(false);

  const zones = useMemo(allZones, []);
  const set = (patch: Partial<ScheduleDraft>) => onChange({ ...value, ...patch });

  const applySpec = (next: ScheduleSpec) => {
    setSpec(next);
    set({ cron: toCron(next) });
  };

  // Re-derive when the parent swaps in a different schedule (opening another
  // row in the same modal), but not on our own writes — comparing the compiled
  // cron is what distinguishes the two.
  useEffect(() => {
    if (toCron(spec) !== value.cron) setSpec(fromCron(value.cron));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.cron]);

  // The server's reading. Debounced, and every in-flight answer is checked
  // against the request that is current when it lands — otherwise a slow reply
  // for an expression the user has already edited past overwrites a newer one.
  const latest = useRef(0);
  useEffect(() => {
    const cron = value.cron.trim();
    if (!cron) {
      setPreview(null);
      return;
    }
    const ticket = ++latest.current;
    setChecking(true);
    const timer = setTimeout(async () => {
      try {
        const res = await triggersService.preview({
          cron,
          timezone: value.timezone,
          count: 3,
          starts_at: value.startsAt,
          ends_at: value.endsAt,
        });
        if (ticket === latest.current) setPreview(res);
      } catch {
        // A preview is a convenience; failing to fetch one must not block the
        // form. The local reading below still stands.
        if (ticket === latest.current) setPreview(null);
      } finally {
        if (ticket === latest.current) setChecking(false);
      }
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value.cron, value.timezone, value.startsAt, value.endsAt]);

  const localReading = describeLocally(spec, value.timezone);
  const reading = preview?.description || localReading;

  return (
    <div className="space-y-4">
      {!agentAllowsUnattended && (
        <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-[12px] text-destructive">
            This agent is not cleared to run with nobody watching, so every
            firing of this schedule will be refused — and after five refusals
            the schedule switches itself off. Turn on <strong>May run with
            nobody watching</strong> in the agent&rsquo;s settings first.
          </p>
        </div>
      )}

      <Field label="Repeats">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(KIND_LABELS) as ScheduleKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => applySpec({ ...spec, kind })}
              className={cn(
                'rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors',
                spec.kind === kind
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border/60 text-muted-foreground hover:text-foreground',
              )}
            >
              {KIND_LABELS[kind]}
            </button>
          ))}
        </div>
      </Field>

      {(spec.kind === 'minutes' || spec.kind === 'hourly') && (
        <Field
          label={spec.kind === 'minutes' ? 'Every' : 'Every'}
          hint={spec.kind === 'minutes' ? 'minutes' : 'hours'}
        >
          <div className="flex flex-wrap gap-1.5">
            {(spec.kind === 'minutes' ? MINUTE_INTERVALS : HOUR_INTERVALS).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => applySpec({ ...spec, interval: n })}
                className={cn(
                  'w-11 rounded-lg border py-1.5 text-[12px] tabular-nums',
                  spec.interval === n
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border/60 text-muted-foreground hover:text-foreground',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </Field>
      )}

      {spec.kind === 'weekly' && (
        <Field label="On these days">
          <div className="flex flex-wrap gap-1.5">
            {DAY_NAMES.map((name, day) => {
              const on = spec.weekdays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => applySpec({
                    ...spec,
                    weekdays: on
                      ? spec.weekdays.filter((d) => d !== day)
                      : [...spec.weekdays, day].sort((a, b) => a - b),
                  })}
                  className={cn(
                    'w-12 rounded-lg border py-1.5 text-[12px]',
                    on
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border/60 text-muted-foreground hover:text-foreground',
                  )}
                >
                  {name}
                </button>
              );
            })}
          </div>
          {spec.weekdays.length === 0 && (
            <p className="mt-1.5 text-[12px] text-warning">
              Pick at least one day, or it defaults to Monday.
            </p>
          )}
        </Field>
      )}

      {spec.kind === 'monthly' && (
        <Field label="Day of the month" hint="1–31">
          <input
            type="number" min={1} max={31} value={spec.monthday}
            onChange={(e) => applySpec({ ...spec, monthday: Number(e.target.value) })}
            className={cn(inputCls, 'w-24 tabular-nums')}
          />
          {spec.monthday > 28 && (
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              Months without a {spec.monthday}
              {spec.monthday === 31 ? 'st' : 'th'} are skipped, not moved — cron
              has no notion of &ldquo;the last day&rdquo;.
            </p>
          )}
        </Field>
      )}

      {/* Hour and minute matter for everything except the two interval forms,
          where the hour is meaningless and would just be a dead control. */}
      {spec.kind !== 'minutes' && spec.kind !== 'custom' && (
        <Field label="At" hint={spec.kind === 'hourly' ? 'minutes past the hour' : ''}>
          <div className="flex items-center gap-1.5">
            {spec.kind !== 'hourly' && (
              <>
                <input
                  type="number" min={0} max={23} value={spec.hour}
                  onChange={(e) => applySpec({ ...spec, hour: Number(e.target.value) })}
                  className={cn(inputCls, 'w-20 tabular-nums text-center')}
                  aria-label="Hour"
                />
                <span className="text-muted-foreground">:</span>
              </>
            )}
            <input
              type="number" min={0} max={59} value={spec.minute}
              onChange={(e) => applySpec({ ...spec, minute: Number(e.target.value) })}
              className={cn(inputCls, 'w-20 tabular-nums text-center')}
              aria-label="Minute"
            />
            <span className="ml-1 text-[12px] text-muted-foreground">
              24-hour clock
            </span>
          </div>
        </Field>
      )}

      {spec.kind === 'custom' && (
        <Field label="Cron expression" hint="minute hour day month weekday">
          <input
            value={spec.expression}
            onChange={(e) => applySpec({ ...spec, expression: e.target.value })}
            placeholder="0 9 * * 1"
            spellCheck={false}
            className={cn(inputCls, 'font-mono')}
          />
        </Field>
      )}

      <Field label="Timezone" hint="the schedule is read in this zone">
        <Select
          value={value.timezone}
          onChange={(tz) => set({ timezone: tz })}
          options={zones.map((z) => ({
            value: z,
            label: z === 'UTC' ? 'UTC' : `${z} · ${zoneOffsetLabel(z)}`,
          }))}
          showSearch
          icon={<Globe className="w-4 h-4" />}
        />
      </Field>

      {/* The proof. */}
      <div className="rounded-lg border border-border/60 bg-secondary/30 p-3">
        <div className="flex items-start gap-2">
          <CalendarClock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium">
              {reading || (checking ? 'Reading…' : 'Nothing scheduled yet')}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {value.cron || '—'}
            </p>
          </div>
          {checking && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          )}
        </div>

        {preview && !preview.valid && (
          <p className="mt-2 flex items-start gap-1.5 text-[12px] text-destructive">
            <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
            {preview.error}
          </p>
        )}

        {preview?.valid && preview.upcoming.length > 0 && (
          <div className="mt-2 border-t border-border/60 pt-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Next runs, in your time
            </p>
            <ul className="mt-1 space-y-0.5">
              {preview.upcoming.map((iso) => (
                <li key={iso} className="flex items-center gap-1.5 text-[12px]">
                  <Check className="w-3 h-3 text-success shrink-0" />
                  {new Date(iso).toLocaleString(undefined, {
                    weekday: 'short', day: 'numeric', month: 'short',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {showAdvanced && (
      <details className="group">
        <summary className="cursor-pointer text-[12px] font-medium text-muted-foreground hover:text-foreground">
          Name, window, and what to do when it overlaps
        </summary>
        <div className="mt-3 space-y-4">
          <Field label="Name" hint="optional — an agent can have several schedules">
            <input
              value={value.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Weekday briefing"
              maxLength={80}
              className={inputCls}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Starts" hint="optional">
              <input
                type="datetime-local"
                value={toLocalInput(value.startsAt)}
                onChange={(e) => set({ startsAt: fromLocalInput(e.target.value) })}
                className={inputCls}
              />
            </Field>
            <Field label="Ends" hint="optional">
              <input
                type="datetime-local"
                value={toLocalInput(value.endsAt)}
                onChange={(e) => set({ endsAt: fromLocalInput(e.target.value) })}
                className={inputCls}
              />
            </Field>
          </div>
          <p className="text-[12px] text-muted-foreground">
            A schedule outside its window is not broken, just not live — it
            waits before its start date, and switches itself off after its end
            date rather than sitting armed for a firing that will never come.
          </p>

          <Field
                label="Goal"
                hint="optional — defaults to the agent's own brief"
              >
                <textarea
                  value={value.goal}
                  onChange={(e) => set({ goal: e.target.value })}
                  rows={2}
                  placeholder="What should it do each time this fires?"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-y focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </Field>

              <Field label="If the previous run is still going">
                <div className="space-y-1.5">
                  {(Object.keys(OVERLAP_COPY) as OverlapPolicy[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => set({ overlap: id })}
                      className={cn(
                        'w-full text-left rounded-lg border px-3 py-2 transition-colors',
                        value.overlap === id
                          ? 'border-primary bg-primary/5'
                          : 'border-border/60 hover:border-border',
                      )}
                    >
                      <p className="text-[13px] font-medium">{OVERLAP_COPY[id].label}</p>
                      <p className="text-[12px] text-muted-foreground">
                        {OVERLAP_COPY[id].hint}
                      </p>
                    </button>
                  ))}
                </div>
          </Field>
        </div>
      </details>
      )}
    </div>
  );
}
