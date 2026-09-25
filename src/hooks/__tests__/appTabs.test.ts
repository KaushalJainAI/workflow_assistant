// @vitest-environment jsdom
import { describe as group, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAppTabs } from '../useAppTabs';

/**
 * Open files as tabs: the active `?file=` is always listed, renames follow,
 * closing drops the tab, and a second app keeps its own list.
 */
group('useAppTabs', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('starts empty and lists the active file', () => {
    const { result } = renderHook(() => useAppTabs('docs', { id: 7, name: 'a.md' }));
    expect(result.current.tabs).toEqual([{ id: 7, name: 'a.md' }]);
  });

  it('adds newly opened files to the front without duplicates', () => {
    const { result, rerender } = renderHook(
      ({ active }) => useAppTabs('docs', active),
      { initialProps: { active: { id: 7, name: 'a.md' } } },
    );
    rerender({ active: { id: 9, name: 'b.md' } });
    rerender({ active: { id: 7, name: 'a.md' } });
    expect(result.current.tabs.map((t) => t.id)).toEqual([7, 9]);
  });

  it('follows renames without duplicating the tab', () => {
    const { result, rerender } = renderHook(
      ({ active }) => useAppTabs('docs', active),
      { initialProps: { active: { id: 7, name: 'a.md' } } },
    );
    rerender({ active: { id: 7, name: 'renamed.md' } });
    expect(result.current.tabs).toEqual([{ id: 7, name: 'renamed.md' }]);
  });

  it('closes a tab and survives a remount from storage', () => {
    const { result, rerender } = renderHook(
      ({ active }) => useAppTabs('docs', active),
      { initialProps: { active: { id: 7, name: 'a.md' } } },
    );
    rerender({ active: { id: 9, name: 'b.md' } });
    act(() => {
      result.current.close(9);
    });
    expect(result.current.tabs.map((t) => t.id)).toEqual([7]);
    const second = renderHook(() => useAppTabs('docs', null));
    expect(second.result.current.tabs.map((t) => t.id)).toEqual([7]);
  });

  it('keeps one list per app', () => {
    renderHook(() => useAppTabs('docs', { id: 7, name: 'a.md' }));
    const sheets = renderHook(() => useAppTabs('sheets', { id: 3, name: 'b.xlsx' }));
    expect(sheets.result.current.tabs).toEqual([{ id: 3, name: 'b.xlsx' }]);
    expect(JSON.parse(sessionStorage.getItem('app-tabs:docs')!)).toEqual([
      { id: 7, name: 'a.md' },
    ]);
  });
});
