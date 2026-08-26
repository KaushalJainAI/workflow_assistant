/**
 * Agents API.
 *
 * The wire shape *is* `AgentConfig` — the backend speaks the same camelCase the
 * knob board does, so there is no mapping layer here to drift out of sync. The
 * only additions are the read-only fields the server computes: the id and the
 * observed run statistics.
 */
import apiClient from './client';
import { asArray } from './unwrap';
import type { AgentConfig } from '../types/agentConfig';

/** An agent as the server returns it: the config, plus what actually happened. */
export interface Agent extends AgentConfig {
  id: number;
  status: string;
  /** Counted from the execution log, not stored — see orchestrator/agents.py. */
  runs: number;
  /** Runs that raised no approval request, i.e. nobody had to be involved. */
  unattended: number;
  /** Credits spent across those runs. */
  spend: number;
  created_at: string;
  updated_at: string;
}

/** What starting a run returns now: an id to watch, not an answer. */
export interface AgentRunStarted {
  execution_id: string;
  status: string;
  unserved_grants: string[];
}

/** What the server accepts. Everything read-only is stripped by the caller. */
export type AgentInput = Partial<AgentConfig> & Pick<AgentConfig, 'name'>;

const agentsService = {
  list: async (): Promise<Agent[]> => {
    const { data } = await apiClient.get<Agent[]>('/orchestrator/agents/');
    return asArray<Agent>(data);
  },

  get: async (id: number | string): Promise<Agent> => {
    const { data } = await apiClient.get<Agent>(`/orchestrator/agents/${id}/`);
    return data;
  },

  create: async (config: AgentInput): Promise<Agent> => {
    const { data } = await apiClient.post<Agent>('/orchestrator/agents/', config);
    return data;
  },

  /**
   * PATCH, so a knob the caller did not send keeps its current value. Sending
   * a partial config with PUT would reset unmentioned grants to their defaults,
   * which for a permission is the difference between narrowing and widening.
   */
  update: async (id: number | string, config: Partial<AgentConfig>): Promise<Agent> => {
    const { data } = await apiClient.patch<Agent>(`/orchestrator/agents/${id}/`, config);
    return data;
  },

  /**
   * Start a run. Resolves as soon as the backend has an execution id — the run
   * itself streams to `ws/execution/{execution_id}/`, which is what lets the
   * canvas draw it. Waiting for the answer here would defeat that.
   */
  execute: async (id: number | string, goal: string, threadId?: string): Promise<AgentRunStarted> => {
    const { data } = await apiClient.post<AgentRunStarted>(
      `/orchestrator/agents/${id}/execute/`,
      { goal, ...(threadId ? { thread_id: threadId } : {}) },
    );
    return data;
  },

  /** Approve a paused tool call. The backend also resumes the run. */
  approve: async (id: number | string, threadId: string, callId: string) => {
    const { data } = await apiClient.post(`/orchestrator/agents/${id}/approve/`, {
      thread_id: threadId, call_id: callId,
    });
    return data;
  },

  remove: async (id: number | string): Promise<void> => {
    await apiClient.delete(`/orchestrator/agents/${id}/`);
  },
};

export default agentsService;
