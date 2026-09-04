/**
 * Agents — a named agent with a brief, a toolset and an autonomy level.
 *
 * The prototype treats agents, not workflows, as the thing you delegate to: you
 * hire "Finance agent" and it decides which steps to run. Workflows stay as the
 * deterministic layer underneath.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bot, Plus, Wrench, ShieldCheck, Zap, Clock, Loader2, Sliders, LayoutGrid, Share2 } from 'lucide-react';
import { cn } from '../lib/utils';
import PageHeader from '../components/layout/PageHeader';
import agentsService, { type Agent } from '../api/agents';
import { AUTONOMY_COPY, TRIGGER_COPY } from '../types/agentConfig';
import { mcpService } from '../api/mcp';
import ShareAgentDialog from '../components/agents/ShareAgentDialog';

/* Autonomy is the whole safety story, so it is the most prominent field on the
   card: how much this agent may do before it has to stop and ask. */
const autonomyStyle = {
  full: 'bg-agent-subtle text-agent border-agent-line',
  auto: 'bg-agent-subtle text-agent border-agent-line',
  ask: 'bg-primary-subtle text-primary border-primary-line',
  review: 'bg-secondary text-muted-foreground border-border',
  plan: 'bg-secondary text-muted-foreground border-border',
} as const;

const TOOL_NAMES: Record<string, string> = {
  codeExecution: 'Python',
  shell: 'Shell',
  webSearch: 'Web search',
  scrape: 'Read pages',
  fileOps: 'Files',
  rag: 'Knowledge base',
};

/** "Finance agent" -> "FA". One letter per word beats slicing the first two
 *  characters, which turns every agent into "AG"-shaped mush. */
function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return (words[0][0] + (words[1]?.[0] ?? words[0][1] ?? '')).toUpperCase();
}

/** What this agent was granted, as readable chips.
 *
 * `names` maps a connection id to its label. It is passed in rather than looked
 * up from a table in this file because connector presentation is served from
 * the database — adding a connector is a fixture row, not an edit here. A id
 * with no name is one the user can no longer see (deleted, or another
 * account's), and it is rendered as such rather than as a bare number: the
 * runtime drops it too, so a chip reading "Gmail" for a connection that no
 * longer resolves would be the one misleading thing this list could say. */
function grants(agent: Agent, names: Map<number, string>) {
  const tools = Object.entries(agent.tools ?? {})
    .filter(([, on]) => on)
    .map(([k]) => TOOL_NAMES[k] ?? k);
  // A stored connection is either a bare id or `{id, mode, tools}`; a
  // read-only one says so here, because "Gmail" and "Gmail (read only)" are
  // different amounts of trust and this list is where they are compared.
  const conns = (agent.connectors ?? []).map((choice) => {
    const id = typeof choice === 'number' ? choice : choice.id;
    const label = names.get(id) ?? 'Unavailable connection';
    const mode = typeof choice === 'number' ? 'all' : choice.mode;
    return mode === 'all' ? label : `${label} (${mode === 'read' ? 'read only' : 'limited'})`;
  });
  return [...conns, ...tools];
}

function EmptyState() {
  return (
    <div className="max-w-md py-12">
      <div className="w-10 h-10 rounded bg-agent-subtle border border-agent-line flex items-center justify-center mb-3">
        <Bot className="w-5 h-5 text-agent" />
      </div>
      <h2 className="font-semibold mb-1">No agents yet</h2>
      <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
        An agent combines instructions and tools. Describe the job in plain
        language and the builder handles setup — you can change anything.
      </p>
      <div className="flex items-center gap-2">
        <Link
          to="/agents/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded font-semibold text-sm hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          New agent
        </Link>
        {/* The likelier first move of the two: starting from a template means
            approving a permission envelope somebody already thought about,
            rather than choosing every dial from scratch. */}
        <Link
          to="/templates"
          className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded font-semibold text-sm hover:bg-secondary"
        >
          <LayoutGrid className="w-4 h-4" />
          Start from a template
        </Link>
      </div>
    </div>
  );
}

export default function Agents() {
  /* Which agent's share dialog is open, if any. The dialog previews before it
     publishes, so opening it is safe and commits nothing. */
  const [sharing, setSharing] = useState<Agent | null>(null);
  const { data: agents = [], isLoading, isError } = useQuery({
    queryKey: ['agents'],
    queryFn: () => agentsService.list(),
  });
  /* Connection names for the capability chips. An agent stores ids; the label
     belongs to the connector row, so it is fetched rather than mapped here. */
  const { data: connectorNames = new Map<number, string>() } = useQuery({
    queryKey: ['agents', 'connection-names'],
    queryFn: async () =>
      new Map((await mcpService.list()).servers.map((s) => [s.id, s.label])),
    staleTime: 5 * 60 * 1000,
  });

  const totalRuns = agents.reduce((n, a) => n + (a.runs ?? 0), 0);
  const subtitle = isLoading
    ? 'Loading…'
    : `${agents.length} ${agents.length === 1 ? 'agent' : 'agents'} · ${totalRuns} runs`;

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        icon={Bot}
        title="Agents"
        subtitle={subtitle}
        actions={
          <div className="flex items-center gap-2">
          <Link
            to="/templates"
            className="flex items-center gap-2 px-4 py-2 border border-border rounded font-semibold text-sm hover:bg-secondary"
          >
            <LayoutGrid className="w-4 h-4" />
            Explore
          </Link>
          <Link
            to="/agents/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded font-semibold text-sm hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            New agent
          </Link>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading agents…
          </div>
        ) : isError ? (
          <p className="text-[13px] text-destructive py-12">
            Could not load your agents. Reload the page to try again.
          </p>
        ) : agents.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((a) => {
              // Before the first run there is no honest percentage to show.
              const pct = a.runs ? Math.round((a.unattended / a.runs) * 100) : null;
              return (
                /* The whole card opens the builder, prefilled. A list you cannot
                   click into is a dead end — and editing an agent is the same act
                   as creating one, so it is the same board. */
                <div
                  key={a.id}
                  className="bg-card border border-border rounded hover:border-border-strong transition-colors"
                >
                <Link
                  to={`/agents/${a.id}`}
                  className="block p-4 hover:bg-secondary/40 transition-colors"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span className="w-9 h-9 rounded bg-agent-subtle border border-agent-line text-agent flex items-center justify-center text-[13px] font-semibold shrink-0">
                      {initials(a.name)}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{a.name}</h3>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded border text-[11px] font-semibold',
                          autonomyStyle[a.autonomy]
                        )}
                      >
                        <ShieldCheck className="w-3 h-3" />
                        {AUTONOMY_COPY[a.autonomy].label}
                      </span>
                    </div>
                  </div>

                  <p className="text-[13px] text-muted-foreground leading-relaxed mb-3">
                    {a.brief || 'No description yet.'}
                  </p>

                  <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground mb-3">
                    <Clock className="w-3 h-3" />
                    {TRIGGER_COPY[a.schedule ? 'maintenance' : 'goal'].label}
                    {a.schedule && <span className="font-mono">· {a.schedule}</span>}
                  </div>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {grants(a, connectorNames).map((t) => (
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
                        {pct === null ? 'Not run yet' : `${pct}% handled without you`}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {a.runs} runs{a.spend ? ` · ₹${a.spend}` : ''}
                      </span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded overflow-hidden">
                      <span
                        className="block h-full bg-agent rounded"
                        style={{ width: `${pct ?? 0}%` }}
                      />
                    </div>
                  </div>
                </Link>

                {/* One surface now: the builder. The canvas that used to sit
                    beside it was retired 2026-08-24 — a run is read on /runs
                    and in the Inbox, not projected onto a graph. */}
                <div className="flex border-t border-border">
                  <Link
                    to={`/agents/${a.id}`}
                    className="flex-1 px-3 py-2 text-[12px] text-muted-foreground hover:bg-secondary inline-flex items-center justify-center gap-1.5"
                  >
                    <Sliders className="w-3 h-3" />
                    Configure
                  </Link>
                  {/* Sharing sits on the agent rather than on Explore, because
                      what you publish is something you own — and the dialog
                      shows the whole payload before anything leaves. */}
                  <button
                    type="button"
                    onClick={() => setSharing(a)}
                    className="flex-1 border-l border-border px-3 py-2 text-[12px] text-muted-foreground hover:bg-secondary inline-flex items-center justify-center gap-1.5"
                  >
                    <Share2 className="w-3 h-3" />
                    Share
                  </button>
                </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {sharing && (
        <ShareAgentDialog
          agentId={sharing.id}
          agentName={sharing.name}
          onClose={() => setSharing(null)}
        />
      )}
    </div>
  );
}
