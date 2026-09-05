/**
 * Read one text document without leaving the Documents page.
 *
 * Before this, a `.md` written by an agent and a `.csv` the user uploaded were
 * both a filename and an icon: the only way to see inside either was to
 * download it and open something else. Images and PDFs already had a preview,
 * so text — the format the agent file tools actually produce — was the one kind
 * of file the file browser could not show.
 *
 * Three decisions worth keeping:
 *
 * **The bytes come from `download`, not from the serializer's `content`.**
 * `content_text` is what the *extractor* stored, and it has been through
 * `bleach.clean(tags=[], strip=True)` and, for CSV, a lossy space-join that
 * discards the column structure. `download` returns the real file when one
 * exists and falls back to `content_text` only for rows an agent wrote — where
 * the text *is* the file. One path, and it is the honest one.
 *
 * **HTML is shown as source, never rendered.** Rendering a user's HTML inside
 * this origin is a scripting hole, and rendering it in a sandboxed iframe would
 * be a second, weaker copy of `render_html_artifact`. Source is what a preview
 * of a source file should show.
 *
 * **Markdown renders through `MarkdownMessage`.** It is the app's single
 * markdown renderer; a second one here would drift in exactly the ways its own
 * header warns about.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileWarning, Loader2, X } from 'lucide-react';

import { documentsService, type Document } from '../../api/documents';
import MarkdownMessage from '../chat/MarkdownMessage';
import { AuthenticatedMediaPreview } from './AuthenticatedMediaPreview';
import { CSV_PREVIEW_ROWS, parseCsv } from '../../lib/csv';
import { cn } from '../../lib/utils';

/**
 * How much text a preview will hold in the DOM.
 *
 * A preview is for deciding whether this is the file you meant, and a 5 MB log
 * rendered in full freezes the tab for a question that the first screen already
 * answered. Truncation is always stated, never silent.
 */
const MAX_PREVIEW_CHARS = 300_000;

type Kind = 'markdown' | 'csv' | 'code' | 'text' | 'media';

/** What to do with a document, from its type and then its extension. */
function kindOf(doc: Document): Kind {
  const type = (doc.file_type || '').toLowerCase();
  if (type === 'image' || type === 'video' || type === 'pdf') return 'media';
  if (type === 'md') return 'markdown';
  if (type === 'csv') return 'csv';
  if (type === 'html' || type === 'json') return 'code';

  // `file_type` is a small closed vocabulary, so anything the user actually
  // named `.css` or `.py` arrives as 'txt'. The extension is the finer signal.
  const ext = (doc.filename.split('.').pop() ?? '').toLowerCase();
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (ext === 'csv' || ext === 'tsv') return 'csv';
  if (['html', 'htm', 'css', 'js', 'ts', 'tsx', 'jsx', 'json', 'py', 'yml', 'yaml', 'xml', 'sh', 'sql'].includes(ext)) {
    return 'code';
  }
  return 'text';
}

interface Props {
  doc: Document;
  onClose: () => void;
  onDownload?: (doc: Document) => void;
}

export function DocumentPreviewModal({ doc, onClose, onDownload }: Props) {
  const kind = useMemo(() => kindOf(doc), [doc]);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(kind !== 'media');
  const [showSource, setShowSource] = useState(false);

  // Escape closes, matching every other modal on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (kind === 'media') return;
    let cancelled = false;

    // No synchronous reset here: the call site keys this component on the
    // document id, so a different document is a fresh mount whose initial
    // state is already the loading state. Resetting in the effect body would
    // be a cascading render for a case that cannot occur.
    documentsService
      .download(doc.id)
      .then((blob) => blob.text())
      .then((body) => {
        if (cancelled) return;
        setText(body);
      })
      .catch(() => {
        if (cancelled) return;
        setError('This file could not be read.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [doc.id, kind]);

  const clipped = useMemo(() => {
    if (text === null) return { body: '', truncated: false };
    return text.length > MAX_PREVIEW_CHARS
      ? { body: text.slice(0, MAX_PREVIEW_CHARS), truncated: true }
      : { body: text, truncated: false };
  }, [text]);

  const table = useMemo(
    () => (kind === 'csv' && text !== null ? parseCsv(clipped.body, CSV_PREVIEW_ROWS) : null),
    [kind, text, clipped.body]
  );

  const handleBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const canToggleSource = kind === 'markdown' || (kind === 'csv' && table !== null);

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-6 animate-in fade-in duration-300"
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${doc.filename}`}
    >
      <div className="bg-card border border-border/60 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground truncate">{doc.filename}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {(doc.file_type || 'file').toUpperCase()}
              {doc.folder_path && doc.folder_path !== '/' ? ` · ${doc.folder_path}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {canToggleSource && (
              <button
                onClick={() => setShowSource((v) => !v)}
                className="px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              >
                {showSource ? 'Preview' : 'Source'}
              </button>
            )}
            {onDownload && (
              <button
                onClick={() => onDownload(doc)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
                aria-label="Download"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6 min-h-0">
          {kind === 'media' && <AuthenticatedMediaPreview doc={doc} />}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading…
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
              <FileWarning className="w-6 h-6" />
              {error}
            </div>
          )}

          {!loading && !error && text !== null && (
            <>
              {/* An empty file and an unextracted binary look identical if we
                  just render nothing, so say which this is. */}
              {text.trim() === '' ? (
                <p className="text-sm text-muted-foreground py-16 text-center">
                  This file has no text to show. It may be a binary upload that was never
                  processed, rather than an empty file.
                </p>
              ) : kind === 'markdown' && !showSource ? (
                <MarkdownMessage content={clipped.body} variant="full" />
              ) : kind === 'csv' && table && !showSource ? (
                <CsvTableView table={table} />
              ) : (
                <pre className="text-xs leading-relaxed font-mono whitespace-pre-wrap break-words text-foreground/90">
                  {clipped.body}
                </pre>
              )}

              {clipped.truncated && (
                <p className="mt-4 text-xs text-muted-foreground border-t border-border/60 pt-3">
                  Showing the first {MAX_PREVIEW_CHARS.toLocaleString()} characters of{' '}
                  {text.length.toLocaleString()}. Download the file to read all of it.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CsvTableView({ table }: { table: ReturnType<typeof parseCsv> }) {
  if (table.headers.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No rows to show.</p>;
  }

  return (
    <div>
      {/* The table scrolls inside its own box; the modal body must not scroll
          sideways because one file happens to have forty columns. */}
      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full text-xs border-collapse">
          <thead className="bg-muted/40">
            <tr>
              {table.headers.map((h, i) => (
                <th
                  key={i}
                  className="text-left font-semibold px-3 py-2 border-b border-border/60 whitespace-nowrap"
                >
                  {h || <span className="text-muted-foreground italic">col {i + 1}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r} className={cn(r % 2 === 1 && 'bg-muted/20')}>
                {row.map((cell, c) => (
                  <td key={c} className="px-3 py-1.5 border-b border-border/40 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {table.truncated
          ? `Showing ${table.rows.length} of ${table.totalRows.toLocaleString()} rows`
          : `${table.totalRows.toLocaleString()} ${table.totalRows === 1 ? 'row' : 'rows'}`}
        {' · '}
        {table.headers.length} {table.headers.length === 1 ? 'column' : 'columns'}
      </p>
    </div>
  );
}
