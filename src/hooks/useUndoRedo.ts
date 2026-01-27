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
 */
export function useUndoRedo(config: UseUndoRedoConfig = {}): UseUndoRedoReturn {
  const { maxHistory = 50 } = config;
  
  // Use refs for immediate access to current values
  const historyRef = useRef<WorkflowState[]>([]);
  const currentIndexRef = useRef(-1);
  
  // State for triggering re-renders
  const [, setTick] = useState(0);
  const forceUpdate = useCallback(() => setTick(t => t + 1), []);
  
  // Flag to prevent recording state changes caused by undo/redo
  const isUndoRedoOperation = useRef(false);


  /**
   * Push a new state to the history
   */
  const pushState = useCallback((nodes: Node[], edges: Edge[]) => {
    // Don't record if this change was caused by undo/redo
    if (isUndoRedoOperation.current) {
      isUndoRedoOperation.current = false;
      return;
    }

    // Don't record empty states
    if (nodes.length === 0 && edges.length === 0) {
      return;
    }

    const newState: WorkflowState = {
      nodes: JSON.parse(JSON.stringify(nodes)), // Deep clone
      edges: JSON.parse(JSON.stringify(edges)),
      timestamp: Date.now(),
    };

    // If we're not at the end of history, truncate future states
    const newHistory = historyRef.current.slice(0, currentIndexRef.current + 1);
    
    // Don't add duplicate states
    const lastState = newHistory[newHistory.length - 1];
    if (lastState && 
        JSON.stringify(lastState.nodes) === JSON.stringify(newState.nodes) &&
        JSON.stringify(lastState.edges) === JSON.stringify(newState.edges)) {
      return;
    }
    
    // Add new state
    newHistory.push(newState);
    
    // Limit history size
    if (newHistory.length > maxHistory) {
      newHistory.shift();
      currentIndexRef.current = newHistory.length - 1;
    } else {
      currentIndexRef.current = newHistory.length - 1;
    }
    
    historyRef.current = newHistory;
    forceUpdate();
  }, [maxHistory, forceUpdate]);


  /**
   * Undo the last action
   */
  const undo = useCallback((): WorkflowState | null => {
    if (currentIndexRef.current <= 0) {
      return null;
    }

    isUndoRedoOperation.current = true;
    currentIndexRef.current--;
    forceUpdate();
    
    return historyRef.current[currentIndexRef.current] || null;
  }, [forceUpdate]);


  /**
   * Redo the last undone action
   */
  const redo = useCallback((): WorkflowState | null => {
    if (currentIndexRef.current >= historyRef.current.length - 1) {
      return null;
    }

    isUndoRedoOperation.current = true;
    currentIndexRef.current++;
    forceUpdate();
    
    return historyRef.current[currentIndexRef.current] || null;
  }, [forceUpdate]);


  /**
   * Clear all history
   */
  const clear = useCallback(() => {
    historyRef.current = [];
    currentIndexRef.current = -1;
    forceUpdate();
  }, [forceUpdate]);


  /**
   * Get current state without modifying history
   */
  const getCurrentState = useCallback((): WorkflowState | null => {
    return historyRef.current[currentIndexRef.current] || null;
  }, []);


  return {
    canUndo: currentIndexRef.current > 0,
    canRedo: currentIndexRef.current < historyRef.current.length - 1,
    historySize: historyRef.current.length,
    currentIndex: currentIndexRef.current,
    undo,
    redo,
    pushState,
    clear,
    getCurrentState,
  };
}


export default useUndoRedo;
