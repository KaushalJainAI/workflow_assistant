/**
 * Agents — a named agent with a brief, a toolset and an autonomy level.
 *
 * The prototype treats agents, not workflows, as the thing you delegate to: you
 * hire "Finance Agent" and it decides which steps to run. Workflows stay as the
 * deterministic layer underneath.
 */
import { Link } from 'react-router-dom';
import { Bot, Plus, Wrench, ShieldCheck, Zap, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import PageHeader from '../components/layout/PageHeader';
import PreviewNotice from '../components/ui/PreviewNotice';
import { SAMPLE_AGENTS } from '../lib/sampleAgents';
import { AUTONOMY_COPY, CONNECTOR_OPTIONS, TRIGGER_COPY, type AgentConfig } from '../types/agentConfig';

/* Autonomy is the whole safety story, so it is the most prominent field on the
   card: how much this agent may do before it has to stop and ask. */
const autonomyStyle = {
  full: 'bg-agent-subtle text-agent border-agent-line',
  ask: 'bg-primary-subtle text-primary border-primary-line',
  review: 'bg-secondary text-muted-foreground border-border',
} as const;

const TOOL_NAMES: Record<string, string> = {
  codeExecution: 'Python',
  shell: 'Shell',
  webSearch: 'Web search',
  scrape: 'Read pages',
  fileOps: 'Files',
  rag: 'Knowledge base',
};

/** What this agent was granted, as readable chips. */
function grants(cfg: AgentConfig) {
  const tools = Object.entries(cfg.tools)
    .filter(([, on]) => on)
    .map(([k]) => TOOL_NAMES[k] ?? k);
  const conns = cfg.connectors.map(
    (id) => CONNECTOR_OPTIONS.find((c) => c.id === id)?.label ?? id
  );
  return [...conns, ...tools];
}

export default function Agents() {
  const totalRuns = SAMPLE_AGENTS.reduce((n, a) => n + a.runs, 0);

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        icon={Bot}
        title="Agents"
        subtitle={`${SAMPLE_AGENTS.length} agents · ${totalRuns} runs this month`}
        actions={
          <Link
            to="/agents/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded font-semibold text-sm hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            New agent
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <PreviewNotice what="Agents" />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {SAMPLE_AGENTS.map((a) => {
            const cfg = a.config;
            const pct = Math.round((a.unattended / a.runs) * 100);
            return (
              /* The whole card opens the builder, prefilled. A list you cannot
                 click into is a dead end — and editing an agent is the same act
                 as creating one, so it is the same board. */
              <Link
                key={a.id}
                to={`/agents/${a.id}`}
                className="block bg-card border border-border rounded p-4 hover:border-border-strong hover:bg-secondary/40 transition-colors"
              >
                <div className="flex items-start gap-3 mb-3">
                  <span className="w-9 h-9 rounded bg-agent-subtle border border-agent-line text-agent flex items-center justify-center text-[13px] font-semibold shrink-0">
                    {a.initials}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{cfg.name}</h3>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded border text-[11px] font-semibold',
                        autonomyStyle[cfg.autonomy]
                      )}
                    >
                      <ShieldCheck className="w-3 h-3" />
                      {AUTONOMY_COPY[cfg.autonomy].label}
                    </span>
                  </div>
                </div>

                <p className="text-[13px] text-muted-foreground leading-relaxed mb-3">{cfg.brief}</p>

                <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground mb-3">
                  <Clock className="w-3 h-3" />
                  {TRIGGER_COPY[cfg.trigger].label}
                  {cfg.schedule && <span className="font-mono">· {cfg.schedule}</span>}
                </div>

                <div className="flex flex-wrap gap-1 mb-4">
                  {grants(cfg).map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary border border-border text-[11px] text-muted-foreground"
                    >
                      <Wrench className="w-3 h-3" />
                      {t}
                    </span>
                  ))}
                </div>

                {/* How much of its work needed nobody — the number that tells you
                    whether delegating to this agent is actually paying off. */}
                <div className="pt-3 border-t border-border">
                  <div className="flex items-center justify-between text-[12px] mb-1.5">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      {pct}% handled without you
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {a.runs} runs · {a.spend}
                    </span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded overflow-hidden">
                    <span className="block h-full bg-agent rounded" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
