import { describe, expect, it, vi } from 'vitest';

vi.mock('../../api/documents', () => ({ documentsService: { download: vi.fn() } }));

import { languageFor, languageForFile } from '../codeLanguage';
import { formatJson, kindOf, parseNotebook } from '../filePreview';

const doc = (filename: string, file_type = 'txt') => ({ filename, file_type });

describe('languageFor', () => {
  it('maps the fence tags models actually write', () => {
    expect(languageFor('py')).toBe('python');
    expect(languageFor('TSX')).toBe('typescript');
    expect(languageFor('shell')).toBe('bash');
    expect(languageFor('html')).toBe('xml');
  });

  it('answers null rather than guessing', () => {
    expect(languageFor('text')).toBeNull();
    expect(languageFor('')).toBeNull();
    expect(languageFor(undefined)).toBeNull();
  });

  it('reads a filename by extension, and Dockerfile by name', () => {
    expect(languageForFile('agent_eval_harness.py')).toBe('python');
    expect(languageForFile('Dockerfile')).toBe('dockerfile');
    expect(languageForFile('notes')).toBeNull();
  });
});

describe('kindOf', () => {
  it('trusts the extension over the coarse file_type', () => {
    expect(kindOf(doc('harness.py'))).toBe('code');
    expect(kindOf(doc('run.ipynb', 'json'))).toBe('notebook');
    expect(kindOf(doc('report.md'))).toBe('markdown');
    expect(kindOf(doc('data.tsv'))).toBe('csv');
    expect(kindOf(doc('page.html'))).toBe('html');
    expect(kindOf(doc('cfg.json'))).toBe('json');
  });

  it('keeps media and plain text apart', () => {
    expect(kindOf(doc('scan.pdf', 'pdf'))).toBe('media');
    expect(kindOf(doc('log.txt'))).toBe('text');
  });
});

describe('formatJson', () => {
  it('re-indents valid JSON and refuses invalid', () => {
    expect(formatJson('{"a":[1,2]}')).toBe('{\n  "a": [\n    1,\n    2\n  ]\n}');
    expect(formatJson('{"a":')).toBeNull();
  });
});

describe('parseNotebook', () => {
  const nb = {
    metadata: { language_info: { name: 'python' } },
    cells: [
      { cell_type: 'markdown', source: ['# Title\n', 'text'] },
      {
        cell_type: 'code', execution_count: 3, source: 'print(1)',
        outputs: [
          { output_type: 'stream', name: 'stdout', text: ['1\n'] },
          { output_type: 'display_data', data: { 'image/png': 'iVBORw0K\n', 'text/plain': ['<Figure>'] } },
          { output_type: 'execute_result', data: { 'text/html': '<b>x</b>', 'text/plain': '42' } },
          { output_type: 'error', ename: 'E', evalue: 'v', traceback: ['[31mBoom[0m'] },
        ],
      },
    ],
  };

  it('reads cells, sources and outputs', () => {
    const parsed = parseNotebook(JSON.stringify(nb));
    expect(parsed?.language).toBe('python');
    expect(parsed?.cells[0]).toMatchObject({ type: 'markdown', source: '# Title\ntext' });
    expect(parsed?.cells[1].executionCount).toBe(3);
    expect(parsed?.cells[1].outputs).toEqual([
      { kind: 'text', text: '1\n', error: false },
      { kind: 'image', src: 'data:image/png;base64,iVBORw0K' },
      { kind: 'text', text: '42' },
      { kind: 'text', text: 'Boom', error: true },
    ]);
  });

  it('never builds an image URL from anything but base64', () => {
    const bad = { cells: [{ cell_type: 'code', source: '', outputs: [
      { output_type: 'display_data', data: { 'image/png': '"><script>', 'text/plain': 'fig' } },
    ] }] };
    expect(parseNotebook(JSON.stringify(bad))?.cells[0].outputs).toEqual([{ kind: 'text', text: 'fig' }]);
  });

  it('answers null for text that is not a notebook', () => {
    expect(parseNotebook('{"a":1}')).toBeNull();
    expect(parseNotebook('not json')).toBeNull();
  });
});
