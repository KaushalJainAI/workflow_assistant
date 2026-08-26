/**
 * Agent builder — the knob board, plus the agent that dials it for you.
 *
 * Two panes on purpose. The right side is the whole configuration, always
 * visible, always editable by hand. The left side is the "agent of creating
 * agents": you describe the job, it moves knobs and says why, and every change
 * it makes lights up on the right so nothing happens behind your back.
 *
 * Generating a config you cannot see or override would be the wrong trade —
 * the point of the board is that the agent's choices stay inspectable.
 */
import { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bot, Brain, Cpu, MemoryStick, FolderLock, Wrench, Plug,
  ShieldCheck, Clock, Layers, Save, RotateCcw, Check, Globe, Loader2, Trash2,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import nodeService from '../api/nodeService';
import skillsService from '../api/skills';
import agentsService from '../api/agents';
import { logsService } from '../api';
import { cn } from '../lib/utils';
import MultiSelect from '../components/ui/MultiSelect';
import Select from '../components/ui/Select';
import {
  DEFAULT_AGENT, CONNECTOR_OPTIONS, TRIGGER_COPY, AUTONOMY_COPY, FILE_ACCESS_COPY,
  EGRESS_COPY,
  type AgentConfig, type TriggerMode, type Autonomy, type FileAccess, type Egress,
} from '../types/agentConfig';
import { propose, applyChanges, type Change } from '../lib/agentProposals';
import { SendButton } from '../components/ui/SendButton';

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
            Not yet applied
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

/** Every configuration change to this agent, newest first.
 *
 *  The point is correlation, not nostalgia: a run records the revision it
 *  executed under, so "it got worse on Tuesday" becomes "it got worse at rev 4,
 *  which changed the model and the autonomy". `run_count` says whether a
 *  revision has been exercised enough to judge at all.
 */
function RevisionHistory({ agentId }: { agentId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['agent-revisions', agentId],
    queryFn: () => logsService.listRevisions(agentId),
  });

  if (isLoading) {
    return <p className="text-[12px] text-muted-foreground">Loading history…</p>;
  }

  const revisions = data?.results ?? [];
  if (revisions.length === 0) {
    return (
      <p className="text-[12px] text-muted-foreground">
        No changes recorded yet. Every save from here on is versioned.
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {revisions.map((rev) => (
        <li key={rev.id} className="border-l-2 border-border pl-3">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold">rev {rev.number}</span>
            <span className="text-[12px] text-muted-foreground truncate flex-1">
              {rev.summary}
            </span>
            <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
              {rev.run_count} {rev.run_count === 1 ? 'run' : 'runs'}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {rev.changed_by ?? 'system'} · {new Date(rev.created_at).toLocaleString()}
          </div>
          {Object.keys(rev.diff).length > 0 && (
            <dl className="mt-1 space-y-0.5">
              {Object.entries(rev.diff).slice(0, 6).map(([field, change]) => (
                <div key={field} className="flex gap-2 text-[11px]">
                  <dt className="text-muted-foreground w-28 shrink-0 truncate">{field}</dt>
                  <dd className="truncate">
                    <span className="text-muted-foreground line-through">
                      {summariseValue(change.from)}
                    </span>
                    {' → '}
                    <span>{summariseValue(change.to)}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </li>
      ))}
    </ol>
  );
}

/** One side of a diff, shortened to fit a line. Objects are summarised rather
 *  than stringified: a full `tools` map would swamp the row it sits in. */
function summariseValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  if (Array.isArray(value)) return value.length === 0 ? 'none' : `${value.length} item(s)`;
  if (typeof value === 'object') {
    const on = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v)
      .map(([k]) => k);
    return on.length === 0 ? 'none' : on.join(', ');
  }
  const text = String(value);
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
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
    <button onClick={() => onChange(!on)} className="w-full flex items-start gap-2.5 text-left py-1 group">
      <span className={cn('mt-0.5 w-8 h-[18px] rounded-full shrink-0 transition-colors relative',
        on ? 'bg-primary' : 'bg-accent border border-border-strong')}>
        <span className={cn('absolute top-[2px] w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-all',
          on ? 'left-[16px]' : 'left-[2px]')} />
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

  // Fill the board once the agent arrives. The server's shape is AgentConfig,
  // so there is nothing to translate — which is the point of the contract.
  //
  // Adjusted during render rather than in an effect (the pattern React documents
  // for deriving state from changing props). An effect would paint the empty
  // board first and then overwrite it, and any edit made in that gap would be
  // silently discarded.
  const [loadedId, setLoadedId] = useState<number | null>(null);
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const set = <K extends keyof AgentConfig>(k: K, v: AgentConfig[K]) =>
    setCfg((c) => ({ ...c, [k]: v }));
  const setTool = (k: keyof AgentConfig['tools'], v: boolean) =>
    setCfg((c) => ({ ...c, tools: { ...c.tools, [k]: v } }));

  const send = (text: string) => {
    if (!text.trim()) return;
    const { reply, changes } = propose(text, cfg);
    setCfg((c) => applyChanges(c, changes));
    setTouched(new Set(changes.map((c) => c.path)));
    setMessages((m) => [...m, { role: 'user', text }, { role: 'agent', text: reply, changes }]);
    setInput('');
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
    if (isNew) return 'Describe the job, or set the knobs yourself';
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
                  Say it in plain words. I'll set the knobs on the right and tell you why
                  I picked each one — nothing is hidden, and you can override all of it.
                </p>
                <div className="space-y-2">
                  {STARTERS.map((s) => (
                    <button key={s} onClick={() => send(s)}
                      className="w-full text-left px-3 py-2 text-[13px] bg-card hover:bg-accent border border-border rounded transition-colors">
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
          </div>

          <div className="border-t border-border p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send(input)}
                placeholder="Describe what it should do…"
                className="flex-1 h-10 px-3 rounded border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
              <SendButton onClick={() => send(input)} disabled={!input.trim()} />
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

            <Section icon={FolderLock} title="Sandbox"
              hint="What it may touch, and how much it may use"
              notEnforced="Saved with the agent, but the runtime has no per-agent sandbox envelope yet — Python still runs in the shared sandbox with its own fixed limits. Set these for when it lands; do not rely on them today.">
              <Knob path="fileAccess" touched={touched} label="File access">
                <Choice<FileAccess>
                  value={cfg.fileAccess} onChange={(v) => set('fileAccess', v)}
                  options={(Object.keys(FILE_ACCESS_COPY) as FileAccess[]).map((id) => ({
                    id, label: FILE_ACCESS_COPY[id].label, hint: FILE_ACCESS_COPY[id].hint,
                  }))} />
              </Knob>
              <div className="grid sm:grid-cols-2 gap-3">
                <Knob path="cpu" touched={touched} label="vCPU">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-muted-foreground" />
                    <input type="number" min={1} max={8} value={cfg.cpu}
                      onChange={(e) => set('cpu', Number(e.target.value))}
                      className="w-full h-9 px-2 rounded border border-input bg-background text-sm" />
                  </div>
                </Knob>
                <Knob path="memoryMb" touched={touched} label="Memory (MB)">
                  <div className="flex items-center gap-2">
                    <MemoryStick className="w-4 h-4 text-muted-foreground" />
                    <input type="number" min={256} step={256} value={cfg.memoryMb}
                      onChange={(e) => set('memoryMb', Number(e.target.value))}
                      className="w-full h-9 px-2 rounded border border-input bg-background text-sm" />
                  </div>
                </Knob>
              </div>
              <Toggle on={cfg.venv} onChange={(v) => set('venv', v)}
                label="Isolated virtualenv" hint="Its own Python environment, not the host's." />
            </Section>

            <Section icon={Wrench} title="Tools">
              {([
                ['codeExecution', 'Run Python', 'Sandboxed interpreter for calculation and parsing.'],
                ['shell', 'Run shell commands', 'Powerful and blunt — leave off unless it needs it.'],
                ['webSearch', 'Web search', 'Look things up it was not given.'],
                ['scrape', 'Read web pages', 'Fetch and extract from a URL.'],
                ['fileOps', 'Read and write files', 'Within the file access scope above.'],
                ['rag', 'Knowledge base search', 'Retrieve from your indexed documents.'],
                ['mcp', 'MCP servers', 'The tools from your connected MCP servers, using your credentials.'],
              ] as const).map(([k, label, hint]) => (
                <Knob key={k} path={`tools.${k}`} touched={touched} label="">
                  <Toggle on={cfg.tools[k]} onChange={(v) => setTool(k, v)} label={label} hint={hint} />
                </Knob>
              ))}
            </Section>

            <Section icon={Plug} title="Context it is given">
              <Knob path="connectors" touched={touched} label="Connectors (not yet applied)"
                    hint={cfg.connectors.length ? `${cfg.connectors.length} selected` : undefined}>
                <MultiSelect
                  options={CONNECTOR_OPTIONS.map((c) => ({ id: c.id, label: c.label }))}
                  value={cfg.connectors}
                  onChange={(v) => set('connectors', v)}
                  placeholder="No connectors — it works only with what you give it"
                  searchPlaceholder="Search connectors…"
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
                hint="Not yet applied — nothing reads this at run time." />
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
              {cfg.trigger === 'maintenance' && (
                <Knob path="schedule" touched={touched} label="Schedule" hint="cron, UTC">
                  <input value={cfg.schedule} onChange={(e) => set('schedule', e.target.value)}
                    placeholder="0 9 * * 1"
                    className="w-full h-9 px-3 rounded border border-input bg-background text-sm font-mono" />
                </Knob>
              )}
              <Knob path="allowUnattended" touched={touched} label="">
                <Toggle on={cfg.allowUnattended} onChange={(v) => set('allowUnattended', v)}
                  label="May run with nobody watching"
                  hint="Required for schedules, webhooks, and being delegated to by another agent." />
              </Knob>
              {cfg.schedule && !cfg.allowUnattended && (
                <p className="flex items-start gap-1.5 text-[12px] text-destructive">
                  <Clock className="w-3.5 h-3.5 mt-px shrink-0" />
                  A schedule without this is refused at every firing — the runtime
                  checks it again, and the sweep disables the trigger after five
                  refusals. Save is blocked until one of the two changes.
                </p>
              )}
            </Section>

            <Section icon={ShieldCheck} title="Guardrails">
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
                  Partly applied: the agent is told this in its instructions, and
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
                    Shell plus an open network is refused on save — anything the agent
                    reads, it can also send. Narrow one of the two.
                  </p>
                )}
              </Knob>
              <Toggle on={cfg.notifyOnHitl} onChange={(v) => set('notifyOnHitl', v)}
                label="Notify me when it stops to ask"
                hint="Not yet applied — approval notifications are sent regardless of this setting." />
              <Knob path="reviewAgent" touched={touched} label="">
                <Toggle on={cfg.reviewAgent} onChange={(v) => set('reviewAgent', v)}
                  label="Review agent"
                  hint="Not yet applied — grading exists in Evals, but this toggle is not wired to it." />
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

            <Section icon={Layers} title="Context lifecycle" hint="For long-running agents"
              notEnforced="Saved, but the turn loop does not read these yet. Long runs currently use the built-in context handling regardless of what is set here.">
              <Toggle on={cfg.recursiveContext} onChange={(v) => set('recursiveContext', v)}
                label="Recursive context management" hint="Summarise and re-summarise as the window fills." />
              <Toggle on={cfg.compaction} onChange={(v) => set('compaction', v)}
                label="Compaction" hint="Collapse finished work into a short record." />
              <Toggle on={cfg.indexing} onChange={(v) => set('indexing', v)}
                label="Indexing" hint="Index what it drops so it can retrieve it later." />
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
