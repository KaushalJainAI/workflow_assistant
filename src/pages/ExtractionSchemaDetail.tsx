/**
 * One extraction schema: the rows it produced, and the review queue.
 *
 * Review is an explicit act recorded against a person — "who said this ₹48,200
 * was right?" has to have an answer or the table is not usable for accounting.
 * Low-confidence cells are tinted so the eye lands on the field that is actually
 * doubtful rather than on the whole row.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ScanText, AlertTriangle, CheckCircle2, Loader2, X, Check, SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import extractionService, { type ExtractedRow, type RowStatus } from '../api/extraction';
import { sourceIcon, sourceLabel, rowStatusStyle } from '../lib/improveDisplay';

const FILTERS: { id: RowStatus | ''; label: string }[] = [
  { id: '', label: 'All' },
  { id: 'needs_review', label: 'Needs review' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'rejected', label: 'Rejected' },
];

export default function ExtractionSchemaDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<RowStatus | ''>('needs_review');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const { data: schema, isLoading } = useQuery({
    queryKey: ['extraction-schema', id],
    queryFn: () => extractionService.getSchema(id!),
    enabled: !!id,
  });
  const { data: rows, isFetching } = useQuery({
    queryKey: ['extraction-schema', id, 'rows', filter, page],
    queryFn: () => extractionService.rows(id!, { status: filter || undefined, page }),
    enabled: !!id,
  });

  const review = useMutation({
    mutationFn: ({ rowId, data, reject }: { rowId: number; data?: Record<string, unknown>; reject?: boolean }) =>
      extractionService.review(rowId, { data, reject }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['extraction-schema', id] });
      queryClient.invalidateQueries({ queryKey: ['extraction-schemas'] });
      setEditing(null);
      // A correction is the most valuable kind of training example, so say so
      // rather than letting the judgement disappear into the row.
      toast.success(
        res.corrected
          ? 'Corrected — worth adding to a dataset'
          : res.status === 'rejected'
            ? 'Rejected'
            : 'Accepted'
      );
    },
    onError: () => toast.error('Could not save that review.'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm p-6">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading…
      </div>
    );
  }
  if (!schema) {
    return (
      <div className="p-6">
        <p className="text-[13px] text-muted-foreground mb-3">That schema no longer exists.</p>
        <Link to="/extract" className="text-[13px] text-primary hover:underline">
          Back to extract
        </Link>
      </div>
    );
  }

  const SrcIcon = sourceIcon[schema.source_kind] ?? ScanText;
  const fieldNames = schema.fields.map((f) => f.name);
  const pageCount = rows ? Math.ceil(rows.count / 50) : 1;

  const startEdit = (row: ExtractedRow) => {
    setEditing(row.id);
    setDraft(
      Object.fromEntries(fieldNames.map((n) => [n, String(row.data[n] ?? '')]))
    );
  };

  return (
    <div className="h-full flex flex-col">
      <header className="px-4 md:px-6 py-4 border-b border-border">
        <Link
          to="/extract"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Extract
        </Link>
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary-subtle border border-primary-line rounded">
            <ScanText className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">{schema.name}</h1>
            <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <SrcIcon className="w-3.5 h-3.5" />
              {sourceLabel[schema.source_kind] ?? 'Manual upload'}
              {schema.source_ref && ` · ${schema.source_ref}`}
              {` · ${schema.field_count} fields`}
            </p>
          </div>
          <span className="ml-auto flex items-center gap-1.5 text-[12px] text-muted-foreground shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            held below {Math.round(schema.confidence_threshold * 100)}%
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {schema.review_count > 0 && (
          <div className="mb-4 p-3 rounded border border-destructive-line bg-destructive-subtle">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-destructive">
              <AlertTriangle className="w-4 h-4" />
              {schema.review_count} row{schema.review_count === 1 ? '' : 's'} the model was not
              sure about
            </p>
          </div>
        )}

        <div className="flex items-center gap-1 mb-4 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setFilter(f.id);
                setPage(1);
              }}
              className={cn(
                'px-3 py-1.5 text-[13px] rounded border transition-colors',
                filter === f.id
                  ? 'border-primary bg-primary-subtle text-primary font-medium'
                  : 'border-border hover:bg-secondary'
              )}
            >
              {f.label}
            </button>
          ))}
          {isFetching && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-2" />}
        </div>

        {rows && rows.results.length === 0 ? (
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground py-8">
            <CheckCircle2 className="w-4 h-4 text-success" />
            {filter === 'needs_review'
              ? 'Nothing waiting on you.'
              : 'No rows here yet.'}
          </p>
        ) : (
          <div className="border border-border rounded overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-secondary">
                <tr className="text-left text-[12px] text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Document</th>
                  {fieldNames.map((n) => (
                    <th key={n} className="px-3 py-2 font-medium">
                      {schema.fields.find((f) => f.name === n)?.label ?? n}
                    </th>
                  ))}
                  <th className="px-3 py-2 font-medium w-24">Status</th>
                  <th className="px-3 py-2 font-medium w-32" />
                </tr>
              </thead>
              <tbody>
                {rows?.results.map((r) => {
                  const isEditing = editing === r.id;
                  return (
                    <tr key={r.id} className="border-t border-border align-top">
                      <td className="px-3 py-2 max-w-[200px]">
                        <span className="truncate block">{r.document_name}</span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {Math.round(r.confidence * 100)}% confident
                        </span>
                      </td>

                      {fieldNames.map((n) => {
                        const conf = r.field_confidence?.[n];
                        // Tint the doubtful cell, not the whole row — the point
                        // of per-field confidence is to say where to look.
                        const doubtful =
                          conf !== undefined && conf < schema.confidence_threshold;
                        return (
                          <td
                            key={n}
                            className={cn('px-3 py-2', doubtful && 'bg-destructive-subtle/40')}
                          >
                            {isEditing ? (
                              <input
                                value={draft[n] ?? ''}
                                onChange={(e) => setDraft({ ...draft, [n]: e.target.value })}
                                className="w-full h-8 px-2 rounded border border-input bg-background text-[13px]"
                              />
                            ) : (
                              <>
                                {String(r.data[n] ?? '—')}
                                {doubtful && (
                                  <span className="block text-[11px] text-destructive tabular-nums">
                                    {Math.round(conf * 100)}%
                                  </span>
                                )}
                              </>
                            )}
                          </td>
                        );
                      })}

                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            'inline-block px-1.5 py-0.5 rounded text-[11px]',
                            rowStatusStyle[r.status]
                          )}
                        >
                          {r.status.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="px-3 py-2">
                        {isEditing ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => review.mutate({ rowId: r.id, data: draft })}
                              className="p-1.5 rounded bg-primary text-primary-foreground"
                              aria-label="Save correction"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditing(null)}
                              className="p-1.5 rounded border border-border hover:bg-secondary"
                              aria-label="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : r.status === 'needs_review' ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => review.mutate({ rowId: r.id })}
                              className="px-2 py-1 text-[12px] rounded border border-border hover:bg-secondary"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => startEdit(r)}
                              className="px-2 py-1 text-[12px] rounded border border-border hover:bg-secondary"
                            >
                              Fix
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(r)}
                            className="px-2 py-1 text-[12px] rounded border border-border hover:bg-secondary"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
