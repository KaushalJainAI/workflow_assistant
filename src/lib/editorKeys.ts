/** Ctrl/Cmd+S → save, without the browser's "Save page as". */
export function isSaveKey(e: { ctrlKey: boolean; metaKey: boolean; key: string }): boolean {
  return (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's';
}
