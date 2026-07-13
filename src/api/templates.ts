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
  // New fields
  author_name: string;
  average_rating: number;
  rating_count: number;
  fork_count: number;
  is_featured: boolean;
  is_bookmarked: boolean;
  user_rating?: number;
}

export interface PaginatedTemplates {
    results: WorkflowTemplate[];
    count: number;
    page: number;
    pages: number;
}

export interface TemplateComment {
    id: number;
    user_name: string;
    text: string;
    parent: number | null;
    replies: TemplateComment[];
    created_at: string;
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
   * List all available templates with filters
   */
  async list(params?: { category?: string; sort?: string; page?: number }): Promise<PaginatedTemplates> {
    const response = await apiClient.get<PaginatedTemplates>('/orchestrator/templates/', { params });
    return response.data;
  },

  /**
   * Search templates with hybrid logic
   */
  async search(data: { query: string; category?: string; sort?: string; page?: number }): Promise<PaginatedTemplates> {
    const response = await apiClient.post<PaginatedTemplates>('/orchestrator/templates/search/', data);
    return response.data;
  },

  /**
   * Rate a template
   */
  async rate(id: number, stars: number, review?: string): Promise<any> {
      const response = await apiClient.post(`/orchestrator/templates/${id}/rate/`, { stars, review });
      return response.data;
  },

  /**
   * Toggle bookmark
   */
  async toggleBookmark(id: number): Promise<{ bookmarked: boolean }> {
      const response = await apiClient.post<{ bookmarked: boolean }>(`/orchestrator/templates/${id}/bookmark/`);
      return response.data;
  },

  /**
   * Get comments for a template
   */
  async getComments(id: number): Promise<TemplateComment[]> {
      const response = await apiClient.get<TemplateComment[]>(`/orchestrator/templates/${id}/comments/`);
      return response.data;
  },

  /**
   * Post a comment
   */
  async postComment(id: number, text: string, parentId?: number): Promise<TemplateComment> {
      const response = await apiClient.post<TemplateComment>(`/orchestrator/templates/${id}/comments/`, { 
        text, 
        parent_id: parentId 
      });
      return response.data;
  },

  /**
   * Get similar templates
   */
  async getSimilar(id: number): Promise<WorkflowTemplate[]> {
      const response = await apiClient.get<WorkflowTemplate[]>(`/orchestrator/templates/${id}/similar/`);
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
  }
};

export default templatesService;
