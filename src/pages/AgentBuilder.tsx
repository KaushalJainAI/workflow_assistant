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
import { useQuery } from '@tanstack/react-query';
import {
  Bot, Send, Sparkles, Cpu, MemoryStick, FolderLock, Wrench, Plug,
  ShieldCheck, Clock, Layers, Save, RotateCcw, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import nodeService from '../api/nodeService';
import { kbService } from '../api/documents';
import { cn } from '../lib/utils';
import PreviewNotice from '../components/ui/PreviewNotice';
import MultiSelect from '../components/ui/MultiSelect';
import {
  DEFAULT_AGENT, CONNECTOR_OPTIONS, TRIGGER_COPY, AUTONOMY_COPY, FILE_ACCESS_COPY,
  type AgentConfig, type TriggerMode, type Autonomy, type FileAccess,
} from '../types/agentConfig';
import { propose, applyChanges, type Change } from '../lib/agentProposals';
import { findSampleAgent } from '../lib/sampleAgents';

type Msg = { role: 'user' | 'agent'; text: string; changes?: Change[] };

const STARTERS = [
  'Read invoices from Gmail every Monday and chase anything overdue by 30 days',
  'Watch Drive for files nobody has opened in 3 years and propose what to archive',
  'Classify support tickets and draft a first reply, but never send without asking',
  'Answer questions about our uploaded spreadsheets by writing Python',
];

/* ---------- small building blocks ---------- */

function Section({ icon: Icon, title, hint, children }: {
  icon: typeof Cpu; title: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <section className="border border-border rounded bg-card mb-4 break-inside-avoid">
      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-[13px] font-semibold">{title}</h3>
        {hint && <span className="text-[12px] text-muted-foreground ml-auto">{hint}</span>}
      </header>
      <div className="p-4 space-y-3">{children}</div>
    </section>
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
            <Sparkles className="w-3 h-3" />set by agent
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
  // /agents/new -> blank board. /agents/:id -> the same board, prefilled.
  // Editing and creating are the same act, so they are the same screen.
  const { id } = useParams<{ id: string }>();
  const existing = id && id !== 'new' ? findSampleAgent(id) : undefined;

  const [cfg, setCfg] = useState<AgentConfig>(existing?.config ?? DEFAULT_AGENT);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Real model catalogue — the picker should show what is actually callable.
  const { data: providers = [] } = useQuery({
    queryKey: ['agent-builder', 'models'],
    queryFn: async () => (await nodeService.getAIModels()).providers,
    staleTime: 5 * 60 * 1000,
  });
  const { data: kbs = [] } = useQuery({
    queryKey: ['agent-builder', 'kbs'],
    queryFn: () => kbService.list(),
    staleTime: 5 * 60 * 1000,
  });

  const activeProvider = useMemo(
    () => providers.find((p) => p.slug === cfg.provider) ?? providers[0],
    [providers, cfg.provider]
  );

  // Seed the model once the catalogue arrives, rather than shipping a hardcoded id.
  useEffect(() => {
    if (!cfg.model && activeProvider?.models?.length) {
      setCfg((c) => ({ ...c, provider: activeProvider.slug, model: activeProvider.models[0].value }));
    }
  }, [activeProvider, cfg.model]);

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
    setCfg(existing?.config ?? DEFAULT_AGENT);
    setTouched(new Set());
    setMessages([]);
  };

  return (
    <div className="h-full flex flex-col">
      <header className="px-4 md:px-6 py-4 border-b border-border flex items-center gap-3">
        <div className="p-2 bg-agent-subtle border border-agent-line rounded">
          <Bot className="w-5 h-5 text-agent" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">
            {existing ? cfg.name || 'Agent' : 'New agent'}
          </h1>
          <p className="text-[13px] text-muted-foreground">
            {existing
              ? `${existing.runs} runs · ${Math.round((existing.unattended / existing.runs) * 100)}% handled without you · ${existing.spend}`
              : 'Describe the job, or set the knobs yourself'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={reset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-border hover:bg-secondary">
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={() => toast.info('Saving needs the agents API — nothing is persisted yet.')}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded bg-primary text-primary-foreground hover:bg-primary/90">
            <Save className="w-4 h-4" />
            {existing ? 'Save changes' : 'Create agent'}
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
                  <Sparkles className="w-5 h-5 text-agent" />
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
              <button onClick={() => send(input)} disabled={!input.trim()}
                className="w-10 h-10 rounded bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ---- knob board ---- */}
        <div className="hidden lg:block flex-1 overflow-y-auto p-6 bg-bg-1">
          <div className="max-w-[1600px]">
            <PreviewNotice what="The agents API" />
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

            <Section icon={Sparkles} title="Model">
              <div className="grid sm:grid-cols-2 gap-3">
                <Knob path="provider" touched={touched} label="Provider">
                  <select value={cfg.provider}
                    onChange={(e) => {
                      const p = providers.find((x) => x.slug === e.target.value);
                      setCfg((c) => ({ ...c, provider: e.target.value, model: p?.models?.[0]?.value ?? '' }));
                    }}
                    className="w-full h-9 px-2 rounded border border-input bg-background text-sm">
                    {providers.map((p) => (
                      <option key={p.slug} value={p.slug}>{p.name}</option>
                    ))}
                  </select>
                </Knob>
                <Knob path="model" touched={touched} label="Model">
                  <select value={cfg.model} onChange={(e) => set('model', e.target.value)}
                    className="w-full h-9 px-2 rounded border border-input bg-background text-sm">
                    {(activeProvider?.models ?? []).map((mo) => (
                      <option key={mo.value} value={mo.value}>
                        {mo.name}{mo.is_free ? ' · free' : ''}
                      </option>
                    ))}
                  </select>
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

            <Section icon={FolderLock} title="Sandbox" hint="What it may touch, and how much it may use">
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
              ] as const).map(([k, label, hint]) => (
                <Knob key={k} path={`tools.${k}`} touched={touched} label="">
                  <Toggle on={cfg.tools[k]} onChange={(v) => setTool(k, v)} label={label} hint={hint} />
                </Knob>
              ))}
            </Section>

            <Section icon={Plug} title="Context it is given">
              <Knob path="connectors" touched={touched} label="Connectors"
                    hint={cfg.connectors.length ? `${cfg.connectors.length} selected` : undefined}>
                <MultiSelect
                  options={CONNECTOR_OPTIONS.map((c) => ({ id: c.id, label: c.label }))}
                  value={cfg.connectors}
                  onChange={(v) => set('connectors', v)}
                  placeholder="No connectors — it works only with what you give it"
                  searchPlaceholder="Search connectors…"
                />
              </Knob>
              <Knob path="knowledgeBases" touched={touched} label="Knowledge bases"
                    hint={cfg.knowledgeBases.length ? `${cfg.knowledgeBases.length} selected` : undefined}>
                {/* Ids are numeric on the wire; the control speaks strings. */}
                <MultiSelect
                  options={kbs.map((kb) => ({
                    id: String(kb.id),
                    label: kb.name,
                    hint: `${kb.doc_count} documents`,
                  }))}
                  value={cfg.knowledgeBases.map(String)}
                  onChange={(v) => set('knowledgeBases', v.map(Number))}
                  placeholder="No knowledge bases"
                  searchPlaceholder="Search knowledge bases…"
                  emptyText="None yet — add documents first."
                />
              </Knob>
              <Toggle on={cfg.useOrgContext} onChange={(v) => set('useOrgContext', v)}
                label="Organisation context" hint="House style, entity names, standing facts." />
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
                <Knob path="schedule" touched={touched} label="Schedule" hint="cron">
                  <input value={cfg.schedule} onChange={(e) => set('schedule', e.target.value)}
                    placeholder="0 9 * * 1"
                    className="w-full h-9 px-3 rounded border border-input bg-background text-sm font-mono" />
                </Knob>
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
              <Toggle on={cfg.notifyOnHitl} onChange={(v) => set('notifyOnHitl', v)}
                label="Notify me when it stops to ask" hint="Otherwise it waits silently in Inbox." />
              <Knob path="reviewAgent" touched={touched} label="">
                <Toggle on={cfg.reviewAgent} onChange={(v) => set('reviewAgent', v)}
                  label="Review agent" hint="A second agent grades the output before you see it." />
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

            <Section icon={Layers} title="Context lifecycle" hint="For long-running agents">
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
                onClick={() => toast.info('Saving needs the agents API — nothing is persisted yet.')}
                className="px-4 py-2 text-sm font-semibold rounded bg-primary text-primary-foreground hover:bg-primary/90">
                {existing ? 'Save changes' : 'Create agent'}
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
