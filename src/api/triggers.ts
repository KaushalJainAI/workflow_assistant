/**
 * Triggers API — the ways something other than the user starts a run.
 *
 * The backend surface for this has existed since triggers shipped and nothing
 * in this app called it, so a schedule could be set on an agent and then never
 * seen again: no list, no next-due time, no way to tell that a trigger had
 * disabled itself after five failures. This module is that missing half.
 *
 * The wire shape is the model's own, snake_case, because `TriggerSerializer` is
 * a `ModelSerializer` — unlike agents, there is no camelCase config contract in
 * front of it to match.
 */
import apiClient from './client';
import { asArray } from './unwrap';

export type TriggerMode = 'schedule' | 'webhook' | 'event';

/** What to do when a trigger fires while its previous run is still going. */
export type OverlapPolicy = 'skip' | 'queue' | 'cancel';

/**
 * The one-word result of a firing, as `agents/sweep.py::fire` reports it.
 * Distinguishing these is the whole point of the run-now button: "nothing was
 * due" and "everything was refused" look identical in a boolean.
 */
export type FireOutcome =
  | 'fired'
  | 'skipped'
  | 'late'
  | 'busy'
  | 'refused'
  | 'failed';

export interface Trigger {
  id: number;
  subagent: number;
  agent_name: string;
  mode: TriggerMode;
  /** Mode-specific. For schedules this carries `{ cron }`. */
  config: { cron?: string; event?: string; [k: string]: unknown };
  goal: string;
  enabled: boolean;
  overlap: OverlapPolicy;
  last_fired_at: string | null;
  next_due_at: string | null;
  consecutive_failures: number;
  /** Only ever populated for webhook triggers, and only for the owner. */
  webhook_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TriggerInput {
  subagent: number;
  mode: TriggerMode;
  /** Write-only on the server; it lands in `config.cron`. */
  cron?: string;
  goal?: string;
  enabled?: boolean;
  overlap?: OverlapPolicy;
}

export interface RunNowResult {
  outcome: FireOutcome;
  trigger: Trigger;
}

const triggersService = {
  list: async (): Promise<Trigger[]> => {
    const { data } = await apiClient.get<Trigger[]>('/orchestrator/triggers/');
    return asArray<Trigger>(data);
  },

  create: async (input: TriggerInput): Promise<Trigger> => {
    const { data } = await apiClient.post<Trigger>('/orchestrator/triggers/', input);
    return data;
  },

  /** PATCH, so an unmentioned field keeps its value — same reasoning as agents. */
  update: async (id: number, patch: Partial<TriggerInput>): Promise<Trigger> => {
    const { data } = await apiClient.patch<Trigger>(`/orchestrator/triggers/${id}/`, patch);
    return data;
  },

  remove: async (id: number): Promise<void> => {
    await apiClient.delete(`/orchestrator/triggers/${id}/`);
  },

  /**
   * Fire a schedule now, through the sweep's own path. Not a shortcut to
   * `agents/{id}/execute/`: that would prove the agent runs, which was never
   * in doubt — the question is whether the *scheduled* path runs.
   */
  runNow: async (id: number): Promise<RunNowResult> => {
    const { data } = await apiClient.post<RunNowResult>(
      `/orchestrator/triggers/${id}/run/`, {},
    );
    return data;
  },
};

export default triggersService;
