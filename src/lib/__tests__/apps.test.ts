import { describe, expect, it } from 'vitest';

import { APPS, searchApps } from '../apps';

describe('apps registry', () => {
  it('every app opens a real route, not a desktop window', () => {
    for (const app of APPS) {
      expect(app.path.startsWith('/')).toBe(true);
    }
  });

  it('only ships server-backed destinations', () => {
    const ids = APPS.map((a) => a.id);
    expect(ids).toEqual(['files', 'docs', 'sheets', 'slides', 'dashboards', 'pages', 'media']);
  });

  it('search finds sheets by keyword', () => {
    expect(searchApps('excel')[0]?.id).toBe('sheets');
    expect(searchApps('deck')[0]?.id).toBe('slides');
    expect(searchApps('zzz-no-match')).toEqual([]);
  });
});
