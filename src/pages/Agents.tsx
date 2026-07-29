/**
 * Agents — a named agent with a brief, a toolset and an autonomy level.
 *
 * The prototype treats agents, not workflows, as the thing you delegate to: you
 * hire "Finance Agent" and it decides which steps to run. Workflows stay as the
 * deterministic layer underneath.
 */
import { Bot, Plus, Wrench, ShieldCheck, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import PageHeader from '../components/layout/PageHeader';
import PreviewNotice from '../components/ui/PreviewNotice';

/* Autonomy is the whole safety story, so it is the most prominent field on the
   card: how much this agent may do before it has to stop and ask. */
const autonomy = {
  full: { label: 'Runs unattended', cls: 'bg-agent-subtle text-agent border-agent-line' },
  ask: { label: 'Asks before side effects', cls: 'bg-primary-subtle text-primary border-primary-line' },
  review: { label: 'Every step reviewed', cls: 'bg-secondary text-muted-foreground border-border' },
} as const;

const AGENTS = [
  {
    initials: 'FA',
    name: 'Finance agent',
    brief: 'Reads invoices from Gmail, reconciles them against the vendor master, and chases anything overdue by more than 30 days.',
    autonomy: 'ask' as const,
    tools: ['Gmail', 'Sheets', 'Parse PDF', 'Knowledge base'],
    runs: 48,
    unattended: 43,
    spend: '₹4,210',
  },
  {
    initials: 'OA',
    name: 'Ops agent',
    brief: 'Audits Drive for files nothing has opened in three years and proposes what to archive.',
    autonomy: 'ask' as const,
    tools: ['Drive', 'Sheets'],
    runs: 12,
    unattended: 11,
    spend: '₹9,830',
  },
  {
    initials: 'SA',
    name: 'Support agent',
    brief: 'Classifies inbound tickets, drafts a first reply and routes anything it is not confident about to a human.',
    autonomy: 'ask' as const,
    tools: ['Linear', 'Knowledge base', 'Web search'],
    runs: 210,
    unattended: 186,
    spend: '₹3,930',
  },
  {
    initials: 'DA',
    name: 'Data agent',
    brief: 'Answers questions about uploaded spreadsheets by writing and running Python in the sandbox.',
    autonomy: 'full' as const,
    tools: ['Python sandbox', 'Files', 'Knowledge base'],
    runs: 96,
    unattended: 96,
    spend: '₹490',
  },
];

export default function Agents() {
  return (
    <div className="h-full flex flex-col">
      <PageHeader
        icon={Bot}
        title="Agents"
        subtitle={`${AGENTS.length} agents · ${AGENTS.reduce((n, a) => n + a.runs, 0)} runs this month`}
        actions={
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded font-semibold text-sm hover:bg-primary/90">
            <Plus className="w-4 h-4" />
            New agent
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <PreviewNotice what="Agents" />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {AGENTS.map((a) => {
            const auto = autonomy[a.autonomy];
            const pct = Math.round((a.unattended / a.runs) * 100);
            return (
              <div key={a.name} className="bg-card border border-border rounded p-4 hover:border-border-strong transition-colors">
                <div className="flex items-start gap-3 mb-3">
                  <span className="w-9 h-9 rounded bg-agent-subtle border border-agent-line text-agent flex items-center justify-center text-[13px] font-semibold shrink-0">
                    {a.initials}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{a.name}</h3>
                    <span className={cn('inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded border text-[11px] font-semibold', auto.cls)}>
                      <ShieldCheck className="w-3 h-3" />
                      {auto.label}
                    </span>
                  </div>
                </div>

                <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">{a.brief}</p>

                <div className="flex flex-wrap gap-1 mb-4">
                  {a.tools.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary border border-border text-[11px] text-muted-foreground">
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
                    <span className="text-muted-foreground tabular-nums">{a.runs} runs · {a.spend}</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded overflow-hidden">
                    <span className="block h-full bg-agent rounded" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
