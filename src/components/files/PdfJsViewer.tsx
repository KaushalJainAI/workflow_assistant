/**
 * Every PDF on every device: pdf.js (Apache-2.0) instead of the browser's
 * built-in viewer, which shows nothing inside a page on most phones.
 *
 * Page thumbnails, search, zoom and the page count — the same viewer in the
 * file preview and in the PDF Reader app. Only this file pulls in pdf.js,
 * and it loads lazily wherever it is used, so no other page downloads it.
 */
import { useEffect, useRef, useState } from 'react';
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';
import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut } from 'lucide-react';

import { documentsService } from '../../api/documents';
import { apiErrorMessage } from '../../lib/apiError';
import { cn } from '../../lib/utils';

// Past this many pages thumbnails stop: a thumbnail each is a render, and a
// 500-page scan does not need 500 of them to be navigable.
const THUMBNAIL_CAP = 200;

let workerStarted = false;

function ensureWorker() {
  if (!workerStarted) {
    GlobalWorkerOptions.workerPort = new PdfWorker();
    workerStarted = true;
  }
}

function usePdfDocument(docId: number) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let task: { destroy: () => Promise<void>; promise: Promise<PDFDocumentProxy> } | null = null;
    ensureWorker();
    documentsService
      .download(docId, { inline: true })
      .then((blob) => blob.arrayBuffer())
      .then((bytes) => {
        if (cancelled) return null;
        task = getDocument({ data: bytes });
        return task.promise;
      })
      .then((loaded) => {
        if (cancelled || !loaded) {
          if (loaded) void task?.destroy();
          return;
        }
        setPdf(loaded);
      })
      .catch((err) => {
        if (!cancelled) setError(apiErrorMessage(err, 'This PDF could not be opened.'));
      });
    return () => {
      cancelled = true;
      if (task) void task.destroy();
    };
  }, [docId]);
  return { pdf, error };
}

export default function PdfJsViewer({ docId }: { docId: number }) {
  const { pdf, error } = usePdfDocument(docId);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<number[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Fresh mount per file (every caller keys the preview on the document
  // id), so the initial page/query state is the reset.
  const pages = pdf?.numPages ?? 0;

  const search = async () => {
    if (!pdf || !query.trim()) {
      setHits(null);
      return;
    }
    setSearching(true);
    try {
      const needle = query.trim().toLowerCase();
      const found: number[] = [];
      for (let n = 1; n <= pages; n += 1) {
        const content = await pdf.getPage(n).then((p) => p.getTextContent());
        const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
        if (text.toLowerCase().includes(needle)) found.push(n);
      }
      setHits(found);
      if (found.length > 0) setPage(found[0]);
    } finally {
      setSearching(false);
    }
  };

  if (error) {
    return <p className="px-6 py-16 text-center text-sm text-muted-foreground">{error}</p>;
  }
  if (!pdf) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Opening…
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border/60 bg-card px-2 py-1.5">
        <button
          type="button"
          onClick={() => setPage((n) => Math.max(1, n - 1))}
          disabled={page <= 1}
          aria-label="Previous page"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-16 text-center text-[12px] text-muted-foreground" aria-live="polite">
          {page} / {pages}
        </span>
        <button
          type="button"
          onClick={() => setPage((n) => Math.min(pages, n + 1))}
          disabled={page >= pages}
          aria-label="Next page"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
          aria-label="Zoom out"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="w-12 text-center text-[12px] text-muted-foreground">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
          aria-label="Zoom in"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <form
          className="ml-auto flex min-w-0 items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            void search();
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in PDF…"
            aria-label="Search in PDF"
            className="h-8 w-36 rounded-md border border-border/60 bg-background px-2 text-[12.5px] outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={searching}
            className="h-8 rounded-md px-2.5 text-[12.5px] font-medium text-primary hover:bg-muted disabled:opacity-50"
          >
            {searching ? '…' : 'Find'}
          </button>
        </form>
      </div>
      {hits !== null && (
        <p className="shrink-0 border-b border-border/60 bg-card px-4 py-1.5 text-[12px] text-muted-foreground" aria-live="polite">
          {hits.length === 0 ? (
            <>No matches for “{query}”.</>
          ) : (
            <>
              {hits.length} {hits.length === 1 ? 'page matches' : 'pages match'}: {hits.slice(0, 12).map((n, i) => (
                <span key={n}>
                  {i > 0 && ', '}
                  <button type="button" onClick={() => setPage(n)} className="text-primary hover:underline">
                    {n}
                  </button>
                </span>
              ))}
              {hits.length > 12 && '…'}
            </>
          )}
        </p>
      )}
      <div className="flex min-h-0 flex-1">
        {pages > 1 && (
          <div className="hidden w-28 shrink-0 flex-col gap-2 overflow-y-auto border-r border-border/60 bg-card p-2 sm:flex" aria-label="Page thumbnails">
            <ThumbnailStrip pdf={pdf} page={page} onSelect={setPage} />
          </div>
        )}
        <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-muted/40 p-4">
          <PageCanvas key={`${docId}:${page}:${zoom}`} pdf={pdf} page={page} scale={1.5 * zoom} />
        </div>
      </div>
    </div>
  );
}

function PageCanvas({ pdf, page, scale }: { pdf: PDFDocumentProxy; page: number; scale: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let rendering: { cancel: () => void } | null = null;
    pdf
      .getPage(page)
      .then((pg) => {
        if (cancelled) return;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = pg.getViewport({ scale: scale * ratio });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
        const task = pg.render({ canvas, viewport });
        rendering = task;
        return task.promise;
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      try {
        rendering?.cancel();
      } catch {
        // Already finished: cancelling a done task throws, harmlessly.
      }
    };
  }, [pdf, page, scale]);
  if (failed) return <p className="py-10 text-center text-sm text-muted-foreground">This page could not be drawn.</p>;
  return (
    <canvas ref={canvasRef} className="mx-auto block max-w-none rounded-sm bg-white shadow-md" role="img" aria-label={`Page ${page}`} />
  );
}

function ThumbnailStrip({ pdf, page, onSelect }: {
  pdf: PDFDocumentProxy;
  page: number;
  onSelect: (n: number) => void;
}) {
  const pages = Math.min(pdf.numPages, THUMBNAIL_CAP);
  return (
    <>
      {Array.from({ length: pages }, (_, i) => (
        <ThumbButton key={i + 1} pdf={pdf} page={i + 1} active={i + 1 === page} onSelect={onSelect} />
      ))}
      {pdf.numPages > THUMBNAIL_CAP && (
        <p className="px-1 text-center text-[11px] text-muted-foreground">+{pdf.numPages - THUMBNAIL_CAP} more</p>
      )}
    </>
  );
}

function ThumbButton({ pdf, page, active, onSelect }: {
  pdf: PDFDocumentProxy;
  page: number;
  active: boolean;
  onSelect: (n: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawn = useRef(false);
  useEffect(() => {
    if (drawn.current) return;
    drawn.current = true;
    let cancelled = false;
    pdf
      .getPage(page)
      .then((pg) => {
        if (cancelled) return;
        const viewport = pg.getViewport({ scale: 0.25 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        return pg.render({ canvas, viewport }).promise;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pdf, page]);
  return (
    <button
      type="button"
      onClick={() => onSelect(page)}
      aria-label={`Go to page ${page}`}
      aria-current={active}
      className={cn(
        'shrink-0 overflow-hidden rounded border bg-white',
        active ? 'border-primary ring-1 ring-primary' : 'border-border/60 hover:border-primary/40',
      )}
    >
      <canvas ref={canvasRef} className="block w-full" />
      <span className="block py-0.5 text-center text-[10px] text-muted-foreground">{page}</span>
    </button>
  );
}
