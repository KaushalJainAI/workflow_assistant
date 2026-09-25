import { describe as group, expect, it } from 'vitest';
import { pruneBlocks, specToTipTap, tipTapToBlocks } from '../docSpec';
import type { Block } from '../officeSpec';

/**
 * Spec ⇄ TipTap JSON: marks become runs, alignment rides along, lists
 * flatten one level, tables take their first row as the header, images keep
 * their source through caller maps, and unknown nodes keep their words.
 */
group('tipTapToBlocks', () => {
  it('turns marks into runs', () => {
    const blocks = tipTapToBlocks({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Hi ' },
          { type: 'text', text: 'there', marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://example.com' } }] },
        ],
      }],
    });
    expect(blocks).toEqual([{
      type: 'paragraph',
      runs: [{ text: 'Hi ' }, { text: 'there', bold: true, link: 'https://example.com' }],
    }]);
  });

  it('reads alignment, lists, quotes and tables', () => {
    const blocks = tipTapToBlocks({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2, textAlign: 'center' }, content: [{ type: 'text', text: 'Part' }] },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }] },
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'two' }] },
                {
                  type: 'bulletList',
                  content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'sub' }] }] }],
                },
              ],
            },
          ],
        },
        { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'quoted' }] }] },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'h' }] }] },
              ],
            },
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'v' }] }] },
              ],
            },
          ],
        },
      ],
    });
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 2, align: 'center' });
    expect(blocks[1]).toEqual({
      type: 'bullets',
      items: ['one', 'two', { text: 'sub', level: 1 }],
    });
    expect(blocks[2]).toEqual({ type: 'quote', runs: [{ text: 'quoted' }] });
    expect(blocks[3]).toEqual({ type: 'table', columns: ['h'], rows: [['v']], caption: '' });
  });

  it('maps image sources through the caller and drops empty paragraphs', () => {
    const blocks = tipTapToBlocks(
      {
        type: 'doc',
        content: [
          { type: 'image', attrs: { src: 'blob:1', alt: 'fig' } },
          { type: 'paragraph' },
        ],
      },
      { storePath: (src) => (src === 'blob:1' ? '/Reports/fig.png' : src) },
    );
    expect(blocks).toEqual([{ type: 'image', path: '/Reports/fig.png', caption: 'fig' }]);
  });

  it('keeps the words of unknown nodes', () => {
    const blocks = tipTapToBlocks({
      type: 'doc',
      content: [{ type: 'fancyBox', content: [{ type: 'text', text: 'survives' }] }],
    });
    expect(blocks).toEqual([{ type: 'paragraph', text: 'survives' }]);
  });
});

group('specToTipTap', () => {
  it('round-trips blocks, marks, alignment and nesting', () => {
    const blocks: Block[] = [
      { type: 'heading', level: 2, align: 'center', runs: [{ text: 'Hi', bold: true }] },
      { type: 'paragraph', runs: [{ text: 'a' }, { text: 'b', italic: true, link: 'https://x.example' }] },
      { type: 'bullets', items: ['one', { text: 'sub', level: 1 }] },
      { type: 'image', path: '/r.png', caption: 'fig' },
      { type: 'page_break' },
    ];
    const doc = specToTipTap(blocks, { displaySrc: (p) => `blob:${p}` });
    expect(doc.type).toBe('doc');
    const back = tipTapToBlocks(doc, { storePath: (s) => s.replace(/^blob:/, '') });
    expect(back[0]).toMatchObject({ type: 'heading', level: 2, align: 'center' });
    expect(back[1]).toEqual({
      type: 'paragraph',
      runs: [{ text: 'a' }, { text: 'b', italic: true, link: 'https://x.example' }],
    });
    expect(back[2]).toEqual({ type: 'bullets', items: ['one', { text: 'sub', level: 1 }] });
    expect(back[3]).toEqual([{ type: 'image', path: '/r.png', caption: 'fig' }][0]);
    expect(back[4]).toEqual({ type: 'page_break' });
  });

  it('never returns an empty document', () => {
    expect(specToTipTap([])).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
  });
});

group('pruneBlocks', () => {
  it('drops empties but keeps structure', () => {
    expect(pruneBlocks([
      { type: 'paragraph', text: '  ' },
      { type: 'paragraph', runs: [{ text: 'kept' }] },
      { type: 'bullets', items: [' ', { text: 'x' }] },
      { type: 'table', columns: ['h'], rows: [], caption: '' },
    ])).toEqual([
      { type: 'paragraph', runs: [{ text: 'kept' }] },
      { type: 'bullets', items: [{ text: 'x' }] },
      { type: 'table', columns: ['h'], rows: [], caption: '' },
    ]);
  });
});
