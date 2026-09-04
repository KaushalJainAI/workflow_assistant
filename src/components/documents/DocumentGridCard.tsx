import { useEffect, useState, useMemo } from 'react';
import { Download, FileText, FileImage, FileVideo, FileJson, Globe, Trash2, Clock3 } from 'lucide-react';
import { documentsService, type Document } from '../../api/documents';
import { cn } from '../../lib/utils';

function humanizeFilename(name: string): string {
  // name is like "a-neon-lit-tokyo-street-at-night-12-1726123456.png"
  // Strip extension
  let base = name.replace(/\.[a-z0-9]{2,5}$/i, '');
  // Strip trailing -<id>-<timestamp>  (e.g. -12-1726123456)
  base = base.replace(/-\d+-\d{10,13}$/, '');
  // Also strip single trailing timestamp if present
  base = base.replace(/-\d{10,13}$/, '');
  // Replace hyphens/underscores with spaces
  base = base.replace(/[-_]+/g, ' ').trim();
  // Collapse whitespace
  base = base.replace(/\s+/g, ' ');
  if (!base) return name;
  // Title case but keep small words lowercase after first
  const small = new Set(['a', 'an', 'the', 'at', 'in', 'on', 'of', 'and', 'or', 'for', 'to']);
  const words = base.split(' ').map((w, i) => {
    const lower = w.toLowerCase();
    if (i !== 0 && small.has(lower)) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
  let out = words.join(' ');
  // Truncate sensibly
  if (out.length > 72) out = out.slice(0, 71) + '…';
  return out;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function TypeIcon({ fileType, className }: { fileType: string; className?: string }) {
  if (fileType.includes('image')) return <FileImage className={className} />;
  if (fileType.includes('video')) return <FileVideo className={className} />;
  if (fileType.includes('pdf')) return <FileText className={className} />;
  if (fileType.includes('json') || fileType.includes('csv')) return <FileJson className={className} />;
  return <FileText className={className} />;
}

interface Props {
  doc: Document;
  onDownload: (doc: Document) => void;
  onShare: (doc: Document) => void;
  onDelete: (id: number) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  showActions?: boolean;
}

export function DocumentGridCard({ doc, onDownload, onShare, onDelete, draggable, onDragStart, onDragEnd }: Props) {
  const isImage = doc.file_type.includes('image');
  const isVideo = doc.file_type.includes('video');
  const isGenerated = doc.metadata?.source === 'imagine';
  const title = useMemo(() => humanizeFilename(doc.title || doc.filename), [doc.title, doc.filename]);
  const folderLabel = doc.folder_path && doc.folder_path !== '/' ? doc.folder_path.split('/').filter(Boolean).pop() ?? doc.folder_path : 'My Files';
  const typeLabel = isImage ? 'Image' : isVideo ? 'Video' : doc.file_type.toUpperCase();
  const ext = (doc.filename.split('.').pop() ?? '').toUpperCase();

  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isImage) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    // Authenticated fetch — never an unauthenticated <img src="/api/...">
    documentsService
      .download(doc.id)
      .then((blob) => {
        if (cancelled) return;
        // Guard: if backend returns fallback text (401 html) don't create image
        if (blob.type && !blob.type.startsWith('image/') && blob.size < 500) return;
        objectUrl = URL.createObjectURL(blob);
        setThumbUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc.id, isImage]);

  const isPending = doc.status === 'pending' || doc.status === 'processing' || doc.status === 'uploading';
  const isFailed = doc.status === 'failed';

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground',
        'border-border/60 hover:border-border hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)] hover:-translate-y-[1px]',
        'transition-all duration-200',
        doc.is_shared && 'ring-1 ring-primary/15',
        isFailed && 'border-destructive/30'
      )}
    >
      {/* Media */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted/20">
        {isImage && thumbUrl ? (
          <img
            src={thumbUrl}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : isImage ? (
          // Skeleton while authenticated blob loads — avoids flash of unauthenticated 401
          <div className="flex h-full w-full items-center justify-center bg-muted/30">
            <div className="h-6 w-6 animate-pulse rounded-full bg-border" />
          </div>
        ) : isVideo ? (
          <div className="flex h-full w-full items-center justify-center bg-slate-900/5 dark:bg-zinc-900">
            <FileVideo className="h-8 w-8 text-muted-foreground/30" />
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted/10 p-6 text-center">
            <TypeIcon fileType={doc.file_type} className="h-7 w-7 text-muted-foreground/25" />
            <span className="max-w-[80%] truncate text-[11px] font-medium text-muted-foreground/50">{ext || typeLabel}</span>
          </div>
        )}

        {/* Top bar: type + size */}
        <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/70 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/70">
            <TypeIcon fileType={doc.file_type} className="h-3 w-3" />
            {ext || typeLabel}
          </span>
          {!isPending && !isFailed && (
            <span className="hidden sm:inline-flex rounded-full bg-background/80 px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur">
              {formatSize(doc.file_size)}
            </span>
          )}
        </div>

        {/* Failed / pending overlay */}
        {isFailed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-destructive/5 backdrop-blur-[1px] p-4 text-center">
            <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive">Failed</span>
            <span className="line-clamp-2 max-w-[85%] text-[11px] leading-relaxed text-muted-foreground">{doc.error_message ?? 'Could not process'}</span>
          </div>
        ) : isPending ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-full bg-background px-3 py-1.5 text-xs font-medium shadow-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              {doc.status === 'uploading' ? 'Uploading…' : doc.status === 'processing' ? 'Indexing…' : 'Queued'}
            </div>
          </div>
        ) : null}

        {/* Subtle bottom gradient for legibility without AI gloss */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100 dark:from-black/20" />
      </div>

      {/* Body — left aligned, editorial */}
      <div className="flex flex-1 flex-col p-3.5">
        <h4 className="line-clamp-2 text-[13.5px] font-[550] leading-[1.35] tracking-[-0.01em] text-foreground" title={doc.title}>
          {title}
        </h4>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] leading-none">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Clock3 className="h-3 w-3 opacity-60" />
            {formatDate(doc.created_at)}
          </span>
          <span className="h-1 w-1 rounded-full bg-border" />
          <span className="truncate text-muted-foreground/70">{folderLabel}</span>
          {/* `metadata` is open-ended JSON, so the type is now `unknown` and the
              narrowing has to happen here. It also stops a non-string `kind`
              rendering as "[object Object]". */}
          {isGenerated && typeof doc.metadata?.kind === 'string' && (
            <>
              <span className="h-1 w-1 rounded-full bg-border" />
              <span className="capitalize text-muted-foreground/60">{doc.metadata.kind}</span>
            </>
          )}
        </div>

        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
          <span className="truncate">{doc.filename}</span>
          <span className="hidden sm:inline">· {doc.chunk_count} chunks</span>
          {doc.is_shared && <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Shared</span>}
        </div>

        {/* Actions — muted, appear on hover/focus */}
        <div className="mt-3 flex items-center gap-1.5 border-t border-border/50 pt-3 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload(doc);
            }}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-colors hover:bg-foreground/90"
            title="Download"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShare(doc);
            }}
            disabled={isPending}
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-lg border text-muted-foreground transition-colors',
              doc.is_shared ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15' : 'border-border/60 bg-card hover:bg-muted hover:text-foreground',
              isPending && 'opacity-40 pointer-events-none'
            )}
            title={doc.is_shared ? 'Shared' : 'Share'}
          >
            <Globe className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(doc.id);
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground transition-colors hover:border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
            title="Move to Trash"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
