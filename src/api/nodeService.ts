import apiClient from './client';

export interface NodeSchema {
  nodeType: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  fields: NodeField[];
  inputs: NodeHandle[];
  outputs: NodeHandle[];
}

export interface NodeField {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;
  options?: (string | { value: string; label: string })[];
  description?: string;
  credentialType?: string;
}

export interface NodeHandle {
  id: string;
  label?: string;
  color?: string;
}

export interface NodeCategory {
  name: string;
  nodes: NodeSchema[];
}

const nodeService = {
  /**
   * Get all available node schemas
   */
  async getNodes(): Promise<{ count: number; nodes: NodeSchema[] }> {
    const response = await apiClient.get<{ count: number; nodes: NodeSchema[] }>('/nodes/');
    return response.data;
  },

  /**
   * Get nodes grouped by category
   */
  async getCategories(): Promise<{ categories: Record<string, NodeSchema[]> }> {
    const response = await apiClient.get<{ categories: Record<string, NodeSchema[]> }>('/nodes/categories/');
    return response.data;
  },

  /**
   * Get specific node schema
   */
  async getNodeSchema(nodeType: string): Promise<NodeSchema> {
    const response = await apiClient.get<NodeSchema>(`/nodes/${nodeType}/`);
    return response.data;
  }
};

export default nodeService;
