/**
 * MCP Service
 * 
 * Management of Model Context Protocol (MCP) servers.
 */

import apiClient from './client';

export type MCPServerType = 'stdio' | 'sse';

export interface MCPServer {
  id: number;
  name: string;
  type: MCPServerType;
  
  // Stdio Config
  command?: string;
  args?: string[];
  
  // SSE Config
  url?: string;
  
  // Execution Environment
  env?: Record<string, string>;
  
  // Credential wiring
  required_credential_types?: string[];
  credential_env_map?: Record<string, string>;
  credential_header_map?: Record<string, string>;
  
  setup_notes?: string;
  enabled: boolean;
  user: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMCPServerData {
  name: string;
  type: MCPServerType;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  required_credential_types?: string[];
  credential_env_map?: Record<string, string>;
  credential_header_map?: Record<string, string>;
  setup_notes?: string;
  enabled?: boolean;
}

export const mcpService = {
  /**
   * List MCP servers
   */
  async list(): Promise<{ servers: MCPServer[] }> {
    const response = await apiClient.get<{ servers: MCPServer[] }>('/mcp/servers/');
    return response.data;
  },

  /**
   * Get MCP server details
   */
  async get(id: number): Promise<MCPServer> {
    const response = await apiClient.get<MCPServer>(`/mcp/servers/${id}/`);
    return response.data;
  },

  /**
   * Create MCP server
   */
  async create(data: CreateMCPServerData): Promise<MCPServer> {
    const response = await apiClient.post<MCPServer>('/mcp/servers/', data);
    return response.data;
  },

  /**
   * Update MCP server
   */
  async update(id: number, data: Partial<CreateMCPServerData>): Promise<MCPServer> {
    const response = await apiClient.patch<MCPServer>(`/mcp/servers/${id}/`, data);
    return response.data;
  },

  /**
   * Delete MCP server
   */
  async delete(id: number): Promise<void> {
    await apiClient.delete(`/mcp/servers/${id}/`);
  },
};

export default mcpService;
