/**
 * Extract — turn a pile of documents into rows.
 *
 * You define the fields once, point it at a folder or an inbox, and it fills a
 * table. Anything the model is unsure about is flagged for review rather than
 * quietly guessed, which is what makes the output usable for accounting — so
 * the count that leads each card is how many rows are waiting on a person.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScanText, Plus, AlertTriangle, CheckCircle2, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '../components/layout/PageHeader';
import extractionService, { type ExtractionSchema } from '../api/extraction';
import { sourceIcon, sourceLabel } from '../lib/improveDisplay';
import TruncationNotice from '../components/ui/TruncationNotice';

function NewSchemaForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [fieldText, setFieldText] = useState('vendor\ndate\ngstin\ntotal');

  const create = useMutation({
    mutationFn: () =>
      extractionService.createSchema({
        name: name.trim(),
        // One field per line is the fastest way to define a table by hand; the
        // type picker belongs on the detail page, not in the way of creating one.
        fields: fieldText
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .map((n) => ({ name: n, type: 'string' as const })),
      }),
    onSuccess: (s) => {
      queryClient.invalidateQueries({ queryKey: ['extraction-schemas'] });
      toast.success(`${s.name} created`);
      onDone();
    },
    onError: (err: { response?: { data?: Record<string, unknown> } }) => {
      const first = err.response?.data && Object.values(err.response.data)[0];
      toast.error(String(Array.isArray(first) ? first[0] : (first ?? 'Could not create that schema.')));
    },
  });

  return (
    <div className="bg-card border border-border rounded p-4 mb-4 max-w-md space-y-3">
      <div>
        <label className="block text-[13px] font-medium mb-1.5">Schema name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Purchase invoices"
          className="w-full h-9 px-3 rounded border border-input bg-background text-sm"
        />
      </div>
      <div>
        <label className="block text-[13px] font-medium mb-1.5">
          Fields <span className="text-muted-foreground font-normal">one per line</span>
        </label>
        <textarea
          value={fieldText}
          onChange={(e) => setFieldText(e.target.value)}
          rows={5}
          className="w-full px-3 py-2 rounded border border-input bg-background text-sm font-mono resize-none"
        />
      </div>
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

export default function Extract() {
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['extraction-schemas'],
    queryFn: () => extractionService.listSchemas(),
  });
  const schemas = data?.items ?? [];
  const total = data?.count ?? 0;

  const flagged = schemas.reduce((n, s) => n + s.review_count, 0);

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        icon={ScanText}
        title="Extract"
        subtitle={
          isLoading
            ? 'Loading…'
            : flagged
              ? `${total} schemas · ${flagged} rows waiting on you`
              : `${total} schemas · nothing waiting`
        }
        actions={
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded font-semibold text-sm hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            New schema
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {creating && <NewSchemaForm onDone={() => setCreating(false)} />}

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading schemas…
          </div>
        ) : schemas.length === 0 && !creating ? (
          <div className="max-w-md py-12">
            <h2 className="font-semibold mb-1">No schemas yet</h2>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              A schema is the set of columns you want filled. Define it once, point
              it at an inbox or a folder, and anything the model is unsure about
              gets held for you rather than guessed.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {schemas.map((s: ExtractionSchema) => {
              const SrcIcon = sourceIcon[s.source_kind] ?? Upload;
              return (
                <Link
                  key={s.id}
                  to={`/extract/${s.id}`}
                  className="block bg-card border border-border rounded p-4 hover:border-border-strong hover:bg-secondary/40 transition-colors"
                >
                  <h3 className="font-semibold mb-1 truncate">{s.name}</h3>
                  <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground mb-3">
                    <SrcIcon className="w-3 h-3" />
                    {sourceLabel[s.source_kind] ?? 'Manual upload'}
                    {s.source_ref && <span className="truncate">· {s.source_ref}</span>}
                  </p>

                  <div className="flex items-center gap-3 text-[12px] text-muted-foreground mb-3">
                    <span>{s.field_count} fields</span>
                    <span className="tabular-nums">{s.row_count.toLocaleString()} rows</span>
                  </div>

                  {/* The number that decides whether this page needs you today. */}
                  <div className="pt-3 border-t border-border">
                    {s.review_count > 0 ? (
                      <p className="flex items-center gap-1.5 text-[13px] text-destructive font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {s.review_count} need{s.review_count === 1 ? 's' : ''} review
                      </p>
                    ) : (
                      <p className="flex items-center gap-1.5 text-[13px] text-success">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Nothing waiting
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Held below {Math.round(s.confidence_threshold * 100)}% confidence
                    </p>
                  </div>
                </Link>
              );
            })}
            </div>
            <TruncationNotice shown={schemas.length} total={total} />
          </>
        )}
      </div>
    </div>
  );
}
