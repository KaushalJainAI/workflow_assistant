/**
 * Open files as tabs, one list per app, kept in `sessionStorage`.
 *
 * `?file=<id>` is the active tab — a link from Files or a chat card lands on
 * the right tab, and Back works. Opening a file adds it to the list;
 * closing removes it. The list is capped (20) so a long session cannot grow
 * it without bound. Names ride beside the ids so a tab labels itself without
 * a fetch for files past the first page.
 *
 * Unsaved work never sits on a background tab: switching away from a dirty
 * file goes through the unsaved-changes dialog first (Save / Don't save /
 * Cancel), so a tab left behind is always saved or deliberately discarded.
 * The dot therefore marks the active tab while it is dirty.
 */
import { useCallback, useEffect, useState } from 'react';

export interface AppTab {
  id: number;
  name: string;
}

const MAX_TABS = 20;

function keyFor(appId: string) {
  return `app-tabs:${appId}`;
}

function read(appId: string): AppTab[] {
  try {
    const raw = sessionStorage.getItem(keyFor(appId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is AppTab =>
        !!t && Number.isInteger(t.id) && typeof t.name === 'string',
    );
  } catch {
    return [];
  }
}

function store(appId: string, tabs: AppTab[]) {
  try {
    sessionStorage.setItem(keyFor(appId), JSON.stringify(tabs));
  } catch {
    // A full or blocked storage costs the tab list, never the file.
  }
}

export function useAppTabs(appId: string, active: AppTab | null) {
  // The workspace is keyed by app, so one initializer per app is enough —
  // no effect is needed to pick the list back up.
  const [tabs, setTabs] = useState<AppTab[]>(() => read(appId));

  // The active file is always a tab, and its name follows renames.
  // Returning `prev` when nothing changed keeps this loop-free even when the
  // caller builds a fresh `active` object every render; `sessionStorage` is
  // the external system this synchronises with.
  useEffect(() => {
    if (active === null) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTabs((prev) => {
      const i = prev.findIndex((t) => t.id === active.id);
      if (i === 0 && prev[0].name === active.name) return prev;
      const next = [
        { id: active.id, name: active.name },
        ...prev.filter((t) => t.id !== active.id),
      ].slice(0, MAX_TABS);
      store(appId, next);
      return next;
    });
  }, [appId, active]);

  const close = useCallback(
    (id: number) => {
      setTabs((prev) => {
        const next = prev.filter((t) => t !== undefined && t.id !== id);
        if (next.length === prev.length) return prev;
        store(appId, next);
        return next;
      });
    },
    [appId],
  );

  return { tabs, close };
}
