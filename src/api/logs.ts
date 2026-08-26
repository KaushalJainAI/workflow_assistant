/**
 * Logs Service — what an agent did, thought, and was configured as.
 *
 * A run is a loop of **turns**, not a list of steps: each turn is one pass of
 * the model, carrying the reasoning behind it, and the tool calls it issued
 * hang off it. Calls sharing a turn were decided together; calls in different
 * turns were not. Render them that way or the trace claims a causality the run
 * never had.
 *
 * `workflow_id` / `workflow_name` are frozen wire names. What they identify is
 * a SubAgent — the backend renames the column on the way out so that this app
 * and BrowserOS, which ship their own builds, do not have to move together.
 */

import apiClient from './client';

// Execution types

/** Who started a run. `trigger_type` says how; this says what. */
export type RunCaller = 'api' | 'chat' | 'orchestrator' | 'trigger';

export interface ExecutionLog {
  id?: number;
  execution_id: string;
  workflow_id: number;
  workflow_name: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
  trigger_type: string;
  caller: RunCaller;
  /** Delegation depth. 0 is a run the user started. */
  depth: number;
  is_delegated: boolean;
  duration_ms: number | null;
  nodes_executed: number;
  tokens_used: number;
  error_message: string | null;
  started_at: string | null;
  created_at: string;
  completed_at: string | null;
}

/** One tool call, belonging to the turn that issued it. */
export interface AgentStep {
  id: number;
  /** The provider's tool-call id — what an approval resumes on. */
  call_id: string;
  tool: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  order: number;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
  error_message: string | null;
  duration_ms: number | null;
  started_at: string | null;
  completed_at: string | null;
  /** Non-empty only on delegating steps (`invoke_subagent`, `run_agent`). */
  delegated_runs: DelegatedRun[];
}

export interface DelegatedRun {
  execution_id: string;
  workflow_id: number | null;
  workflow_name: string | null;
  status: string;
  /** The instruction the worker was given — it exists nowhere else. */
  task: string;
  index: number;
  tokens_used: number;
  duration_ms: number | null;
}

/** One pass of the model: what it thought, and what it decided to do next. */
export interface AgentTurn {
  index: number;
  decision: 'tools' | 'answer' | 'paused' | 'error';
  /** The model's reasoning for THIS turn. Capped; see `reasoning_truncated`. */
  reasoning: string;
  reasoning_truncated: boolean;
  content: string;
  content_truncated: boolean;
  provider: string;
  model_id: string;
  tokens: number;
  duration_ms: number | null;
  created_at: string;
  steps: AgentStep[];
}

/** The orchestrator's side of a delegated run: who asked, and why. */
export interface DelegatedBy {
  execution_id: string;
  workflow_id: number | null;
  workflow_name: string | null;
  tool: string;
  call_id: string;
  task: string;
  index: number;
  /** What the orchestrator was thinking when it handed this work over. */
  reasoning: string;
  turn_index: number | null;
}

export interface RevisionSummary {
  id: number;
  number: number;
  summary: string;
  source: 'create' | 'update' | 'backfill';
  created_at: string;
}

export interface ExecutionDetail extends ExecutionLog {
  turns: AgentTurn[];
  /** Steps whose turn row is missing — a backfilled run, or a failed write. */
  unattributed_steps: AgentStep[];
  step_total: number;
  steps_truncated: boolean;
  turn_total: number;
  turns_truncated: boolean;
  credits_used: number;
  supervision_level?: string;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  error_node_id: string;
  /** The configuration this run actually executed under. */
  revision: RevisionSummary | null;
  delegated_by: DelegatedBy | null;
}

// Configuration history

export interface RevisionDiff {
  [field: string]: { from: unknown; to: unknown };
}

export interface AgentRevision {
  id: number;
  number: number;
  summary: string;
  source: 'create' | 'update' | 'backfill';
  diff: RevisionDiff;
  changed_by: string | null;
  /** Runs that executed under this revision — has it been tried enough to judge? */
  run_count: number;
  created_at: string;
}

export interface AgentRevisionDetail extends AgentRevision {
  config: Record<string, unknown>;
}

export interface CursorPage<T> {
  results: T[];
  /** Only the uncursored first page carries a total; later pages send null. */
  count: number | null;
  limit: number;
  next_cursor: string | null;
  has_more: boolean;
}

// Insights types

/**
 * Mirrors `logs.views.execution_statistics`. The scalars live under `summary` —
 * they are NOT flat on the response, and `daily_trend` carries a per-day
 * `success` count alongside the total.
 */
export interface ExecutionStatistics {
  summary: {
    total_executions: number;
    successful: number;
    failed: number;
    /** Already a percentage (0-100), not a fraction. */
    success_rate: number;
    avg_duration_ms: number;
    total_nodes_executed: number;
    total_tokens_used: number;
  };
  by_status: Record<string, number>;
  by_trigger: Record<string, number>;
  by_caller: Record<RunCaller, number>;
  daily_trend: DailyTrendPoint[];
}

export interface DailyTrendPoint {
  /** null when the row's created_at was null; skip those points. */
  date: string | null;
  count: number;
  success: number;
}

/**
 * Mirrors `logs.queries.agent_metrics`. `success_rate` is already a percentage,
 * and `tool_success_rates` is keyed by tool name, mapping to an object.
 */
export interface WorkflowMetrics {
  workflow_id: number;
  workflow_name: string;
  total_executions: number;
  success_rate: number;
  avg_duration_ms: number;
  total_tokens_used: number;
  recent_executions: ExecutionLog[];
  revision_count: number;
  /** Keyed by tool name: "read_url fails half the time" is the actionable read. */
  tool_success_rates: Record<
    string,
    { success_rate: number; total_runs: number }
  >;
  error_hotspots: { tool: string; error_count: number }[];
}

/**
 * Mirrors `logs.views.cost_breakdown`. `by_workflow` keeps the `workflow_id` /
 * `workflow_name` wire names used everywhere else in `/api/logs/`, and
 * `by_tool` is a list, not a mapping.
 */
export interface CostBreakdown {
  period_days: number;
  total_credits: number;
  total_tokens: number;
  by_workflow: {
    workflow_id: number;
    workflow_name: string;
    tokens: number;
    credits: number;
    executions: number;
  }[];
  by_tool: { tool: string; count: number }[];
  daily_usage: { date: string | null; credits: number; tokens: number }[];
}

export const logsService = {
  // ========== Insights ==========

  /**
   * Get execution statistics
   */
  async getStatistics(days: number = 30): Promise<ExecutionStatistics> {
    const response = await apiClient.get<ExecutionStatistics>('/logs/insights/stats/', {
      params: { days },
    });
    return response.data;
  },

  /**
   * Get workflow metrics
   */
  async getWorkflowMetrics(workflowId: number): Promise<WorkflowMetrics> {
    const response = await apiClient.get<WorkflowMetrics>(
      `/logs/insights/workflow/${workflowId}/`
    );
    return response.data;
  },

  /**
   * Get cost breakdown
   */
  async getCostBreakdown(days: number = 30): Promise<CostBreakdown> {
    const response = await apiClient.get<CostBreakdown>('/logs/insights/costs/', {
      params: { days },
    });
    return response.data;
  },

  // ========== Executions ==========

  /**
   * List executions
   */
async listExecutions(params?: {
    workflow_id?: number;
    status?: string;
    caller?: RunCaller;
    limit?: number;
    cursor?: string | null;
  }): Promise<CursorPage<ExecutionLog>> {
    const response = await apiClient.get<CursorPage<ExecutionLog>>(
      '/logs/executions/',
      { params }
    );
    return response.data;
  },

  /**
   * Get execution detail
   */
  async getExecution(executionId: string): Promise<ExecutionDetail> {
    const response = await apiClient.get<ExecutionDetail>(`/logs/executions/${executionId}/`);
    return response.data;
  },

  // ========== Configuration history ==========

/**
 * Every configuration change to an agent, newest first, with its diff.
 * `truncated` says when the timeline hit its cap — a cut history and a short
 * one must not look alike.
 */
async listRevisions(agentId: number): Promise<{
  results: AgentRevision[];
  count: number;
  limit: number;
  truncated: boolean;
}> {
  const response = await apiClient.get<{
    results: AgentRevision[];
    count: number;
    limit: number;
    truncated: boolean;
  }>(`/logs/agents/${agentId}/revisions/`);
  return response.data;
},

  /**
   * One revision's full configuration snapshot.
   */
  async getRevision(agentId: number, number: number): Promise<AgentRevisionDetail> {
    const response = await apiClient.get<AgentRevisionDetail>(
      `/logs/agents/${agentId}/revisions/${number}/`
    );
    return response.data;
  },
};

export default logsService;
