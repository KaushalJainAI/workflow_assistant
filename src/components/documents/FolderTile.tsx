import { Folder as FolderIcon, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import type { Folder } from '../../api/documents';
import { cn } from '../../lib/utils';

interface FolderTileProps {
  folder: Folder;
  viewMode: 'grid' | 'list';
  onOpen: (folder: Folder) => void;
  onRename: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
  /** Something was dragged onto this folder. */
  onDropInto: (folder: Folder) => void;
  onDragStartFolder: (folder: Folder) => void;
}

/**
 * A folder in the same grid as the documents.
 *
 * It is both a drag source and a drop target, which is what makes
 * drag-to-organise work without a separate tree pane. The drop highlight is
 * driven by a counter rather than a boolean because `dragenter`/`dragleave`
 * fire for every child element the pointer crosses, so a boolean flickers.
 */
export default function FolderTile({
  folder,
  viewMode,
  onOpen,
  onRename,
  onDelete,
  onDropInto,
  onDragStartFolder,
}: FolderTileProps) {
  const [dragDepth, setDragDepth] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const isDropTarget = dragDepth > 0;

  const dragHandlers = {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', `folder:${folder.id}`);
      onDragStartFolder(folder);
    },
    onDragEnter: () => setDragDepth((d) => d + 1),
    onDragLeave: () => setDragDepth((d) => Math.max(0, d - 1)),
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragDepth(0);
      onDropInto(folder);
    },
  };

  const subtitle = [
    folder.child_count ? `${folder.child_count} folder${folder.child_count === 1 ? '' : 's'}` : null,
    folder.document_count
      ? `${folder.document_count} file${folder.document_count === 1 ? '' : 's'}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ') || 'Empty';

  const menu = (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((v) => !v);
        }}
        className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
        aria-label={`Actions for ${folder.name}`}
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
          <div className="absolute right-0 top-8 z-20 w-40 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg py-1">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onRename(folder); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted"
            >
              <Pencil className="w-3.5 h-3.5" /> Rename
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(folder); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-3.5 h-3.5" /> Move to Trash
            </button>
          </div>
        </>
      )}
    </div>
  );

  if (viewMode === 'list') {
    return (
      <div
        {...dragHandlers}
        onDoubleClick={() => onOpen(folder)}
        className={cn(
          'flex items-center gap-3 px-4 py-3 border-b border-border cursor-pointer transition-colors bg-card',
          isDropTarget
            ? 'bg-primary/10 ring-1 ring-inset ring-primary'
            : 'hover:bg-muted'
        )}
      >
        <FolderIcon className="w-5 h-5 text-amber-500 shrink-0" />
        <button
          type="button"
          onClick={() => onOpen(folder)}
          className="flex-1 min-w-0 text-left font-medium text-card-foreground truncate"
        >
          {folder.name}
        </button>
        <span className="text-sm text-muted-foreground shrink-0">{subtitle}</span>
        {menu}
      </div>
    );
  }

  return (
    <div
      {...dragHandlers}
      onDoubleClick={() => onOpen(folder)}
      className={cn(
        'group relative rounded-lg border p-4 cursor-pointer card-hover bg-card',
        isDropTarget
          ? 'border-primary bg-primary/10 ring-1 ring-primary'
          : 'border-border hover:border-border-strong hover:shadow-sm'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onOpen(folder)}
          className="flex items-start gap-3 min-w-0 flex-1 text-left"
        >
          <FolderIcon className="w-8 h-8 text-amber-500 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-card-foreground truncate" title={folder.name}>
              {folder.name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
        </button>
        <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {menu}
        </div>
      </div>
    </div>
  );
}
