/**
 * One slash-command catalogue for the session.
 *
 * Fetched once per session and refetched when Connections or the builder
 * change (either can hide or reveal commands: an engine at `none` hides its
 * commands, a new agent/skill/project/connection adds a completion
 * candidate). The palette ranks locally from this list; completion and
 * validation stay server-side.
 */
import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import commandsService from '../api/commands';
import type { CommandDef } from '../lib/commands';

export const COMMANDS_QUERY_KEY = ['commands'];

export function useCommands(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const query = useQuery({
    queryKey: COMMANDS_QUERY_KEY,
    queryFn: () => commandsService.list(),
    staleTime: 5 * 60 * 1000,
    enabled,
  });

  return {
    commands: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Refetch the catalogue — call after Connections or builder saves. */
export function useRefreshCommands() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: COMMANDS_QUERY_KEY });
  }, [queryClient]);
}

/**
 * Completion candidates for one argument, debounced by the caller.
 * Returns `[]` while the query is empty only when the server says so —
 * completion is validated by the same predicate as resolution, so an empty
 * response is a real answer, not a loading state.
 */
export function useCommandCompletion(
  command: string | null,
  arg: string | null,
  q: string,
  options?: { enabled?: boolean },
) {
  const [candidates, setCandidates] = useState<
    { id?: number | string; value: string; label: string; description?: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!options?.enabled && options?.enabled === false) return;
    if (!command || !arg) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    const timer = setTimeout(() => {
      commandsService
        .complete(command, arg, q)
        .then((rows) => {
          if (!cancelled) setCandidates(rows);
        })
        .catch(() => {
          if (!cancelled) setCandidates([]);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [command, arg, q, options?.enabled]);

  return { candidates, isLoading };
}

export type { CommandDef };
