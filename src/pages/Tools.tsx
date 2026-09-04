/**
 * Tools — the standard tool library, and the one place a tool is switched off
 * for the whole workspace.
 *
 * Vocabulary: Tool = callable function (code, ours), Plugin = external MCP pack
 * (Connections), Connector = credential (Credentials). Nothing is created here.
 *
 * Two levels of configuration, and the page says which is which rather than
 * leaving the user to guess: a **grant** in the agent builder decides what one
 * agent may reach, and a **switch here** decides what exists to be granted. The
 * six grant-backed groups are shown first for that reason — they are the ones
 * an agent's permissions screen mirrors — with the always-on groups below.
 *
 * The page carries no per-tool knowledge. Effects, requirements and the schema
 * for every numeric budget come down with the catalogue, so a tool that grows a
 * knob gets a control here without this file being edited.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Wrench,
  Search,
  Globe,
  BookOpen,
  Code,
  Folder,
  Users,
  Clock,
  MessageCircle,
  Eye,
  LayoutTemplate,
  Shield,
  Plug,
  Terminal,
  ChevronDown,
  X,
  Lock,
  RotateCcw,
  SlidersHorizontal,
  AlertCircle,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import PageHeader from '../components/layout/PageHeader';
import SearchInput from '../components/ui/SearchInput';
import toolsService, {
  type ToolCategory,
  type ToolChange,
  type ToolEntry,
  type ToolsCatalogue,
} from '../api/tools';

const CATALOGUE_KEY = ['tools', 'catalogue'] as const;

const iconMap: Record<string, LucideIcon> = {
  search: Search,
  globe: Globe,
  book: BookOpen,
  code: Code,
  files: Folder,
  users: Users,
  clock: Clock,
  message: MessageCircle,
  eye: Eye,
  layout: LayoutTemplate,
  shield: Shield,
  plug: Plug,
  terminal: Terminal,
};

// ---------------------------------------------------------------------------
// Vocabulary
//
// `effect` and `sensitive` answer different questions and used to share the
// label "Needs approval", which made the drawer read as if it were saying the
// same thing twice. `effect` is what running the tool does to the world;
// `sensitive` is whether a human is asked first. They are shown as different
// kinds of chip for that reason.
// ---------------------------------------------------------------------------

const EFFECT_VIEW: Record<string, { label: string; blurb: string; tone: string }> = {
  read: {
    label: 'Reads only',
    blurb: 'Looks at things. Nothing outside changes.',
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  },
  reversible: {
    label: 'Undoable',
    blurb: 'Changes something you can put back — a deleted file goes to your recycle bin.',
    tone: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  },
  irreversible: {
    label: 'Permanent',
    blurb: 'Cannot be taken back once it runs.',
    tone: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
  },
};

const REQUIREMENT_BLURB: Record<string, string> = {
  memory: 'Needs conversation memory switched on.',
  vision: 'Needs an image the vision witness can look at.',
  spill: 'Appears once a result was too large to keep in full.',
  files: 'Needs an agent with file access; chat never gets it.',
};

type FilterKey = 'all' | 'read' | 'changes' | 'off';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'read', label: 'Reads only' },
  { key: 'changes', label: 'Makes changes' },
  { key: 'off', label: 'Switched off' },
];

function matchesFilter(tool: ToolEntry, filter: FilterKey): boolean {
  if (filter === 'read') return tool.effect === 'read';
  if (filter === 'changes') return tool.effect !== 'read';
  if (filter === 'off') return !tool.enabled;
  return true;
}

function matchesQuery(tool: ToolEntry, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    tool.name.toLowerCase().includes(needle) ||
    tool.displayName.toLowerCase().includes(needle) ||
    tool.description.toLowerCase().includes(needle)
  );
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border whitespace-nowrap',
        'bg-secondary text-muted-foreground border-border',
        className,
      )}
    >
      {children}
    </span>
  );
}

function EffectBadge({ effect }: { effect: string }) {
  const view = EFFECT_VIEW[effect] ?? EFFECT_VIEW.irreversible;
  return <Chip className={view.tone}>{view.label}</Chip>;
}

/** Same switch as Connections, so on/off looks the same everywhere. */
function Switch({
  isOn,
  onToggle,
  disabled,
  label,
}: {
  isOn: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle(!isOn);
      }}
      disabled={disabled}
      role="switch"
      aria-checked={isOn}
      aria-label={`${isOn ? 'Turn off' : 'Turn on'} ${label}`}
      className={cn(
        'inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        'focus-visible:ring-offset-2 focus-visible:ring-offset-card',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        isOn ? 'bg-primary' : 'bg-muted-foreground/30',
      )}
    >
      <span
        className={cn(
          'h-4 w-4 shrink-0 rounded-full bg-white shadow-sm transition-transform',
          isOn ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// One tool
// ---------------------------------------------------------------------------

function ToolRow({
  tool,
  onOpen,
  onToggle,
  busy,
}: {
  tool: ToolEntry;
  onOpen: () => void;
  onToggle: (next: boolean) => void;
  busy: boolean;
}) {
  const off = !tool.enabled;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        'group flex items-start gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors cursor-pointer',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        off
          ? 'border-dashed border-border/60 bg-muted/20'
          : 'border-border/60 bg-background/40 hover:border-primary/40 hover:bg-accent/40',
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              'text-[13px] font-mono font-semibold',
              off && 'text-muted-foreground line-through decoration-muted-foreground/40',
            )}
          >
            {tool.name}
          </span>
          <EffectBadge effect={tool.effect} />
          {tool.settings.length > 0 && (
            <Chip className="border-primary-line/60 text-primary bg-primary-subtle">
              <SlidersHorizontal className="w-2.5 h-2.5" />
              {tool.settings.length === 1 ? '1 setting' : `${tool.settings.length} settings`}
            </Chip>
          )}
          {tool.requires && <Chip>{tool.requires}</Chip>}
          {tool.locked && (
            <Chip>
              <Lock className="w-2.5 h-2.5" />
              Always on
            </Chip>
          )}
        </div>
        <p className="text-[12px] leading-snug text-muted-foreground mt-1 line-clamp-2">
          {tool.description || tool.displayName}
        </p>
      </div>
      <div className="pt-1 shrink-0">
        <Switch
          isOn={tool.enabled}
          onToggle={onToggle}
          disabled={busy || tool.locked || tool.unserved}
          label={tool.name}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One category
// ---------------------------------------------------------------------------

function CategorySection({
  category,
  tools,
  usageCount,
  open,
  onOpenChange,
  onSelect,
  onToggleTool,
  onToggleCategory,
  busy,
}: {
  category: ToolCategory;
  tools: ToolEntry[];
  usageCount?: number;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onSelect: (tool: ToolEntry) => void;
  onToggleTool: (tool: ToolEntry, next: boolean) => void;
  onToggleCategory: (next: boolean) => void;
  busy: boolean;
}) {
  const Icon = iconMap[category.icon] ?? Wrench;
  const switchable = tools.filter((t) => !t.locked && !t.unserved);
  const onCount = tools.filter((t) => t.enabled).length;
  const allOn = switchable.length > 0 && switchable.every((t) => t.enabled);

  return (
    <section
      className={cn(
        'bg-card border rounded-2xl overflow-hidden transition-colors',
        onCount === 0 && tools.length > 0
          ? 'border-dashed border-border/60'
          : 'border-border/60',
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button
          onClick={() => onOpenChange(!open)}
          disabled={tools.length === 0}
          className="flex items-center gap-3 flex-1 min-w-0 text-left disabled:cursor-default"
          aria-expanded={open}
        >
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-foreground">{category.label}</h3>
              {tools.length > 0 && (
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {onCount === tools.length
                    ? `${tools.length} tools`
                    : `${onCount} of ${tools.length} on`}
                </span>
              )}
              {typeof usageCount === 'number' && category.grantBacked && (
                <span className="hidden sm:inline text-[11px] text-muted-foreground">
                  · granted to {usageCount} {usageCount === 1 ? 'agent' : 'agents'}
                </span>
              )}
              {category.unserved && (
                <Chip className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800">
                  Not available
                </Chip>
              )}
            </div>
            {/* The catalogue has always sent this and the page used to drop it. */}
            <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
              {category.description}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-3 shrink-0">
          {switchable.length > 1 && (
            <button
              onClick={() => onToggleCategory(!allOn)}
              disabled={busy}
              className="hidden sm:inline text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
            >
              {allOn ? 'Turn all off' : 'Turn all on'}
            </button>
          )}
          {tools.length > 0 && (
            <ChevronDown
              className={cn(
                'w-4 h-4 text-muted-foreground transition-transform',
                open && 'rotate-180',
              )}
            />
          )}
        </div>
      </div>

      {category.note && (
        <div className="px-4 pb-4">
          <div className="flex gap-2 text-[12px] text-muted-foreground bg-muted/40 border border-border/60 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              {category.note}
              {category.key === 'mcp' && (
                <>
                  {' '}
                  <Link to="/connections" className="underline text-primary font-semibold">
                    Connections
                  </Link>
                  .
                </>
              )}
            </span>
          </div>
        </div>
      )}

      {open && tools.length > 0 && (
        <div className="px-3 pb-3 grid gap-2 grid-cols-1 lg:grid-cols-2">
          {tools.map((tool) => (
            <ToolRow
              key={tool.name}
              tool={tool}
              busy={busy}
              onOpen={() => onSelect(tool)}
              onToggle={(next) => onToggleTool(tool, next)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Detail drawer
// ---------------------------------------------------------------------------

/**
 * The numeric budgets, as an editable draft.
 *
 * Its own component so that the page can remount it (`key`) when the stored
 * values change, rather than copying props into state from an effect: the
 * server answers every PATCH with the whole catalogue, so a value it clamped
 * comes back as a different `config` and the draft has to follow it.
 */
function SettingsEditor({
  tool,
  onSave,
  busy,
}: {
  tool: ToolEntry;
  onSave: (config: Record<string, number>) => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<Record<string, number>>(tool.config);
  const dirty = tool.settings.some((s) => draft[s.key] !== tool.config[s.key]);
  const atDefaults = tool.settings.every((s) => draft[s.key] === s.default);

  return (
    <div>
      <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
        Settings
      </h3>
      <div className="space-y-3">
        {tool.settings.map((setting) => (
          <div
            key={setting.key}
            className="border border-border/60 rounded-xl px-3 py-3 bg-background/40"
          >
            <div className="flex items-center justify-between gap-3">
              <label htmlFor={`${tool.name}-${setting.key}`} className="text-[13px] font-semibold">
                {setting.label}
              </label>
              <input
                id={`${tool.name}-${setting.key}`}
                type="number"
                min={setting.minimum}
                max={setting.maximum}
                value={draft[setting.key] ?? setting.default}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, [setting.key]: Number(e.target.value) }))
                }
                className="w-28 h-9 px-2 text-right rounded-lg bg-background border border-border/60 text-[13px] tabular-nums focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {setting.help}{' '}
              <span className="tabular-nums">
                {setting.minimum.toLocaleString()}-{setting.maximum.toLocaleString()}
                {setting.unit ? ` ${setting.unit}` : ''}, default{' '}
                {setting.default.toLocaleString()}.
              </span>
            </p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={() => onSave(draft)}
          disabled={!dirty || busy}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? 'Saving...' : 'Save settings'}
        </button>
        <button
          onClick={() =>
            setDraft(Object.fromEntries(tool.settings.map((s) => [s.key, s.default])))
          }
          disabled={atDefaults || busy}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-border hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Defaults
        </button>
      </div>
    </div>
  );
}

function ToolDrawer({
  tool,
  categoryLabel,
  onClose,
  onToggle,
  onSaveConfig,
  busy,
}: {
  tool: ToolEntry;
  categoryLabel: string;
  onClose: () => void;
  onToggle: (next: boolean) => void;
  onSaveConfig: (config: Record<string, number>) => void;
  busy: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const paramEntries = tool.parameters?.properties
    ? Object.entries(
        tool.parameters.properties as Record<string, { description?: string; type?: string }>,
      )
    : [];
  const required = new Set((tool.parameters?.required as string[]) ?? []);
  const effect = EFFECT_VIEW[tool.effect] ?? EFFECT_VIEW.irreversible;

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        className="flex-1 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close details"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tool.name}
        className="w-full max-w-[480px] bg-card border-l border-border h-full overflow-y-auto shadow-2xl custom-scrollbar"
      >
        <div className="sticky top-0 bg-card/95 backdrop-blur-xl border-b border-border px-5 py-4 flex items-start justify-between gap-4 z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Chip>{categoryLabel}</Chip>
              <EffectBadge effect={tool.effect} />
              {tool.parallel && (
                <Chip>
                  <Zap className="w-2.5 h-2.5" />
                  Runs in parallel
                </Chip>
              )}
              {tool.sensitive && (
                <Chip className="bg-primary-subtle border-primary-line text-primary">
                  Asks before running
                </Chip>
              )}
            </div>
            <h2 className="text-lg font-bold font-mono mt-2 break-all">{tool.name}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{tool.displayName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-6">
          {/* On/off first: it is the only thing on this screen that changes
              what the assistant can do, so it does not belong under the fold. */}
          <div
            className={cn(
              'flex items-start gap-3 rounded-xl border px-4 py-3',
              tool.enabled ? 'border-border bg-muted/30' : 'border-dashed border-border bg-muted/20',
            )}
          >
            <div className="flex-1">
              <p className="text-sm font-semibold">
                {tool.locked
                  ? 'Always available'
                  : tool.enabled
                    ? 'Available to your assistant'
                    : 'Switched off'}
              </p>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {tool.locked
                  ? 'The assistant is told to call this by name when a result is too large to replay, so it cannot be switched off.'
                  : tool.enabled
                    ? 'Offered to every agent whose grants cover it, and in chat.'
                    : 'Not offered to any agent, and refused if one asks for it anyway.'}
              </p>
            </div>
            <div className="pt-1">
              <Switch
                isOn={tool.enabled}
                onToggle={onToggle}
                disabled={busy || tool.locked || tool.unserved}
                label={tool.name}
              />
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
              What it does
            </h3>
            <p className="text-[13px] leading-relaxed">{tool.description || 'No description.'}</p>
          </div>

          {tool.settings.length > 0 && (
            <SettingsEditor
              key={JSON.stringify(tool.config)}
              tool={tool}
              onSave={onSaveConfig}
              busy={busy}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
            <div className="bg-muted/40 border border-border/60 rounded-xl px-3 py-2.5">
              <div className="text-muted-foreground text-[11px]">Effect</div>
              <div className="font-semibold">{effect.label}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{effect.blurb}</div>
            </div>
            <div className="bg-muted/40 border border-border/60 rounded-xl px-3 py-2.5">
              <div className="text-muted-foreground text-[11px]">Availability</div>
              <div className="font-semibold">
                {tool.alwaysAvailable ? 'Always on' : tool.requires ? 'Conditional' : 'By grant'}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {tool.requires
                  ? REQUIREMENT_BLURB[tool.requires] ?? 'Has a precondition.'
                  : tool.alwaysAvailable
                    ? 'Offered whatever an agent was granted.'
                    : 'Offered to agents granted this tool group.'}
              </div>
            </div>
          </div>

          {paramEntries.length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Parameters
              </h3>
              <div className="border border-border/60 rounded-xl overflow-hidden divide-y divide-border/60">
                {paramEntries.map(([key, def]) => (
                  <div key={key} className="px-3 py-2.5 flex gap-3">
                    <span className="text-[13px] font-mono font-medium shrink-0">
                      {key}
                      {required.has(key) && <span className="text-destructive"> *</span>}
                    </span>
                    <span className="text-[12px] text-muted-foreground flex-1">
                      {(def as { description?: string }).description ??
                        (def as { type?: string }).type ??
                        ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Link
              to="/agents/new"
              className="flex-1 text-center px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Use it in an agent
            </Link>
            <Link
              to="/connections"
              className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-secondary"
            >
              Connections
            </Link>
          </div>
          <p className="text-[11px] text-muted-foreground">
            The switch above is workspace-wide. Which agents may use this tool is set per agent, in
            the agent builder.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Tools() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: CATALOGUE_KEY,
    queryFn: () => toolsService.catalogue(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: usage } = useQuery({
    queryKey: ['tools', 'usage'],
    queryFn: () => toolsService.usage(),
    staleTime: 60 * 1000,
  });

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (changes: Record<string, ToolChange>) => toolsService.update(changes),
    onSuccess: (fresh) => {
      queryClient.setQueryData(CATALOGUE_KEY, fresh);
    },
  });

  const categories = useMemo(() => data?.categories ?? [], [data]);

  /**
   * Search and filter apply across every category; a category with no match
   * disappears rather than sitting there empty, and searching opens what is
   * left so the hits are visible without a second click.
   */
  const visible = useMemo(() => {
    const q = query.trim();
    return categories
      .map((category) => ({
        category,
        tools: category.tools.filter((t) => matchesQuery(t, q) && matchesFilter(t, filter)),
      }))
      .filter(({ category, tools }) => {
        if (tools.length > 0) return true;
        // Keep the explanatory empty groups (plugins, shell) only when nothing
        // is being searched for — they answer "where are my MCP tools?".
        return !q && filter === 'all' && Boolean(category.note);
      });
  }, [categories, query, filter]);

  const searching = query.trim().length > 0 || filter !== 'all';
  const granted = visible.filter((v) => v.category.grantBacked);
  const alwaysOn = visible.filter((v) => !v.category.grantBacked);

  const found = selectedName
    ? categories
        .map((category) => ({
          tool: category.tools.find((t) => t.name === selectedName),
          categoryLabel: category.label,
        }))
        .find((entry) => entry.tool)
    : undefined;
  const selected = found?.tool ? { tool: found.tool, categoryLabel: found.categoryLabel } : null;

  const isOpen = (key: string) => searching || !collapsed.has(key);
  const setOpen = (key: string, open: boolean) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (open) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleTool = (tool: ToolEntry, enabled: boolean) =>
    mutation.mutate({ [tool.name]: { enabled } });

  const toggleCategory = (category: ToolCategory, enabled: boolean) => {
    const changes: Record<string, ToolChange> = {};
    for (const tool of category.tools) {
      if (tool.locked || tool.unserved || tool.enabled === enabled) continue;
      changes[tool.name] = { enabled };
    }
    if (Object.keys(changes).length > 0) mutation.mutate(changes);
  };

  const changedCount = categories.reduce(
    (n, c) => n + c.tools.filter((t) => t.customized).length,
    0,
  );

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <PageHeader icon={Wrench} title="Tools" subtitle="Loading your tool library…" />
        <div className="flex-1 p-4 md:p-8 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-card border border-border/60 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-full flex flex-col">
        <PageHeader icon={Wrench} title="Tools" subtitle="What your assistant can do" />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <AlertCircle className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-semibold">We couldn't load your tools</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            The library is code, so nothing is lost — this is a connection problem.
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        icon={Wrench}
        title="Tools"
        subtitle={`${data.enabledTools} of ${data.totalTools} switched on${
          changedCount > 0 ? ` · ${changedCount} changed from default` : ''
        }`}
        actions={
          <Link
            to="/agents/new"
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 whitespace-nowrap"
          >
            New agent
          </Link>
        }
      >
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="group flex-1">
            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tools by name or what they do…"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                  filter === f.key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background/50 text-muted-foreground border-border/60 hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </PageHeader>

      {mutation.isError && (
        <div className="mx-4 md:mx-8 mt-4 bg-destructive/10 text-destructive p-3 rounded-xl border border-destructive/20 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="text-sm font-medium">
            That change didn't save. Nothing has been switched off — try again.
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-8 custom-scrollbar">
        {visible.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-semibold">No tool matches that</p>
            <p className="text-[12px] text-muted-foreground mt-1">
              Try a different word, or clear the filter.
            </p>
          </div>
        )}

        {granted.length > 0 && (
          <section className="space-y-3">
            <div>
              <h2 className="text-base font-bold text-foreground">Granted per agent</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Switching one off here withdraws it everywhere. Which agents may use what is set in
                each agent's own settings.
              </p>
            </div>
            {granted.map(({ category, tools }) => (
              <CategorySection
                key={category.key}
                category={category}
                tools={tools}
                usageCount={usage?.usage?.[category.key]}
                open={isOpen(category.key)}
                onOpenChange={(next) => setOpen(category.key, next)}
                onSelect={(tool) => setSelectedName(tool.name)}
                onToggleTool={toggleTool}
                onToggleCategory={(next) => toggleCategory(category, next)}
                busy={mutation.isPending}
              />
            ))}
          </section>
        )}

        {alwaysOn.length > 0 && (
          <section className="space-y-3">
            <div>
              <h2 className="text-base font-bold text-foreground">Always on</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                No grant needed. These read this conversation, the clock, or an attachment — never
                anything outside.
              </p>
            </div>
            {alwaysOn.map(({ category, tools }) => (
              <CategorySection
                key={category.key}
                category={category}
                tools={tools}
                open={isOpen(category.key)}
                onOpenChange={(next) => setOpen(category.key, next)}
                onSelect={(tool) => setSelectedName(tool.name)}
                onToggleTool={toggleTool}
                onToggleCategory={(next) => toggleCategory(category, next)}
                busy={mutation.isPending}
              />
            ))}
          </section>
        )}
      </div>

      {selected && (
        <ToolDrawer
          tool={selected.tool}
          categoryLabel={selected.categoryLabel}
          busy={mutation.isPending}
          onClose={() => setSelectedName(null)}
          onToggle={(next) => toggleTool(selected.tool, next)}
          onSaveConfig={(config) => mutation.mutate({ [selected.tool.name]: { config } })}
        />
      )}
    </div>
  );
}

export type { ToolsCatalogue };
