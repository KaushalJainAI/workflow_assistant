/**
 * Explore — agent configurations you can install and then change.
 *
 * Two sources sit side by side: templates we curate, and agents other users
 * have published. They are presented identically on purpose. From the
 * installer's side the provenance changes how much you trust it, not what the
 * thing is or how it arrives — so the card carries a byline and the install
 * flow is the same code either way.
 *
 * The install dialog is the part worth caring about. Installing someone else's
 * agent means letting a recipe you cannot read touch your files and act on
 * your behalf, and unlike a workflow there is no graph to inspect: the
 * permission envelope *is* the safety mechanism (`docs/AGENT_TEMPLATES.md`
 * §5). So the dialog is an app-store permission prompt, and every line of it
 * is rendered from `template.config` — the same keys the backend stores and
 * the runtime enforces. There is no second vocabulary here that could drift
 * from the first, which is the one failure this screen cannot tolerate.
 *
 * The requirement dropdowns are the other half. A template names *what kind*
 * of connection or corpus it needs, never an id, and the installer satisfies
 * each one from their own rows — so a template can be shared without carrying
 * anything private, and credentials never travel.
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BookOpen,
  Bot,
  CalendarClock,
  Check,
  Clock,
  Coins,
  Download,
  Globe,
  Inbox,
  LayoutGrid,
  Loader2,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Table2,
  User,
  Wrench,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import PageHeader from '../components/layout/PageHeader';
import templatesService, {
  type AgentTemplate,
  type RequirementChoices,
  type TemplateSource,
} from '../api/templates';
import {
  AUTONOMY_COPY,
  FILE_ACCESS_COPY,
  type Autonomy,
  type FileAccess,
} from '../types/agentConfig';

/* Icons are keyed off the template's stable `icon` slug, never its name — the
   same rule the connector catalogue follows, and for the same reason: copy
   changes, identifiers do not. An unknown slug falls back rather than
   rendering an empty tile. */
const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  search: Search,
  inbox: Inbox,
  'book-open': BookOpen,
  'calendar-clock': CalendarClock,
  table: Table2,
  radar: Radar,
};

/* What each grant lets the agent do, in the second person, because that is the
   question the installer is actually answering: not "what tools does it have"
   but "what are you handing over". */
const GRANT_COPY: Record<string, string> = {
  webSearch: 'Search the web',
  scrape: 'Open and read web pages',
  codeExecution: 'Run Python in a sandbox',
  shell: 'Run shell commands',
  fileOps: 'Read and write your files',
  rag: 'Search a knowledge base',
  mcp: 'Use your connections',
  subAgents: 'Delegate to your other agents',
};

const REQUIREMENT_NOUN: Record<string, string> = {
  connector: 'Connection',
  knowledge_base: 'Knowledge base',
  skill: 'Skill',
};

const autonomyStyle: Record<Autonomy, string> = {
  full: 'bg-agent-subtle text-agent border-agent-line',
  auto: 'bg-agent-subtle text-agent border-agent-line',
  ask: 'bg-primary-subtle text-primary border-primary-line',
  review: 'bg-secondary text-muted-foreground border-border',
  plan: 'bg-secondary text-muted-foreground border-border',
};

/** The capability lines, in grant order. Only what is on — an install screen
 *  listing everything the agent *cannot* do buries the four lines that matter. */
function granted(template: AgentTemplate): string[] {
  return Object.entries(template.config.tools ?? {})
    .filter(([, on]) => on)
    .map(([key]) => GRANT_COPY[key] ?? key);
}

function TemplateCard({
  template,
  onInstall,
}: {
  template: AgentTemplate;
  onInstall: () => void;
}) {
  const Icon = TEMPLATE_ICONS[template.icon] ?? Bot;
  const autonomy = (template.config.autonomy ?? 'ask') as Autonomy;
  const chips = granted(template);

  return (
    <div className="bg-card border border-border rounded flex flex-col hover:border-border-strong transition-colors">
      <div className="p-4 flex-1">
        <div className="flex items-start gap-3 mb-3">
          <span className="w-9 h-9 rounded bg-agent-subtle border border-agent-line text-agent flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate">{template.name}</h3>
            <div className="flex flex-wrap items-center gap-1 mt-1">
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-semibold',
                  autonomyStyle[autonomy],
                )}
              >
                <ShieldCheck className="w-3 h-3" />
                {AUTONOMY_COPY[autonomy].label}
              </span>
              {/* Provenance is the one thing a card must not blur: an agent a
                  stranger wrote and one we curate warrant different amounts of
                  reading before you hand either your mailbox. */}
              {template.source === 'curated' ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-primary-line bg-primary-subtle text-primary text-[11px] font-semibold">
                  <Sparkles className="w-3 h-3" />
                  Built in
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border bg-secondary text-muted-foreground text-[11px] font-semibold">
                  <User className="w-3 h-3" />
                  {template.is_mine ? 'You' : template.author}
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="text-[13px] text-muted-foreground leading-relaxed mb-3">
          {template.tagline}
        </p>

        {template.config.schedule && (
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground mb-3">
            <Clock className="w-3 h-3" />
            Scheduled
            <span className="font-mono">· {template.config.schedule}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-1">
          {chips.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary border border-border text-[11px] text-muted-foreground"
            >
              <Wrench className="w-3 h-3" />
              {c}
            </span>
          ))}
        </div>
      </div>

      {template.source === 'community' && (
        <div className="px-4 pb-3 text-[12px] text-muted-foreground">
          {template.install_count === 0
            ? 'No installs yet'
            : `${template.install_count} ${template.install_count === 1 ? 'install' : 'installs'}`}
          {template.is_listed === false && ' · withdrawn'}
        </div>
      )}

      <button
        type="button"
        onClick={onInstall}
        className="flex items-center justify-center gap-1.5 border-t border-border px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:bg-secondary"
      >
        <Download className="w-3 h-3" />
        Use this {template.source === 'curated' ? 'template' : 'agent'}
      </button>
    </div>
  );
}

function InstallDialog({
  template,
  onClose,
}: {
  template: AgentTemplate;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState(template.name);
  const [choices, setChoices] = useState<RequirementChoices>(() => {
    /* Preselect where there is exactly one candidate — with a single knowledge
       base there is no choice to make, and asking anyway reads as a question
       the user got wrong when they leave it alone. The provider hint put the
       likeliest connection first, but a first is not an only, so a connection
       is never preselected out of a longer list. */
    const initial: RequirementChoices = {};
    for (const req of template.requirements) {
      if (req.candidates.length === 1) initial[req.key] = req.candidates[0].id;
    }
    return initial;
  });

  const install = useMutation({
    mutationFn: () =>
      templatesService.install(template.slug, { name: name.trim(), requirements: choices }),
    onSuccess: (agent) => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success(`${agent.name} installed`);
      /* Straight into the builder: a template is a starting point, and the
         first thing anyone wants is to see what they just agreed to and
         change the brief. */
      navigate(`/agents/${agent.id}`);
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      toast.error(detail || 'Could not install this template.');
    },
  });

  const missing = template.requirements.filter(
    (r) => !r.optional && choices[r.key] === undefined,
  );
  const config = template.config;
  const fileAccess = (config.fileAccess ?? 'scoped') as FileAccess;
  const autonomy = (config.autonomy ?? 'ask') as Autonomy;

  return (
    <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-4 p-5 border-b border-border">
          <div>
            <h2 className="font-semibold text-lg">Install {template.name}</h2>
            <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
              {template.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-secondary text-muted-foreground shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <label className="block">
            <span className="text-[12px] font-semibold text-muted-foreground">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-background border border-border rounded text-sm"
            />
          </label>

          {/* Every line here is enforced, not described: it renders from the
              same config the backend validates and the runtime reads. */}
          <div>
            <h3 className="text-[12px] font-semibold text-muted-foreground mb-2">
              This agent will be able to
            </h3>
            <ul className="space-y-1.5">
              {granted(template).map((line) => (
                <li key={line} className="flex items-start gap-2 text-[13px]">
                  <Check className="w-3.5 h-3.5 mt-0.5 text-agent shrink-0" />
                  {line}
                </li>
              ))}
              {granted(template).length === 0 && (
                <li className="text-[13px] text-muted-foreground">
                  Nothing beyond answering you. It has no tools at all.
                </li>
              )}
            </ul>
          </div>

          {template.requirements.length > 0 && (
            <div>
              <h3 className="text-[12px] font-semibold text-muted-foreground mb-2">
                What it should use
              </h3>
              <div className="space-y-3">
                {template.requirements.map((req) => (
                  <div key={req.key}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[13px] font-medium">
                        {req.label}
                        {req.optional && (
                          <span className="text-muted-foreground font-normal"> · optional</span>
                        )}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {REQUIREMENT_NOUN[req.type] ?? req.type}
                      </span>
                    </div>
                    <p className="text-[12px] text-muted-foreground mb-1">{req.why}</p>
                    {req.candidates.length === 0 ? (
                      /* An empty pool is a real answer, not a broken dropdown:
                         say what is missing and where it is made. */
                      <p className="text-[12px] text-destructive">
                        You have no {(REQUIREMENT_NOUN[req.type] ?? req.type).toLowerCase()} to
                        use here yet.
                        {req.type === 'connector' && ' Add one on Connections.'}
                        {req.type === 'knowledge_base' && ' Add one on Documents.'}
                      </p>
                    ) : (
                      <select
                        value={choices[req.key] ?? ''}
                        onChange={(e) =>
                          setChoices((prev) => {
                            const next = { ...prev };
                            if (e.target.value === '') delete next[req.key];
                            else next[req.key] = Number(e.target.value);
                            return next;
                          })
                        }
                        className="w-full px-3 py-2 bg-background border border-border rounded text-sm"
                      >
                        <option value="">Choose…</option>
                        {req.candidates.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                            {c.doc_count !== undefined ? ` · ${c.doc_count} documents` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-[12px] font-semibold text-muted-foreground mb-2">Limits</h3>
            <ul className="space-y-1.5 text-[13px]">
              <li className="flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                {AUTONOMY_COPY[autonomy].hint}
              </li>
              {/* A fact about every agent, not a per-template setting: the
                  sandbox runs on an internal-only network. */}
              <li className="flex items-start gap-2">
                <Globe className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                Sandboxed code cannot reach the network.
              </li>
              <li className="flex items-start gap-2">
                <LayoutGrid className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                {FILE_ACCESS_COPY[fileAccess].hint}
              </li>
              <li className="flex items-start gap-2">
                <Coins className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                Spends at most ₹{config.spendCapRupees ?? 500} a month.
              </li>
              {config.schedule && (
                <li className="flex items-start gap-2">
                  <Clock className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  Runs on its own schedule (
                  <span className="font-mono">{config.schedule}</span>) in your timezone, and is
                  therefore cleared to run with nobody watching.
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 p-5 border-t border-border">
          <p className="text-[12px] text-muted-foreground">
            You can change any of this afterwards.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded border border-border hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={install.isPending || missing.length > 0 || !name.trim()}
              onClick={() => install.mutate()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {install.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Install
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The filters, in the order they read. `mine` is last because it is the only
 *  one about you rather than about what is available. */
const FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'curated', label: 'Built in' },
  { key: 'community', label: 'From the community' },
  { key: 'mine', label: 'Shared by you' },
];

export default function Templates() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [installing, setInstalling] = useState<AgentTemplate | null>(null);
  const [filter, setFilter] = useState('all');

  /* A deep link is the only way to reach a `link`-visibility share, so it is
     fetched on its own rather than looked up in the grid — by design that
     entry is not in any listing. A slug that resolves to nothing simply leaves
     the grid showing, which is the right landing for a withdrawn link. */
  const { data: linked } = useQuery({
    queryKey: ['agent-template', slug],
    queryFn: () => templatesService.get(slug as string),
    enabled: !!slug,
    retry: false,
  });

  /* Derived, not mirrored into state. Copying the fetched entry into
     `installing` would need an effect and a second source of truth; this way
     clearing the slug from the URL is what closes a deep-linked dialog,
     because the query it came from is keyed on that slug. */
  const active = installing ?? linked ?? null;

  /* Closing returns to the grid, so the URL stops naming an entry that is no
     longer open — otherwise a reload reopens a dialog the user dismissed. */
  const closeInstall = () => {
    setInstalling(null);
    if (slug) navigate('/templates', { replace: true });
  };

  /* The filter is a server parameter, not a client-side `.filter()`: "shared
     by you" includes listings you have withdrawn, which by definition are not
     in the listing everyone else gets, so it cannot be derived from it. */
  const { data: templates = [], isLoading, isError } = useQuery({
    queryKey: ['agent-templates', filter],
    queryFn: () =>
      templatesService.list(
        filter === 'mine'
          ? { mine: true }
          : filter === 'all'
            ? {}
            : { source: filter as TemplateSource },
      ),
    staleTime: 60 * 1000,
  });

  const subtitle = isLoading
    ? 'Loading…'
    : `${templates.length} ${templates.length === 1 ? 'entry' : 'entries'} · install and edit`;

  return (
    <div className="h-full flex flex-col">
      <PageHeader icon={LayoutGrid} title="Explore" subtitle={subtitle} />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <p className="text-[13px] text-muted-foreground max-w-2xl mb-4 leading-relaxed">
          Installing creates an ordinary agent in your account — you approve
          what it may reach, point it at your own connections and documents,
          and change anything afterwards in the builder. Nothing of the
          author's comes with it: no credentials, no documents, no runs. You can
          publish your own from the Agents page.
        </p>

        <div className="flex flex-wrap gap-1 mb-5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                'px-3 py-1.5 rounded text-[12px] font-semibold border',
                filter === f.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:bg-secondary',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        ) : isError ? (
          <p className="text-[13px] text-destructive py-12">
            Could not load this list. Reload the page to try again.
          </p>
        ) : templates.length === 0 ? (
          <p className="text-[13px] text-muted-foreground py-12 max-w-md leading-relaxed">
            {filter === 'mine'
              ? 'You have not published anything yet. Open an agent on the Agents page and choose Share to list it here.'
              : filter === 'community'
                ? 'Nobody has published an agent yet. Yours would be the first.'
                : 'Nothing to show.'}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((t) => (
              <TemplateCard key={t.slug} template={t} onInstall={() => setInstalling(t)} />
            ))}
          </div>
        )}
      </div>

      {active && <InstallDialog template={active} onClose={closeInstall} />}
    </div>
  );
}
