/**
 * One eval suite: its run history, and the per-case results of one run.
 *
 * Regressions are pulled to the top and named. A suite that scores 94% is
 * useless information if you cannot see which two cases broke to get there —
 * that is the whole reason to keep stable case keys across runs.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, LineChart, Play, CheckCircle2, XCircle, AlertTriangle, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { evalsService } from '../api/improve';
import Delta from '../components/ui/Delta';
import { evalRunStatusStyle } from '../lib/improveDisplay';

export default function EvalSuiteDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [selectedRun, setSelectedRun] = useState<number | null>(null);
  const [only, setOnly] = useState<'all' | 'failed'>('all');

  const { data: suite, isLoading } = useQuery({
    queryKey: ['eval-suite', id],
    queryFn: () => evalsService.getSuite(id!),
    enabled: !!id,
  });
  const { data: cases = [] } = useQuery({
    queryKey: ['eval-suite', id, 'cases'],
    queryFn: () => evalsService.cases(id!),
    enabled: !!id,
  });
  const { data: runs = [] } = useQuery({
    queryKey: ['eval-suite', id, 'runs'],
    queryFn: () => evalsService.runs(id!),
    enabled: !!id,
    // A queued run has no results yet; poll until it settles.
    refetchInterval: (q) =>
      (q.state.data ?? []).some((r) => r.status === 'queued' || r.status === 'running')
        ? 4000
        : false,
  });

  // Land on the newest run rather than an empty pane. Derived rather than synced
  // into state by an effect: the newest run is a fact about `runs`, so storing a
  // copy of it just creates a second thing that can be stale.
  const activeRun = selectedRun ?? runs[0]?.id ?? null;

  const { data: results = [] } = useQuery({
    queryKey: ['eval-run', activeRun, only],
    queryFn: () => evalsService.results(activeRun!, only === 'failed' ? 'failed' : undefined),
    enabled: activeRun !== null,
  });

  const start = useMutation({
    mutationFn: () => evalsService.run(id!),
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ['eval-suite', id, 'runs'] });
      queryClient.invalidateQueries({ queryKey: ['eval-suites'] });
      setSelectedRun(run.id);
      toast.success('Run queued');
    },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast.error(err.response?.data?.error ?? 'Could not start that run.'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm p-6">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading…
      </div>
    );
  }
  if (!suite) {
    return (
      <div className="p-6">
        <p className="text-[13px] text-muted-foreground mb-3">That suite no longer exists.</p>
        <Link to="/evals" className="text-[13px] text-primary hover:underline">
          Back to evals
        </Link>
      </div>
    );
  }

  const current = runs.find((r) => r.id === activeRun);

  return (
    <div className="h-full flex flex-col">
      <header className="px-4 md:px-6 py-4 border-b border-border">
        <Link
          to="/evals"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Evals
        </Link>
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary-subtle border border-primary-line rounded">
            <LineChart className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">{suite.name}</h1>
            <p className="text-[13px] text-muted-foreground">
              {suite.case_count} cases
              {suite.agent_name && ` · grades ${suite.agent_name}`}
              {suite.dataset_name && ` · from ${suite.dataset_name}`}
            </p>
          </div>
          <button
            onClick={() => start.mutate()}
            disabled={start.isPending || suite.case_count === 0}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded font-semibold text-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {start.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Run suite
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* ---- run history ---- */}
        <div className="w-64 border-r border-border overflow-y-auto p-3 shrink-0">
          <h2 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
            Runs
          </h2>
          {runs.length === 0 ? (
            <p className="text-[13px] text-muted-foreground px-1">Never run.</p>
          ) : (
            <div className="space-y-1">
              {runs.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRun(r.id)}
                  className={cn(
                    'w-full text-left px-2.5 py-2 rounded border transition-colors',
                    activeRun === r.id
                      ? 'border-primary bg-primary-subtle'
                      : 'border-transparent hover:bg-secondary'
                  )}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[15px] font-semibold tabular-nums">{r.score}%</span>
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[11px] font-medium',
                        evalRunStatusStyle[r.status] ?? evalRunStatusStyle.queued
                      )}
                    >
                      {r.status}
                    </span>
                  </div>
                  <Delta v={r.delta} />
                  {r.regressions.length > 0 && (
                    <p className="flex items-center gap-1 text-[11px] text-destructive font-semibold mt-1">
                      <AlertTriangle className="w-3 h-3" />
                      {r.regressions.length} broke
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ---- results ---- */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 min-w-0">
          {!current ? (
            <div className="max-w-md">
              <h2 className="font-semibold mb-1">
                {suite.case_count === 0 ? 'No cases yet' : 'Not run yet'}
              </h2>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                {suite.case_count === 0
                  ? 'A suite needs cases before it can be scored — each one an input and the answer you expect.'
                  : 'Run the suite to score the current model against these cases.'}
              </p>
              {cases.length > 0 && (
                <ul className="mt-4 space-y-1">
                  {cases.map((c) => (
                    <li key={c.id} className="text-[13px]">
                      <span className="font-mono text-muted-foreground">{c.key}</span>{' '}
                      {c.description}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <>
              {/* Regressions first: the reason to look at this page at all. */}
              {current.regressions.length > 0 && (
                <div className="mb-5 p-3 rounded border border-destructive-line bg-destructive-subtle">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-destructive mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    {current.regressions.length} case
                    {current.regressions.length === 1 ? '' : 's'} passed last run and fail now
                  </p>
                  <p className="text-[12px] text-destructive/90 font-mono">
                    {current.regressions.join(', ')}
                  </p>
                </div>
              )}

              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-3xl font-semibold tabular-nums">{current.score}%</span>
                <Delta v={current.delta} />
                <span className="text-[13px] text-muted-foreground">
                  {current.passed_cases}/{current.total_cases} passed
                  {current.model && ` · ${current.model}`}
                </span>
              </div>

              {current.status === 'queued' || current.status === 'running' ? (
                <p className="flex items-center gap-2 text-[13px] text-muted-foreground py-6">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  This run is {current.status}. Results appear as cases are scored.
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-1 mb-3">
                    {(['all', 'failed'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setOnly(f)}
                        className={cn(
                          'px-3 py-1.5 text-[13px] rounded border transition-colors',
                          only === f
                            ? 'border-primary bg-primary-subtle text-primary font-medium'
                            : 'border-border hover:bg-secondary'
                        )}
                      >
                        {f === 'all' ? 'All cases' : 'Failures only'}
                      </button>
                    ))}
                  </div>

                  {results.length === 0 ? (
                    <p className="text-[13px] text-muted-foreground py-6">
                      {only === 'failed'
                        ? 'Nothing failed in this run.'
                        : 'No results recorded for this run.'}
                    </p>
                  ) : (
                    <div className="border border-border rounded overflow-hidden">
                      <table className="w-full text-[13px]">
                        <thead className="bg-secondary">
                          <tr className="text-left text-[12px] text-muted-foreground">
                            <th className="px-3 py-2 font-medium w-8" />
                            <th className="px-3 py-2 font-medium w-28">Case</th>
                            <th className="px-3 py-2 font-medium">Expected</th>
                            <th className="px-3 py-2 font-medium">Got</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((r) => (
                            <tr
                              key={r.id}
                              className={cn(
                                'border-t border-border align-top',
                                !r.passed && 'bg-destructive-subtle/30'
                              )}
                            >
                              <td className="px-3 py-2">
                                {r.passed ? (
                                  <CheckCircle2 className="w-4 h-4 text-success" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-destructive" />
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <span className="font-mono text-[12px]">{r.key}</span>
                                {r.description && (
                                  <p className="text-[12px] text-muted-foreground">
                                    {r.description}
                                  </p>
                                )}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {JSON.stringify(r.expected)}
                              </td>
                              <td className="px-3 py-2">
                                {JSON.stringify(r.got)}
                                {r.reason && (
                                  <p className="text-[12px] text-muted-foreground italic mt-0.5">
                                    {r.reason}
                                  </p>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
