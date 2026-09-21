/**
 * A side drawer that previews a file without leaving the page.
 *
 * Clicking a file an agent wrote used to navigate away from the conversation
 * that explains it, and back again cost the scroll position. The drawer keeps
 * both on screen: the answer on the left, the file on the right, and "Open in
 * Documents" for when the user does want the file browser.
 *
 * A target by id is fetched directly. A target by path is walked through
 * `lib/vfsPath.ts`, the same resolution the Documents page uses, so a path in
 * prose and a card with an id end up at the same document.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileWarning, FolderOpen, Loader2, X } from 'lucide-react';

import { documentsService, type Document } from '../../api/documents';
import { downloadDocument } from '../../lib/filePreview';
import { resolvePath } from '../../lib/vfsPath';
import { toast } from '../../lib/toastStore';
import FilePreview from './FilePreview';
import { FilePreviewContext, type FileTarget } from './filePreviewState';

export default function FilePreviewProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<FileTarget | null>(null);
  // Bumped on every open, so reopening the same file remounts the drawer and
  // re-reads it — an agent may have edited it since it was last opened.
  const [openCount, setOpenCount] = useState(0);

  const open = useCallback((t: FileTarget) => {
    setTarget(t);
    setOpenCount((n) => n + 1);
  }, []);
  const close = useCallback(() => setTarget(null), []);

  return (
    <FilePreviewContext.Provider value={open}>
      {children}
      {target && <FileDrawer key={openCount} target={target} onClose={close} />}
    </FilePreviewContext.Provider>
  );
}

function FileDrawer({ target, onClose }: { target: FileTarget; onClose: () => void }) {
  const [doc, setDoc] = useState<Document | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const label = 'path' in target && target.path ? target.path : 'File';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    const load: Promise<Document | null> =
      'documentId' in target
        ? documentsService.get(target.documentId)
        : resolvePath(target.path).then((r) => r.doc);
    load
      .then((d) => {
        if (cancelled) return;
        if (d) setDoc(d);
        else setProblem(`${label} is not in your files. It may have been moved or deleted.`);
      })
      .catch(() => {
        // The API answers 404 for a deleted file and for someone else's alike,
        // so the message cannot say which, and should not try.
        if (!cancelled) setProblem('This file is no longer available. It may have been deleted.');
      });
    return () => {
      cancelled = true;
    };
  }, [target, label]);

  const download = async () => {
    if (!doc) return;
    try {
      await downloadDocument(doc);
    } catch {
      toast.error('Download failed');
    }
  };

  return (
    <aside
      role="dialog"
      aria-label={`Preview of ${doc?.filename ?? label}`}
      className="fixed inset-y-0 right-0 z-[90] flex w-full flex-col border-l border-border bg-card shadow-2xl animate-in slide-in-from-right duration-200 sm:w-[min(760px,55vw)] sm:min-w-[440px]"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-foreground">{doc?.filename ?? label}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {doc?.folder_path && doc.folder_path !== '/' ? doc.folder_path : doc ? 'Your files' : ' '}
          </p>
        </div>
        {doc && (
          <>
            <Link
              to={`/documents?doc=${doc.id}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span>Open in Documents</span>
            </Link>
            <button
              type="button"
              onClick={download}
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Download"
            >
              <Download className="h-4 w-4" />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close preview"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {doc ? (
        <FilePreview key={doc.id} doc={doc} className="flex-1" />
      ) : problem ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
          <FileWarning className="h-6 w-6" />
          {problem}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Opening…
        </div>
      )}
    </aside>
  );
}
