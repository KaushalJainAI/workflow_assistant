/**
 * Documents Service
 * 
 * Document upload, management, and RAG search.
 */

import apiClient from './client';

export interface Document {
  id: number;
  title: string;
  filename: string;
  file_type: string;
  file_size: number;
  chunk_count: number;
  is_shared: boolean;
  shared_at: string | null;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  status: 'pending' | 'processing' | 'indexed' | 'failed' | 'uploading'; // Added status
  error_message?: string;
}

// ... DocumentChunk, SearchResult interfaces ...

export interface DocumentChunk {
  id: number;
  content: string;
  chunk_index: number;
  metadata: Record<string, unknown>;
}

export interface SearchResult {
  document_id: number;
  content: string;
  score: number;
  source: 'personal' | 'platform';
}

export interface RAGQueryResponse {
  answer: string;
  sources: SearchResult[];
  thought_process?: any[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export const documentsService = {
  /**
   * List all documents
   */
  async list(): Promise<{ documents: Document[] }> {
    const response = await apiClient.get<{ documents: Document[] }>('/inference/documents/');
    return response.data;
  },

  /**
   * Get document details
   */
  async get(id: number): Promise<Document> {
    const response = await apiClient.get<Document>(`/inference/documents/${id}/`);
    return response.data;
  },

  /**
   * Upload document
   */
  async upload(file: File, title?: string): Promise<Document> {
    const formData = new FormData();
    formData.append('file', file);
    if (title) {
      formData.append('title', title);
    }

    const response = await apiClient.post<Document>('/inference/documents/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Toggle document sharing with platform
   */
  async toggleSharing(id: number): Promise<{ is_shared: boolean; shared_at: string | null; message: string }> {
    const response = await apiClient.post<{ is_shared: boolean; shared_at: string | null; message: string }>(
      `/inference/documents/${id}/share/`
    );
    return response.data;
  },

  /**
   * Delete document
   */
  async delete(id: number): Promise<void> {
    await apiClient.delete(`/inference/documents/${id}/`);
  },

  /**
   * Download document
   */
  async download(id: number): Promise<Blob> {
    const response = await apiClient.get<Blob>(`/inference/documents/${id}/download/`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Search documents
   */
  async search(query: string, topK: number = 5, includePlatform: boolean = false): Promise<{ results: SearchResult[], platform_results: SearchResult[] }> {
    const response = await apiClient.post<{ results: SearchResult[], platform_results: SearchResult[] }>('/inference/rag/search/', {
      query,
      top_k: topK,
      include_platform: includePlatform
    });
    return response.data;
  },

  /**
   * RAG query - ask a question
   */
  async query(question: string, topK: number = 5): Promise<RAGQueryResponse> {
    const response = await apiClient.post<RAGQueryResponse>('/inference/rag/query/', {
      question,
      top_k: topK,
    });
    return response.data;
  },
};

export default documentsService;
