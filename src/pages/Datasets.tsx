/**
 * Datasets — the examples that feed evals and tuning.
 *
 * Most rows here are captured from real runs: a corrected extraction or an
 * edited draft reply is worth more as training data than anything synthetic,
 * so the interesting column is where each row came from.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import PageHeader from '../components/layout/PageHeader';
import { datasetsService, type Dataset } from '../api/improve';
import { sourceConfig } from '../lib/improveDisplay';
import TruncationNotice from '../components/ui/TruncationNotice';

function NewDatasetForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  const create = useMutation({
    mutationFn: () => datasetsService.create({ name: name.trim() }),
    onSuccess: (ds) => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      toast.success(`${ds.name} created`);
      onDone();
    },
    onError: () => toast.error('Could not create that dataset — is the name already taken?'),
  });

  return (
    <div className="bg-card border border-border rounded p-4 mb-4 max-w-md">
      <label className="block text-[13px] font-medium mb-1.5">Dataset name</label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && name.trim() && create.mutate()}
        placeholder="Invoice fields — gold"
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

export default function Datasets() {
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => datasetsService.list(),
  });
  const sets = data?.items ?? [];
  const total = data?.count ?? 0;

  const totalRows = sets.reduce((n, s) => n + s.row_count, 0);

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        icon={Database}
        title="Datasets"
        subtitle={
          isLoading ? 'Loading…' : `${total} datasets · ${totalRows.toLocaleString()} rows shown`
        }
        actions={
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded font-semibold text-sm hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            New dataset
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {creating && <NewDatasetForm onDone={() => setCreating(false)} />}

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading datasets…
          </div>
        ) : sets.length === 0 && !creating ? (
          <div className="max-w-md py-12">
            <h2 className="font-semibold mb-1">No datasets yet</h2>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              A dataset is a set of examples — an input, and what the right answer
              would have been. The most useful ones come from corrections you made
              to an agent's output, not from anything written by hand.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sets.map((s: Dataset) => {
              const src = sourceConfig[s.source] ?? sourceConfig.uploaded;
              const Icon = src.icon;
              return (
                <Link
                  key={s.id}
                  to={`/datasets/${s.id}`}
                  className="block bg-card border border-border rounded p-4 hover:border-border-strong hover:bg-secondary/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-semibold truncate">{s.name}</h3>
                    <span className="text-[13px] text-muted-foreground tabular-nums shrink-0">
                      {s.row_count.toLocaleString()} rows
                    </span>
                  </div>

                  <span
                    className={cn(
                      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-medium mb-3',
                      src.cls
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    {src.label}
                  </span>

                  <p className="text-[12px] text-muted-foreground mb-3">
                    Split <span className="font-mono">{s.split_label}</span>
                  </p>

                  {/* What breaks if you change this — the question you actually
                      ask before editing a dataset. */}
                  {s.used_by.length > 0 && (
                    <div className="pt-3 border-t border-border">
                      <p className="text-[11px] text-muted-foreground mb-1">Used by</p>
                      <div className="flex flex-wrap gap-1">
                        {s.used_by.map((u) => (
                          <span
                            key={u}
                            className="px-1.5 py-0.5 rounded bg-secondary border border-border text-[11px] text-muted-foreground"
                          >
                            {u}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </Link>
              );
            })}
            </div>
            <TruncationNotice shown={sets.length} total={total} />
          </>
        )}
      </div>
    </div>
  );
}
