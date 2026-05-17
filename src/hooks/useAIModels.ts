import { useState, useEffect, useCallback } from 'react';
import nodeService, { type AIProvider } from '../api/nodeService';
import { tokenManager } from '../api/client';

export function useAIModels() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchModels = useCallback(async () => {
    // Skip the call entirely for unauthenticated visitors — this endpoint
    // requires auth and would otherwise spam the console with errors on the
    // public guest chat page.
    if (!tokenManager.isAuthenticated()) {
      setProviders([]);
      setIsLoading(false);
      return;
    }
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
