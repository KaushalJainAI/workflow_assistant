/**
 * Read one document without leaving the Documents page.
 *
 * Only the frame lives here — title, location, open-in-app, download, close.
 * What is inside is `components/files/FilePreview.tsx`, shared with the chat's
 * file drawer so a file looks the same wherever it is opened. Editing is the
 * apps' job (`/apps/<id>?file=`): the button here hands the file to the one
 * that suits it, rather than keeping a second, weaker editor in a modal.
 */

import { useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Download, X } from 'lucide-react';

import type { Document } from '../../api/documents';
import { defaultAppFor, openInAppPath } from '../../lib/apps';
import FilePreview from '../files/FilePreview';

interface Props {
  doc: Document;
  onClose: () => void;
  onDownload?: (doc: Document) => void;
}

export function DocumentPreviewModal({ doc, onClose, onDownload }: Props) {
  const app = defaultAppFor(doc);
  // Escape closes, matching every other modal on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-3 sm:p-6 animate-in fade-in duration-300"
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${doc.filename}`}
    >
      <div className="bg-card border border-border/60 rounded-lg shadow-lg w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden entrance-modal">
        <div className="px-5 py-3.5 border-b border-border/60 flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground truncate">{doc.filename}</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {(doc.file_type || 'file').toUpperCase()}
              {doc.folder_path && doc.folder_path !== '/' ? ` · ${doc.folder_path}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {app && (
              <Link
                to={openInAppPath(doc, app)!}
                className="mr-1 inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[12.5px] font-medium text-primary-foreground hover:bg-primary/90"
              >
                <app.icon className="h-3.5 w-3.5" /> Open in {app.title}
              </Link>
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

        <FilePreview doc={doc} className="min-h-0 flex-1 overflow-auto" />
      </div>
    </div>
  );
}
