/**
 * One dataset: its split, and the rows themselves.
 *
 * Rows are fetched a page at a time rather than inlined on the list page. A gold
 * set runs to thousands of rows, and loading all of them to render a card would
 * make the datasets page slow in proportion to how much work you have done —
 * exactly backwards.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Database, Loader2, ExternalLink } from 'lucide-react';
import { cn } from '../lib/utils';
import { datasetsService } from '../api/improve';
import { sourceConfig } from '../lib/improveDisplay';

const SPLITS = [
  { id: '', label: 'All' },
  { id: 'train', label: 'Train' },
  { id: 'val', label: 'Validation' },
  { id: 'test', label: 'Test' },
] as const;

/** JSON as one readable line. Rows hold arbitrary shapes, so nothing structural
 *  can be assumed — but a wall of braces is unreadable, so keys are lifted out. */
function Cell({ value }: { value: Record<string, unknown> }) {
  const entries = Object.entries(value ?? {});
  if (entries.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="space-x-2">
      {entries.map(([k, v]) => (
        <span key={k} className="inline-block">
          <span className="text-muted-foreground">{k}</span>{' '}
          <span className="text-foreground">{String(v)}</span>
        </span>
      ))}
    </span>
  );
}

export default function DatasetDetail() {
  const { id } = useParams<{ id: string }>();
  const [split, setSplit] = useState<string>('');
  const [page, setPage] = useState(1);

  const { data: dataset, isLoading } = useQuery({
    queryKey: ['dataset', id],
    queryFn: () => datasetsService.get(id!),
    enabled: !!id,
  });
  const { data: stats } = useQuery({
    queryKey: ['dataset', id, 'stats'],
    queryFn: () => datasetsService.stats(id!),
    enabled: !!id,
  });
  const { data: rows, isFetching } = useQuery({
    queryKey: ['dataset', id, 'rows', split, page],
    queryFn: () => datasetsService.rows(id!, { split: split || undefined, page }),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm p-6">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading…
      </div>
    );
  }
  if (!dataset) {
    return (
      <div className="p-6">
        <p className="text-[13px] text-muted-foreground mb-3">That dataset no longer exists.</p>
        <Link to="/datasets" className="text-[13px] text-primary hover:underline">
          Back to datasets
        </Link>
      </div>
    );
  }

  const src = sourceConfig[dataset.source] ?? sourceConfig.uploaded;
  const SrcIcon = src.icon;
  const pageCount = rows ? Math.ceil(rows.count / 50) : 1;

  return (
    <div className="h-full flex flex-col">
      <header className="px-4 md:px-6 py-4 border-b border-border">
        <Link
          to="/datasets"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Datasets
        </Link>
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary-subtle border border-primary-line rounded">
            <Database className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">{dataset.name}</h1>
            <p className="text-[13px] text-muted-foreground">
              {dataset.row_count.toLocaleString()} rows · split{' '}
              <span className="font-mono">{dataset.split_label}</span>
            </p>
          </div>
          <span
            className={cn(
              'ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-medium shrink-0',
              src.cls
            )}
          >
            <SrcIcon className="w-3 h-3" />
            {src.label}
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {dataset.used_by.length > 0 && (
          <div className="mb-4 p-3 bg-card border border-border rounded">
            <p className="text-[12px] text-muted-foreground mb-1.5">
              Changing these rows changes what these depend on
            </p>
            <div className="flex flex-wrap gap-1">
              {dataset.used_by.map((u) => (
                <span
                  key={u}
                  className="px-1.5 py-0.5 rounded bg-secondary border border-border text-[11px]"
                >
                  {u}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 mb-4">
          {SPLITS.map((s) => {
            const n = !stats
              ? null
              : s.id === ''
                ? stats.total
                : stats[s.id as 'train' | 'val' | 'test'];
            return (
              <button
                key={s.id}
                onClick={() => {
                  setSplit(s.id);
                  setPage(1);
                }}
                className={cn(
                  'px-3 py-1.5 text-[13px] rounded border transition-colors',
                  split === s.id
                    ? 'border-primary bg-primary-subtle text-primary font-medium'
                    : 'border-border hover:bg-secondary'
                )}
              >
                {s.label}
                {n !== null && <span className="ml-1.5 text-muted-foreground tabular-nums">{n}</span>}
              </button>
            );
          })}
          {isFetching && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-2" />}
        </div>

        {rows && rows.results.length === 0 ? (
          <p className="text-[13px] text-muted-foreground py-8">
            No rows in this split yet.
          </p>
        ) : (
          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-secondary">
                <tr className="text-left text-[12px] text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Input</th>
                  <th className="px-3 py-2 font-medium">Expected</th>
                  <th className="px-3 py-2 font-medium w-24">Split</th>
                  <th className="px-3 py-2 font-medium w-28">Source</th>
                </tr>
              </thead>
              <tbody>
                {rows?.results.map((r) => (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="px-3 py-2">
                      <Cell value={r.inputs} />
                      {r.note && (
                        <p className="text-[12px] text-muted-foreground mt-1 italic">{r.note}</p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Cell value={r.expected} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.split}</td>
                    <td className="px-3 py-2">
                      {/* Provenance: walk back to the run and see the original
                          document the correction was made against. */}
                      {r.source_execution ? (
                        <Link
                          to={`/runs?execution=${r.source_execution}`}
                          className="inline-flex items-center gap-1 text-primary hover:underline text-[12px]"
                        >
                          the run
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      ) : (
                        <span className="text-muted-foreground text-[12px]">uploaded</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows && pageCount > 1 && (
          <div className="flex items-center gap-2 mt-4 text-[13px]">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={!rows.previous}
              className="px-3 py-1.5 rounded border border-border hover:bg-secondary disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-muted-foreground tabular-nums">
              Page {page} of {pageCount}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!rows.next}
              className="px-3 py-1.5 rounded border border-border hover:bg-secondary disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
