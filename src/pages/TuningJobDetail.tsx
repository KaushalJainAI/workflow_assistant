/**
 * One tuning job: what it was trained on, what it scored, and what it saves.
 *
 * The comparison is against baselines stored on the job rather than looked up
 * now. The model you measured against may have been repriced or retired since,
 * and a saving computed against today's price list would be fiction.
 */
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, SlidersHorizontal, Loader2, Rocket, Ban, Database } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { formatPaise, tuningService } from '../api/improve';
import { jobStatus } from '../lib/improveDisplay';

/** One measured number against the thing it is supposed to beat. */
function Comparison({
  label, value, baseline, better, hint,
}: {
  label: string;
  value: string;
  baseline: string;
  better: boolean | null;
  hint?: string;
}) {
  return (
    <div className="bg-card border border-border rounded p-4">
      <p className="text-[12px] text-muted-foreground mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {better !== null && (
          <span
            className={cn(
              'text-[12px] font-semibold',
              better ? 'text-success' : 'text-destructive'
            )}
          >
            {better ? 'better' : 'worse'}
          </span>
        )}
      </div>
      <p className="text-[12px] text-muted-foreground mt-1">
        base model scored {baseline}
      </p>
      {hint && <p className="text-[12px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

export default function TuningJobDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: job, isLoading } = useQuery({
    queryKey: ['tuning-job', id],
    queryFn: () => tuningService.get(id!),
    enabled: !!id,
    refetchInterval: (q) =>
      q.state.data?.status === 'training' || q.state.data?.status === 'queued' ? 5000 : false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tuning-job', id] });
    queryClient.invalidateQueries({ queryKey: ['tuning-jobs'] });
  };

  const cancel = useMutation({
    mutationFn: () => tuningService.cancel(id!),
    onSuccess: () => {
      invalidate();
      toast.success('Job cancelled');
    },
    onError: () => toast.error('That job is already finished.'),
  });

  const deploy = useMutation({
    mutationFn: () => tuningService.deploy(id!),
    onSuccess: () => {
      invalidate();
      toast.success('Deployed');
    },
    onError: () => toast.error('Only a completed job can be deployed.'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm p-6">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading…
      </div>
    );
  }
  if (!job) {
    return (
      <div className="p-6">
        <p className="text-[13px] text-muted-foreground mb-3">That job no longer exists.</p>
        <Link to="/tuning" className="text-[13px] text-primary hover:underline">
          Back to tuning
        </Link>
      </div>
    );
  }

  const st = jobStatus[job.status] ?? jobStatus.queued;
  const StIcon = st.icon;
  const running = job.status === 'training' || job.status === 'queued';

  return (
    <div className="h-full flex flex-col">
      <header className="px-4 md:px-6 py-4 border-b border-border">
        <Link
          to="/tuning"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Tuning
        </Link>
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary-subtle border border-primary-line rounded">
            <SlidersHorizontal className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight font-mono">{job.name}</h1>
            <p className="text-[13px] text-muted-foreground">
              tuned from {job.base_model}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded text-[12px] font-semibold',
                st.cls
              )}
            >
              <StIcon className={cn('w-3.5 h-3.5', st.spin && 'animate-spin')} />
              {st.label}
            </span>
            {running && (
              <button
                onClick={() => cancel.mutate()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-border hover:bg-secondary"
              >
                <Ban className="w-4 h-4" />
                Cancel
              </button>
            )}
            {job.status === 'completed' && (
              <button
                onClick={() => deploy.mutate()}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Rocket className="w-4 h-4" />
                Deploy
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {job.error_message && (
          <div className="p-3 rounded border border-destructive-line bg-destructive-subtle">
            <p className="text-[13px] text-destructive">{job.error_message}</p>
          </div>
        )}

        {running && (
          <div className="bg-card border border-border rounded p-4">
            <p className="text-[13px] mb-2">
              Epoch {job.epochs_done} of {job.epochs_total}
            </p>
            <div className="h-2 bg-secondary rounded overflow-hidden">
              <span
                className="block h-full bg-agent rounded transition-all"
                style={{ width: `${job.progress_pct}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
          <Comparison
            label="Accuracy"
            value={job.accuracy === null ? 'Not scored yet' : `${job.accuracy}%`}
            baseline={job.baseline_accuracy === null ? '—' : `${job.baseline_accuracy}%`}
            better={job.accuracy_delta === null ? null : job.accuracy_delta >= 0}
            hint={
              job.accuracy_delta === null
                ? undefined
                : `${job.accuracy_delta >= 0 ? '+' : ''}${job.accuracy_delta} points`
            }
          />
          <Comparison
            label="Cost per 1,000 calls"
            value={formatPaise(job.cost_per_1k_paise)}
            baseline={formatPaise(job.baseline_cost_per_1k_paise)}
            better={job.cost_saving_pct === null ? null : job.cost_saving_pct > 0}
            hint={
              job.cost_saving_pct === null
                ? undefined
                : `${job.cost_saving_pct}% cheaper than the base model`
            }
          />
        </div>

        <div className="bg-card border border-border rounded p-4 max-w-2xl">
          <h2 className="text-[13px] font-semibold mb-2">Trained on</h2>
          <Link
            to={`/datasets/${job.dataset}`}
            className="inline-flex items-center gap-2 text-[13px] text-primary hover:underline"
          >
            <Database className="w-4 h-4" />
            {job.dataset_name}
            <span className="text-muted-foreground">
              · {(job.dataset_rows ?? 0).toLocaleString()} rows
            </span>
          </Link>
          {/* Why the dataset cannot simply be deleted out from under this. */}
          <p className="text-[12px] text-muted-foreground mt-2 leading-relaxed">
            These examples are the only record of why this model behaves as it
            does, so they are kept for as long as the job exists.
          </p>
        </div>

        {job.tuned_model_id && (
          <div className="bg-card border border-border rounded p-4 max-w-2xl">
            <h2 className="text-[13px] font-semibold mb-1">Model id</h2>
            <code className="text-[13px] text-muted-foreground break-all">
              {job.tuned_model_id}
            </code>
          </div>
        )}
      </div>
    </div>
  );
}
