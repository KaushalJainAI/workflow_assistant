import { ChevronRight, Home } from 'lucide-react';

import type { Breadcrumb, Folder } from '../../api/documents';
import { cn } from '../../lib/utils';

interface BreadcrumbsProps {
  /** Ancestors, root-first, excluding the folder itself. */
  trail: Breadcrumb[];
  /** The folder currently open, or null at the root. */
  current: Folder | null;
  onNavigate: (folderId: number | null) => void;
  /** Called when something is dropped on a crumb — moves it up the tree. */
  onDropOn?: (folderId: number | null) => void;
  className?: string;
}

/**
 * The location trail.
 *
 * The root has no id and no row on the server — `folder_id IS NULL` *is* the
 * root — so the first crumb navigates to `null` rather than to a folder. It is
 * also a drop target, which is the only way to move something back to the top
 * without opening the picker.
 */
export default function Breadcrumbs({
  trail,
  current,
  onNavigate,
  onDropOn,
  className,
}: BreadcrumbsProps) {
  const dropProps = (folderId: number | null) =>
    onDropOn
      ? {
          onDragOver: (e: React.DragEvent) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          },
          onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            onDropOn(folderId);
          },
        }
      : {};

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center gap-1 text-sm min-w-0 flex-wrap', className)}
    >
      <button
        type="button"
        onClick={() => onNavigate(null)}
        {...dropProps(null)}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors shrink-0',
          'hover:bg-muted',
          current === null
            ? 'text-foreground font-medium'
            : 'text-muted-foreground'
        )}
      >
        <Home className="w-3.5 h-3.5" />
        My Files
      </button>

      {trail.map((crumb) => (
        <div key={crumb.id} className="flex items-center gap-1 min-w-0">
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
          <button
            type="button"
            onClick={() => onNavigate(crumb.id)}
            {...dropProps(crumb.id)}
            className={cn(
              'px-2 py-1 rounded-md truncate max-w-[10rem] transition-colors',
              'text-muted-foreground',
              'hover:bg-muted hover:text-foreground'
            )}
            title={crumb.name}
          >
            {crumb.name}
          </button>
        </div>
      ))}

      {current && (
        <div className="flex items-center gap-1 min-w-0">
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
          <span
            className="px-2 py-1 font-medium text-foreground truncate max-w-[12rem]"
            title={current.name}
            aria-current="page"
          >
            {current.name}
          </span>
        </div>
      )}
    </nav>
  );
}
