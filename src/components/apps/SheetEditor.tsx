/**
 * Sheets: a spreadsheet grid over a CSV or an .xlsx.
 *
 * The two formats save through different doors, and that is the whole
 * difference between them here:
 *
 * * a **CSV** is text, so the grid is serialised (in the file's own
 *   delimiter) and saved through `PATCH content/`, and rows and columns can be
 *   inserted or deleted freely;
 * * an **.xlsx** is edited cell by cell (`POST office/` with `set_cells`,
 *   the `edit_workbook` path), so formatting, charts and untouched formulas
 *   survive. Inserting or deleting a row there would silently break every
 *   formula that points past it, so a workbook only grows at its edges.
 *
 * Formulas show as written (`=SUM(B2:B9)`); calculated values need the file
 * opened in a spreadsheet program, and the status bar says so.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowRightToLine, Columns3, Rows3, Trash2 } from 'lucide-react';

import { documentsService } from '../../api/documents';
import { apiErrorMessage } from '../../lib/apiError';
import { parseCsv } from '../../lib/csv';
import {
  cellRef, chunk, columnName, diffCells, sizeGrid, toCsv, toText, type Grid,
} from '../../lib/sheetGrid';
import { toast } from '../../lib/toastStore';
import { cn } from '../../lib/utils';
import {
  Divider, EditorError, EditorLoading, SaveStatus, StaleBanner, ToolButton, Toolbar,
} from './EditorChrome';
import { isSaveKey } from '../../lib/editorKeys';
import type { EditorProps } from './TextEditors';

interface SheetState {
  name: string;
  base: Grid;
  grid: Grid;
  truncated: boolean;
}

const EXTRA_ROWS = 30;
const EXTRA_COLS = 4;
const MIN_ROWS = 60;
const MIN_COLS = 10;
const MAX_EDITS_PER_CALL = 200;

function stale(err: unknown): boolean {
  return (err as { response?: { status?: number } })?.response?.status === 412;
}

export default function SheetEditor({ doc, onDirtyChange }: EditorProps) {
  const qc = useQueryClient();
  const isCsv = doc.file_type === 'csv';
  const [sheets, setSheets] = useState<SheetState[]>([]);
  const [active, setActive] = useState(0);
  const [delimiter, setDelimiter] = useState<',' | '\t' | ';'>(',');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [nonce, setNonce] = useState(0);
  const etag = useRef<string | undefined>(undefined);

  // Keyed on the file by the workspace, so the first load needs no reset;
  // `reload` resets from its handler.
  useEffect(() => {
    let cancelled = false;
    const load = isCsv
      ? Promise.all([documentsService.get(doc.id), documentsService.download(doc.id).then((b) => b.text())]).then(
          ([d, text]) => {
            const table = parseCsv(text, Number.POSITIVE_INFINITY);
            const grid = table.headers.length ? [table.headers, ...table.rows] : [];
            setDelimiter(table.delimiter);
            etag.current = d.updated_at;
            return [{ name: 'Sheet1', base: grid, grid, truncated: false }];
          },
        )
      : documentsService.workbook(doc.id).then((wb) => {
          etag.current = wb.updated_at;
          return wb.sheets.map((s) => {
            const grid = s.rows.map((row) => row.map(toText));
            return { name: s.name, base: grid, grid, truncated: s.truncated };
          });
        });
    load
      .then((next) => {
        if (cancelled) return;
        setSheets(next);
        setActive(0);
      })
      .catch((err) => {
        if (!cancelled) setError(apiErrorMessage(err, 'Could not open this spreadsheet.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [doc.id, isCsv, nonce]);

  const changes = useMemo(
    () => sheets.map((s) => (isCsv ? (toCsv(s.base) === toCsv(s.grid) ? 0 : 1) : diffCells(s.base, s.grid).length)),
    [sheets, isCsv],
  );
  const dirty = changes.some((n) => n > 0);
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  const save = useCallback(
    async (guard = true) => {
      if (!dirty || saving) return;
      setSaving(true);
      try {
        if (isCsv) {
          const saved = await documentsService.updateContent(
            doc.id, toCsv(sheets[0].grid, delimiter), guard ? etag.current : undefined,
          );
          etag.current = saved.updated_at;
        } else {
          for (const s of sheets) {
            for (const part of chunk(diffCells(s.base, s.grid), MAX_EDITS_PER_CALL)) {
              const saved = await documentsService.editOffice(
                doc.id, { sheet: s.name, set_cells: part }, guard ? etag.current : undefined,
              );
              etag.current = saved.updated_at;
            }
          }
        }
        setSheets((prev) => prev.map((s) => ({ ...s, base: s.grid })));
        setIsStale(false);
        qc.invalidateQueries({ queryKey: ['documents'] });
        qc.invalidateQueries({ queryKey: ['app-files'] });
      } catch (err) {
        if (stale(err)) setIsStale(true);
        else toast.error('Could not save', apiErrorMessage(err, 'Please try again.'));
      } finally {
        setSaving(false);
      }
    },
    [dirty, saving, isCsv, doc.id, sheets, delimiter, qc],
  );

  const setGrid = useCallback(
    (update: (g: Grid) => Grid) =>
      setSheets((prev) => prev.map((s, i) => (i === active ? { ...s, grid: update(s.grid) } : s))),
    [active],
  );

  if (loading) return <EditorLoading />;
  if (error) return <EditorError message={error} />;
  const sheet = sheets[active];
  if (!sheet) return <EditorError message="This workbook has no sheets." />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {isStale && (
        <StaleBanner
          onReload={() => {
            setLoading(true);
            setIsStale(false);
            setNonce((n) => n + 1);
          }}
          onOverwrite={() => void save(false)}
        />
      )}
      <GridEditor
        key={`${doc.id}:${active}:${nonce}`}
        grid={sheet.grid}
        setGrid={setGrid}
        onSave={() => void save()}
        structural={isCsv}
      />
      {sheets.length > 1 && (
        <div className="flex shrink-0 gap-0.5 overflow-x-auto border-t border-border/60 bg-muted/30 px-2 pt-1" role="tablist">
          {sheets.map((s, i) => (
            <button
              key={s.name}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={cn(
                'shrink-0 rounded-t-md px-3 py-1.5 text-[12px]',
                i === active ? 'bg-card font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s.name}
              {changes[i] > 0 && ' •'}
            </button>
          ))}
        </div>
      )}
      <SaveStatus
        dirty={dirty}
        saving={saving}
        onSave={() => void save()}
        extra={
          <>
            {sheet.truncated && <span className="text-warning">Showing the first 500 rows × 40 columns</span>}
            {!isCsv && <span className="hidden md:inline">Formulas show as written</span>}
            <span>{isCsv ? 'CSV' : 'Excel workbook'}</span>
          </>
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// The grid
// ---------------------------------------------------------------------------

type Pos = { r: number; c: number };

function GridEditor({
  grid,
  setGrid,
  onSave,
  structural,
}: {
  grid: Grid;
  setGrid: (update: (g: Grid) => Grid) => void;
  onSave: () => void;
  structural: boolean;
}) {
  const [sel, setSel] = useState<Pos>({ r: 0, c: 0 });
  const [editing, setEditing] = useState<string | null>(null);
  // Where the edit is happening: in the cell, or in the formula bar. Only the
  // cell's own input takes focus, or typing in the bar would lose it each key.
  const [inCell, setInCell] = useState(true);
  const editCell = (v: string) => {
    setInCell(true);
    setEditing(v);
  };
  const container = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const dataRows = grid.length;
  const dataCols = grid.reduce((m, row) => Math.max(m, row.length), 0);
  const rows = Math.max(MIN_ROWS, dataRows + EXTRA_ROWS, sel.r + 10);
  const cols = Math.max(MIN_COLS, dataCols + EXTRA_COLS, sel.c + 3);

  const valueAt = (p: Pos) => grid[p.r]?.[p.c] ?? '';

  const write = (p: Pos, value: string) =>
    setGrid((g) => {
      if ((g[p.r]?.[p.c] ?? '') === value) return g;
      const next = sizeGrid(g, Math.max(g.length, p.r + 1), Math.max(g.reduce((m, r) => Math.max(m, r.length), 0), p.c + 1));
      next[p.r][p.c] = value;
      return next;
    });

  const move = (dr: number, dc: number) => {
    setSel((p) => ({ r: Math.max(0, p.r + dr), c: Math.max(0, p.c + dc) }));
  };

  // Keep the selected cell in view.
  useEffect(() => {
    const el = container.current?.querySelector<HTMLElement>(`[data-cell="${sel.r}:${sel.c}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [sel]);

  const editingCell = editing !== null && inCell;
  useEffect(() => {
    if (editingCell) input.current?.focus();
  }, [editingCell]);

  const commit = (after?: Pos) => {
    if (editing !== null) write(sel, editing);
    setEditing(null);
    if (after) setSel(after);
    requestAnimationFrame(() => container.current?.focus());
  };

  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (editing !== null) return;
    if (isSaveKey(e)) {
      e.preventDefault();
      onSave();
      return;
    }
    const k = e.key;
    if (k === 'ArrowUp') { e.preventDefault(); move(-1, 0); }
    else if (k === 'ArrowDown') { e.preventDefault(); move(1, 0); }
    else if (k === 'ArrowLeft') { e.preventDefault(); move(0, -1); }
    else if (k === 'ArrowRight') { e.preventDefault(); move(0, 1); }
    else if (k === 'Tab') { e.preventDefault(); move(0, e.shiftKey ? -1 : 1); }
    else if (k === 'Enter' || k === 'F2') { e.preventDefault(); editCell(valueAt(sel)); }
    else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); write(sel, ''); }
    else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'c') {
      void navigator.clipboard?.writeText(valueAt(sel)).catch(() => undefined);
    } else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      editCell(k);
    }
  };

  // Paste a block from Excel / Sheets: tab-separated columns, newline rows.
  const onPaste = (e: React.ClipboardEvent) => {
    if (editing !== null) return;
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    const block = text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n').map((l) => l.split('\t'));
    setGrid((g) => {
      const width = Math.max(g.reduce((m, r) => Math.max(m, r.length), 0), sel.c + Math.max(...block.map((b) => b.length)));
      const next = sizeGrid(g, Math.max(g.length, sel.r + block.length), width);
      block.forEach((row, i) => row.forEach((v, j) => { next[sel.r + i][sel.c + j] = v; }));
      return next;
    });
  };

  const insertRow = () =>
    setGrid((g) => {
      const width = Math.max(1, g.reduce((m, r) => Math.max(m, r.length), 0));
      const next = sizeGrid(g, Math.max(g.length, sel.r + 1), width);
      next.splice(sel.r + 1, 0, Array(width).fill(''));
      return next;
    });
  const deleteRow = () => setGrid((g) => g.filter((_, i) => i !== sel.r));
  const insertCol = () => setGrid((g) => g.map((row) => {
    const r = [...row];
    while (r.length <= sel.c) r.push('');
    r.splice(sel.c + 1, 0, '');
    return r;
  }));
  const deleteCol = () => setGrid((g) => g.map((row) => row.filter((_, i) => i !== sel.c)));

  const current = editing ?? valueAt(sel);
  const numeric = (v: string) => /^-?\d+(\.\d+)?$/.test(v.trim());

  return (
    <>
      <Toolbar>
        <ToolButton onClick={insertRow} disabled={!structural} title={structural ? 'Insert row below' : 'Rows can only be added at the end of a workbook'}>
          <ArrowDownToLine className="h-4 w-4" /> <span className="hidden sm:inline">Row</span>
        </ToolButton>
        <ToolButton onClick={insertCol} disabled={!structural} title={structural ? 'Insert column to the right' : 'Columns can only be added at the edge of a workbook'}>
          <ArrowRightToLine className="h-4 w-4" /> <span className="hidden sm:inline">Column</span>
        </ToolButton>
        <ToolButton onClick={deleteRow} disabled={!structural} title="Delete row">
          <Rows3 className="h-4 w-4" /><Trash2 className="h-3 w-3" />
        </ToolButton>
        <ToolButton onClick={deleteCol} disabled={!structural} title="Delete column">
          <Columns3 className="h-4 w-4" /><Trash2 className="h-3 w-3" />
        </ToolButton>
        <Divider />
        <span className="w-14 shrink-0 rounded border border-border/60 bg-background px-2 py-1 text-center font-mono text-[12px]">
          {cellRef(sel.r, sel.c)}
        </span>
        <input
          value={current}
          onChange={(e) => setEditing(e.target.value)}
          onFocus={() => {
            setInCell(false);
            setEditing((v) => v ?? valueAt(sel));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit({ r: sel.r + 1, c: sel.c }); }
            else if (e.key === 'Escape') { setEditing(null); container.current?.focus(); }
          }}
          onBlur={() => editing !== null && commit()}
          aria-label="Cell contents"
          placeholder="Type a value or =formula"
          className="min-w-0 flex-1 rounded border border-border/60 bg-background px-2 py-1 font-mono text-[12.5px] outline-none focus:border-primary"
        />
      </Toolbar>
      <div
        ref={container}
        tabIndex={0}
        onKeyDown={onGridKey}
        onPaste={onPaste}
        className="min-h-0 flex-1 overflow-auto bg-background outline-none"
        aria-label="Spreadsheet"
        role="grid"
      >
        <table className="border-separate border-spacing-0 text-[12.5px]">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 h-6 w-10 border-b border-r border-border/60 bg-muted" />
              {Array.from({ length: cols }, (_, c) => (
                <th
                  key={c}
                  className={cn(
                    'sticky top-0 z-10 h-6 min-w-[96px] border-b border-r border-border/60 bg-muted px-2 font-medium text-muted-foreground',
                    c === sel.c && 'bg-primary/15 text-foreground',
                  )}
                >
                  {columnName(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                <th
                  className={cn(
                    'sticky left-0 z-10 w-10 border-b border-r border-border/60 bg-muted px-1 text-right font-medium text-muted-foreground',
                    r === sel.r && 'bg-primary/15 text-foreground',
                  )}
                >
                  {r + 1}
                </th>
                {Array.from({ length: cols }, (_, c) => {
                  const selected = sel.r === r && sel.c === c;
                  const v = grid[r]?.[c] ?? '';
                  return (
                    <td
                      key={c}
                      data-cell={`${r}:${c}`}
                      onMouseDown={() => {
                        if (editing !== null) commit();
                        setSel({ r, c });
                      }}
                      onDoubleClick={() => editCell(v)}
                      className={cn(
                        'relative h-6 max-w-[260px] cursor-cell truncate border-b border-r border-border/40 px-2',
                        r === 0 && structural && 'font-semibold',
                        numeric(v) && 'text-right tabular-nums',
                        v.startsWith('=') && 'text-primary',
                        selected && 'outline outline-2 -outline-offset-2 outline-primary',
                      )}
                    >
                      {selected && editingCell ? (
                        <input
                          ref={input}
                          value={editing}
                          onChange={(e) => setEditing(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); commit({ r: r + 1, c }); }
                            else if (e.key === 'Tab') { e.preventDefault(); commit({ r, c: c + (e.shiftKey ? -1 : 1) }); }
                            else if (e.key === 'Escape') { setEditing(null); container.current?.focus(); }
                          }}
                          onBlur={() => commit()}
                          className="absolute inset-0 z-10 w-full min-w-[160px] bg-card px-2 font-mono text-[12.5px] shadow-md outline outline-2 outline-primary"
                          aria-label={`Edit ${cellRef(r, c)}`}
                        />
                      ) : (
                        v
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
