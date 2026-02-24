import { useEffect, useCallback } from 'react';

/**
 * Keyboard shortcut definition
 */
export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
}

/**
 * Default keyboard shortcuts for the workflow editor
 */
export function getDefaultShortcuts(handlers: {
  onSave?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onSelectAll?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onExecute?: () => void;
  onEscape?: () => void;
}): KeyboardShortcut[] {
  const shortcuts: KeyboardShortcut[] = [];

  if (handlers.onSave) {
    shortcuts.push({
      key: 's',
      ctrl: true,
      action: handlers.onSave,
      description: 'Save workflow',
    });
  }

  if (handlers.onUndo) {
    shortcuts.push({
      key: 'z',
      ctrl: true,
      action: handlers.onUndo,
      description: 'Undo',
    });
  }

  if (handlers.onRedo) {
    shortcuts.push({
      key: 'y',
      ctrl: true,
      action: handlers.onRedo,
      description: 'Redo',
    });
    // Also support Ctrl+Shift+Z
    shortcuts.push({
      key: 'z',
      ctrl: true,
      shift: true,
      action: handlers.onRedo,
      description: 'Redo (alternative)',
    });
  }

  if (handlers.onDelete) {
    shortcuts.push({
      key: 'Delete',
      action: handlers.onDelete,
      description: 'Delete selected node',
    });

  }

  if (handlers.onDuplicate) {
    shortcuts.push({
      key: 'd',
      ctrl: true,
      action: handlers.onDuplicate,
      description: 'Duplicate selected node',
    });
  }

  if (handlers.onCopy) {
    shortcuts.push({
      key: 'c',
      ctrl: true,
      action: handlers.onCopy,
      description: 'Copy selected node',
    });
  }

  if (handlers.onPaste) {
    shortcuts.push({
      key: 'v',
      ctrl: true,
      action: handlers.onPaste,
      description: 'Paste node',
    });
  }

  if (handlers.onSelectAll) {
    shortcuts.push({
      key: 'a',
      ctrl: true,
      action: handlers.onSelectAll,
      description: 'Select all nodes',
    });
  }

  if (handlers.onZoomIn) {
    shortcuts.push({
      key: '=',
      ctrl: true,
      action: handlers.onZoomIn,
      description: 'Zoom in',
    });
    shortcuts.push({
      key: '+',
      ctrl: true,
      action: handlers.onZoomIn,
      description: 'Zoom in (alternative)',
    });
  }

  if (handlers.onZoomOut) {
    shortcuts.push({
      key: '-',
      ctrl: true,
      action: handlers.onZoomOut,
      description: 'Zoom out',
    });
  }

  if (handlers.onZoomReset) {
    shortcuts.push({
      key: '0',
      ctrl: true,
      action: handlers.onZoomReset,
      description: 'Reset zoom',
    });
  }

  if (handlers.onExecute) {
    shortcuts.push({
      key: 'Enter',
      ctrl: true,
      action: handlers.onExecute,
      description: 'Execute workflow',
    });
  }

  if (handlers.onEscape) {
    shortcuts.push({
      key: 'Escape',
      action: handlers.onEscape,
      description: 'Deselect / Close panel',
    });
  }

  return shortcuts;
}

/**
 * Check if user is currently typing in an input field
 */
function isTypingInInput(target: HTMLElement): boolean {
  // Check if target is an input or textarea
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    return true;
  }

  // Check if target is contentEditable
  if (target.isContentEditable) {
    return true;
  }

  // Check if target is inside a contentEditable element
  if (target.closest('[contenteditable="true"]')) {
    return true;
  }

  // Check for common code editor classes
  if (
    target.closest('.monaco-editor') ||
    target.closest('.CodeMirror') ||
    target.closest('.ace_editor') ||
    target.closest('.cm-editor')
  ) {
    return true;
  }

  // Check for select elements
  if (target.tagName === 'SELECT') {
    return true;
  }

  // Check for any element with role="textbox"
  if (target.getAttribute('role') === 'textbox') {
    return true;
  }

  return false;
}

/**
 * Hook to register keyboard shortcuts
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  enabled: boolean = true
) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const target = event.target as HTMLElement;
      const isTyping = isTypingInInput(target);

      // ✅ FIX: Allow Escape and some Ctrl shortcuts even when typing
      const allowedWhenTyping = [
        'Escape',
        // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X in inputs (native browser behavior)
      ];

      // If typing and not an allowed key, skip
      if (isTyping && !allowedWhenTyping.includes(event.key)) {
        // However, still allow Ctrl+S (Save) even when typing
        const isCtrlS = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's';
        if (!isCtrlS) {
          return;
        }
      }

      for (const shortcut of shortcuts) {
        // Check if the key matches (case-insensitive for letters)
        const keyMatches =
          event.key.toLowerCase() === shortcut.key.toLowerCase() ||
          event.key === shortcut.key;

        if (!keyMatches) continue;

        // Check modifiers
        const hasCtrl = event.ctrlKey || event.metaKey;
        const hasShift = event.shiftKey;
        const hasAlt = event.altKey;

        // ✅ FIX: Improved modifier matching logic
        // If shortcut requires a modifier, it must be pressed
        // If shortcut doesn't require a modifier, it must NOT be pressed
        const ctrlMatches = shortcut.ctrl ? hasCtrl : true;
        const shiftMatches = shortcut.shift ? hasShift : true;
        const altMatches = shortcut.alt ? hasAlt : true;

        // For shortcuts without modifiers, ensure no modifiers are pressed
        // (except Escape which should work regardless)
        if (!shortcut.ctrl && !shortcut.shift && !shortcut.alt && event.key !== 'Escape') {
          if (hasCtrl || hasAlt) {
            continue; // Skip if unwanted modifiers are pressed
          }
        }

        if (ctrlMatches && shiftMatches && altMatches) {
          event.preventDefault();
          event.stopPropagation();
          shortcut.action();
          return;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (enabled) {
      document.addEventListener('keydown', handleKeyDown, { capture: true });
      return () =>
        document.removeEventListener('keydown', handleKeyDown, { capture: true });
    }
  }, [handleKeyDown, enabled]);
}

/**
 * Hook to get keyboard shortcut labels for display
 */
export function useShortcutLabel(shortcut: KeyboardShortcut): string {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');
  const parts: string[] = [];

  if (shortcut.ctrl) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (shortcut.shift) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  if (shortcut.alt) {
    parts.push(isMac ? '⌥' : 'Alt');
  }

  // Format key name
  let keyName = shortcut.key;
  if (keyName === ' ') keyName = 'Space';
  else if (keyName === 'Escape') keyName = 'Esc';
  else if (keyName === 'Delete') keyName = 'Del';
  else if (keyName === 'Backspace') keyName = '⌫';
  else if (keyName === 'Enter') keyName = '↵';
  else if (keyName.length === 1) keyName = keyName.toUpperCase();

  parts.push(keyName);

  return parts.join(isMac ? '' : '+');
}

export default useKeyboardShortcuts;
