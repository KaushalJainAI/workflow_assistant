import { useState, useEffect, useCallback } from 'react';
import nodeService, { type AIProvider } from '../api/nodeService';

export function useAIModels() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await nodeService.getAIModels();
      setProviders(data.providers);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch AI models:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch models'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return {
    providers,
    isLoading,
    error,
    refresh: fetchModels
  };
}
