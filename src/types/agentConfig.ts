/**
 * Every knob that defines an agent.
 *
 * The premise from the design note: an agent is a configuration, not code. If
 * all of it is data, a generating agent can write it — which is what the chat
 * pane in the builder does. So this shape is the contract between the knob
 * board, the chat, and (eventually) the backend.
 */

export type TriggerMode = 'goal' | 'maintenance' | 'template';
export type Autonomy = 'full' | 'ask' | 'review';
export type FileAccess = 'none' | 'readonly' | 'scoped' | 'full';

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
  cpu: number;      // vCPUs
  memoryMb: number;

  // Tools
  tools: {
    codeExecution: boolean;
    shell: boolean;
    webSearch: boolean;
    scrape: boolean;
    fileOps: boolean;
    rag: boolean;
  };

  // Context the agent is given
  connectors: string[];      // gdrive, gmail, photos, sheets, ...
  knowledgeBases: number[];
  skills: string[];
  useOrgContext: boolean;
  useEnvironment: boolean;   // time / place

  // Invocation
  trigger: TriggerMode;
  schedule: string;          // only meaningful for maintenance

  // Guardrails
  autonomy: Autonomy;
  notifyOnHitl: boolean;
  reviewAgent: boolean;
  spendCapRupees: number;

  // Context lifecycle
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
  cpu: 1,
  memoryMb: 1024,

  tools: {
    codeExecution: false,
    shell: false,
    webSearch: true,
    scrape: false,
    fileOps: false,
    rag: true,
  },

  connectors: [],
  knowledgeBases: [],
  skills: [],
  useOrgContext: true,
  useEnvironment: false,

  trigger: 'goal',
  schedule: '',

  autonomy: 'ask',
  notifyOnHitl: true,
  reviewAgent: false,
  spendCapRupees: 500,

  recursiveContext: true,
  compaction: true,
  indexing: true,
};

export const CONNECTOR_OPTIONS = [
  { id: 'gdrive', label: 'Google Drive' },
  { id: 'gmail', label: 'Gmail' },
  { id: 'sheets', label: 'Sheets' },
  { id: 'photos', label: 'Photos' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'slack', label: 'Slack' },
];

export const TRIGGER_COPY: Record<TriggerMode, { label: string; hint: string }> = {
  goal: { label: 'Goal', hint: 'Runs when you ask it to do a specific thing.' },
  maintenance: { label: 'Maintenance', hint: 'Runs on a schedule to keep something true.' },
  template: { label: 'Template', hint: 'Instantiated from a known shape, with parameters.' },
};

export const AUTONOMY_COPY: Record<Autonomy, { label: string; hint: string }> = {
  full: { label: 'Runs unattended', hint: 'No approval gate. Only for reversible work.' },
  ask: { label: 'Asks before side effects', hint: 'Pauses before anything leaves your account.' },
  review: { label: 'Every step reviewed', hint: 'You approve each step. Slow, for high-stakes work.' },
};

export const FILE_ACCESS_COPY: Record<FileAccess, { label: string; hint: string }> = {
  none: { label: 'None', hint: 'No filesystem at all.' },
  readonly: { label: 'Read only', hint: 'Can read the workdir, cannot write.' },
  scoped: { label: 'Scoped', hint: 'Read and write, confined to the workdir.' },
  full: { label: 'Full', hint: 'Whole sandbox filesystem. Rarely justified.' },
};
