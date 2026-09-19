/**
 * What a file preview does with a document, decided without rendering it.
 *
 * Kept out of `components/files/FilePreview.tsx` so the decisions — which kind
 * a file is, how JSON is formatted, what a notebook contains — are testable
 * without a DOM and shared by every surface that previews a file.
 */

import { documentsService, type Document } from '../api/documents';
import { languageForFile } from './codeLanguage';

export type PreviewKind =
  | 'markdown' | 'csv' | 'json' | 'html' | 'notebook' | 'code' | 'text' | 'media' | 'office';

/** Types whose bytes are a zip of XML: previewed from their stored spec or extract, never read as text. */
const OFFICE_TYPES = new Set(['pptx', 'xlsx', 'docx']);

type Previewable = Pick<Document, 'filename' | 'file_type'>;

/** How to show a document, from its extension first and then its type. */
export function kindOf(doc: Previewable): PreviewKind {
  const type = (doc.file_type || '').toLowerCase();
  if (type === 'image' || type === 'video' || type === 'pdf') return 'media';
  // Before the extension checks below, because a .docx read as text is zip noise.
  if (OFFICE_TYPES.has(type) || OFFICE_TYPES.has((doc.filename.split('.').pop() ?? '').toLowerCase())) return 'office';

  // `file_type` is a small closed vocabulary, so anything the user named
  // `.py` or `.ipynb` arrives as 'txt' or 'json'. The extension is the finer
  // signal, which is why it is read first.
  const ext = (doc.filename.split('.').pop() ?? '').toLowerCase();
  if (ext === 'ipynb') return 'notebook';
  if (ext === 'md' || ext === 'markdown' || type === 'md') return 'markdown';
  if (ext === 'csv' || ext === 'tsv' || type === 'csv') return 'csv';
  if (ext === 'json' || type === 'json') return 'json';
  if (ext === 'html' || ext === 'htm' || type === 'html') return 'html';
  if (languageForFile(doc.filename)) return 'code';
  return 'text';
}

/** `text` re-indented when it parses as JSON; null when it does not. */
export function formatJson(text: string): string | null {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Notebooks
// ---------------------------------------------------------------------------

export type NotebookOutput =
  | { kind: 'text'; text: string; error?: boolean }
  | { kind: 'image'; src: string };

export interface NotebookCell {
  type: 'code' | 'markdown' | 'raw';
  source: string;
  executionCount: number | null;
  outputs: NotebookOutput[];
}

export interface Notebook {
  language: string | null;
  cells: NotebookCell[];
}

const joinSource = (s: unknown): string =>
  Array.isArray(s) ? s.map(String).join('') : typeof s === 'string' ? s : '';

/** Terminal colour codes, which Jupyter tracebacks are full of. */
// eslint-disable-next-line no-control-regex
const ANSI = /\[[0-9;]*[A-Za-z]/g;

/** Image types a notebook may embed and an `<img>` may safely show. */
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif'] as const;

function readOutput(raw: Record<string, unknown>): NotebookOutput | null {
  const type = raw.output_type;
  if (type === 'stream') {
    return { kind: 'text', text: joinSource(raw.text), error: raw.name === 'stderr' };
  }
  if (type === 'error') {
    const tb = Array.isArray(raw.traceback) ? raw.traceback.map(String).join('\n') : '';
    return { kind: 'text', text: (tb || `${raw.ename}: ${raw.evalue}`).replace(ANSI, ''), error: true };
  }
  if (type === 'execute_result' || type === 'display_data') {
    const data = (raw.data ?? {}) as Record<string, unknown>;
    for (const mime of IMAGE_TYPES) {
      const b64 = joinSource(data[mime]).replace(/\s/g, '');
      // Base64 alphabet only, so the value cannot close the attribute or
      // smuggle a different scheme into the data URL.
      if (b64 && /^[A-Za-z0-9+/=]+$/.test(b64)) return { kind: 'image', src: `data:${mime};base64,${b64}` };
    }
    // `text/html` outputs are deliberately not rendered: they would need the
    // same sandboxed frame an HTML file gets, per output. Their plain-text
    // twin is always present and says what the value was.
    const plain = joinSource(data['text/plain']);
    return plain ? { kind: 'text', text: plain } : null;
  }
  return null;
}

/** A parsed `.ipynb`, or null when the text is not one. */
export function parseNotebook(text: string): Notebook | null {
  let nb: unknown;
  try {
    nb = JSON.parse(text);
  } catch {
    return null;
  }
  if (!nb || typeof nb !== 'object' || !Array.isArray((nb as { cells?: unknown }).cells)) return null;

  const { cells, metadata } = nb as { cells: Record<string, unknown>[]; metadata?: Record<string, unknown> };
  const info = (metadata?.language_info ?? metadata?.kernelspec ?? {}) as { name?: string; language?: string };

  return {
    language: info.language ?? info.name ?? null,
    cells: cells.map((c) => ({
      type: c.cell_type === 'markdown' ? 'markdown' : c.cell_type === 'raw' ? 'raw' : 'code',
      source: joinSource(c.source),
      executionCount: typeof c.execution_count === 'number' ? c.execution_count : null,
      outputs: Array.isArray(c.outputs)
        ? c.outputs.map((o) => readOutput(o as Record<string, unknown>)).filter((o): o is NotebookOutput => o !== null)
        : [],
    })),
  };
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

/** Save one document through the authenticated download route. */
export async function downloadDocument(doc: Pick<Document, 'id' | 'filename' | 'title'>): Promise<void> {
  const blob = await documentsService.download(doc.id);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', doc.filename || doc.title);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
