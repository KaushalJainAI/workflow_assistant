/**
 * Workflows Service
 * 
 * CRUD operations for workflows.
 */

import apiClient from './client';

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    icon?: string;
    color?: string;
    config?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  animated?: boolean;
}

export interface Workflow {
  id: number;
  name: string;
  slug: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport: { x: number; y: number; zoom: number };
  workflow_settings: Record<string, unknown>;
  status: 'draft' | 'active' | 'inactive';
  icon: string;
  color: string;
  tags: string[];
  execution_count: number;
  last_executed_at: string | null;
  created_at: string;
  updated_at: string;
  node_count?: number;
}

export interface WorkflowListItem {
  id: number;
  name: string;
  slug: string;
  description: string;
  status: string;
  icon: string;
  color: string;
  tags: string[];
  execution_count: number;
  last_executed_at: string | null;
  created_at: string;
  updated_at: string;
  node_count: number;
}

export interface CreateWorkflowData {
  name: string;
  description?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  status?: string;
  icon?: string;
  color?: string;
  tags?: string[];
}

export interface WorkflowVersion {
  id: number;
  version_number: number;
  label: string;
  change_summary: string;
  created_at: string;
}

export const workflowsService = {
  /**
   * List all workflows
   */
  async list(status?: string): Promise<WorkflowListItem[]> {
    const params = status ? { status } : undefined;
    const response = await apiClient.get<WorkflowListItem[]>('/orchestrator/workflows/', { params });
    return response.data;
  },

  /**
   * Get single workflow
   */
  async get(id: number): Promise<Workflow> {
    const response = await apiClient.get<Workflow>(`/orchestrator/workflows/${id}/`);
    return response.data;
  },

  /**
   * Create new workflow
   */
  async create(data: CreateWorkflowData): Promise<Workflow> {
    const response = await apiClient.post<Workflow>('/orchestrator/workflows/', data);
    return response.data;
  },

  /**
   * Update workflow
   */
  async update(id: number, data: Partial<Workflow>): Promise<Workflow> {
    const response = await apiClient.put<Workflow>(`/orchestrator/workflows/${id}/`, data);
    return response.data;
  },

  /**
   * Delete workflow
   */
  async delete(id: number): Promise<void> {
    await apiClient.delete(`/orchestrator/workflows/${id}/`);
  },

  /**
   * Get workflow versions
   */
  async getVersions(id: number): Promise<{ versions: WorkflowVersion[] }> {
    const response = await apiClient.get<{ versions: WorkflowVersion[] }>(
      `/orchestrator/workflows/${id}/versions/`
    );
    return response.data;
  },

  /**
   * Create version snapshot
   */
  async createVersion(id: number, label: string, changeSummary: string): Promise<WorkflowVersion> {
    const response = await apiClient.post<WorkflowVersion>(`/orchestrator/workflows/${id}/versions/`, {
      label,
      change_summary: changeSummary,
    });
    return response.data;
  },

  /**
   * Restore to version
   */
  async restoreVersion(workflowId: number, versionId: number): Promise<void> {
    await apiClient.post(`/orchestrator/workflows/${workflowId}/versions/${versionId}/restore/`);
  },
};

export default workflowsService;
