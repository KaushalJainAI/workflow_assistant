/**
 * Agents — a named agent with a brief, a toolset and an autonomy level.
 *
 * The prototype treats agents, not workflows, as the thing you delegate to: you
 * hire "Finance agent" and it decides which steps to run. Workflows stay as the
 * deterministic layer underneath.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Plus, Wrench, ShieldCheck, Zap, Clock, Sliders, LayoutGrid, Share2, Play, Archive, ArchiveRestore } from 'lucide-react';
import { cn } from '../lib/utils';
import PageHeader from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Loading';
import agentsService, { type Agent } from '../api/agents';
import {
  AUTONOMY_COPY, STATUS_COPY, TRIGGER_COPY, type AgentStatus,
} from '../types/agentConfig';
import { mcpService } from '../api/mcp';
import ShareAgentDialog from '../components/agents/ShareAgentDialog';
import RunAgentDialog from '../components/agents/RunAgentDialog';

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
  office: 'Office files',
  media: 'Images',
  publish: 'Publishing',
  browser: 'Browser',
  rag: 'Knowledge base',
  mcp: 'Connectors',
  subAgents: 'Other agents',
};

/** Chips shown before the rest fold into "+N". A card is for recognising an
 *  agent at a glance; the full list is one click away in the builder. */
const MAX_CHIPS = 3;

/** What the card says the agent is for.
 *
 * `brief` is the agent's whole instruction set — often a page of prose written
 * for a model, not a person — so it is never shown here in full. `description`
 * is the one line meant for this; without one, the brief's first sentence
 * stands in, and the card clamps whatever it gets to two lines. */
function summary(agent: Agent): string {
  const line = agent.description?.trim();
  if (line) return line;
  const brief = (agent.brief ?? '').trim();
  if (!brief) return 'No description yet.';
  const first = brief.split(/(?<=[.!?])\s|\n/)[0].trim();
  return first.length > 160 ? `${first.slice(0, 157).trimEnd()}…` : first;
}

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
  // The generic `mcp` grant is dropped when named connections follow it:
  // "Connectors" beside "Gmail" and "Google Drive" says the same thing twice.
  const named = (agent.connectors ?? []).length > 0;
  const tools = Object.entries(agent.tools ?? {})
    .filter(([k, on]) => on && !(k === 'mcp' && named))
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

function EmptyStateView() {
  return (
    <EmptyState
      align="left"
      icon={Bot}
      title="No agents yet"
      body="An agent combines instructions and tools. Describe the job in plain language and the builder handles setup — you can change anything."
      action={
        <>
          <Link to="/agents/new">
            <Button size="md">
              <Plus className="w-4 h-4" />
              New agent
            </Button>
          </Link>
          {/* The likelier first move of the two: starting from a template means
              approving a permission envelope somebody already thought about,
              rather than choosing every dial from scratch. */}
          <Link to="/templates">
            <Button variant="secondary" size="md">
              <LayoutGrid className="w-4 h-4" />
              Start from a template
            </Button>
          </Link>
        </>
      }
    />
  );
}

export default function Agents() {
  /* Which agent's share dialog is open, if any. The dialog previews before it
     publishes, so opening it is safe and commits nothing. */
  const [sharing, setSharing] = useState<Agent | null>(null);
  const [runningAgent, setRunningAgent] = useState<Agent | null>(null);
  const { data: allAgents = [], isLoading, isError } = useQuery({
    queryKey: ['agents'],
    queryFn: () => agentsService.list(),
  });
  // Archived agents are filed away, not gone: behind a toggle, restorable.
  // Before archive was settable the only way to clear an agent out of this
  // list was to delete it, which also took its run history.
  const [showArchived, setShowArchived] = useState(false);
  const archivedCount = allAgents.filter((a) => a.status === 'archived').length;
  const agents = allAgents.filter((a) =>
    showArchived ? a.status === 'archived' : a.status !== 'archived');
  const queryClient = useQueryClient();
  const restore = useMutation({
    mutationFn: (id: number) => agentsService.update(id, { status: 'active' }),
    onSuccess: (agent) => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success(`${agent.name} restored`);
    },
    onError: () => toast.error('Could not restore that agent.'),
  });
  /* Connection names for the capability chips. An agent stores ids; the label
     belongs to the connector row, so it is fetched rather than mapped here. */
  const { data: connectorNames = new Map<number, string>() } = useQuery({
    queryKey: ['agents', 'connection-names'],
    queryFn: async () =>
      new Map((await mcpService.list()).servers.map((s) => [s.id, s.label])),
    staleTime: 5 * 60 * 1000,
  });

  const totalRuns = allAgents.reduce((n, a) => n + (a.runs ?? 0), 0);
  const subtitle = isLoading
    ? 'Loading…'
    : `${allAgents.length - archivedCount} ${allAgents.length - archivedCount === 1 ? 'agent' : 'agents'} · ${totalRuns} runs`;

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        icon={Bot}
        title="Agents"
        subtitle={subtitle}
        actions={
          <div className="flex items-center gap-2">
          {(archivedCount > 0 || showArchived) && (
            <Button variant="secondary" size="md"
              onClick={() => setShowArchived((v) => !v)}>
              <Archive className="w-4 h-4" />
              {showArchived ? 'Back to agents' : `Archived (${archivedCount})`}
            </Button>
          )}
          <Link to="/templates">
            <Button variant="secondary" size="md">
              <LayoutGrid className="w-4 h-4" />
              Explore
            </Button>
          </Link>
          <Link to="/agents/new">
            <Button size="md">
              <Plus className="w-4 h-4" />
              New agent
            </Button>
          </Link>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
            <Spinner size="md" />
            Loading agents…
          </div>
        ) : isError ? (
          <p className="text-[13px] text-destructive py-12">
            Could not load your agents. Reload the page to try again.
          </p>
        ) : agents.length === 0 && showArchived ? (
          <p className="text-[13px] text-muted-foreground py-12">Nothing is archived.</p>
        ) : agents.length === 0 ? (
          <EmptyStateView />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((a) => {
              // Before the first run there is no honest percentage to show.
              const pct = a.runs ? Math.round((a.unattended / a.runs) * 100) : null;
              const chips = grants(a, connectorNames);
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
                      {/* Only the statuses that change behaviour: a
                          paused agent's schedules are not firing. */}
                      {(a.status === 'paused' || a.status === 'archived') && (
                        <span className="inline-flex items-center mt-1 ml-1.5 px-1.5 py-0.5 rounded border border-border text-[11px] font-semibold text-muted-foreground"
                          title={STATUS_COPY[a.status as AgentStatus]?.hint}>
                          {STATUS_COPY[a.status as AgentStatus]?.label ?? a.status}
                        </span>
                      )}
                    </div>
                  </div>

                  <p
                    className="text-[13px] text-muted-foreground leading-relaxed mb-3 line-clamp-2 min-h-[2.6em]"
                    title={a.description || undefined}
                  >
                    {summary(a)}
                  </p>

                  {chips.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {chips.slice(0, MAX_CHIPS).map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary border border-border text-[11px] text-muted-foreground"
                        >
                          <Wrench className="w-3 h-3" />
                          {t}
                        </span>
                      ))}
                      {chips.length > MAX_CHIPS && (
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded border border-dashed border-border text-[11px] text-muted-foreground"
                          title={chips.slice(MAX_CHIPS).join(', ')}
                        >
                          +{chips.length - MAX_CHIPS} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* One footer line: when it runs and what it has done. The
                      bar is how much of its work needed nobody — the number
                      that says whether delegating to it is paying off — and it
                      only appears once there is a run to measure. */}
                  <div className="pt-3 border-t border-border">
                    <div className="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
                      <span className="flex items-center gap-1 min-w-0 truncate">
                        <Clock className="w-3 h-3 shrink-0" />
                        {TRIGGER_COPY[a.schedule ? 'maintenance' : 'goal'].label}
                      </span>
                      <span className="tabular-nums shrink-0">
                        {a.runs ? `${a.runs} ${a.runs === 1 ? 'run' : 'runs'}` : 'Not run yet'}
                        {a.spend ? ` · ₹${a.spend}` : ''}
                      </span>
                    </div>
                    {pct !== null && (
                      <div className="mt-2 flex items-center gap-2" title="Share of runs that finished without needing you">
                        <div className="h-1 flex-1 bg-secondary rounded overflow-hidden">
                          <span className="block h-full bg-agent rounded" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground tabular-nums">
                          <Zap className="w-3 h-3" />
                          {pct}% on its own
                        </span>
                      </div>
                    )}
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
                  {/* Run by hand. The execute endpoint had no caller in the
                      app, so an agent could only be run by asking chat to. */}
                  {a.status === 'archived' ? (
                    <button
                      type="button"
                      onClick={() => restore.mutate(a.id)}
                      disabled={restore.isPending}
                      className="flex-1 border-l border-border px-3 py-2 text-[12px] text-muted-foreground hover:bg-secondary inline-flex items-center justify-center gap-1.5"
                    >
                      <ArchiveRestore className="w-3 h-3" />
                      Restore
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRunningAgent(a)}
                      className="flex-1 border-l border-border px-3 py-2 text-[12px] text-muted-foreground hover:bg-secondary inline-flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-3 h-3" />
                      Run
                    </button>
                  )}
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

      {runningAgent && (
        <RunAgentDialog
          agentId={runningAgent.id}
          agentName={runningAgent.name}
          brief={runningAgent.brief}
          onClose={() => setRunningAgent(null)}
        />
      )}

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
