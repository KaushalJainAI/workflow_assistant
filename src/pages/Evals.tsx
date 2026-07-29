/**
 * Evals — does the agent still do the right thing after you change something?
 *
 * A suite is a set of cases with expected outcomes; a run scores the current
 * model and prompt against them. The score is the headline but not the point:
 * what decides whether you ship is regressions — cases that used to pass and now
 * do not. An average can rise while the five cases you care about break, so
 * regressions get the alarm colour and the score does not.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LineChart, Plus, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '../components/layout/PageHeader';
import Delta from '../components/ui/Delta';
import { evalsService, type EvalSuite } from '../api/improve';
import TruncationNotice from '../components/ui/TruncationNotice';

function NewSuiteForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  const create = useMutation({
    mutationFn: () => evalsService.createSuite({ name: name.trim() }),
    onSuccess: (s) => {
      queryClient.invalidateQueries({ queryKey: ['eval-suites'] });
      toast.success(`${s.name} created`);
      onDone();
    },
    onError: () => toast.error('Could not create that suite — is the name already taken?'),
  });

  return (
    <div className="bg-card border border-border rounded p-4 mb-4 max-w-md">
      <label className="block text-[13px] font-medium mb-1.5">Suite name</label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && name.trim() && create.mutate()}
        placeholder="Invoice extraction accuracy"
        className="w-full h-9 px-3 rounded border border-input bg-background text-sm mb-3"
      />
      <div className="flex gap-2">
        <button
          onClick={() => create.mutate()}
          disabled={!name.trim() || create.isPending}
          className="px-4 py-1.5 text-sm font-semibold rounded bg-primary text-primary-foreground disabled:opacity-50"
        >
          Create
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

export default function Evals() {
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['eval-suites'],
    queryFn: () => evalsService.listSuites(),
  });
  const suites = data?.items ?? [];
  const total = data?.count ?? 0;

  const totalCases = suites.reduce((n, s) => n + s.case_count, 0);
  const regressing = suites.filter((s) => (s.latest?.regressions ?? 0) > 0).length;

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        icon={LineChart}
        title="Evals"
        subtitle={
          isLoading
            ? 'Loading…'
            : `${total} suites · ${totalCases} cases${
                regressing ? ` · ${regressing} with regressions` : ''
              }`
        }
        actions={
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded font-semibold text-sm hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            New suite
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {creating && <NewSuiteForm onDone={() => setCreating(false)} />}

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading suites…
          </div>
        ) : suites.length === 0 && !creating ? (
          <div className="max-w-md py-12">
            <h2 className="font-semibold mb-1">No eval suites yet</h2>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              A suite is a set of cases with known right answers. Running it after
              a change tells you whether you improved things, or quietly broke
              something that used to work.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {suites.map((s: EvalSuite) => (
              <Link
                key={s.id}
                to={`/evals/${s.id}`}
                className="block bg-card border border-border rounded p-4 hover:border-border-strong hover:bg-secondary/40 transition-colors"
              >
                <h3 className="font-semibold mb-1 truncate">{s.name}</h3>
                <p className="text-[12px] text-muted-foreground mb-3">
                  {s.case_count} cases
                  {s.agent_name && ` · ${s.agent_name}`}
                </p>

                {s.latest ? (
                  <>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-2xl font-semibold tabular-nums">{s.latest.score}%</span>
                      <Delta v={s.latest.delta} />
                    </div>
                    <div className="h-1.5 bg-secondary rounded overflow-hidden mb-3">
                      <span
                        className="block h-full bg-primary rounded"
                        style={{ width: `${s.latest.score}%` }}
                      />
                    </div>

                    {/* The honest signal, and the only thing on this card that
                        earns an alarm colour. */}
                    {s.latest.regressions > 0 && (
                      <p className="flex items-center gap-1.5 text-[12px] text-destructive font-semibold mb-2">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {s.latest.regressions} {s.latest.regressions === 1 ? 'case' : 'cases'} broke
                        since last run
                      </p>
                    )}

                    <p className="text-[12px] text-muted-foreground truncate">
                      {s.latest.model || 'no model recorded'}
                    </p>
                  </>
                ) : (
                  <p className="text-[13px] text-muted-foreground py-2">Never run.</p>
                )}
              </Link>
            ))}
            </div>
            <TruncationNotice shown={suites.length} total={total} />
          </>
        )}
      </div>
    </div>
  );
}
