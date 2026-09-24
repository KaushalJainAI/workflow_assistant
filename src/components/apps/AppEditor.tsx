/**
 * Which editor an app shows for a file. One switch, so a new app is a
 * registry entry in `lib/apps.ts` plus a case here.
 */
import type { Document } from '../../api/documents';
import type { AppMeta } from '../../lib/apps';
import { extensionOf } from '../../lib/apps';
import FilePreview from '../files/FilePreview';
import { MediaPlayer, PdfViewer, PhotosViewer, Whiteboard } from './MediaEditors';
import { SlidesEditor, WordEditor } from './OfficeEditors';
import SheetEditor from './SheetEditor';
import { CodeEditor, MarkdownEditor, NotepadEditor, TasksEditor, WebEditor } from './TextEditors';

interface Props {
  app: AppMeta;
  doc: Document;
  siblings: Document[];
  onDirtyChange: (dirty: boolean) => void;
  onOpenDoc: (doc: Document) => void;
}

export default function AppEditor({ app, doc, siblings, onDirtyChange, onOpenDoc }: Props) {
  const common = { doc, onDirtyChange };
  switch (app.editor) {
    case 'writer':
      return doc.file_type === 'docx' ? <WordEditor {...common} onOpenDoc={onOpenDoc} /> : <MarkdownEditor {...common} />;
    case 'notepad':
      return <NotepadEditor {...common} />;
    case 'tasks':
      return <TasksEditor {...common} />;
    case 'code':
      // A notebook is JSON nobody should hand-edit; show it as a notebook.
      return extensionOf(doc.filename) === 'ipynb' ? <FilePreview doc={doc} className="min-h-0 flex-1 overflow-auto" /> : <CodeEditor {...common} />;
    case 'web':
      return <WebEditor {...common} />;
    case 'sheets':
      return <SheetEditor {...common} />;
    case 'slides':
      return <SlidesEditor {...common} />;
    case 'pdf':
      return <PdfViewer doc={doc} />;
    case 'photos':
      return <PhotosViewer doc={doc} siblings={siblings} onOpenDoc={onOpenDoc} />;
    case 'media':
      return <MediaPlayer doc={doc} />;
    case 'whiteboard':
      return <Whiteboard doc={doc} onCreated={onOpenDoc} />;
    default:
      return <FilePreview doc={doc} className="min-h-0 flex-1" />;
  }
}
