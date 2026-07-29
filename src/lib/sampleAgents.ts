/**
 * Sample agents, as full AgentConfig objects.
 *
 * They live here rather than inline in the Agents page so the builder can load
 * one and dial its knobs — clicking a card has to open the same board that made
 * it, otherwise the list is a dead end.
 *
 * Replace with the agents API when it exists; the shape is already the one the
 * builder and the (eventual) backend both speak.
 */
import { DEFAULT_AGENT, type AgentConfig } from '../types/agentConfig';

export interface SampleAgent {
  id: string;
  initials: string;
  /** Observed behaviour — the numbers that say whether delegating is paying off. */
  runs: number;
  unattended: number;
  spend: string;
  config: AgentConfig;
}

const agent = (
  id: string,
  initials: string,
  runs: number,
  unattended: number,
  spend: string,
  config: Partial<AgentConfig>
): SampleAgent => ({
  id, initials, runs, unattended, spend,
  config: { ...DEFAULT_AGENT, ...config },
});

export const SAMPLE_AGENTS: SampleAgent[] = [
  agent('finance', 'FA', 48, 43, '₹4,210', {
    name: 'Finance agent',
    brief: 'Reads invoices from Gmail, reconciles them against the vendor master, and chases anything overdue by more than 30 days.',
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-5',
    temperature: 0,
    autonomy: 'ask',
    trigger: 'maintenance',
    schedule: '0 9 * * 1',
    connectors: ['gmail', 'sheets'],
    tools: { ...DEFAULT_AGENT.tools, codeExecution: true, fileOps: true, rag: true },
    skills: ['GSTIN validation', 'Invoice line-item extraction'],
    spendCapRupees: 500,
  }),
  agent('ops', 'OA', 12, 11, '₹9,830', {
    name: 'Ops agent',
    brief: 'Audits Drive for files nothing has opened in three years and proposes what to archive.',
    provider: 'openrouter',
    model: 'openai/gpt-5.6-terra',
    temperature: 0.1,
    autonomy: 'ask',
    trigger: 'maintenance',
    schedule: '0 9 1 * *',
    connectors: ['gdrive', 'sheets'],
    tools: { ...DEFAULT_AGENT.tools, fileOps: true },
    spendCapRupees: 1000,
  }),
  agent('support', 'SA', 210, 186, '₹3,930', {
    name: 'Support agent',
    brief: 'Classifies inbound tickets, drafts a first reply and routes anything it is not confident about to a human.',
    provider: 'openrouter',
    model: 'openai/gpt-5.6-luna',
    temperature: 0.4,
    autonomy: 'ask',
    trigger: 'goal',
    connectors: ['slack'],
    tools: { ...DEFAULT_AGENT.tools, webSearch: true, rag: true },
    skills: ['Support ticket triage', 'House writing style'],
    spendCapRupees: 400,
  }),
  agent('data', 'DA', 96, 96, '₹490', {
    name: 'Data agent',
    brief: 'Answers questions about uploaded spreadsheets by writing and running Python in the sandbox.',
    provider: 'nvidia',
    model: 'nvidia/nemotron-3-super-120b-a12b',
    temperature: 0,
    // Runs unattended because everything it does is read-only and reversible —
    // it computes and reports, it never writes back or sends anything.
    autonomy: 'full',
    trigger: 'goal',
    tools: { ...DEFAULT_AGENT.tools, codeExecution: true, fileOps: true, rag: true },
    fileAccess: 'readonly',
    memoryMb: 2048,
    cpu: 2,
    spendCapRupees: 200,
  }),
];

export const findSampleAgent = (id?: string) =>
  SAMPLE_AGENTS.find((a) => a.id === id);
