/**
 * Datasets — the examples that feed evals and tuning.
 *
 * Most rows here are captured from real runs: a corrected extraction or an
 * edited draft reply is worth more as training data than anything synthetic,
 * so the interesting column is where each row came from.
 */
import { Database, Plus, Upload, GitBranch, Bot, PencilLine } from 'lucide-react';
import { cn } from '../lib/utils';
import PageHeader from '../components/layout/PageHeader';
import PreviewNotice from '../components/ui/PreviewNotice';

const sourceConfig = {
  corrected: { icon: PencilLine, label: 'You corrected the agent', cls: 'text-primary bg-primary-subtle border-primary-line' },
  captured: { icon: Bot, label: 'Captured from a run', cls: 'text-agent bg-agent-subtle border-agent-line' },
  uploaded: { icon: Upload, label: 'Uploaded', cls: 'text-muted-foreground bg-secondary border-border' },
} as const;

const SETS = [
  { name: 'Invoice fields — gold', rows: 1_240, source: 'corrected' as const, split: '80/10/10', used: ['Invoice extraction accuracy', 'invoice-extract-v3'], updated: '2h ago' },
  { name: 'Ticket intents', rows: 4_820, source: 'captured' as const, split: '70/15/15', used: ['Ticket classification'], updated: '1d ago' },
  { name: 'House style replies', rows: 312, source: 'corrected' as const, split: '90/10/—', used: ['Reply tone & house style'], updated: '3d ago' },
  { name: 'GSTIN edge cases', rows: 64, source: 'uploaded' as const, split: '—', used: ['GSTIN validation'], updated: '2w ago' },
];

export default function Datasets() {
  return (
    <div className="h-full flex flex-col">
      <PageHeader
        icon={Database}
        title="Datasets"
        subtitle={`${SETS.length} datasets · ${SETS.reduce((n, s) => n + s.rows, 0).toLocaleString()} rows`}
        actions={
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-3 py-2 border border-border rounded text-sm hover:bg-secondary">
              <Upload className="w-4 h-4" />
              Import
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded font-semibold text-sm hover:bg-primary/90">
              <Plus className="w-4 h-4" />
              New dataset
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <PreviewNotice what="Datasets" />

        <div className="grid gap-4 md:grid-cols-2">
          {SETS.map((s) => {
            const src = sourceConfig[s.source];
            const Icon = src.icon;
            return (
              <div key={s.name} className="bg-card border border-border rounded p-4 hover:border-border-strong transition-colors">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-semibold">{s.name}</h3>
                  <span className="text-[13px] text-muted-foreground tabular-nums shrink-0">{s.rows.toLocaleString()} rows</span>
                </div>

                <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-semibold mb-3', src.cls)}>
                  <Icon className="w-3 h-3" />
                  {src.label}
                </span>

                <dl className="text-[12px] text-muted-foreground space-y-1 mb-3">
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0">Train/val/test</dt>
                    <dd className="text-foreground tabular-nums">{s.split}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0">Last updated</dt>
                    <dd className="text-foreground">{s.updated}</dd>
                  </div>
                </dl>

                {/* Which suites and tuning jobs depend on this — so you know what
                    you will break by editing it. */}
                <div className="pt-3 border-t border-border">
                  <p className="text-[11px] text-muted-foreground mb-1.5">Used by</p>
                  <div className="flex flex-wrap gap-1">
                    {s.used.map((u) => (
                      <span key={u} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary border border-border text-[11px]">
                        <GitBranch className="w-3 h-3 text-muted-foreground" />
                        {u}
                      </span>
                    ))}
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
