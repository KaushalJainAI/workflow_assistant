/**
 * Every knob that defines an agent.
 *
 * The premise from the design note: an agent is a configuration, not code. If
 * all of it is data, a generating agent can write it — which is what the chat
 * pane in the builder does. So this shape is the contract between the knob
 * board, the chat, and (eventually) the backend.
 */

export type TriggerMode = 'goal' | 'maintenance' | 'template';
export type Autonomy = 'plan' | 'review' | 'ask' | 'auto' | 'full';
export type FileAccess = 'none' | 'readonly' | 'scoped' | 'read_all_write_own' | 'full';
export type Egress = 'none' | 'allowlist' | 'full';

export interface AgentConfig {
  // Identity
  name: string;
  brief: string;

  // Model
  provider: string;
  model: string;
  /** 0 = deterministic, 1 = loose. Extraction wants low, drafting wants high. */
  temperature: number;

  // Sandbox
  fileAccess: FileAccess;
  workdir: string;
  venv: boolean;

  // Tools
  tools: {
    codeExecution: boolean;
    shell: boolean;
    webSearch: boolean;
    scrape: boolean;
    fileOps: boolean;
    rag: boolean;
    /** The user's own configured MCP servers. Off by default: these reach
     *  real systems under the user's credentials. */
    mcp: boolean;
  };

  // Context the agent is given
  /** Which connections this agent may reach: `MCPServer` ids from
   *  `/mcp/servers/`, not slugs. The second axis to the `mcp` tool grant —
   *  that says whether connectors are reachable at all, this says which ones.
   *
   *  Empty means "any the user has", which is what every agent saved before
   *  this was enforced carries: the field existed here long before the runtime
   *  read it, so treating an empty list as "no connectors" would silently strip
   *  the toolbox of every agent that never made a choice. */
  connectors: number[];
  knowledgeBases: number[];
  /** Skill ids, not titles — a title is not a stable reference. */
  skills: number[];
  useOrgContext: boolean;
  useEnvironment: boolean;   // time / place

  // Invocation
  trigger: TriggerMode;
  /**
   * The agent's own schedule, as cron. One field, and therefore one schedule:
   * it round-trips the single `origin='builder'` Trigger row and deliberately
   * cannot see the others, because a field that overwrites on every save must
   * not be pointed at a list. Extra schedules are made on the Schedules page.
   */
  schedule: string;
  /**
   * The IANA zone `schedule` is read in. Defaults to UTC on the server so an
   * agent saved by an older client keeps firing at the instant it always did.
   */
  scheduleTimezone: string;
  /**
   * Read-only: how many *other* schedules this agent has. Present so the
   * builder can say the field is not the whole picture rather than implying
   * it is.
   */
  extraSchedules?: number;
  /**
   * Whether anything other than the user may start a run — a schedule, a
   * webhook, or a parent agent delegating. Off by default, and the runtime
   * checks it again on every unattended call, so a schedule set without this
   * is refused at every firing rather than merely ignored.
   */
  allowUnattended: boolean;

  // Guardrails
  autonomy: Autonomy;
  notifyOnHitl: boolean;
  reviewAgent: boolean;
  spendCapRupees: number;
  /**
   * Wall-clock ceiling on a single run, in seconds. Stored in seconds because
   * that is the unit the runtime compares against; the builder shows minutes.
   *
   * This replaced the `cpu` and `memoryMb` fields, which were stored, sent, and
   * read by nothing — the backend runs user code on a thread inside its own
   * process, where there is no cgroup to enforce either. Time is the resource a
   * run genuinely holds, so it is the one with a knob.
   */
  maxRunSeconds: number;
  /**
   * Whether the sandbox can reach the network. Separate from the web-search
   * tool: search goes through us and is logged, egress is the agent opening its
   * own socket. An agent that can run code but cannot dial out is a very
   * different thing to hand a stranger.
   */
  egress: Egress;

  // Context lifecycle
  /**
   * Which model folds this agent's earlier steps when its context window fills.
   * Empty means the platform default — a small NVIDIA model the platform holds
   * a key for, so the fold works without the user connecting anything. Set both
   * or neither: a model without its provider cannot be routed.
   */
  summaryModel: string;
  summaryProvider: string;
  recursiveContext: boolean;
  compaction: boolean;
  indexing: boolean;
}

export const DEFAULT_AGENT: AgentConfig = {
  name: '',
  brief: '',

  provider: 'openrouter',
  model: '',
  temperature: 0.2,

  // Default to the cautious end of every dial. An agent that turns out to need
  // more can be widened deliberately; one that starts wide is never narrowed.
  fileAccess: 'scoped',
  workdir: '/workspace',
  venv: true,

  tools: {
    codeExecution: false,
    shell: false,
    webSearch: true,
    scrape: false,
    fileOps: false,
    rag: true,
    mcp: false,
  },

  connectors: [],
  knowledgeBases: [],
  skills: [],
  useOrgContext: true,
  useEnvironment: false,

  trigger: 'goal',
  schedule: '',
  scheduleTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  allowUnattended: false,

  autonomy: 'ask',
  notifyOnHitl: true,
  reviewAgent: false,
  spendCapRupees: 500,
  maxRunSeconds: 15 * 60,
  egress: 'none',

  summaryModel: '',
  summaryProvider: '',
  recursiveContext: true,
  compaction: true,
  indexing: true,
};

export const TRIGGER_COPY: Record<TriggerMode, { label: string; hint: string }> = {
  goal: { label: 'Goal', hint: 'Runs when you ask it to do a specific thing.' },
  maintenance: { label: 'Maintenance', hint: 'Runs on a schedule to keep something true.' },
  template: { label: 'Template', hint: 'Instantiated from a known shape, with parameters.' },
};

// Key order is the order the radio list renders in, and it runs strictest to
// loosest — the same order as `AUTONOMY_LADDER` in the runtime, which is the
// authority on what each level actually gates.
//
// `plan` and `auto` are the two rungs that make this a ladder rather than a
// switch. Without `plan` the only way to find out what an agent will do is to
// let it do it; without `auto` the choice is between approving every recycled
// file write and approving nothing, and a user facing that picks "runs
// unattended" once and stops reading the prompts entirely.
export const AUTONOMY_COPY: Record<Autonomy, { label: string; hint: string }> = {
  plan: { label: 'Plan only', hint: 'Can look and report, never change anything. Nothing to approve.' },
  review: { label: 'Every step reviewed', hint: 'You approve each step. Slow, for high-stakes work.' },
  ask: { label: 'Asks before side effects', hint: 'Pauses before anything leaves your account.' },
  auto: { label: 'Asks only about the permanent', hint: 'Runs file changes you can undo; still stops before anything you cannot.' },
  full: { label: 'Runs unattended', hint: 'No approval gate at all, including tools using your credentials.' },
};

export const EGRESS_COPY: Record<Egress, { label: string; hint: string }> = {
  none: { label: 'No network', hint: 'The sandbox cannot dial out at all. The safe default.' },
  allowlist: { label: 'Allowlist', hint: 'Only hosts you have named.' },
  full: { label: 'Open network', hint: 'Anything it likes. Not allowed together with shell access.' },
};

// Describes the virtual filesystem in `Backend/inference/vfs.py`, which is a
// view over the user's own document tree — not a disk. Files an agent writes
// show up in My Files like any upload, and deletes go to the recycle bin.
// Key order is the order the radio list renders in, and it is deliberate: least
// reach first. Note the progression is not a single line — `scoped` reads less
// than `readonly` but writes more — which is exactly why the fourth option
// exists. Values must match `FILE_ACCESS` in `Backend/agents/views/agents.py`;
// an option this app offers that the serializer does not accept is a 400 on save.
export const FILE_ACCESS_COPY: Record<FileAccess, { label: string; hint: string }> = {
  none: { label: 'None', hint: 'No file tools at all — it is not offered them.' },
  readonly: { label: 'Read only', hint: 'Can read all your files. Cannot change anything.' },
  scoped: { label: 'Own folder', hint: 'Read and write, but only inside its own folder in Agents/. It cannot see the rest of your files.' },
  read_all_write_own: {
    label: 'Read all, write own folder',
    hint: 'Can read all your files, but only writes inside its own folder in Agents/. Usually the one you want.',
  },
  full: { label: 'All your files', hint: 'Read and write anywhere in your files. Rarely justified.' },
};

/**
 * Shims for the old slug-based connector picker.
 * The builder now stores numeric MCPServer ids (agent_context.connectors) and
 * the Connections page is the source of truth — see `mcpService.list()`.
 * Kept only so `Agents.tsx` / `AgentBuilder.tsx` imports don't 500 on a missing
 * export; the live labels come from the API and this list is the fallback.
 */
export const CONNECTOR_OPTIONS: { id: number; label: string }[] = [
  { id: 5, label: 'Google Drive' },
  { id: 6, label: 'Gmail' },
  { id: 7, label: 'Google Calendar' },
  { id: 8, label: 'Google Sheets' },
  { id: 9, label: 'Google Docs' },
  { id: 10, label: 'Notion' },
  { id: 11, label: 'Slack' },
  { id: 1, label: 'Files' },
  { id: 2, label: 'Web pages' },
];
