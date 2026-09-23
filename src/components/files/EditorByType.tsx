/**
 * Basic in-browser editor for text documents (P3).
 *
 * Text types only (`txt | md | csv | json | html`) — the same set the
 * `PATCH .../content/` door accepts. Binaries refuse server-side with a
 * re-render pointer, so this component never offers to edit them.
 *
 * Ctrl+S saves. A 412 means the file changed since it was opened (AI draft
 * landing after the human opened it) — the edit is kept on screen, never
 * clobbered, until the user re-opens and re-applies it.
 */
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Loader2 } from 'lucide-react';

import { documentsService, type Document } from '../../api/documents';
import { apiErrorMessage } from '../../lib/apiError';
import { toast } from '../../lib/toastStore';
import { cn } from '../../lib/utils';

const EDITABLE = new Set(['txt', 'md', 'csv', 'json', 'html']);

export function isEditableType(fileType: string): boolean {
  return EDITABLE.has((fileType || '').toLowerCase());
}

export default function EditorByType({ docId, onSaved }: { docId: number; onSaved?: (doc: Document) => void }) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [etag, setEtag] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [base, setBase] = useState('');
  const [saving, setSaving] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    documentsService
      .get(docId)
      .then((doc) => {
        if (cancelled) return;
        const text = doc.content ?? '';
        setValue(text);
        setBase(text);
        setEtag(doc.updated_at);
      })
      .catch((err) => {
        if (!cancelled) setError(apiErrorMessage(err, 'Could not open that file.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [docId]);

  const dirty = value !== base;

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setStale(false);
    try {
      const saved = await documentsService.updateContent(docId, value, etag ?? undefined);
      setBase(value);
      setEtag(saved.updated_at);
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['folders'] });
      toast.success('Saved.');
      onSaved?.(saved);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 412) {
        // Keep the user's text on screen; they re-open and re-apply.
        setStale(true);
      } else {
        toast.error(apiErrorMessage(err, 'Could not save that file.'));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading editor…
      </div>
    );
  }

  if (error) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{error}</p>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {stale && (
        <p className="shrink-0 border-b border-warning/40 bg-warning-subtle px-4 py-2 text-[12px] text-warning">
          This file changed since you opened it (an AI draft may have landed). Re-open it from Documents
          and re-apply your change — your text above is untouched.
        </p>
      )}
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            void save();
          }
        }}
        spellCheck={false}
        className="min-h-[40vh] flex-1 resize-none bg-background p-4 font-mono text-[13px] leading-relaxed outline-none"
        aria-label="File contents"
      />
      <div className="flex shrink-0 items-center gap-2 border-t border-border/60 px-4 py-2">
        <span className={cn('text-[11px]', dirty ? 'font-medium text-foreground' : 'text-muted-foreground')}>
          {dirty ? '• Unsaved changes' : 'Saved'}
        </span>
        <span className="text-[11px] text-muted-foreground">Ctrl+S to save</span>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!dirty || saving}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Save
        </button>
      </div>
    </div>
  );
}
