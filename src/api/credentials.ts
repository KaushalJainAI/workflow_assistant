/**
 * Credentials Service
 * 
 * Credential management (values are never exposed).
 */

import apiClient from './client';

export interface CredentialType {
  id: number;
  name: string;
  slug: string;
  service_identifier?: string;
  description: string;
  icon: string;
  auth_method: 'api_key' | 'oauth2' | 'basic' | 'bearer' | 'custom';
  fields_schema: CredentialFieldSchema[];
  oauth_config?: {
    auth_url?: string;
    token_url?: string;
    scopes?: string[];
  };
}

export interface CredentialFieldSchema {
  name: string;
  label: string;
  type: 'text' | 'password' | 'select' | 'textarea';
  required: boolean;
  placeholder?: string;
  default?: string;
  options?: { value: string; label: string }[];
}

export interface CredentialField {
  key: string;
  label: string;
  type: string;
  value: string;
}

export interface Credential {
  id: number;
  name: string;
  credential_type: number;
  credential_type_display: string;
  is_valid: boolean;
  is_verified: boolean;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
  fields: CredentialField[];
}

export interface CreateCredentialData {
  name: string;
  credential_type: number;
  data: Record<string, string>;
}

export const credentialsService = {
  /**
   * List credential types
   */
  async getTypes(): Promise<{ types: CredentialType[] }> {
    const response = await apiClient.get<{ types: CredentialType[] }>('/credentials/types/');
    return response.data;
  },

  /**
   * List user credentials
   */
  async list(): Promise<{ credentials: Credential[] }> {
    const response = await apiClient.get<{ credentials: Credential[] }>('/credentials/');
    return response.data;
  },

  /**
   * Get credential details (no values)
   */
  async get(id: number): Promise<Credential> {
    const response = await apiClient.get<Credential>(`/credentials/${id}/`);
    return response.data;
  },

  /**
   * Create credential
   */
  async create(data: CreateCredentialData): Promise<Credential> {
    const response = await apiClient.post<Credential>('/credentials/', data);
    return response.data;
  },

  /**
   * Update credential
   */
  async update(id: number, data: Partial<CreateCredentialData>): Promise<Credential> {
    const response = await apiClient.patch<Credential>(`/credentials/${id}/`, data);
    return response.data;
  },

  /**
   * Delete credential
   */
  async delete(id: number): Promise<void> {
    await apiClient.delete(`/credentials/${id}/`);
  },

  /**
   * Verify credential is valid
   */
  async verify(id: number): Promise<{ valid: boolean; message: string }> {
    const response = await apiClient.post<{ valid: boolean; message: string }>(
      `/credentials/${id}/verify/`
    );
    return response.data;
  },

  /**
   * Create new credential type
   */
  async createType(data: Partial<CredentialType>): Promise<CredentialType> {
    const response = await apiClient.post<CredentialType>('/credentials/types/', data);
    return response.data;
  },

  /**
   * Delete credential type
   */
  async deleteType(id: number): Promise<void> {
    await apiClient.delete(`/credentials/types/${id}/`);
  },
};

export default credentialsService;
