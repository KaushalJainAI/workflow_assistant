/**
 * Logs Service
 * 
 * Execution logs, insights, and audit trail.
 */

import apiClient from './client';

// Execution types
export interface ExecutionLog {
  id?: number;
  execution_id: string;
  workflow_id: number;
  workflow_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  trigger_type: string;
  duration_ms: number | null;
  error_message: string | null;
  node_count: number;
  created_at: string;
  completed_at: string | null;
}

export interface ExecutionDetail extends ExecutionLog {
  node_logs: NodeLog[];
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  supervision_level?: string;
}

export interface NodeLog {
  id: number;
  node_id: string;
  node_name?: string;
  node_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  error_message: string | null;
  duration_ms: number;
  started_at: string;
  completed_at: string | null;
}

export interface OrchestratorThought {
  id: number;
  execution?: string;
  node_id: string;
  node_name?: string;
  category: 'workflow' | 'idle' | 'system';
  thought_type: 'thinking' | 'thought' | 'narrative' | 'status' | 'error';
  content: string;
  reasoning: string;
  model_id?: string;
  model_name?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CursorPage<T> {
  results: T[];
  count?: number | null;
  limit: number;
  offset?: number;
  next_cursor: string | null;
  has_more: boolean;
}

// Insights types
export interface ExecutionStatistics {
  total_executions: number;
  by_status: Record<string, number>;
  by_trigger: Record<string, number>;
  daily_trend: { date: string; count: number }[];
  avg_duration_ms: number;
  success_rate: number;
}

export interface WorkflowMetrics {
  workflow_id: number;
  workflow_name: string;
  total_executions: number;
  success_count: number;
  failure_count: number;
  avg_duration_ms: number;
  recent_executions: ExecutionLog[];
  node_success_rates: Record<string, number>;
  error_hotspots: { node_id: string; error_count: number }[];
}

export interface CostBreakdown {
  total_credits: number;
  total_tokens: number;
  by_workflow: { workflow_id: number; workflow_name: string; credits: number }[];
  by_node_type: Record<string, number>;
  daily_usage: { date: string; credits: number; tokens: number }[];
}

// Audit types
export interface AuditEntry {
  id: number;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, unknown>;
  ip_address: string;
  user_agent: string;
  created_at: string;
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
    limit?: number;
    offset?: number;
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

  // ========== Audit ==========

  /**
   * List audit entries
   */
  async listAudit(params?: {
    action_type?: string;
    workflow_id?: number;
    limit?: number;
    cursor?: string | null;
  }): Promise<CursorPage<AuditEntry>> {
    const response = await apiClient.get<CursorPage<AuditEntry>>(
      '/logs/audit/',
      { params }
    );
    return response.data;
  },

  /**
   * Export audit log
   */
  async exportAudit(format: 'json' | 'csv', days?: number): Promise<Blob> {
    const response = await apiClient.get('/logs/audit/export/', {
      params: { format, days },
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Get orchestrator activity logs for an execution
   */
  async getActivityLogs(executionId: string): Promise<OrchestratorThought[]> {
    const response = await apiClient.get<OrchestratorThought[]>(
      `/logs/executions/${executionId}/activities/`
    );
    return response.data;
  },

  /**
   * Get synthesized narrative for an execution
   */
  async getNarrative(executionId: string): Promise<OrchestratorThought> {
    const response = await apiClient.get<OrchestratorThought>(
      `/logs/executions/${executionId}/narrative/`
    );
    return response.data;
  },
};

export default logsService;
