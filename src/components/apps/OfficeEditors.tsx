/**
 * Slides and the Word side of Docs: edits to a deck or a document through the
 * spec the file was rendered from.
 *
 * The browser edits `metadata.spec` and the server re-renders the real
 * `.pptx` / `.docx` from it (`POST office/ {spec}`), so what is saved is a
 * file PowerPoint and Word open normally — never an approximation the browser
 * drew. An uploaded deck or document has no spec; it opens read-only and says
 * so, and a Word file offers an editable copy built from its text.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Copy, FilePlus2, Heading, List, ListOrdered, Loader2,
  Minus, Pilcrow, Play, Plus, Quote, Table2, Trash2, X,
} from 'lucide-react';

import { documentsService, type Document } from '../../api/documents';
import { apiErrorMessage } from '../../lib/apiError';
import { officeSpecOf, type Block, type Bullet, type DeckSpec, type DocumentSpec, type Slide } from '../../lib/officeSpec';
import { toast } from '../../lib/toastStore';
import { cn } from '../../lib/utils';
import OfficePreview, { DeckSlide } from '../files/OfficePreview';
import {
  Divider, EditorError, EditorLoading, SaveStatus, StaleBanner, ToolButton, Toolbar,
} from './EditorChrome';
import { isSaveKey } from '../../lib/editorKeys';
import type { EditorProps } from './TextEditors';

// Limits mirrored from `chat/tools/office/deck.py` and `document.py`, so an
// input stops where the server would refuse rather than failing at save.
const DECK = { slides: 40, title: 90, subtitle: 200, bullets: 6, bullet: 160, notes: 3000, cols: 6, rows: 10, stats: 4 };
const DOC = { blocks: 300, title: 200, paragraph: 6000, items: 50, item: 1000 };

function useSpecFile<T>(doc: Document, pick: (d: Document) => T | null) {
  const qc = useQueryClient();
  const [spec, setSpec] = useState<T | null>(null);
  const [base, setBase] = useState('');
  const [full, setFull] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [stale, setStale] = useState(false);
  const [nonce, setNonce] = useState(0);
  const etag = useRef<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    documentsService
      .get(doc.id)
      .then((d) => {
        if (cancelled) return;
        const s = pick(d);
        etag.current = d.updated_at;
        setFull(d);
        setSpec(s);
        setBase(JSON.stringify(s));
      })
      .catch((err) => !cancelled && setError(apiErrorMessage(err, 'Could not open this file.')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [doc.id, nonce, pick]);

  const dirty = spec !== null && JSON.stringify(spec) !== base;

  const save = useCallback(
    async (payload: unknown, guard = true) => {
      if (saving) return;
      setSaving(true);
      try {
        const saved = await documentsService.editOffice(doc.id, { spec: payload }, guard ? etag.current : undefined);
        etag.current = saved.updated_at;
        const next = pick(saved);
        setFull(saved);
        setSpec(next);
        setBase(JSON.stringify(next));
        setStale(false);
        qc.invalidateQueries({ queryKey: ['documents'] });
        qc.invalidateQueries({ queryKey: ['app-files'] });
      } catch (err) {
        if ((err as { response?: { status?: number } })?.response?.status === 412) setStale(true);
        else toast.error('Could not save', apiErrorMessage(err, 'Please try again.'));
      } finally {
        setSaving(false);
      }
    },
    [doc.id, qc, saving, pick],
  );

  const reload = () => {
    setLoading(true);
    setError(null);
    setStale(false);
    setNonce((n) => n + 1);
  };

  return { spec, setSpec, full, loading, error, saving, stale, dirty, save, reload };
}

function ReadOnlyNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="shrink-0 border-b border-border/60 bg-muted/40 px-4 py-2 text-[12.5px] text-muted-foreground">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slides
// ---------------------------------------------------------------------------

const NEW_SLIDES: { layout: Slide['layout']; label: string; make: () => Slide }[] = [
  { layout: 'bullets', label: 'Bullets', make: () => ({ layout: 'bullets', title: 'New slide', bullets: [{ text: 'First point', level: 0 }] }) },
  { layout: 'title', label: 'Title', make: () => ({ layout: 'title', title: 'Title', subtitle: '' }) },
  { layout: 'section', label: 'Section', make: () => ({ layout: 'section', title: 'Section', subtitle: '' }) },
  {
    layout: 'two_column', label: 'Two columns', make: () => ({
      layout: 'two_column', title: 'Compare',
      left: { heading: 'Before', bullets: [{ text: 'Point', level: 0 }] },
      right: { heading: 'After', bullets: [{ text: 'Point', level: 0 }] },
    }),
  },
  { layout: 'quote', label: 'Quote', make: () => ({ layout: 'quote', quote: 'A memorable line.', attribution: '' }) },
  {
    layout: 'stats', label: 'Numbers', make: () => ({
      layout: 'stats', title: 'Key numbers', stats: [{ value: '42%', label: 'Growth' }, { value: '3×', label: 'Faster' }],
    }),
  },
  {
    layout: 'table', label: 'Table', make: () => ({
      layout: 'table', title: 'Table', columns: ['Item', 'Value'], rows: [['A', '1'], ['B', '2']],
    }),
  },
  { layout: 'closing', label: 'Closing', make: () => ({ layout: 'closing', title: 'Thank you', subtitle: '' }) },
];

const bulletsToText = (bullets: Bullet[] = []) => bullets.map((b) => (b.level ? `- ${b.text}` : b.text)).join('\n');
const textToBullets = (text: string): Bullet[] =>
  text
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim())
    .slice(0, DECK.bullets)
    .map((l, i) => {
      const sub = i > 0 && /^\s*- /.test(l);
      return { text: (sub ? l.replace(/^\s*- /, '') : l.trim()).slice(0, DECK.bullet), level: sub ? 1 : 0 };
    });

// Module-level so `useSpecFile` gets a stable function and its effect runs once per file.
function pickDeck(d: Document): DeckSpec | null {
  const s = officeSpecOf(d.metadata);
  return s?.kind === 'deck' ? s : null;
}

function pickDocument(d: Document): DocumentSpec | null {
  const s = officeSpecOf(d.metadata);
  return s?.kind === 'document' ? s : null;
}

export function SlidesEditor({ doc, onDirtyChange }: EditorProps) {
  const file = useSpecFile<DeckSpec>(doc, pickDeck);
  const [index, setIndex] = useState(0);
  const [presenting, setPresenting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  useEffect(() => onDirtyChange?.(file.dirty), [file.dirty, onDirtyChange]);

  if (file.loading) return <EditorLoading />;
  if (file.error) return <EditorError message={file.error} />;
  if (!file.spec) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ReadOnlyNotice>
          This deck was uploaded, so it opens read-only — its layout came from another program and this editor
          cannot rebuild it. Download it to edit in PowerPoint, or create a new presentation here.
        </ReadOnlyNotice>
        {file.full && <OfficePreview doc={file.full} className="flex-1" />}
      </div>
    );
  }

  const spec = file.spec;
  const current = Math.min(index, spec.slides.length - 1);
  const slide = spec.slides[current];
  const setSlides = (slides: Slide[]) => file.setSpec({ ...spec, slides });
  const patchSlide = (change: Partial<Slide>) =>
    setSlides(spec.slides.map((s, i) => (i === current ? { ...s, ...change } : s)));
  const moveSlide = (from: number, to: number) => {
    if (to < 0 || to >= spec.slides.length) return;
    const next = [...spec.slides];
    const [s] = next.splice(from, 1);
    next.splice(to, 0, s);
    setSlides(next);
    setIndex(to);
  };
  const addSlide = (make: () => Slide) => {
    if (spec.slides.length >= DECK.slides) return toast.error(`A deck can hold ${DECK.slides} slides.`);
    const next = [...spec.slides];
    next.splice(current + 1, 0, make());
    setSlides(next);
    setIndex(current + 1);
    setAddOpen(false);
  };
  const save = (guard = true) =>
    void file.save({ title: spec.title, theme: spec.theme?.name, slides: spec.slides }, guard);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onKeyDown={(e) => {
        if (isSaveKey(e)) {
          e.preventDefault();
          save();
        }
      }}
    >
      {file.stale && <StaleBanner onReload={file.reload} onOverwrite={() => save(false)} />}
      <Toolbar>
        <div className="relative">
          <ToolButton onClick={() => setAddOpen((o) => !o)} title="New slide">
            <Plus className="h-4 w-4" /> New slide
          </ToolButton>
          {addOpen && (
            <div className="absolute left-0 top-full z-30 mt-1 w-44 rounded-md border border-border/60 bg-popover p-1 shadow-lg">
              {NEW_SLIDES.map((n) => (
                <button
                  key={n.layout}
                  type="button"
                  onClick={() => addSlide(n.make)}
                  className="block w-full rounded px-2 py-1.5 text-left text-[13px] hover:bg-muted"
                >
                  {n.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <ToolButton onClick={() => addSlide(() => structuredClone(slide))} title="Duplicate slide">
          <Copy className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          onClick={() => {
            if (spec.slides.length <= 1) return;
            setSlides(spec.slides.filter((_, i) => i !== current));
            setIndex(Math.max(0, current - 1));
          }}
          disabled={spec.slides.length <= 1}
          title="Delete slide"
        >
          <Trash2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton onClick={() => moveSlide(current, current - 1)} disabled={current === 0} title="Move up">
          <ArrowUp className="h-4 w-4" />
        </ToolButton>
        <ToolButton onClick={() => moveSlide(current, current + 1)} disabled={current === spec.slides.length - 1} title="Move down">
          <ArrowDown className="h-4 w-4" />
        </ToolButton>
        <Divider />
        <input
          value={spec.title}
          onChange={(e) => file.setSpec({ ...spec, title: e.target.value.slice(0, DECK.title) })}
          aria-label="Deck title"
          placeholder="Deck title"
          className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-[13px] font-medium outline-none hover:border-border/60 focus:border-primary"
        />
        <ToolButton onClick={() => setPresenting(true)} title="Present">
          <Play className="h-4 w-4" /> Present
        </ToolButton>
      </Toolbar>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Slide rail: a strip on phones, a column from md up. */}
        <ol className="m-0 flex shrink-0 list-none gap-2 overflow-auto border-b border-border/60 bg-muted/30 p-2 md:w-44 md:flex-col md:border-b-0 md:border-r">
          {spec.slides.map((_, i) => (
            <li key={i} className="w-28 shrink-0 md:w-full">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-current={i === current}
                aria-label={`Slide ${i + 1}`}
                className={cn(
                  'flex w-full items-start gap-1.5 rounded-md p-1 text-left',
                  i === current ? 'bg-primary/15 ring-2 ring-primary' : 'hover:bg-muted',
                )}
              >
                <span className="w-4 shrink-0 pt-0.5 text-right text-[10px] text-muted-foreground">{i + 1}</span>
                <div className="pointer-events-none min-w-0 flex-1">
                  <DeckSlide spec={spec} index={i} className="shadow-none" />
                </div>
              </button>
            </li>
          ))}
        </ol>

        <div className="min-h-0 flex-1 overflow-auto">
          <div className="mx-auto max-w-3xl space-y-4 p-4">
            <DeckSlide spec={spec} index={current} />
            <SlideFields key={current} slide={slide} onChange={patchSlide} />
          </div>
        </div>
      </div>

      <SaveStatus
        dirty={file.dirty}
        saving={file.saving}
        onSave={() => save()}
        extra={<span>Slide {current + 1} of {spec.slides.length} · {spec.theme?.name} theme</span>}
      />

      {presenting && <Presenter spec={spec} start={current} onClose={() => setPresenting(false)} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputCls = 'w-full rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary';

function SlideFields({ slide, onChange }: { slide: Slide; onChange: (c: Partial<Slide>) => void }) {
  const titled = slide.layout !== 'quote';
  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-card p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{slide.layout.replace('_', ' ')} slide</p>
      {titled && (
        <Field label="Title">
          <input className={inputCls} maxLength={DECK.title} value={slide.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} />
        </Field>
      )}
      {(slide.layout === 'title' || slide.layout === 'section' || slide.layout === 'closing') && (
        <Field label="Subtitle">
          <input className={inputCls} maxLength={DECK.subtitle} value={slide.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} />
        </Field>
      )}
      {slide.layout === 'bullets' && (
        <Field label={`Bullets — one per line, start a line with “- ” for a sub-point (max ${DECK.bullets})`}>
          <BulletsBox bullets={slide.bullets} onChange={(bullets) => onChange({ bullets })} />
        </Field>
      )}
      {slide.layout === 'two_column' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {(['left', 'right'] as const).map((side) => {
            const col = slide[side] ?? { heading: '', bullets: [] };
            return (
              <div key={side} className="space-y-2">
                <Field label={`${side === 'left' ? 'Left' : 'Right'} heading`}>
                  <input className={inputCls} value={col.heading} onChange={(e) => onChange({ [side]: { ...col, heading: e.target.value } })} />
                </Field>
                <Field label="Bullets">
                  <BulletsBox bullets={col.bullets} onChange={(bullets) => onChange({ [side]: { ...col, bullets } })} />
                </Field>
              </div>
            );
          })}
        </div>
      )}
      {slide.layout === 'quote' && (
        <>
          <Field label="Quote">
            <textarea className={cn(inputCls, 'min-h-20')} value={slide.quote ?? ''} onChange={(e) => onChange({ quote: e.target.value })} />
          </Field>
          <Field label="Attribution">
            <input className={inputCls} value={slide.attribution ?? ''} onChange={(e) => onChange({ attribution: e.target.value })} />
          </Field>
        </>
      )}
      {slide.layout === 'stats' && (
        <div className="space-y-2">
          {(slide.stats ?? []).map((st, i) => (
            <div key={i} className="flex gap-2">
              <input className={cn(inputCls, 'w-28')} aria-label="Value" value={st.value}
                onChange={(e) => onChange({ stats: slide.stats!.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
              <input className={inputCls} aria-label="Label" value={st.label}
                onChange={(e) => onChange({ stats: slide.stats!.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
              <button type="button" aria-label="Remove" className="rounded p-1.5 text-muted-foreground hover:text-destructive"
                onClick={() => onChange({ stats: slide.stats!.filter((_, j) => j !== i) })}>
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {(slide.stats?.length ?? 0) < DECK.stats && (
            <button type="button" className="text-[12.5px] text-primary hover:underline"
              onClick={() => onChange({ stats: [...(slide.stats ?? []), { value: '0', label: 'Label' }] })}>
              + Add number
            </button>
          )}
        </div>
      )}
      {slide.layout === 'table' && (
        <TableBox
          columns={slide.columns ?? []}
          rows={slide.rows ?? []}
          maxCols={DECK.cols}
          maxRows={DECK.rows}
          onChange={(columns, rows) => onChange({ columns, rows })}
        />
      )}
      {(slide.layout === 'chart' || slide.layout === 'image') && (
        <>
          <Field label="Caption">
            <input className={inputCls} value={slide.caption ?? ''} onChange={(e) => onChange({ caption: e.target.value })} />
          </Field>
          <p className="text-[12px] text-muted-foreground">
            The {slide.layout} itself is kept as it is — ask the assistant to change its data.
          </p>
        </>
      )}
      <Field label="Speaker notes">
        <textarea className={cn(inputCls, 'min-h-16')} maxLength={DECK.notes} value={slide.notes ?? ''}
          onChange={(e) => onChange({ notes: e.target.value || undefined })} />
      </Field>
    </div>
  );
}

function BulletsBox({ bullets, onChange }: { bullets?: Bullet[]; onChange: (b: Bullet[]) => void }) {
  // The textarea owns the raw text so a trailing newline survives typing;
  // the parsed bullets are what the spec keeps.
  const [text, setText] = useState(() => bulletsToText(bullets));
  return (
    <textarea
      className={cn(inputCls, 'min-h-28 font-mono text-[13px]')}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(textToBullets(e.target.value));
      }}
    />
  );
}

function TableBox({
  columns, rows, maxCols, maxRows, onChange,
}: {
  columns: string[];
  rows: string[][];
  maxCols: number;
  maxRows: number;
  onChange: (columns: string[], rows: string[][]) => void;
}) {
  const width = columns.length;
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="border-collapse text-[13px]">
          <thead>
            <tr>
              {columns.map((c, j) => (
                <th key={j} className="p-0.5">
                  <input className={cn(inputCls, 'min-w-24 font-semibold')} value={c} aria-label={`Column ${j + 1}`}
                    onChange={(e) => onChange(columns.map((x, k) => (k === j ? e.target.value : x)), rows)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {Array.from({ length: width }, (_, j) => (
                  <td key={j} className="p-0.5">
                    <input className={cn(inputCls, 'min-w-24')} value={row[j] ?? ''} aria-label={`Row ${i + 1}, column ${j + 1}`}
                      onChange={(e) => onChange(columns, rows.map((r, k) => (k === i ? Array.from({ length: width }, (_, m) => (m === j ? e.target.value : r[m] ?? '')) : r)))} />
                  </td>
                ))}
                <td className="p-0.5">
                  <button type="button" aria-label="Remove row" className="rounded p-1 text-muted-foreground hover:text-destructive"
                    onClick={() => onChange(columns, rows.filter((_, k) => k !== i))}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-3 text-[12.5px]">
        {rows.length < maxRows && (
          <button type="button" className="text-primary hover:underline" onClick={() => onChange(columns, [...rows, Array(width).fill('')])}>
            + Row
          </button>
        )}
        {width < maxCols && (
          <button type="button" className="text-primary hover:underline"
            onClick={() => onChange([...columns, `Column ${width + 1}`], rows.map((r) => [...r, '']))}>
            + Column
          </button>
        )}
        {width > 1 && (
          <button type="button" className="text-muted-foreground hover:text-destructive hover:underline"
            onClick={() => onChange(columns.slice(0, -1), rows.map((r) => r.slice(0, width - 1)))}>
            − Last column
          </button>
        )}
      </div>
    </div>
  );
}

function Presenter({ spec, start, onClose }: { spec: DeckSpec; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.requestFullscreen?.().catch(() => undefined);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (['ArrowRight', 'ArrowDown', ' ', 'PageDown'].includes(e.key)) setI((n) => Math.min(n + 1, spec.slides.length - 1));
      else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [onClose, spec.slides.length]);

  return (
    <div ref={box} className="fixed inset-0 z-[150] flex flex-col bg-black" role="dialog" aria-label="Presentation">
      <div className="flex min-h-0 flex-1 items-center justify-center p-2 sm:p-6" onClick={() => setI((n) => Math.min(n + 1, spec.slides.length - 1))}>
        <div className="w-full max-w-[min(100%,calc((100dvh-6rem)*16/9))]">
          <DeckSlide spec={spec} index={i} className="border-none" />
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-center gap-4 pb-4 text-sm text-white/70">
        <button type="button" aria-label="Previous slide" onClick={() => setI((n) => Math.max(n - 1, 0))} className="rounded p-2 hover:bg-white/10">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span>{i + 1} / {spec.slides.length}</span>
        <button type="button" aria-label="Next slide" onClick={() => setI((n) => Math.min(n + 1, spec.slides.length - 1))} className="rounded p-2 hover:bg-white/10">
          <ChevronRight className="h-5 w-5" />
        </button>
        <button type="button" onClick={onClose} className="ml-4 rounded px-3 py-1.5 hover:bg-white/10">Exit (Esc)</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Word documents
// ---------------------------------------------------------------------------

const NEW_BLOCKS: { label: string; icon: typeof Heading; make: () => Block }[] = [
  { label: 'Heading', icon: Heading, make: () => ({ type: 'heading', text: 'Heading', level: 2 }) },
  { label: 'Paragraph', icon: Pilcrow, make: () => ({ type: 'paragraph', text: '' }) },
  { label: 'Bulleted list', icon: List, make: () => ({ type: 'bullets', items: [''] }) },
  { label: 'Numbered list', icon: ListOrdered, make: () => ({ type: 'numbered', items: [''] }) },
  { label: 'Quote', icon: Quote, make: () => ({ type: 'quote', text: '' }) },
  { label: 'Table', icon: Table2, make: () => ({ type: 'table', columns: ['Column 1', 'Column 2'], rows: [['', '']], caption: '' }) },
  { label: 'Page break', icon: Minus, make: () => ({ type: 'page_break' }) },
];

/** Blocks the server would refuse (empty text, empty lists) are dropped at save. */
function cleanBlocks(blocks: Block[]): Block[] {
  return blocks.flatMap((b): Block[] => {
    if (b.type === 'heading' || b.type === 'paragraph' || b.type === 'quote') return b.text.trim() ? [b] : [];
    if (b.type === 'bullets' || b.type === 'numbered') {
      const items = b.items.filter((i) => i.trim());
      return items.length ? [{ ...b, items }] : [];
    }
    return [b];
  });
}

/** Paragraphs of extracted text → blocks, for the editable copy of an upload. */
function blocksFromText(text: string): Block[] {
  return text
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, DOC.blocks)
    .map((p) => ({ type: 'paragraph' as const, text: p.slice(0, DOC.paragraph) }));
}

export function WordEditor({ doc, onDirtyChange, onOpenDoc }: EditorProps & { onOpenDoc?: (d: Document) => void }) {
  const file = useSpecFile<DocumentSpec>(doc, pickDocument);
  const [focus, setFocus] = useState<number | null>(null);
  const [copying, setCopying] = useState(false);
  useEffect(() => onDirtyChange?.(file.dirty), [file.dirty, onDirtyChange]);

  if (file.loading) return <EditorLoading />;
  if (file.error) return <EditorError message={file.error} />;

  if (!file.spec) {
    const makeCopy = async () => {
      if (!file.full) return;
      setCopying(true);
      try {
        const stem = doc.filename.replace(/\.docx$/i, '');
        const created = await documentsService.create(`${stem} (editable).docx`, doc.folder_id ?? null);
        const blocks = blocksFromText(file.full.content ?? '');
        const saved = blocks.length
          ? await documentsService.editOffice(created.id, { spec: { title: stem, blocks } }, created.updated_at)
          : created;
        toast.success('Editable copy created', saved.filename);
        onOpenDoc?.(saved);
      } catch (err) {
        toast.error('Could not make a copy', apiErrorMessage(err, 'Please try again.'));
      } finally {
        setCopying(false);
      }
    };
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ReadOnlyNotice>
          <span className="mr-2">
            This Word file was uploaded, so it opens read-only — its formatting came from another program.
          </span>
          <button type="button" onClick={() => void makeCopy()} disabled={copying}
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline disabled:opacity-50">
            {copying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FilePlus2 className="h-3.5 w-3.5" />}
            Make an editable copy
          </button>
        </ReadOnlyNotice>
        {file.full && <OfficePreview doc={file.full} className="flex-1" />}
      </div>
    );
  }

  const spec = file.spec;
  const setBlocks = (blocks: Block[]) => file.setSpec({ ...spec, blocks });
  const patch = (i: number, b: Block) => setBlocks(spec.blocks.map((x, j) => (j === i ? b : x)));
  const insert = (b: Block) => {
    if (spec.blocks.length >= DOC.blocks) return toast.error(`A document can hold ${DOC.blocks} blocks.`);
    const at = focus === null ? spec.blocks.length : focus + 1;
    const next = [...spec.blocks];
    next.splice(at, 0, b);
    setBlocks(next);
    setFocus(at);
  };
  const move = (i: number, to: number) => {
    if (to < 0 || to >= spec.blocks.length) return;
    const next = [...spec.blocks];
    const [b] = next.splice(i, 1);
    next.splice(to, 0, b);
    setBlocks(next);
    setFocus(to);
  };
  const save = (guard = true) => {
    const blocks = cleanBlocks(spec.blocks);
    if (!blocks.length) return toast.error('Write something first', 'A document needs at least one block with text.');
    if (!spec.title.trim()) return toast.error('Give the document a title.');
    void file.save({ title: spec.title, subtitle: spec.subtitle, blocks }, guard);
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onKeyDown={(e) => {
        if (isSaveKey(e)) {
          e.preventDefault();
          save();
        }
      }}
    >
      {file.stale && <StaleBanner onReload={file.reload} onOverwrite={() => save(false)} />}
      <Toolbar>
        <span className="mr-1 hidden text-[12px] text-muted-foreground sm:inline">Insert:</span>
        {NEW_BLOCKS.map((n) => (
          <ToolButton key={n.label} onClick={() => insert(n.make())} title={`Insert ${n.label.toLowerCase()}`}>
            <n.icon className="h-4 w-4" /> <span className="hidden xl:inline">{n.label}</span>
          </ToolButton>
        ))}
      </Toolbar>
      <div className="min-h-0 flex-1 overflow-auto bg-muted/40 px-2 py-4 sm:px-6 sm:py-8">
        <article className="mx-auto max-w-3xl rounded-sm bg-card px-5 py-8 shadow-md sm:px-12 sm:py-12">
          <input
            value={spec.title}
            onChange={(e) => file.setSpec({ ...spec, title: e.target.value.slice(0, DOC.title) })}
            placeholder="Title"
            aria-label="Title"
            className="w-full bg-transparent text-2xl font-bold outline-none sm:text-3xl"
          />
          <input
            value={spec.subtitle ?? ''}
            onChange={(e) => file.setSpec({ ...spec, subtitle: e.target.value.slice(0, DOC.title) })}
            placeholder="Subtitle (optional)"
            aria-label="Subtitle"
            className="mt-1 w-full bg-transparent text-base text-muted-foreground outline-none"
          />
          <div className="mt-6 space-y-1">
            {spec.blocks.map((b, i) => (
              <div
                key={i}
                onFocusCapture={() => setFocus(i)}
                className={cn('group relative rounded-md px-2 py-1 transition-colors', focus === i ? 'bg-primary/5' : 'hover:bg-muted/40')}
              >
                <div className={cn(
                  'absolute -top-3 right-1 z-10 flex gap-0.5 rounded-md border border-border/60 bg-popover p-0.5 shadow-sm',
                  focus === i ? 'flex' : 'hidden group-hover:flex',
                )}>
                  <button type="button" aria-label="Move up" onClick={() => move(i, i - 1)} className="rounded p-1 text-muted-foreground hover:bg-muted"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label="Move down" onClick={() => move(i, i + 1)} className="rounded p-1 text-muted-foreground hover:bg-muted"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label="Delete block" onClick={() => { setBlocks(spec.blocks.filter((_, j) => j !== i)); setFocus(null); }}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                <BlockEditor block={b} onChange={(nb) => patch(i, nb)} />
              </div>
            ))}
          </div>
        </article>
      </div>
      <SaveStatus
        dirty={file.dirty}
        saving={file.saving}
        onSave={() => save()}
        hint="Ctrl+S to save · **bold** and _italic_ work in any text"
        extra={<span>{spec.blocks.length} {spec.blocks.length === 1 ? "block" : "blocks"}</span>}
      />
    </div>
  );
}

function AutoText({ value, onChange, className, placeholder }: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn('block w-full resize-none overflow-hidden bg-transparent leading-relaxed outline-none', className)}
    />
  );
}

function BlockEditor({ block, onChange }: { block: Block; onChange: (b: Block) => void }) {
  switch (block.type) {
    case 'heading':
      return (
        <div className="flex items-center gap-2">
          <select
            value={block.level}
            onChange={(e) => onChange({ ...block, level: Number(e.target.value) as 1 | 2 | 3 })}
            aria-label="Heading level"
            className="rounded border border-border/60 bg-background px-1 py-0.5 text-[11px] text-muted-foreground"
          >
            <option value={1}>H1</option>
            <option value={2}>H2</option>
            <option value={3}>H3</option>
          </select>
          <input
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            placeholder="Heading"
            aria-label="Heading"
            className={cn('min-w-0 flex-1 bg-transparent font-bold outline-none',
              block.level === 1 ? 'text-xl' : block.level === 2 ? 'text-lg' : 'text-base')}
          />
        </div>
      );
    case 'paragraph':
      return <AutoText value={block.text} onChange={(text) => onChange({ ...block, text: text.slice(0, DOC.paragraph) })} placeholder="Type a paragraph…" className="text-[15px]" />;
    case 'quote':
      return (
        <div className="border-l-4 border-primary/50 pl-3">
          <AutoText value={block.text} onChange={(text) => onChange({ ...block, text })} placeholder="Quote" className="text-[15px] italic text-muted-foreground" />
        </div>
      );
    case 'bullets':
    case 'numbered':
      return (
        <div className="flex gap-2">
          <span className="select-none pt-0.5 text-sm text-muted-foreground">{block.type === 'bullets' ? '•' : '1.'}</span>
          <AutoText
            value={block.items.join('\n')}
            onChange={(v) => onChange({ ...block, items: v.split('\n').slice(0, DOC.items).map((i) => i.slice(0, DOC.item)) })}
            placeholder="One item per line"
            className="text-[15px]"
          />
        </div>
      );
    case 'table':
      return (
        <div className="space-y-1.5 py-1">
          <TableBox columns={block.columns} rows={block.rows} maxCols={6} maxRows={40}
            onChange={(columns, rows) => onChange({ ...block, columns, rows })} />
          <input value={block.caption} onChange={(e) => onChange({ ...block, caption: e.target.value })}
            placeholder="Caption (optional)" aria-label="Table caption"
            className="w-full bg-transparent text-[12px] italic text-muted-foreground outline-none" />
        </div>
      );
    case 'page_break':
      return <div className="flex items-center gap-2 py-2 text-[11px] uppercase tracking-wide text-muted-foreground"><span className="h-px flex-1 border-t border-dashed border-border" />Page break<span className="h-px flex-1 border-t border-dashed border-border" /></div>;
    case 'image':
      return <p className="rounded-md border border-dashed border-border/60 px-3 py-4 text-center text-[12.5px] text-muted-foreground">Image: {block.path}{block.caption ? ` — ${block.caption}` : ''}</p>;
    case 'chart':
      return <p className="rounded-md border border-dashed border-border/60 px-3 py-4 text-center text-[12.5px] text-muted-foreground">Chart: {block.chart?.title || 'untitled'} (kept as is)</p>;
    default:
      return null;
  }
}
