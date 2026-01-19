import { useState, useCallback, useRef } from 'react';
import { type Node, type Edge } from 'reactflow';

/**
 * State snapshot for undo/redo
 */
interface WorkflowState {
  nodes: Node[];
  edges: Edge[];
  timestamp: number;
}

/**
 * Undo/Redo hook configuration
 */
interface UseUndoRedoConfig {
  maxHistory?: number;
}

/**
 * Undo/Redo hook return type
 */
interface UseUndoRedoReturn {
  // State
  canUndo: boolean;
  canRedo: boolean;
  historySize: number;
  currentIndex: number;
  
  // Actions
  undo: () => WorkflowState | null;
  redo: () => WorkflowState | null;
  pushState: (nodes: Node[], edges: Edge[]) => void;
  clear: () => void;
  
  // Get current state without modifying history
  getCurrentState: () => WorkflowState | null;
}

/**
 * Hook for managing undo/redo functionality in the workflow editor
 * 
 * @example
 * const { undo, redo, pushState, canUndo, canRedo } = useUndoRedo();
 * 
 * // When user makes a change
 * pushState(nodes, edges);
 * 
 * // When user presses Ctrl+Z
 * const previousState = undo();
 * if (previousState) {
 *   setNodes(previousState.nodes);
 *   setEdges(previousState.edges);
 * }
 */
export function useUndoRedo(config: UseUndoRedoConfig = {}): UseUndoRedoReturn {
  const { maxHistory = 50 } = config;
  
  // History stack
  const [history, setHistory] = useState<WorkflowState[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  
  // Flag to prevent recording state changes caused by undo/redo
  const isUndoRedoOperation = useRef(false);

  /**
   * Push a new state to the history
   * This should be called after any user action that modifies the workflow
   */
  const pushState = useCallback((nodes: Node[], edges: Edge[]) => {
    // Don't record if this change was caused by undo/redo
    if (isUndoRedoOperation.current) {
      isUndoRedoOperation.current = false;
      return;
    }

    const newState: WorkflowState = {
      nodes: JSON.parse(JSON.stringify(nodes)), // Deep clone
      edges: JSON.parse(JSON.stringify(edges)),
      timestamp: Date.now(),
    };

    setHistory((prev) => {
      // If we're not at the end of history, truncate future states
      const newHistory = prev.slice(0, currentIndex + 1);
      
      // Add new state
      newHistory.push(newState);
      
      // Limit history size
      if (newHistory.length > maxHistory) {
        newHistory.shift();
        setCurrentIndex((idx) => Math.max(0, idx)); // Adjust index
        return newHistory;
      }
      
      setCurrentIndex(newHistory.length - 1);
      return newHistory;
    });
  }, [currentIndex, maxHistory]);

  /**
   * Undo the last action
   */
  const undo = useCallback((): WorkflowState | null => {
    if (currentIndex <= 0) {
      return null;
    }

    isUndoRedoOperation.current = true;
    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);
    
    return history[newIndex] || null;
  }, [currentIndex, history]);

  /**
   * Redo the last undone action
   */
  const redo = useCallback((): WorkflowState | null => {
    if (currentIndex >= history.length - 1) {
      return null;
    }

    isUndoRedoOperation.current = true;
    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);
    
    return history[newIndex] || null;
  }, [currentIndex, history]);

  /**
   * Clear all history
   */
  const clear = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
  }, []);

  /**
   * Get current state without modifying history
   */
  const getCurrentState = useCallback((): WorkflowState | null => {
    return history[currentIndex] || null;
  }, [currentIndex, history]);

  return {
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
    historySize: history.length,
    currentIndex,
    undo,
    redo,
    pushState,
    clear,
    getCurrentState,
  };
}

/**
 * Hook to track specific workflow changes and auto-push to history
 * 
 * This is a convenience wrapper that automatically records state changes
 * with debouncing to avoid recording every micro-change
 */
export function useAutoHistory(
  nodes: Node[],
  edges: Edge[],
  undoRedo: UseUndoRedoReturn,
  debounceMs: number = 500
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStateRef = useRef<string>('');

  const recordChange = useCallback(() => {
    // Create a hash of current state to detect actual changes
    const stateHash = JSON.stringify({ nodes, edges });
    
    if (stateHash === lastStateRef.current) {
      return; // No actual change
    }
    
    lastStateRef.current = stateHash;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce the state push
    timeoutRef.current = setTimeout(() => {
      undoRedo.pushState(nodes, edges);
    }, debounceMs);
  }, [nodes, edges, undoRedo, debounceMs]);

  return { recordChange };
}

export default useUndoRedo;
