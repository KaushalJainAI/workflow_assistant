/**
 * Templates Service
 * 
 * Access to workflow templates and related operations.
 */

import apiClient from './client';

export interface WorkflowTemplate {
  id: number;
  name: string;
  description: string;
  category: string;
  tags: string[];
  nodes?: any[];
  edges?: any[];
  workflow_settings?: Record<string, any>;
  usage_count: number;
  success_rate: number;
  score?: number; // For search results
}

export const templatesService = {
  /**
   * Get template details
   */
  async get(id: number): Promise<WorkflowTemplate> {
      const response = await apiClient.get<WorkflowTemplate>(`/orchestrator/templates/${id}/`);
      return response.data;
  },

  /**
   * List all available templates
   */
  async list(): Promise<WorkflowTemplate[]> {
    const response = await apiClient.get<WorkflowTemplate[]>('/orchestrator/templates/');
    return response.data;
  },

  /**
   * Search templates
   */
  async search(query: string): Promise<WorkflowTemplate[]> {
    const response = await apiClient.post<WorkflowTemplate[]>('/orchestrator/templates/search/', { query });
    return response.data;
  },

  /**
   * Clone a workflow explicitly (from ID)
   */
  async cloneWorkflow(workflowId: number): Promise<{ id: number; name: string; status: string }> {
    const response = await apiClient.post<{ id: number; name: string; status: string }>(
      `/orchestrator/workflows/${workflowId}/clone/`
    );
    return response.data;
  },

  /**
   * Test a workflow
   */
  async testWorkflow(workflowId: number): Promise<{ task_id: string; status: string }> {
      const response = await apiClient.post<{ task_id: string; status: string }>(
          `/orchestrator/workflows/${workflowId}/test/`
      );
      return response.data;
  }
};

export default templatesService;
