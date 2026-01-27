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
    shortcuts.push({
      key: 'Backspace',
      action: handlers.onDelete,
      description: 'Delete selected node (alternative)',
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
 * Hook to register keyboard shortcuts
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  enabled: boolean = true
) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;


      // Skip if user is typing in an input/textarea
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Escape in inputs
        if (event.key !== 'Escape') {
          return;
        }
      }


      for (const shortcut of shortcuts) {
        // Check if the key matches (case-insensitive for letters)
        const keyMatches = 
          event.key.toLowerCase() === shortcut.key.toLowerCase() ||
          event.key === shortcut.key;
        
        if (!keyMatches) continue;
        
        // Check modifiers - must match exactly
        // If shortcut doesn't specify a modifier, that modifier must NOT be pressed
        const hasCtrl = event.ctrlKey || event.metaKey;
        const hasShift = event.shiftKey;
        const hasAlt = event.altKey;
        
        const ctrlMatches = shortcut.ctrl ? hasCtrl : !hasCtrl;
        const shiftMatches = shortcut.shift ? hasShift : !hasShift;
        const altMatches = shortcut.alt ? hasAlt : !hasAlt;

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
      return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
    }
  }, [handleKeyDown, enabled]);
}


/**
 * Hook to get keyboard shortcut labels for display
 */
export function useShortcutLabel(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];
  
  if (shortcut.ctrl) {
    parts.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl');
  }
  if (shortcut.shift) {
    parts.push(navigator.platform.includes('Mac') ? '⇧' : 'Shift');
  }
  if (shortcut.alt) {
    parts.push(navigator.platform.includes('Mac') ? '⌥' : 'Alt');
  }
  
  // Format key name
  let keyName = shortcut.key;
  if (keyName === ' ') keyName = 'Space';
  if (keyName.length === 1) keyName = keyName.toUpperCase();
  
  parts.push(keyName);
  
  return parts.join('+');
}


export default useKeyboardShortcuts;
