/**
 * Previews of the files the office tools render — decks, workbooks, documents.
 *
 * Drawn from the spec stored beside the file (`lib/officeSpec.ts`), never from
 * the bytes: a browser cannot lay out a `.pptx`, and a server-side renderer
 * (LibreOffice) would cost more memory than this box has. So the preview is a
 * faithful *reading* of the file — same slides, same words, same theme colours
 * — and says plainly that it is a preview; the download is the real thing.
 *
 * Colours inside a slide come from the deck's own theme, not from the app's
 * tokens, on purpose: this shows what the file looks like, and a dark deck
 * previewed in light mode must still look dark.
 *
 * Every stored string is rendered as text (`spans`), never as HTML: a spec is
 * model-authored and may quote a web page.
 */

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { ImageIcon, Loader2 } from 'lucide-react';

import { documentsService, type Document, type WorkbookGrid } from '../../api/documents';
import ChartArtifact from '../chat/ChartArtifact';
import {
  formatCell,
  hex,
  officeSpecOf,
  sheetChart,
  spans,
  type Bullet,
  type DeckSpec,
  type DocumentSpec,
  type Slide,
  type WorkbookSpec,
} from '../../lib/officeSpec';
import { cn } from '../../lib/utils';

export default function OfficePreview({ doc: given, className }: { doc: Document; className?: string }) {
  // A listing leaves out the spec and the extracted text (both can be large),
  // so a document that arrived from one is re-read in full before drawing.
  const complete = officeSpecOf(given.metadata) !== null || given.content !== undefined;
  const [fetched, setFetched] = useState<Document | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (complete) return;
    let cancelled = false;
    documentsService
      .get(given.id)
      .then((d) => { if (!cancelled) setFetched(d); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [complete, given.id]);

  const doc = complete ? given : fetched;
  if (!doc) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        {failed ? 'This file could not be read.' : (<><Loader2 className="h-4 w-4 animate-spin" /> Loading…</>)}
      </div>
    );
  }
  const spec = officeSpecOf(doc.metadata);

  if (!spec && doc.file_type === 'xlsx') {
    // A workbook with no spec (uploaded, or edited cell by cell since it was
    // rendered) is read from its real cells rather than from the extract.
    return <LiveWorkbookPreview doc={doc} className={className} />;
  }

  if (!spec) {
    // An uploaded Office file: no spec, but the extractor kept its text.
    const text = doc.content?.trim();
    return (
      <div className={cn('p-4', className)}>
        <p className="mb-3 text-xs text-muted-foreground">
          Text extracted from this file. Use Export to take the original layout with you.
        </p>
        {text ? (
          <pre className="m-0 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground/90">
            {text}
          </pre>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">No preview is available for this file.</p>
        )}
      </div>
    );
  }

  return (
    <div className={cn('min-h-0 overflow-auto', className)}>
      {spec.kind === 'deck' && <DeckPreview spec={spec} />}
      {spec.kind === 'workbook' && <WorkbookPreview spec={spec} />}
      {spec.kind === 'document' && <DocumentPreview spec={spec} />}
    </div>
  );
}

function Rich({ text, italic }: { text: string; italic?: boolean }) {
  return (
    <>
      {spans(text, { italic }).map((s, i) =>
        s.bold ? <strong key={i}>{s.text}</strong> : s.italic ? <em key={i}>{s.text}</em> : <span key={i}>{s.text}</span>,
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Decks
// ---------------------------------------------------------------------------

/** Sizes are in container-width units, so a slide scales as one picture. */
const cq = (n: number): CSSProperties => ({ fontSize: `${n}cqw`, lineHeight: 1.2 });

/** A deck theme's colours, with safe fallbacks for a spec that lacks one. */
function deckColors(t: DeckSpec['theme']): Colors {
  return {
    bg: hex(t?.background, '#ffffff'),
    surface: hex(t?.surface, '#f3f5f8'),
    text: hex(t?.text, '#1a1a1a'),
    muted: hex(t?.muted, '#5f6368'),
    accent: hex(t?.accent, '#2a78d6'),
    onAccent: hex(t?.on_accent, '#ffffff'),
    rule: hex(t?.rule, '#d9dde3'),
  };
}

/** One slide drawn at 16:9, scaling as a single picture. Shared with the Slides app. */
export function DeckSlide({ spec, index, className }: { spec: DeckSpec; index: number; className?: string }) {
  const colors = deckColors(spec.theme);
  const slide = spec.slides[index];
  if (!slide) return null;
  return (
    <div
      className={cn(
        'relative aspect-[16/9] w-full overflow-hidden rounded-md border border-border/60 shadow-sm [container-type:inline-size]',
        className,
      )}
      style={{ background: colors.bg, color: colors.text }}
    >
      <SlideBody slide={slide} c={colors} accentTitle={!!spec.theme?.accent_title} />
      {slide.layout !== 'title' && (
        <span className="absolute bottom-[3%] right-[5%]" style={{ ...cq(1.1), color: colors.muted }}>
          {index + 1}
        </span>
      )}
    </div>
  );
}

function DeckPreview({ spec }: { spec: DeckSpec }) {
  const t = spec.theme;
  return (
    <div className="space-y-4 p-4">
      <p className="text-xs text-muted-foreground">
        {spec.slides.length} {spec.slides.length === 1 ? 'slide' : 'slides'} · {t.name} theme · in-browser preview —
        Export for the PowerPoint file, where charts stay editable.
      </p>
      {spec.slides.map((slide, i) => (
        <figure key={i} className="m-0">
          <DeckSlide spec={spec} index={i} />
          {slide.notes && (
            <figcaption className="mt-1.5 px-1 text-[11px] text-muted-foreground">
              <span className="font-medium">Notes:</span> {slide.notes}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

type Colors = {
  bg: string; surface: string; text: string; muted: string;
  accent: string; onAccent: string; rule: string;
};

function SlideTitle({ title, c, accentTitle }: { title?: string; c: Colors; accentTitle: boolean }) {
  return (
    <>
      {accentTitle && <div className="absolute inset-y-0 left-0 w-[1.35%]" style={{ background: c.accent }} />}
      <div className="absolute left-[5.25%] right-[5.25%] top-[6.5%] font-bold" style={cq(2.4)}>
        {title && <Rich text={title} italic={false} />}
      </div>
      <div className="absolute left-[5.25%] top-[20.5%] h-[0.75%] w-[6.75%]" style={{ background: c.accent }} />
    </>
  );
}

function BulletList({ bullets, c, size }: { bullets: Bullet[]; c: Colors; size: number }) {
  return (
    <ul className="m-0 list-none space-y-[0.9cqw] p-0">
      {bullets.map((b, i) => (
        <li
          key={i}
          className="flex gap-[1cqw]"
          style={{ ...cq(b.level ? size - 0.25 : size), color: b.level ? c.muted : c.text, paddingLeft: b.level ? '2.6cqw' : 0 }}
        >
          <span style={{ color: b.level ? c.muted : c.accent }}>{b.level ? '–' : '•'}</span>
          <span><Rich text={b.text} italic={false} /></span>
        </li>
      ))}
    </ul>
  );
}

function Content({ children }: { children: ReactNode }) {
  return <div className="absolute bottom-[10%] left-[5.25%] right-[5.25%] top-[25%]">{children}</div>;
}

function SlideBody({ slide, c, accentTitle }: { slide: Slide; c: Colors; accentTitle: boolean }) {
  switch (slide.layout) {
    case 'title':
    case 'closing': {
      const onAccent = accentTitle;
      return (
        <div className="absolute inset-0" style={{ background: onAccent ? c.accent : undefined }}>
          {!onAccent && <div className="absolute left-[5.25%] top-[32.7%] h-[32%] w-[1.05%]" style={{ background: c.accent }} />}
          <div className="absolute bottom-[46.7%] left-[8.6%] right-[5.25%] font-bold" style={{ ...cq(slide.layout === 'title' ? 3.6 : 3.3), color: onAccent ? c.onAccent : c.text }}>
            {slide.title}
          </div>
          {slide.subtitle && (
            <div className="absolute left-[8.6%] right-[5.25%] top-[55.3%]" style={{ ...cq(1.65), color: onAccent ? c.onAccent : c.muted }}>
              {slide.subtitle}
            </div>
          )}
        </div>
      );
    }
    case 'section':
      return (
        <>
          <div className="absolute left-[5.25%] top-[38.7%] h-[0.9%] w-[9%]" style={{ background: c.accent }} />
          <div className="absolute left-[5.25%] right-[5.25%] top-[41.3%] font-bold" style={cq(3)}>{slide.title}</div>
          {slide.subtitle && (
            <div className="absolute left-[5.25%] right-[5.25%] top-[58.7%]" style={{ ...cq(1.5), color: c.muted }}>{slide.subtitle}</div>
          )}
        </>
      );
    case 'bullets': {
      const n = slide.bullets?.length ?? 0;
      return (
        <>
          <SlideTitle title={slide.title} c={c} accentTitle={accentTitle} />
          <Content><BulletList bullets={slide.bullets ?? []} c={c} size={n <= 3 ? 1.95 : n <= 5 ? 1.65 : 1.5} /></Content>
        </>
      );
    }
    case 'two_column':
      return (
        <>
          <SlideTitle title={slide.title} c={c} accentTitle={accentTitle} />
          <Content>
            <div className="grid h-full grid-cols-2 gap-[4.5cqw]">
              {[slide.left, slide.right].map((col, i) => (
                <div key={i}>
                  {col?.heading && <div className="mb-[1.2cqw] font-bold" style={{ ...cq(1.65), color: c.accent }}>{col.heading}</div>}
                  <BulletList bullets={col?.bullets ?? []} c={c} size={1.42} />
                </div>
              ))}
            </div>
          </Content>
        </>
      );
    case 'chart':
      return (
        <>
          <SlideTitle title={slide.title} c={c} accentTitle={accentTitle} />
          <Content>
            <div className="flex h-full flex-col">
              {/* The app's chart component on a neutral panel: close to the
                  file's native chart, and it offers the table view. */}
              <div className="min-h-0 flex-1 overflow-hidden rounded bg-card text-foreground">
                {slide.chart && <ChartArtifact chart={{ ...slide.chart, title: '' }} />}
              </div>
              {slide.caption && <div className="mt-[0.6cqw] italic" style={{ ...cq(1), color: c.muted }}>{slide.caption}</div>}
            </div>
          </Content>
        </>
      );
    case 'image':
      return (
        <>
          <SlideTitle title={slide.title} c={c} accentTitle={accentTitle} />
          <Content>
            <div className="flex h-full flex-col items-center justify-center gap-[1cqw] rounded" style={{ background: c.surface, color: c.muted }}>
              <ImageIcon style={{ width: '4cqw', height: '4cqw' }} />
              <span style={cq(1.1)}>{slide.image}</span>
            </div>
            {slide.caption && <div className="mt-[0.6cqw] text-center italic" style={{ ...cq(1), color: c.muted }}>{slide.caption}</div>}
          </Content>
        </>
      );
    case 'table':
      return (
        <>
          <SlideTitle title={slide.title} c={c} accentTitle={accentTitle} />
          <Content>
            <table className="w-full border-collapse" style={cq(1.05)}>
              <thead>
                <tr>
                  {(slide.columns ?? []).map((h, i) => (
                    <th key={i} className="px-[0.9cqw] py-[0.7cqw] text-left font-bold" style={{ background: c.accent, color: c.onAccent }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(slide.rows ?? []).map((row, r) => (
                  <tr key={r} style={{ background: r % 2 === 1 ? c.surface : c.bg }}>
                    {row.map((v, k) => <td key={k} className="px-[0.9cqw] py-[0.7cqw]">{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </Content>
        </>
      );
    case 'quote':
      return (
        <>
          <div className="absolute left-[8%] top-[8%] font-bold" style={{ ...cq(9), color: c.accent }}>{'“'}</div>
          <div className="absolute left-[14.25%] right-[14%] top-[29%] flex h-[40%] items-center italic" style={cq(2.25)}>{slide.quote}</div>
          {slide.attribution && (
            <div className="absolute left-[14.25%] top-[71%]" style={{ ...cq(1.35), color: c.muted }}>{'—'} {slide.attribution}</div>
          )}
        </>
      );
    case 'stats': {
      const stats = slide.stats ?? [];
      return (
        <>
          <SlideTitle title={slide.title} c={c} accentTitle={accentTitle} />
          <Content>
            <div className="grid h-[70%] gap-[3cqw]" style={{ gridTemplateColumns: `repeat(${Math.max(stats.length, 1)}, minmax(0, 1fr))` }}>
              {stats.map((st, i) => (
                <div key={i} className="relative flex flex-col justify-center rounded-sm px-[2.2cqw]" style={{ background: c.surface }}>
                  <div className="absolute inset-x-0 top-0 h-[3%]" style={{ background: c.accent }} />
                  <div className="font-bold" style={{ ...cq(stats.length < 4 ? 3.6 : 3), color: c.accent }}>{st.value}</div>
                  <div className="mt-[1cqw]" style={{ ...cq(1.27), color: c.muted }}>{st.label}</div>
                </div>
              ))}
            </div>
          </Content>
        </>
      );
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Workbooks
// ---------------------------------------------------------------------------

function WorkbookPreview({ spec }: { spec: WorkbookSpec }) {
  const [active, setActive] = useState(0);
  const sheet = spec.sheets[Math.min(active, spec.sheets.length - 1)];
  if (!sheet) return null;
  const chart = sheetChart(sheet);
  const totalled = new Set(sheet.totals);

  return (
    <div className="p-4">
      {spec.sheets.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1" role="tablist" aria-label="Sheets">
          {spec.sheets.map((s, i) => (
            <button
              key={s.name}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs transition-colors',
                i === active ? 'border-primary/40 bg-primary/10 font-medium text-foreground' : 'border-border/60 text-muted-foreground hover:text-foreground',
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full border-collapse text-xs">
          <thead className="bg-muted/40">
            <tr>
              {sheet.columns.map((col) => (
                <th key={col.header} className={cn(
                  'whitespace-nowrap border-b border-border/60 px-3 py-2 font-semibold',
                  col.type === 'text' || col.type === 'date' ? 'text-left' : 'text-right',
                )}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, r) => (
              <tr key={r} className={cn(r % 2 === 1 && 'bg-muted/20')}>
                {sheet.columns.map((col, k) => {
                  const cell = formatCell(row[k] ?? null, col);
                  return (
                    <td key={k} className={cn(
                      'whitespace-nowrap border-b border-border/40 px-3 py-1.5',
                      col.type === 'text' || col.type === 'date' ? 'text-left' : 'text-right',
                      cell.formula && 'font-mono text-[11px] text-muted-foreground',
                    )}>
                      {cell.text}
                    </td>
                  );
                })}
              </tr>
            ))}
            {sheet.totals.length > 0 && sheet.rows.length === sheet.row_count && (
              <tr className="font-semibold">
                {sheet.columns.map((col, k) => (
                  <td key={k} className="border-t border-border/80 px-3 py-1.5 text-right font-mono text-[11px] text-muted-foreground">
                    {k === 0 && !totalled.has(col.header) ? <span className="font-sans text-xs text-foreground">Total</span>
                      : totalled.has(col.header) ? 'SUM' : ''}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {sheet.rows.length < sheet.row_count
          ? `Showing ${sheet.rows.length} of ${sheet.row_count.toLocaleString()} rows. `
          : `${sheet.row_count.toLocaleString()} ${sheet.row_count === 1 ? 'row' : 'rows'}. `}
        Formulas are shown as written; Excel and Google Sheets calculate them when the file opens.
      </p>

      {sheet.chart && (
        <div className="mt-4">
          {chart ? (
            <ChartArtifact chart={chart} />
          ) : (
            <p className="rounded-md border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
              Chart “{sheet.chart.title}” is in the file. It plots calculated values, so it appears once the workbook is opened.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function LiveWorkbookPreview({ doc, className }: { doc: Document; className?: string }) {
  const [grid, setGrid] = useState<WorkbookGrid | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  useEffect(() => {
    let cancelled = false;
    documentsService
      .workbook(doc.id)
      .then((g) => { if (!cancelled) setGrid(g); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [doc.id]);

  if (!grid) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        {failed ? 'This workbook could not be read.' : (<><Loader2 className="h-4 w-4 animate-spin" /> Loading…</>)}
      </div>
    );
  }
  const sheet = grid.sheets[Math.min(active, grid.sheets.length - 1)];
  const rows = sheet?.rows.slice(0, 200) ?? [];
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  return (
    <div className={cn('min-h-0 overflow-auto p-4', className)}>
      {grid.sheets.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1" role="tablist" aria-label="Sheets">
          {grid.sheets.map((s, i) => (
            <button
              key={s.name}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs transition-colors',
                i === active ? 'border-primary/40 bg-primary/10 font-medium text-foreground' : 'border-border/60 text-muted-foreground hover:text-foreground',
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">This sheet is empty.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full border-collapse text-xs">
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className={cn(r === 0 ? 'bg-muted/40 font-semibold' : r % 2 === 0 && 'bg-muted/20')}>
                  {Array.from({ length: width }, (_, c) => {
                    const v = row[c];
                    const text = v === null || v === undefined ? '' : String(v);
                    return (
                      <td
                        key={c}
                        className={cn(
                          'whitespace-nowrap border-b border-border/40 px-3 py-1.5',
                          typeof v === 'number' && 'text-right tabular-nums',
                          text.startsWith('=') && 'font-mono text-[11px] text-muted-foreground',
                        )}
                      >
                        {text}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        {sheet && sheet.row_count > rows.length ? `Showing ${rows.length} of ${sheet.row_count.toLocaleString()} rows. ` : ''}
        Formulas are shown as written.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

function DocumentPreview({ spec }: { spec: DocumentSpec }) {
  const accent = hex(spec.accent, '#2a78d6');
  return (
    <article className="mx-auto max-w-2xl px-6 py-6 text-sm leading-relaxed text-foreground">
      <h1 className="m-0 text-2xl font-bold">{spec.title}</h1>
      {spec.subtitle && <p className="mt-1 text-base text-muted-foreground">{spec.subtitle}</p>}
      <div className="mt-5 space-y-3">
        {spec.blocks.map((b, i) => {
          switch (b.type) {
            case 'heading': {
              const size = b.level === 1 ? 'text-lg' : b.level === 2 ? 'text-base' : 'text-sm';
              return <h2 key={i} className={cn('m-0 pt-2 font-bold', size)} style={b.level === 1 ? { color: accent } : undefined}><Rich text={b.text} /></h2>;
            }
            case 'paragraph':
              return <p key={i} className="m-0"><Rich text={b.text} /></p>;
            case 'quote':
              return <blockquote key={i} className="m-0 border-l-2 pl-3 italic text-muted-foreground" style={{ borderColor: accent }}><Rich text={b.text} /></blockquote>;
            case 'bullets':
            case 'numbered': {
              const List = b.type === 'bullets' ? 'ul' : 'ol';
              return (
                <List key={i} className={cn('m-0 space-y-1 pl-5', b.type === 'bullets' ? 'list-disc' : 'list-decimal')}>
                  {b.items.map((item, k) => <li key={k}><Rich text={item} /></li>)}
                </List>
              );
            }
            case 'table':
              return <DocTable key={i} columns={b.columns} rows={b.rows} caption={b.caption} accent={accent} />;
            case 'chart': {
              const xs: string[] = [];
              for (const s of b.chart.series) for (const p of s.points) if (!xs.includes(p.x)) xs.push(p.x);
              const rows = xs.map((x) => [x, ...b.chart.series.map((s) => {
                const y = s.points.find((p) => p.x === x)?.y;
                return y === null || y === undefined ? '—' : y.toLocaleString('en-US');
              })]);
              return (
                <div key={i}>
                  <p className="m-0 mb-1 font-semibold">{b.chart.title}</p>
                  <DocTable columns={[b.chart.x_label || 'Category', ...b.chart.series.map((s) => s.name)]} rows={rows}
                    caption="Chart data shown as a table." accent={accent} />
                </div>
              );
            }
            case 'image':
              return (
                <div key={i} className="flex items-center gap-2 rounded-md border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
                  <ImageIcon className="h-4 w-4" /> {b.path}{b.caption ? ` — ${b.caption}` : ''}
                </div>
              );
            case 'page_break':
              return <hr key={i} className="my-4 border-dashed border-border/60" />;
            default:
              return null;
          }
        })}
      </div>
    </article>
  );
}

function DocTable({ columns, rows, caption, accent }: { columns: string[]; rows: string[][]; caption: string; accent: string }) {
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {columns.map((h, i) => <th key={i} className="border border-border/60 px-2 py-1.5 text-left font-semibold text-white" style={{ background: accent }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className={cn(r % 2 === 1 && 'bg-muted/30')}>
                {row.map((v, k) => <td key={k} className="border border-border/60 px-2 py-1.5"><Rich text={v} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption && <p className="m-0 mt-1 text-[11px] italic text-muted-foreground">{caption}</p>}
    </div>
  );
}
