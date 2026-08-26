/**
 * Turns a plain-language description into knob changes.
 *
 * This is the local stand-in for the generating agent in the design note. It is
 * deliberately rule-based and deterministic: no API call, no latency, and you
 * can read exactly why a knob moved. When the backend gains an endpoint that
 * returns an AgentConfig patch, swap `propose()` for that call — the shape it
 * returns here is the shape the UI already consumes.
 */
import type { AgentConfig } from '../types/agentConfig';

export interface Change {
  /** Dotted path into AgentConfig, e.g. "tools.codeExecution". */
  path: string;
  label: string;
  value: unknown;
  why: string;
}

export interface Proposal {
  reply: string;
  changes: Change[];
}

const has = (t: string, ...words: string[]) => words.some((w) => t.includes(w));

export function propose(input: string, cfg: AgentConfig): Proposal {
  const t = input.toLowerCase();
  const changes: Change[] = [];
  const add = (path: string, label: string, value: unknown, why: string) => {
    changes.push({ path, label, value, why });
  };

  // --- what it works on -----------------------------------------------------
  const connectors = new Set(cfg.connectors);
  if (has(t, 'gmail', 'email', 'inbox')) connectors.add('gmail');
  if (has(t, 'drive', 'g-drive', 'gdrive')) connectors.add('gdrive');
  if (has(t, 'sheet', 'spreadsheet', 'excel')) connectors.add('sheets');
  if (has(t, 'photo', 'image library')) connectors.add('photos');
  if (has(t, 'calendar', 'meeting')) connectors.add('calendar');
  if (has(t, 'slack')) connectors.add('slack');
  if (connectors.size !== cfg.connectors.length) {
    add('connectors', 'Connectors', [...connectors],
        'Named a source it has to reach.');
  }

  // --- how it should be invoked --------------------------------------------
  if (has(t, 'every day', 'daily', 'every monday', 'weekly', 'every week',
             'schedule', 'each morning', 'hourly', 'keep', 'monitor', 'watch')) {
    if (cfg.trigger !== 'maintenance') {
      add('trigger', 'Trigger', 'maintenance',
          'Standing job, not a one-off request.');
    }
    const cron =
      has(t, 'monday') ? '0 9 * * 1'
      : has(t, 'hourly') ? '0 * * * *'
      : has(t, 'weekly', 'every week') ? '0 9 * * 1'
      : '0 9 * * *';
    if (cfg.schedule !== cron) add('schedule', 'Schedule', cron, 'Derived from the cadence you described.');
    // Proposed together with the schedule, never separately: a scheduled agent
    // without this is refused at every firing, and the save is rejected for
    // exactly that reason — so proposing one without the other would hand the
    // user a configuration they cannot save.
    if (!cfg.allowUnattended) {
      add('allowUnattended', 'Unattended', true,
          'A schedule only fires if the agent may run with nobody watching.');
    }
  }

  // --- tools ----------------------------------------------------------------
  const tools = { ...cfg.tools };
  if (has(t, 'calculate', 'python', 'compute', 'analyse', 'analyze', 'reconcile',
             'csv', 'spreadsheet', 'total', 'sum')) tools.codeExecution = true;
  if (has(t, 'search the web', 'look up', 'research', 'find online', 'web')) tools.webSearch = true;
  if (has(t, 'scrape', 'website', 'web page', 'url')) tools.scrape = true;
  if (has(t, 'file', 'pdf', 'document', 'upload', 'invoice')) tools.fileOps = true;
  if (has(t, 'knowledge base', 'our docs', 'company doc', 'policy', 'sop')) tools.rag = true;
  if (has(t, 'shell', 'command line', 'terminal', 'bash')) tools.shell = true;
  for (const k of Object.keys(tools) as (keyof typeof tools)[]) {
    if (tools[k] !== cfg.tools[k]) {
      add(`tools.${k}`, `Tool: ${k}`, tools[k], 'Implied by the work you described.');
    }
  }

  // --- autonomy -------------------------------------------------------------
  // Anything that leaves the account defaults to asking first; only say
  // "unattended" when the user explicitly asks for it.
  if (has(t, 'without asking', 'unattended', 'automatically', 'no approval', "don't ask")) {
    if (cfg.autonomy !== 'full') {
      add('autonomy', 'Autonomy', 'full', 'You asked for it to run without you.');
    }
  } else if (has(t, 'send', 'email', 'post', 'delete', 'pay', 'publish', 'reply')) {
    if (cfg.autonomy === 'full') {
      add('autonomy', 'Autonomy', 'ask', 'It can act outside your account, so it should ask first.');
    }
  }
  if (has(t, 'review every', 'check every step', 'high stakes', 'approve each')) {
    add('autonomy', 'Autonomy', 'review', 'You asked to see every step.');
  }
  if (has(t, 'double check', 'second opinion', 'review agent', 'grade')) {
    if (!cfg.reviewAgent) add('reviewAgent', 'Review agent', true, 'You asked for a second checker.');
  }

  // --- temperature ----------------------------------------------------------
  if (has(t, 'extract', 'exact', 'precise', 'accurate', 'classif', 'parse', 'validate')) {
    if (cfg.temperature > 0.1) {
      add('temperature', 'Temperature', 0, 'Extraction and classification want determinism.');
    }
  } else if (has(t, 'draft', 'write', 'creative', 'brainstorm', 'compose', 'tone')) {
    if (cfg.temperature < 0.6) {
      add('temperature', 'Temperature', 0.7, 'Drafting reads better with some variation.');
    }
  }

  // --- sandbox budget -------------------------------------------------------
  if (has(t, 'large', 'thousands', 'bulk', 'heavy', 'big file', 'millions')) {
    if (cfg.memoryMb < 4096) add('memoryMb', 'Memory', 4096, 'Bulk work needs headroom.');
    if (cfg.cpu < 2) add('cpu', 'vCPU', 2, 'Bulk work needs headroom.');
  }
  if (has(t, 'cheap', 'low cost', 'budget', 'minimal')) {
    if (cfg.spendCapRupees > 200) add('spendCapRupees', 'Spend cap', 200, 'You asked to keep it cheap.');
  }

  // --- environment ----------------------------------------------------------
  if (has(t, 'time of day', 'timezone', 'business hours', 'location', 'office hours')) {
    if (!cfg.useEnvironment) add('useEnvironment', 'Environment', true, 'It needs to know time or place.');
  }

  // --- name and brief -------------------------------------------------------
  if (!cfg.brief.trim()) {
    add('brief', 'Brief', input.trim(), 'Captured from your description.');
  }
  if (!cfg.name.trim()) {
    const guess =
      has(t, 'invoice', 'payable', 'vendor', 'gst') ? 'Finance agent'
      : has(t, 'ticket', 'support', 'customer') ? 'Support agent'
      : has(t, 'drive', 'file', 'cleanup', 'archive') ? 'Ops agent'
      : has(t, 'data', 'csv', 'analys') ? 'Data agent'
      : 'New agent';
    add('name', 'Name', guess, 'Placeholder — rename it whenever.');
  }

  const reply = changes.length
    ? `I set ${changes.length} ${changes.length === 1 ? 'knob' : 'knobs'}. Each one is highlighted on the right with why — override anything that looks wrong.`
    : "I couldn't tell which knobs that should move. Try naming what it reads, what it does with it, and whether it may act without you.";

  return { reply, changes };
}

/** Applies a proposal to a config, returning a new object. */
export function applyChanges(cfg: AgentConfig, changes: Change[]): AgentConfig {
  const next: AgentConfig = structuredClone(cfg);
  for (const c of changes) {
    const [head, tail] = c.path.split('.');
    if (tail) {
      (next as unknown as Record<string, Record<string, unknown>>)[head][tail] = c.value;
    } else {
      (next as unknown as Record<string, unknown>)[head] = c.value;
    }
  }
  return next;
}
