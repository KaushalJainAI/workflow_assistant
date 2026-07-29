/**
 * Tuning — fine-tune a small model on your own corrections.
 *
 * The pitch is cost, not capability: once there are enough corrected examples,
 * a tuned small model matches the big one on your narrow task for a fraction of
 * the spend. So every job shows what it would save against the current model.
 */
import { SlidersHorizontal, Plus, CheckCircle2, Loader2, XCircle, Clock, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';
import PageHeader from '../components/layout/PageHeader';
import PreviewNotice from '../components/ui/PreviewNotice';

const jobStatus = {
  deployed: { icon: CheckCircle2, label: 'Deployed', cls: 'text-success bg-success-subtle' },
  training: { icon: Loader2, label: 'Training', cls: 'text-agent bg-agent-subtle', spin: true },
  failed: { icon: XCircle, label: 'Failed', cls: 'text-destructive bg-destructive-subtle' },
  queued: { icon: Clock, label: 'Queued', cls: 'text-muted-foreground bg-secondary' },
} as const;

const JOBS = [
  {
    name: 'invoice-extract-v3',
    base: 'gpt-4o-mini',
    dataset: 'Invoice fields — gold',
    rows: 1_240,
    status: 'deployed' as const,
    epoch: '3/3',
    accuracy: 96.1,
    baseline: 94.2,
    costPer1k: '₹0.42',
    baselineCost: '₹2.80',
    finished: '4h ago',
  },
  {
    name: 'ticket-intent-v2',
    base: 'gpt-4o-mini',
    dataset: 'Ticket intents',
    rows: 4_820,
    status: 'training' as const,
    epoch: '2/4',
    accuracy: null,
    baseline: 88.6,
    costPer1k: '—',
    baselineCost: '₹2.80',
    finished: 'about 40m left',
  },
  {
    name: 'house-style-v1',
    base: 'gpt-4o-mini',
    dataset: 'House style replies',
    rows: 312,
    status: 'failed' as const,
    epoch: '1/3',
    accuracy: null,
    baseline: 76.0,
    costPer1k: '—',
    baselineCost: '₹2.80',
    finished: 'too few examples — needs ~500 rows',
  },
];

export default function Tuning() {
  return (
    <div className="h-full flex flex-col">
      <PageHeader
        icon={SlidersHorizontal}
        title="Tuning"
        subtitle="Train a small model on your corrections"
        actions={
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded font-semibold text-sm hover:bg-primary/90">
            <Plus className="w-4 h-4" />
            New tuning job
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <PreviewNotice what="Tuning" />

        <div className="space-y-3">
          {JOBS.map((j) => {
            const st = jobStatus[j.status];
            const Icon = st.icon;
            const better = j.accuracy != null && j.accuracy > j.baseline;
            return (
              <div key={j.name} className="bg-card border border-border rounded p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold font-mono text-[14px] truncate">{j.name}</h3>
                      <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold shrink-0', st.cls)}>
                        <Icon className={cn('w-3 h-3', 'spin' in st && st.spin && 'animate-spin')} />
                        {st.label}
                      </span>
                    </div>
                    <p className="text-[12px] text-muted-foreground">
                      {j.base} · {j.dataset} · {j.rows.toLocaleString()} rows · epoch {j.epoch}
                    </p>
                  </div>
                  <span className="text-[12px] text-muted-foreground shrink-0">{j.finished}</span>
                </div>

                {j.status === 'deployed' && (
                  <div className="grid sm:grid-cols-2 gap-3 pt-3 border-t border-border">
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-1">Accuracy against the eval suite</p>
                      <div className="flex items-center gap-2 text-[13px]">
                        <span className="text-muted-foreground tabular-nums">{j.baseline}%</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        <span className={cn('font-semibold tabular-nums', better ? 'text-success' : 'text-foreground')}>
                          {j.accuracy}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-1">Cost per 1,000 calls</p>
                      <div className="flex items-center gap-2 text-[13px]">
                        <span className="text-muted-foreground tabular-nums line-through">{j.baselineCost}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        <span className="font-semibold text-success tabular-nums">{j.costPer1k}</span>
                      </div>
                    </div>
                  </div>
                )}

                {j.status === 'training' && (
                  <div className="pt-3 border-t border-border">
                    <div className="h-1.5 bg-secondary rounded overflow-hidden">
                      <span className="block h-full bg-agent rounded animate-agent-pulse" style={{ width: '50%' }} />
                    </div>
                  </div>
                )}

                {j.status === 'failed' && (
                  <p className="pt-3 border-t border-border text-[13px] text-destructive">
                    Not enough examples to train on. Correct more extractions in Extract and the dataset will grow.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
