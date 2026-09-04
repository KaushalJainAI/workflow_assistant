import { useQuery } from '@tanstack/react-query';
import nodeService, { type AIProvider } from '../api/nodeService';
import { tokenManager } from '../api/client';

/**
 * The provider/model catalogue, fetched once per session rather than once per
 * component.
 *
 * Three components mount this on the chat route alone. With local `useState` +
 * `useEffect` each got its own request, and `getAIModels` appended a
 * `?t=${Date.now()}` cache-buster that defeated the HTTP cache too — so a
 * single page load asked the server the same question three times and cached
 * none of the answers. React Query dedupes by key across every consumer and
 * holds the result for the shared `staleTime`.
 *
 * Unauthenticated visitors are skipped via `enabled`: the endpoint requires
 * auth, and the public guest chat used to fill the console with 401s.
 */
export function useAIModels() {
  const authenticated = tokenManager.isAuthenticated();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['ai-models'],
    queryFn: () => nodeService.getAIModels(),
    enabled: authenticated,
  });

  return {
    providers: (data?.providers ?? []) as AIProvider[],
    isLoading: authenticated ? isLoading : false,
    error: (error as Error | null) ?? null,
    refresh: refetch,
  };
}
