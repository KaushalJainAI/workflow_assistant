import { useState, useEffect, useCallback } from 'react';
import { nodeService, type NodeSchema } from '../api';
import { toast } from 'sonner';

// Simple in-memory cache to avoid repeated fetches
let nodeCache: Record<string, NodeSchema> = {};
let listeners: ((cache: Record<string, NodeSchema>) => void)[] = [];

export function useNodeTypes() {
  const [nodes, setNodes] = useState<NodeSchema[]>([]);
  const [categories, setCategories] = useState<Record<string, NodeSchema[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to cache updates
  useEffect(() => {
    const handler = (cache: Record<string, NodeSchema>) => {
       // Optional: update local state if we want real-time cache updates across components
    };
    listeners.push(handler);
    return () => {
      listeners = listeners.filter(l => l !== handler);
    };
  }, []);

  const fetchNodes = useCallback(async () => {
    try {
      setLoading(true);
      const [listRes, catRes] = await Promise.all([
        nodeService.getNodes(),
        nodeService.getCategories()
      ]);
      
      setNodes(listRes.nodes);
      setCategories(catRes.categories);
      
      // Populate cache
      listRes.nodes.forEach(node => {
        nodeCache[node.nodeType] = node;
      });
      
      setError(null);
    } catch (err) {
      console.error('Failed to load node types:', err);
      setError('Failed to load node definitions');
      // Fallback to empty or handled in UI
    } finally {
      setLoading(false);
    }
  }, []);

  const getNodeConfig = useCallback(async (type: string): Promise<NodeSchema | null> => {
    if (nodeCache[type]) return nodeCache[type];
    
    try {
      const schema = await nodeService.getNodeSchema(type);
      nodeCache[type] = schema;
      listeners.forEach(l => l(nodeCache));
      return schema;
    } catch (error) {
      console.error(`Failed to fetch schema for ${type}`, error);
      return null;
    }
  }, []);

  // Sync version of getNodeConfig (returns undefined if not cached, useful for render)
  const getNodeConfigSync = (type: string): NodeSchema | undefined => {
    return nodeCache[type];
  };

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  return {
    nodes,
    categories,
    loading,
    error,
    refresh: fetchNodes,
    getNodeConfig,
    getNodeConfigSync,
  };
}
