import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Folder as FolderIcon, Home, Loader2, X } from 'lucide-react';
import { useState } from 'react';

import { foldersService } from '../../api/documents';
import { cn } from '../../lib/utils';

interface FolderPickerModalProps {
  isOpen: boolean;
  title?: string;
  /** Folders being moved — they and their descendants cannot be the target. */
  excludeFolderIds?: number[];
  onCancel: () => void;
  onConfirm: (targetFolderId: number | null) => void;
  isBusy?: boolean;
}

/**
 * Pick a destination folder by walking into it.
 *
 * This is the *contract* for moving; drag-and-drop is the accelerator on top.
 * Shipping only the drag would leave the operation untestable and unusable on
 * touch, so the menu path exists first and always works.
 *
 * A folder being moved is shown but not selectable — the server refuses a move
 * into self or a descendant with a 400, and refusing it here first is kinder
 * than round-tripping to find out.
 */
export default function FolderPickerModal({
  isOpen,
  title = 'Move to…',
  excludeFolderIds = [],
  onCancel,
  onConfirm,
  isBusy = false,
}: FolderPickerModalProps) {
  const [browsingId, setBrowsingId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['folders', browsingId],
    queryFn: () => foldersService.list(browsingId),
    enabled: isOpen,
  });

  if (!isOpen) return null;

  const excluded = new Set(excludeFolderIds);
  const current = data?.folder ?? null;
  const trail = data?.breadcrumbs ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-1 text-sm overflow-x-auto">
          <button
            type="button"
            onClick={() => setBrowsingId(null)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
          >
            <Home className="w-3.5 h-3.5" />
            My Files
          </button>
          {[...trail, ...(current ? [{ id: current.id, name: current.name }] : [])].map((crumb) => (
            <div key={crumb.id} className="flex items-center gap-1 shrink-0">
              <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
              <button
                type="button"
                onClick={() => setBrowsingId(crumb.id)}
                className="px-2 py-1 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 truncate max-w-[8rem]"
              >
                {crumb.name}
              </button>
            </div>
          ))}
        </div>

        <div className="max-h-72 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : data && data.folders.length > 0 ? (
            <ul className="space-y-0.5">
              {data.folders.map((folder) => {
                const blocked = excluded.has(folder.id);
                return (
                  <li key={folder.id}>
                    <button
                      type="button"
                      disabled={blocked}
                      onClick={() => setBrowsingId(folder.id)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors',
                        blocked
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                      )}
                      title={blocked ? 'You cannot move a folder into itself' : undefined}
                    >
                      <FolderIcon className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="truncate text-gray-800 dark:text-gray-200">{folder.name}</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-auto text-gray-300 dark:text-gray-600" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-10 text-center text-sm text-gray-400">
              No folders here. You can still move items into this one.
            </p>
          )}
          {data?.truncated && (
            <p className="px-3 py-2 text-xs text-gray-400">
              Showing the first {data.count} folders.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onConfirm(browsingId)}
            className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Move {current ? `to “${current.name}”` : 'to My Files'}
          </button>
        </div>
      </div>
    </div>
  );
}
