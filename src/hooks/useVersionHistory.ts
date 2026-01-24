import { useState, useCallback, useEffect, useMemo } from 'react';
import type { Node, Edge } from 'reactflow';

export interface WorkflowVersion {
  id: string;
  timestamp: number;
  nodes: Node[];
  edges: Edge[];
  name: string;
  description?: string;
}

const MAX_VERSIONS = 10;
const STORAGE_KEY_PREFIX = 'workflow_versions_';

// Helper to load versions from localStorage safely
const loadVersionsFromStorage = (workflowId: string): WorkflowVersion[] => {
  const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${workflowId}`);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      console.warn('Invalid workflow versions format in localStorage, resetting.');
      return [];
    } catch (e) {
      console.error('Failed to parse workflow versions', e);
      return [];
    }
  }
  return [];
};

export function useVersionHistory(workflowId: string) {
  // Use lazy initial state to load versions on first render only
  const [versions, setVersions] = useState<WorkflowVersion[]>(() => 
    loadVersionsFromStorage(workflowId)
  );

  // Reload versions when workflowId changes
  const memoizedWorkflowId = useMemo(() => workflowId, [workflowId]);
  
  useEffect(() => {
    // Only reload if workflowId actually changed (not on initial mount)
    const loaded = loadVersionsFromStorage(memoizedWorkflowId);
    setVersions(loaded);
  }, [memoizedWorkflowId]);

  // Save version
  const saveVersion = useCallback((
    nodes: Node[],
    edges: Edge[],
    name: string,
    description?: string
  ) => {
    const newVersion: WorkflowVersion = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      nodes: JSON.parse(JSON.stringify(nodes)), // Deep clone
      edges: JSON.parse(JSON.stringify(edges)),
      name,
      description,
    };

    setVersions((prev) => {
      const next = [newVersion, ...prev].slice(0, MAX_VERSIONS);
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${workflowId}`, JSON.stringify(next));
      return next;
    });
  }, [workflowId]);

  // Restore version (returns the version data)
  const restoreVersion = useCallback((versionId: string): WorkflowVersion | null => {
    const version = versions.find(v => v.id === versionId);
    return version ? JSON.parse(JSON.stringify(version)) : null; // Deep copy on return
  }, [versions]);

  // Clear history
  const clearHistory = useCallback(() => {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${workflowId}`);
    setVersions([]);
  }, [workflowId]);

  return {
    versions,
    saveVersion,
    restoreVersion,
    clearHistory,
  };
}
