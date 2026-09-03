/**
 * Agent builder — the knob board, plus the agent that dials it for you.
 *
 * Two panes on purpose. The right side is the whole configuration, always
 * visible, always editable by hand. The left side is the "agent of creating
 * agents": you describe the job, it adjusts the settings and explains why, and every change
 * it makes lights up on the right so nothing happens behind your back.
 *
 * Generating a config you cannot see or override would be the wrong trade —
 * the point of the board is that the agent's choices stay inspectable.
 */
import { useMemo, useRef, useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bot, Brain, Cpu, Timer, FolderLock, Wrench, Plug,
  ShieldCheck, Clock, Layers, Save, RotateCcw, Check, Globe, Loader2, Trash2,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import nodeService from '../api/nodeService';
import skillsService from '../api/skills';
import { mcpService } from '../api/mcp';
import agentsService from '../api/agents';
import { logsService } from '../api';
import { cn } from '../lib/utils';
import MultiSelect from '../components/ui/MultiSelect';
import Select from '../components/ui/Select';
import {
  DEFAULT_AGENT, TRIGGER_COPY, AUTONOMY_COPY, FILE_ACCESS_COPY,
  EGRESS_COPY,
  type AgentConfig, type TriggerMode, type Autonomy, type FileAccess, type Egress,
} from '../types/agentConfig';
import RevisionEntry from '../components/agents/RevisionEntry';
import { propose, applyChanges, type Change } from '../lib/agentProposals';
import { SendButton } from '../components/ui/SendButton';
import ScheduleEditor from '../components/schedules/ScheduleEditor';
import { EFFORT_LABELS } from '../hooks/useEffortSelection';

type Msg = { role: 'user' | 'agent'; text: string; changes?: Change[] };

const STARTERS = [
  'Read invoices from Gmail every Monday and chase anything overdue by 30 days',
  'Watch Drive for files nobody has opened in 3 years and propose what to archive',
  'Classify support tickets and draft a first reply, but never send without asking',
  'Answer questions about our uploaded spreadsheets by writing Python',
];

/* ---------- small building blocks ---------- */

function Section({ icon: Icon, title, hint, notEnforced, children }: {
  icon: typeof Cpu; title: string; hint?: string;
  /** Why this section's settings are saved but do not yet change a run. */
  notEnforced?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border rounded bg-card mb-4 break-inside-avoid">
      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-[13px] font-semibold">{title}</h3>
        {notEnforced && (
          <span className="text-[10px] uppercase tracking-wide font-semibold text-warning border border-warning/40 rounded px-1.5 py-0.5">
            Coming soon
          </span>
        )}
        {hint && <span className="text-[12px] text-muted-foreground ml-auto">{hint}</span>}
      </header>
      {notEnforced && (
        <p className="px-4 pt-3 text-[12px] text-muted-foreground">{notEnforced}</p>
      )}
      <div className="p-4 space-y-3">{children}</div>
    </section>
  );
}

/** The newest few configuration changes to this agent.
 *
 *  The point is correlation, not nostalgia: a run records the revision it
 *  executed under, so "it got worse on Tuesday" becomes "it got worse at rev 4,
 *  which changed the model and the autonomy". `run_count` says whether a
 *  revision has been exercised enough to judge at all.
 *
 *  Only `INLINE_REVISIONS` of them show. This section used to render the whole
 *  timeline, which grows for the life of the agent — so on an agent anyone
 *  actually tunes it pushed the rest of the board off the screen, and there was
 *  no way to reach a revision past the server's cap at all. The full history is
 *  its own page now; this is the "what did I just change?" view, and the link
 *  is here rather than at the end of a list nobody scrolls to.
 */
const INLINE_REVISIONS = 3;

function RevisionHistory({ agentId }: { agentId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['agent-revisions', agentId, INLINE_REVISIONS],
    queryFn: () => logsService.listRevisions(agentId, { limit: INLINE_REVISIONS }),
  });

  if (isLoading) {
    return <p className="text-[12px] text-muted-foreground">Loading history…</p>;
  }

  const revisions = data?.results ?? [];
  if (revisions.length === 0) {
    return (
      <p className="text-[12px] text-muted-foreground">
        No changes yet. Future saves will be tracked here.
      </p>
    );
  }

  const total = data?.count ?? revisions.length;
  const rest = total - revisions.length;

  return (
    <>
      <ol className="space-y-2">
        {revisions.map((rev) => (
          <RevisionEntry key={rev.id} revision={rev} />
        ))}
      </ol>
      <Link
        to={`/agents/${agentId}/history`}
        className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:underline"
      >
        <History className="w-3.5 h-3.5" />
        {rest > 0
          ? `View all ${total} changes`
          : 'View full history'}
      </Link>
    </>
  );
}


/** Wraps a control so a knob the agent just moved is visibly flagged. */
function Knob({ path, touched, label, hint, children }: {
  path: string; touched: Set<string>; label: string; hint?: string; children: React.ReactNode;
}) {
  const isNew = touched.has(path);
  return (
    <div className={cn('rounded -mx-2 px-2 py-1.5 transition-colors', isNew && 'bg-agent-subtle')}>
      <div className="flex items-center gap-2 mb-1">
        <label className="text-[13px] font-medium text-foreground">{label}</label>
        {isNew && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-agent">
            <Bot className="w-3 h-3" />set by agent
          </span>
        )}
        {hint && <span className="ml-auto text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Choice<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { id: T; label: string; hint?: string }[];
}) {
  return (
    <div className="space-y-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            'w-full text-left px-3 py-2 rounded border transition-colors',
            value === o.id ? 'border-primary bg-primary-subtle' : 'border-border hover:bg-secondary'
          )}
        >
          <div className="flex items-center gap-2">
            <span className={cn('w-3.5 h-3.5 rounded-full border flex items-center justify-center',
              value === o.id ? 'border-primary bg-primary' : 'border-border-strong')}>
              {value === o.id && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
            </span>
            <span className="text-[13px] font-medium">{o.label}</span>
          </div>
          {o.hint && <p className="text-[12px] text-muted-foreground mt-0.5 ml-5.5 pl-0.5">{o.hint}</p>}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, onChange, label, hint }: {
  on: boolean; onChange: (v: boolean) => void; label: string; hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="w-full flex items-start gap-2.5 text-left py-1 group"
    >
      {/* The knob is placed by the track's own flexbox rather than by a hardcoded
          offset: `justify-end` plus the track's padding lands it inside the track
          whatever the two are sized to, so a change to either size cannot leave
          the knob hanging over the edge. */}
      <span className={cn(
        'mt-0.5 w-8 h-[18px] p-[2px] rounded-full shrink-0 box-border',
        'inline-flex items-center transition-colors',
        on ? 'bg-primary justify-end' : 'bg-accent border border-border-strong justify-start')}>
        <span className="block w-3.5 h-3.5 rounded-full bg-white shadow-sm" />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] text-foreground">{label}</span>
        {hint && <span className="block text-[12px] text-muted-foreground">{hint}</span>}
      </span>
    </button>
  );
}

/* ---------- page ---------- */

export default function AgentBuilder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // /agents/new -> blank board. /agents/:id -> the same board, prefilled.
  // Editing and creating are the same act, so they are the same screen.
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const agentId = isNew ? null : Number(id);

  const [cfg, setCfg] = useState<AgentConfig>(DEFAULT_AGENT);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  /** A turn is in flight. One at a time: the proposal is against a snapshot of
   *  the board, so a second send while the first is out would propose against a
   *  config that is about to change under it. */
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: existing, isLoading } = useQuery({
    queryKey: ['agent', id],
    queryFn: () => agentsService.get(id!),
    enabled: !isNew,
  });

  // Real model catalogue — the picker should show what is actually callable.
  const { data: providers = [] } = useQuery({
    queryKey: ['agent-builder', 'models'],
    queryFn: async () => (await nodeService.getAIModels()).providers,
    staleTime: 5 * 60 * 1000,
  });
  const { data: skills = [] } = useQuery({
    queryKey: ['agent-builder', 'skills'],
    queryFn: () => skillsService.list(),
    staleTime: 5 * 60 * 1000,
  });
  /* The connector picker's options are the account's real connections, not a
     list in this file. The old hardcoded six had drifted from the catalogue in
     both directions — it offered "Photos", which no connector has ever been,
     and could not name Notion at all — and nothing enforced it anyway. Now that
     the runtime honours the selection, offering a connection the user does not
     have would put an id in the config that the backend rejects on save.

     `effective_enabled` rather than `enabled`: a connection the user has
     switched off on Connections is not one to offer here, because the runtime
     drops it when it resolves the toolbox. */
  const { data: connectorOptions = [] } = useQuery({
    queryKey: ['agent-builder', 'connections'],
    queryFn: async () =>
      (await mcpService.list()).servers
        .filter((srv) => srv.effective_enabled)
        .map((srv) => ({ id: srv.id, label: srv.label, iconSlug: srv.icon_slug }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    staleTime: 5 * 60 * 1000,
  });

  // Fill the board once the agent arrives. The server's shape is AgentConfig,
  // so there is nothing to translate — which is the point of the contract.
  //
  // Adjusted during render rather than in an effect (the pattern React documents
  // for deriving state from changing props). An effect would paint the empty
  // board first and then overwrite it, and any edit made in that gap would be
  // silently discarded.
  const [loadedId, setLoadedId] = useState<number | null>(null);
  // Whether the schedule editor is open on an agent that has no schedule
  // yet. Not derived from `cfg.schedule`: the editor has to be visible
  // *before* there is a cron to show, or there is nothing to type into.
  const [scheduling, setScheduling] = useState(false);
  if (existing && loadedId !== existing.id) {
    setLoadedId(existing.id);
    setCfg({ ...DEFAULT_AGENT, ...existing });
  }

  const save = useMutation({
    mutationFn: (config: AgentConfig) =>
      isNew ? agentsService.create(config) : agentsService.update(id!, config),
    onSuccess: (agent) => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['agent', id] });
      toast.success(isNew ? `${agent.name} created` : 'Saved');
      setTouched(new Set());
      if (isNew) navigate(`/agents/${agent.id}`, { replace: true });
    },
    // The server validates the same rules the board shows, so its message is
    // more specific than anything generic we could write here.
    onError: (err: { response?: { data?: Record<string, unknown> } }) => {
      const data = err.response?.data;
      const first = data && Object.entries(data)[0];
      toast.error(
        first ? `${first[0]}: ${String(Array.isArray(first[1]) ? first[1][0] : first[1])}`
              : 'Could not save this agent.'
      );
    },
  });

  const remove = useMutation({
    mutationFn: () => agentsService.remove(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Agent deleted');
      navigate('/agents');
    },
  });

  const activeProvider = useMemo(
    () => providers.find((p) => p.slug === cfg.provider) ?? providers[0],
    [providers, cfg.provider]
  );

  // The model actually in force: what was chosen, or the provider's first once
  // the catalogue arrives. Derived rather than written back into state by an
  // effect — an effect would race the agent's own load and could overwrite a
  // saved model with the catalogue's default.
  const effectiveModel = cfg.model || activeProvider?.models?.[0]?.value || '';

  // Which effort rungs the model in force offers, or `[]` for none — which is
  // what hides the control entirely. Derived for the same reason as
  // `effectiveModel`: writing it back through an effect would race the agent's
  // own load and could clear a saved level before it was ever rendered.
  const effortLevels = useMemo(
    () =>
      activeProvider?.models?.find((mo) => mo.value === effectiveModel)?.effort_levels
      ?? [],
    [activeProvider, effectiveModel]
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pending]);

  const set = <K extends keyof AgentConfig>(k: K, v: AgentConfig[K]) =>
    setCfg((c) => ({ ...c, [k]: v }));
  const setTool = (k: keyof AgentConfig['tools'], v: boolean) =>
    setCfg((c) => ({ ...c, tools: { ...c.tools, [k]: v } }));

  /* The chat pane is a *model* configuring the agent, with the local rule table
     as its fallback.

     The rules stay because they are the only thing that works when no model can
     be reached — but they are the fallback and not the feature: they moved a
     knob only when the description happened to contain a word in their table,
     so a brief that named its source, its job and its cadence could still be
     answered with "I couldn't tell which knobs that should move". The server
     sees the account's real connections, knowledge bases and skills, so it can
     name ids the browser has no way to guess, and it validates every value it
     proposes against the same serializer that will validate the save. */
  const send = async (text: string) => {
    if (!text.trim() || pending) return;
    setMessages((m) => [...m, { role: 'user', text }]);
    setInput('');
    setPending(true);
    // Captured before the await: `cfg` in this closure is the board the user
    // was looking at when they pressed send, which is what the proposal is
    // against — and what `applyChanges` must be applied to below.
    const history = messages.map((m) => ({ role: m.role, text: m.text }));
    try {
      const proposal = await agentsService.configure(text, cfg, history);
      apply(proposal.reply, proposal.changes as Change[]);
    } catch {
      const { reply, changes } = propose(text, cfg, connectorOptions);
      apply(
        changes.length
          ? `${reply}

(The configuring model was unreachable, so this is the local rule set — check each change.)`
          : "I couldn't reach the model that configures agents, and the local rules didn't recognise that. Try naming what it reads, what it does with it, and whether it may act without you.",
        changes,
      );
    } finally {
      setPending(false);
    }
  };

  const apply = (reply: string, changes: Change[]) => {
    setCfg((c) => applyChanges(c, changes));
    setTouched(new Set(changes.map((c) => c.path)));
    setMessages((m) => [...m, { role: 'agent', text: reply, changes }]);
  };

  const reset = () => {
    setCfg(existing ? { ...DEFAULT_AGENT, ...existing } : DEFAULT_AGENT);
    setTouched(new Set());
    setMessages([]);
  };

  const submit = () => {
    if (!cfg.name.trim()) {
      toast.error('Give the agent a name first.');
      return;
    }
    // Persist the model actually shown in the picker, not the empty string
    // that was there before the catalogue loaded.
    save.mutate({ ...cfg, model: effectiveModel });
  };

  // What actually happened, once there is something to report. Before the first
  // run there is no honest number, so the line says what to do instead.
  const subtitle = () => {
    if (isNew) return 'Describe what you want, or adjust the settings yourself';
    if (!existing) return 'Loading…';
    if (!existing.runs) return 'Not run yet';
    const pct = Math.round((existing.unattended / existing.runs) * 100);
    return `${existing.runs} runs · ${pct}% handled without you · ₹${existing.spend}`;
  };

  return (
    <div className="h-full flex flex-col">
      <header className="px-4 md:px-6 py-4 border-b border-border flex items-center gap-3">
        <div className="p-2 bg-agent-subtle border border-agent-line rounded">
          <Bot className="w-5 h-5 text-agent" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">
            {isNew ? 'New agent' : cfg.name || 'Agent'}
          </h1>
          <p className="text-[13px] text-muted-foreground">{subtitle()}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!isNew && (
            <button
              onClick={() => {
                if (confirm(`Delete ${cfg.name}? This cannot be undone.`)) remove.mutate();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-border text-destructive hover:bg-destructive-subtle">
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
          <button onClick={reset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-border hover:bg-secondary">
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={submit}
            disabled={save.isPending || isLoading}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isNew ? 'Create agent' : 'Save changes'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* ---- builder chat ---- */}
        <div className="w-full lg:w-[420px] xl:w-[460px] border-r border-border flex flex-col min-h-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="pt-4">
                <div className="w-10 h-10 rounded bg-agent-subtle border border-agent-line flex items-center justify-center mb-3">
                  <Bot className="w-5 h-5 text-agent" />
                </div>
                <h2 className="font-semibold mb-1">What should this agent do?</h2>
                <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
                  Say it in plain language. I'll adjust the settings on the right and explain why
                  I picked each one — nothing is hidden, and you can override all of it.
                </p>
                <div className="space-y-2">
                  {STARTERS.map((s) => (
                    <button key={s} onClick={() => send(s)} disabled={pending}
                      className="w-full text-left px-3 py-2 text-[13px] bg-card hover:bg-accent border border-border rounded transition-colors disabled:opacity-50">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={cn('flex', msg.role === 'user' && 'justify-end')}>
                  <div className={cn('max-w-[92%] rounded px-3 py-2',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border')}>
                    <p className="text-[13px] leading-relaxed">{msg.text}</p>
                    {msg.changes && msg.changes.length > 0 && (
                      <ul className="mt-2 pt-2 border-t border-border space-y-1.5">
                        {msg.changes.map((c) => (
                          <li key={c.path} className="text-[12px]">
                            <span className="font-semibold text-agent">{c.label}</span>
                            <span className="text-muted-foreground"> — {c.why}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))
            )}
            {pending && (
              <div className="flex">
                <div className="max-w-[92%] rounded px-3 py-2 bg-card border border-border
                                flex items-center gap-2 text-[13px] text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Working out the settings…
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send(input)}
                disabled={pending}
                placeholder={pending ? 'Working…' : 'Describe what it should do…'}
                className="flex-1 h-10 px-3 rounded border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60"
              />
              <SendButton onClick={() => send(input)} disabled={!input.trim() || pending} />
            </div>
          </div>
        </div>

        {/* ---- knob board ---- */}
        <div className="hidden lg:block flex-1 overflow-y-auto p-6 bg-bg-1">
          <div className="max-w-[1600px]">
            <div className="2xl:columns-2 2xl:gap-4">

            <Section icon={Bot} title="Identity">
              <Knob path="name" touched={touched} label="Name">
                <input value={cfg.name} onChange={(e) => set('name', e.target.value)}
                  placeholder="Finance agent"
                  className="w-full h-9 px-3 rounded border border-input bg-background text-sm" />
              </Knob>
              <Knob path="brief" touched={touched} label="Brief" hint="What it is for, in one or two sentences">
                <textarea value={cfg.brief} onChange={(e) => set('brief', e.target.value)}
                  rows={3} placeholder="Reads invoices from Gmail and chases anything overdue…"
                  className="w-full px-3 py-2 rounded border border-input bg-background text-sm resize-none" />
              </Knob>
            </Section>

            <Section icon={Brain} title="Model">
              <div className="grid sm:grid-cols-2 gap-3">
                <Knob path="provider" touched={touched} label="Provider">
                  <Select
                    value={cfg.provider}
                    onChange={(slug) => {
                      const p = providers.find((x) => x.slug === slug);
                      setCfg((c) => ({ ...c, provider: slug, model: p?.models?.[0]?.value ?? '' }));
                    }}
                    placeholder="Choose a provider"
                    icon={<Layers className="w-4 h-4" />}
                    options={providers.map((p) => ({ value: p.slug, label: p.name }))}
                  />
                </Knob>
                <Knob path="model" touched={touched} label="Model">
                  <Select
                    value={effectiveModel}
                    onChange={(v) => set('model', v)}
                    placeholder="Choose a model"
                    icon={<Brain className="w-4 h-4" />}
                    showSearch={(activeProvider?.models?.length ?? 0) > 8}
                    options={(activeProvider?.models ?? []).map((mo) => ({
                      value: mo.value,
                      label: mo.is_free ? `${mo.name} · free` : mo.name,
                      is_free: mo.is_free,
                    }))}
                  />
                </Knob>
              </div>
              {/* Only for models that have the knob. Rendering a disabled row
                  for the rest would suggest the setting exists and is simply
                  off, when in fact nothing would be sent. */}
              {(effortLevels.length > 0) && (
                <Knob path="effort" touched={touched} label="Reasoning effort"
                      hint={cfg.effort || 'model default'}>
                  <Select
                    value={cfg.effort}
                    onChange={(v) => set('effort', v)}
                    placeholder="Model default"
                    icon={<Brain className="w-4 h-4" />}
                    options={[
                      { value: '', label: 'Model default' },
                      ...effortLevels.map((level) => ({
                        value: level,
                        label: EFFORT_LABELS[level] ?? level,
                      })),
                    ]}
                  />
                  <p className="text-[12px] text-muted-foreground mt-1">
                    Raise it for multi-step analysis. Extraction, routing and
                    formatting do not get better for the extra thinking, and it
                    is billed either way.
                  </p>
                </Knob>
              )}
              <Knob path="temperature" touched={touched} label="Temperature"
                    hint={cfg.temperature <= 0.2 ? 'deterministic' : cfg.temperature >= 0.7 ? 'varied' : 'balanced'}>
                <div className="flex items-center gap-3">
                  <input type="range" min={0} max={1} step={0.1} value={cfg.temperature}
                    onChange={(e) => set('temperature', Number(e.target.value))}
                    className="flex-1 accent-primary" />
                  <span className="w-8 text-right text-[13px] tabular-nums">{cfg.temperature.toFixed(1)}</span>
                </div>
                <p className="text-[12px] text-muted-foreground mt-1">
                  Extraction and classification want 0. Drafting reads better nearer 0.7.
                </p>
              </Knob>
            </Section>

            {/* File access is enforced; the resource knobs below are not. They
                used to share one section under a single "not yet applied"
                banner, which became a lie the moment the virtual filesystem
                landed — a banner covering a setting that *is* enforced teaches
                people to ignore it on the ones that are not. */}
            <Section icon={FolderLock} title="Files"
              hint="Which of your files it can reach">
              <Knob path="fileAccess" touched={touched} label="File access">
                <Choice<FileAccess>
                  value={cfg.fileAccess} onChange={(v) => set('fileAccess', v)}
                  options={(Object.keys(FILE_ACCESS_COPY) as FileAccess[]).map((id) => ({
                    id, label: FILE_ACCESS_COPY[id].label, hint: FILE_ACCESS_COPY[id].hint,
                  }))} />
              </Knob>
              <p className="text-[12px] text-muted-foreground">
                Needs the “Read and write files” tool below. Anything it writes appears
                in your own files, and anything it deletes goes to your recycle bin.
              </p>
            </Section>

            {/* CPUs and Memory used to live here behind a "COMING SOON" badge.
                They were never read and never could be — the backend runs agent
                code on a thread inside its own process, with no cgroup to hold a
                quota. What a run actually holds is time: an event-loop slot, a
                checkpoint, a database connection, for as long as it waits on a
                model. So the knob is time, and unlike the two it replaced it is
                enforced. */}
            <Section icon={Timer} title="Run limit"
              hint="How long one run may take">
              <Knob path="maxRunSeconds" touched={touched} label="Time limit" hint="per run">
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4 text-muted-foreground" />
                  <input type="number" min={1} max={120} step={1}
                    value={Math.round(cfg.maxRunSeconds / 60)}
                    onChange={(e) => set('maxRunSeconds',
                      Math.max(1, Math.min(120, Number(e.target.value))) * 60)}
                    className="w-full h-9 px-2 rounded border border-input bg-background text-sm" />
                  <span className="text-sm text-muted-foreground shrink-0">minutes</span>
                </div>
              </Knob>
              <div className="flex flex-wrap gap-1.5">
                {[5, 15, 30, 60].map((m) => (
                  <button key={m} type="button"
                    onClick={() => set('maxRunSeconds', m * 60)}
                    className={`h-7 px-2.5 rounded border text-[12px] transition-colors ${
                      Math.round(cfg.maxRunSeconds / 60) === m
                        ? 'border-primary text-primary bg-primary/10'
                        : 'border-input text-muted-foreground hover:text-foreground'
                    }`}>
                    {m} min
                  </button>
                ))}
              </div>
              <p className="text-[12px] text-muted-foreground">
                Near the limit the agent stops calling tools and answers with what it
                has, so a run that runs long still returns something. Work it delegates
                shares this budget — a sub-agent cannot outlive the run that called it.
              </p>
              {/* Kept, but honestly labelled. The section's blanket "not yet
                  enforced" notice went with the CPU and memory fields, and the
                  time limit above genuinely is enforced — so this one carries
                  its own caveat rather than borrowing a badge that no longer
                  applies to its neighbours. */}
              <Toggle on={cfg.venv} onChange={(v) => set('venv', v)}
                label="Isolated Python environment"
                hint="Saved, but not yet enforced — Python currently runs in the shared sandbox." />
            </Section>

            <Section icon={Wrench} title="Tools">
              <p className="px-2 text-[12px] text-muted-foreground -mt-2 mb-1">
                Built-in tools are included with your workspace. See the{' '}
                <Link to="/tools" className="underline text-primary">Tools library</Link> for details — same groups as below. Add-on tools appear after you connect them on{' '}
                <Link to="/connections" className="underline text-primary">Connections</Link>.
              </p>
              {([
                ['codeExecution', 'Run Python', 'Sandboxed interpreter for calculation and parsing.'],
                ['shell', 'Run shell commands', 'Powerful — leave off unless it needs it.'],
                ['webSearch', 'Web search', 'Look things up it was not given.'],
                ['scrape', 'Read web pages', 'Fetch and extract from a URL.'],
                ['fileOps', 'Read and write files', 'Your own files, within the access level set above.'],
                ['rag', 'Knowledge base search', 'Retrieve from your indexed documents.'],
                ['mcp', 'MCP servers (Plugins)', 'The tools from your connected plugins (MCP servers), using your connectors.'],
              ] as const).map(([k, label, hint]) => (
                <Knob key={k} path={`tools.${k}`} touched={touched} label="">
                  <Toggle on={cfg.tools[k]} onChange={(v) => setTool(k, v)} label={label} hint={hint} />
                </Knob>
              ))}
              <p className="px-2 text-[11px] text-muted-foreground">
                Need the full list? <Link to="/tools" className="underline">Browse tools</Link> to see what each tool does and when it needs approval.
              </p>
            </Section>

            <Section icon={Plug} title="Context it is given">
              <Knob path="connectors" touched={touched} label="Connections"
                    hint={cfg.connectors.length ? `${cfg.connectors.length} selected` : undefined}>
                <MultiSelect
                  options={connectorOptions.map((c) => ({ id: String(c.id), label: c.label }))}
                  value={cfg.connectors.map(String)}
                  onChange={(v) => set('connectors', v.map(Number).filter((n) => !Number.isNaN(n)))}
                  placeholder="Every connection — narrow it to what this agent needs"
                  searchPlaceholder="Search connections…"
                  emptyText="None yet — add one on Connections first."
                />
              </Knob>
              <Knob path="skills" touched={touched} label="Skills"
                    hint={cfg.skills.length ? `${cfg.skills.length} selected` : undefined}>
                <MultiSelect
                  options={skills.map((s) => ({
                    id: String(s.id),
                    label: s.title,
                    hint: s.description || s.category,
                  }))}
                  value={cfg.skills.map(String)}
                  onChange={(v) => set('skills', v.map(Number))}
                  placeholder="No skills"
                  searchPlaceholder="Search skills…"
                  emptyText="None yet — write one in Skills first."
                />
              </Knob>
              <Toggle on={cfg.useOrgContext} onChange={(v) => set('useOrgContext', v)}
                label="Organisation context"
                hint="Coming soon — doesn't affect runs today." />
              <Knob path="useEnvironment" touched={touched} label="">
                <Toggle on={cfg.useEnvironment} onChange={(v) => set('useEnvironment', v)}
                  label="Environment" hint="Current time and place, for anything schedule- or locale-aware." />
              </Knob>
            </Section>

            <Section icon={Clock} title="When it runs">
              <Knob path="trigger" touched={touched} label="Trigger">
                <Choice<TriggerMode>
                  value={cfg.trigger} onChange={(v) => set('trigger', v)}
                  options={(Object.keys(TRIGGER_COPY) as TriggerMode[]).map((id) => ({
                    id, label: TRIGGER_COPY[id].label, hint: TRIGGER_COPY[id].hint,
                  }))} />
              </Knob>
              {/* Offered for any invocation mode, not just `maintenance`: the
                  backend has always created a Trigger for a non-blank cron
                  whatever the mode said, so hiding the control behind one
                  choice only hid schedules that already existed. */}
              <Knob path="schedule" touched={touched} label="Schedule">
                {cfg.schedule || scheduling ? (
                  <>
                    <ScheduleEditor
                      value={{
                        cron: cfg.schedule,
                        timezone: cfg.scheduleTimezone,
                        name: '', goal: '', overlap: 'skip',
                        startsAt: null, endsAt: null,
                      }}
                      onChange={(next) => {
                        set('schedule', next.cron);
                        set('scheduleTimezone', next.timezone);
                      }}
                      agentAllowsUnattended={cfg.allowUnattended}
                      // This field writes back only cron and timezone, so the
                      // name, window, goal and overlap controls are withheld
                      // rather than rendered and silently discarded on save.
                      // The Schedules page is where those are set.
                      showAdvanced={false}
                    />
                    <button
                      type="button"
                      onClick={() => { set('schedule', ''); setScheduling(false); }}
                      className="mt-2 text-[12px] text-muted-foreground hover:text-destructive"
                    >
                      Remove this schedule
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setScheduling(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-[13px] hover:bg-secondary"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Run this on a schedule
                  </button>
                )}
                {(cfg.extraSchedules ?? 0) > 0 && (
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    This agent has {cfg.extraSchedules} other schedule
                    {cfg.extraSchedules === 1 ? '' : 's'}, set up on{' '}
                    <Link to="/schedules" className="underline">Schedules</Link>.
                    They are not affected by this field.
                  </p>
                )}
              </Knob>
              <Knob path="allowUnattended" touched={touched} label="">
                <Toggle on={cfg.allowUnattended} onChange={(v) => set('allowUnattended', v)}
                  label="Can run automatically"
                  hint="Needed for schedules and when another agent calls it." />
              </Knob>
              {cfg.schedule && !cfg.allowUnattended && (
                <p className="flex items-start gap-1.5 text-[12px] text-destructive">
                  <Clock className="w-3.5 h-3.5 mt-px shrink-0" />
                  Schedules won't run without this enabled — the runtime
                  checks it again, and the sweep disables the trigger after five
                  refusals. Save is blocked until one of the two changes.
                </p>
              )}
              {cfg.schedule && cfg.allowUnattended && (
                <p className="text-[12px] text-muted-foreground">
                  Once saved, this schedule appears on{' '}
                  <Link to="/schedules" className="underline">Schedules</Link>,
                  where you can test it once before relying on it.
                </p>
              )}
            </Section>

            <Section icon={ShieldCheck} title="Safety">
              <Knob path="autonomy" touched={touched} label="Autonomy">
                <Choice<Autonomy>
                  value={cfg.autonomy} onChange={(v) => set('autonomy', v)}
                  options={(Object.keys(AUTONOMY_COPY) as Autonomy[]).map((id) => ({
                    id, label: AUTONOMY_COPY[id].label, hint: AUTONOMY_COPY[id].hint,
                  }))} />
              </Knob>
              <Knob path="egress" touched={touched} label="Network access"
                    hint="separate from web search">
                <p className="mb-2 text-[12px] text-muted-foreground">
                  Partially active: the agent is told this in its instructions, and
                  shell-plus-open-network is refused on save — but nothing blocks
                  traffic at the network layer yet.
                </p>
                <Choice<Egress>
                  value={cfg.egress} onChange={(v) => set('egress', v)}
                  options={(Object.keys(EGRESS_COPY) as Egress[]).map((id) => ({
                    id, label: EGRESS_COPY[id].label, hint: EGRESS_COPY[id].hint,
                  }))} />
                {cfg.tools.shell && cfg.egress === 'full' && (
                  <p className="mt-2 flex items-start gap-1.5 text-[12px] text-destructive">
                    <Globe className="w-3.5 h-3.5 mt-px shrink-0" />
                    For security, you can't enable both shell access and open network together — anything the agent
                    reads, it can also send. Narrow one of the two.
                  </p>
                )}
              </Knob>
              {/* The hint says what "off" leaves behind on purpose. The switch
                  silences the pings, never the queue — a paused run always waits
                  in the Inbox, or turning notifications off would quietly mean
                  abandoning it. Saying so is what stops someone reading the
                  toggle as "let it run without me". */}
              <Knob path="notifyOnHitl" touched={touched} label="">
                <Toggle on={cfg.notifyOnHitl} onChange={(v) => set('notifyOnHitl', v)}
                  label="Notify me when it stops to ask"
                  hint={cfg.notifyOnHitl
                    ? 'Pings you when it pauses, then again after an hour and a day.'
                    : "No pings for this agent — it still waits in your Inbox and in the daily summary."} />
              </Knob>
              <Knob path="reviewAgent" touched={touched} label="">
                <Toggle on={cfg.reviewAgent} onChange={(v) => set('reviewAgent', v)}
                  label="Review agent"
                  hint="Coming soon — automatic reviews." />
              </Knob>
              <Knob path="spendCapRupees" touched={touched} label="Spend cap" hint="per month">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">₹</span>
                  <input type="number" min={0} step={50} value={cfg.spendCapRupees}
                    onChange={(e) => set('spendCapRupees', Number(e.target.value))}
                    className="w-full h-9 px-2 rounded border border-input bg-background text-sm" />
                </div>
              </Knob>
            </Section>

            {!isNew && agentId != null && (
              <Section icon={History} title="Change history"
                       hint="Which configuration produced which runs">
                <RevisionHistory agentId={agentId} />
              </Section>
            )}

            <Section icon={Layers} title="Context lifecycle" hint="For long runs">
              <p className="text-[12px] text-muted-foreground -mt-1">
                A long run carries its whole transcript into every step, so eventually it
                outgrows the model’s context window. These decide what gets cut and
                whether it can be read back. Nothing happens until a run actually
                approaches its limit.
              </p>
              <Toggle on={cfg.compaction} onChange={(v) => set('compaction', v)}
                label="Auto-compact history"
                hint="Replace older tool results with a short record. Costs nothing, and what each step did stays visible." />
              <Toggle on={cfg.recursiveContext} onChange={(v) => set('recursiveContext', v)}
                label="Smart summarization"
                hint="When compaction is not enough, fold the oldest steps into one running summary. Costs a small model call each time." />
              {cfg.recursiveContext && (
                <Knob path="summaryModel" touched={touched} label="Summarizing model"
                      hint="Left as default, a small NVIDIA model runs on the platform key — nothing to connect.">
                  <Select
                    value={cfg.summaryModel}
                    onChange={(v) => {
                      // Both or neither: a model with no provider cannot be
                      // routed, and the empty value has to clear both or the
                      // agent would keep overriding the platform default with
                      // half a choice.
                      const owner = providers.find((p) => p.models?.some((m) => m.value === v));
                      setCfg((c) => ({
                        ...c,
                        summaryModel: v,
                        summaryProvider: v ? (owner?.slug ?? '') : '',
                      }));
                    }}
                    placeholder="Platform default (recommended)"
                    icon={<Layers className="w-4 h-4" />}
                    showSearch
                    options={[
                      { value: '', label: 'Platform default (recommended)' },
                      ...providers.flatMap((p) =>
                        (p.models ?? []).map((mo) => ({
                          value: mo.value,
                          label: `${p.name} · ${mo.name}${mo.is_free ? ' · free' : ''}`,
                          is_free: mo.is_free,
                        }))
                      ),
                    ]}
                  />
                </Knob>
              )}
              <Toggle on={cfg.indexing} onChange={(v) => set('indexing', v)}
                label="Save and recall"
                hint="Store whatever is cut, so the agent can search it back mid-run. Off means removed text is gone for good." />
            </Section>

            </div>

            <div className="flex items-center gap-2 pb-8">
              <button
                onClick={submit}
                disabled={save.isPending}
                className="px-4 py-2 text-sm font-semibold rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {isNew ? 'Create agent' : 'Save changes'}
              </button>
              <button onClick={() => navigate('/agents')}
                className="px-4 py-2 text-sm rounded border border-border hover:bg-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
