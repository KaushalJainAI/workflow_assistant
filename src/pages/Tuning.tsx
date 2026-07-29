/**
 * Tuning — fine-tune a small model on your own corrections.
 *
 * The pitch is cost, not capability: once there are enough corrected examples, a
 * tuned small model matches the big one on your narrow task for a fraction of
 * the spend. So every job shows what it saves against the model it replaces —
 * a job with no baseline to compare against has not yet made its case.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SlidersHorizontal, Plus, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import PageHeader from '../components/layout/PageHeader';
import { datasetsService, formatPaise, tuningService, type TuningJob } from '../api/improve';
import { jobStatus } from '../lib/improveDisplay';
import TruncationNotice from '../components/ui/TruncationNotice';

function NewJobForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [baseModel, setBaseModel] = useState('');
  const [dataset, setDataset] = useState<number | ''>('');

  const { data: datasetPage } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => datasetsService.list(),
  });
  const sets = datasetPage?.items ?? [];

  const create = useMutation({
    mutationFn: () =>
      tuningService.create({
        name: name.trim(),
        base_model: baseModel.trim(),
        dataset: Number(dataset),
      }),
    onSuccess: (j) => {
      queryClient.invalidateQueries({ queryKey: ['tuning-jobs'] });
      toast.success(`${j.name} queued`);
      onDone();
    },
    // The server refuses a dataset too thin to tune on, and says how thin. That
    // message is more useful than anything generic written here.
    onError: (err: { response?: { data?: Record<string, unknown> } }) => {
      const data = err.response?.data;
      const first = data && Object.values(data)[0];
      toast.error(String(Array.isArray(first) ? first[0] : (first ?? 'Could not queue that job.')));
    },
  });

  const ready = name.trim() && baseModel.trim() && dataset !== '';

  return (
    <div className="bg-card border border-border rounded p-4 mb-4 max-w-md space-y-3">
      <div>
        <label className="block text-[13px] font-medium mb-1.5">Job name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="invoice-extract-v3"
          className="w-full h-9 px-3 rounded border border-input bg-background text-sm"
        />
      </div>
      <div>
        <label className="block text-[13px] font-medium mb-1.5">Base model</label>
        <input
          value={baseModel}
          onChange={(e) => setBaseModel(e.target.value)}
          placeholder="openai/gpt-5.6-luna"
          className="w-full h-9 px-3 rounded border border-input bg-background text-sm"
        />
      </div>
      <div>
        <label className="block text-[13px] font-medium mb-1.5">Dataset</label>
        <select
          value={dataset}
          onChange={(e) => setDataset(e.target.value ? Number(e.target.value) : '')}
          className="w-full h-9 px-2 rounded border border-input bg-background text-sm"
        >
          <option value="">Choose a dataset…</option>
          {sets.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} — {d.row_count} rows
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => create.mutate()}
          disabled={!ready || create.isPending}
          className="px-4 py-1.5 text-sm font-semibold rounded bg-primary text-primary-foreground disabled:opacity-50"
        >
          Queue job
        </button>
        <button
          onClick={onDone}
          className="px-3 py-1.5 text-sm rounded border border-border hover:bg-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function Tuning() {
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['tuning-jobs'],
    queryFn: () => tuningService.list(),
    // Only poll while something is actually moving.
    refetchInterval: (q) =>
      (q.state.data?.items ?? []).some((j) => j.status === 'training' || j.status === 'queued')
        ? 5000
        : false,
  });
  const jobs = data?.items ?? [];
  const total = data?.count ?? 0;

  const deployed = jobs.filter((j) => j.status === 'deployed').length;

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        icon={SlidersHorizontal}
        title="Tuning"
        subtitle={isLoading ? 'Loading…' : `${total} jobs · ${deployed} deployed`}
        actions={
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded font-semibold text-sm hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            New job
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {creating && <NewJobForm onDone={() => setCreating(false)} />}

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading jobs…
          </div>
        ) : jobs.length === 0 && !creating ? (
          <div className="max-w-md py-12">
            <h2 className="font-semibold mb-1">No tuning jobs yet</h2>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Once a dataset has enough corrected examples, tuning a small model on
              it can match a much larger one at your one narrow task — for a
              fraction of the cost per call.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
            {jobs.map((j: TuningJob) => {
              const st = jobStatus[j.status] ?? jobStatus.queued;
              const StIcon = st.icon;
              return (
                <Link
                  key={j.id}
                  to={`/tuning/${j.id}`}
                  className="block bg-card border border-border rounded p-4 hover:border-border-strong hover:bg-secondary/40 transition-colors"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold font-mono text-[14px] truncate">{j.name}</h3>
                      <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground mt-0.5">
                        {j.base_model}
                        <ArrowRight className="w-3 h-3" />
                        {j.dataset_name} · {(j.dataset_rows ?? 0).toLocaleString()} rows
                      </p>
                    </div>
                    <span
                      className={cn(
                        'ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold shrink-0',
                        st.cls
                      )}
                    >
                      <StIcon className={cn('w-3 h-3', st.spin && 'animate-spin')} />
                      {st.label}
                    </span>
                  </div>

                  {j.status === 'training' && (
                    <div className="mb-3">
                      <p className="text-[12px] text-muted-foreground mb-1">
                        Epoch {j.epochs_done}/{j.epochs_total}
                      </p>
                      <div className="h-1.5 bg-secondary rounded overflow-hidden">
                        <span
                          className="block h-full bg-agent rounded"
                          style={{ width: `${j.progress_pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* The two numbers that decide whether this was worth doing.
                      Both stay em-dashes until the job has actually been scored —
                      a zero would read as "scored zero". */}
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-[12px] pt-3 border-t border-border">
                    <span>
                      <span className="text-muted-foreground">Accuracy </span>
                      <span className="tabular-nums font-medium">
                        {j.accuracy === null ? '—' : `${j.accuracy}%`}
                      </span>
                      {j.accuracy_delta !== null && (
                        <span
                          className={cn(
                            'ml-1 font-semibold',
                            j.accuracy_delta >= 0 ? 'text-success' : 'text-destructive'
                          )}
                        >
                          {j.accuracy_delta >= 0 ? '+' : ''}
                          {j.accuracy_delta}
                        </span>
                      )}
                    </span>
                    <span>
                      <span className="text-muted-foreground">Cost/1k </span>
                      <span className="tabular-nums font-medium">
                        {formatPaise(j.cost_per_1k_paise)}
                      </span>
                      {j.cost_saving_pct !== null && (
                        <span className="ml-1 text-success font-semibold">
                          {j.cost_saving_pct}% cheaper
                        </span>
                      )}
                    </span>
                  </div>

                  {j.error_message && (
                    <p className="text-[12px] text-destructive mt-2">{j.error_message}</p>
                  )}
                </Link>
              );
            })}
            </div>
            <TruncationNotice shown={jobs.length} total={total} />
          </>
        )}
      </div>
    </div>
  );
}
