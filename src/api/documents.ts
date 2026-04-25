import apiClient from './client';

export interface KnowledgeBase {
  id: number;
  name: string;
  description: string;
  embedding_model: string;
  vector_dim: number;
  doc_count: number;
  vector_count: number;
  index_size_bytes: number;
  size_human: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseDetail extends KnowledgeBase {
  documents: Document[];
}

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
  status: 'pending' | 'processing' | 'indexed' | 'failed' | 'uploading';
  error_message?: string;
  sharing_mode?: 'private' | 'shared_read' | 'shared_write';
  author_name?: string;
  knowledge_base_id?: number | null;
  knowledge_base_name?: string | null;
}

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
  is_image?: boolean;
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

export const kbService = {
  async list(): Promise<KnowledgeBase[]> {
    const r = await apiClient.get<KnowledgeBase[]>('/inference/kbs/');
    return r.data;
  },

  async create(name: string, description?: string): Promise<KnowledgeBase> {
    const r = await apiClient.post<KnowledgeBase>('/inference/kbs/', { name, description: description ?? '' });
    return r.data;
  },

  async get(id: number): Promise<KnowledgeBaseDetail> {
    const r = await apiClient.get<KnowledgeBaseDetail>(`/inference/kbs/${id}/`);
    return r.data;
  },

  async delete(id: number): Promise<void> {
    await apiClient.delete(`/inference/kbs/${id}/`);
  },

  async assignDocument(kbId: number, documentId: number): Promise<{ detail: string }> {
    const r = await apiClient.post<{ detail: string }>(`/inference/kbs/${kbId}/documents/${documentId}/assign/`);
    return r.data;
  },

  async removeDocument(kbId: number, documentId: number): Promise<void> {
    await apiClient.delete(`/inference/kbs/${kbId}/documents/${documentId}/`);
  },
};

export const documentsService = {
  async list(): Promise<{ my_documents: Document[]; public_documents: Document[] }> {
    const r = await apiClient.get<{ my_documents: Document[]; public_documents: Document[] }>('/inference/documents/');
    return r.data;
  },

  async get(id: number): Promise<Document> {
    const r = await apiClient.get<Document>(`/inference/documents/${id}/`);
    return r.data;
  },

  async upload(file: File, kbId?: number): Promise<Document> {
    const formData = new FormData();
    formData.append('file', file);
    if (kbId != null) formData.append('kb_id', String(kbId));
    const r = await apiClient.post<Document>('/inference/documents/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return r.data;
  },

  async toggleSharing(id: number): Promise<{ is_shared: boolean; shared_at: string | null; message: string }> {
    const r = await apiClient.post<{ is_shared: boolean; shared_at: string | null; message: string }>(
      `/inference/documents/${id}/share/`
    );
    return r.data;
  },

  async delete(id: number): Promise<void> {
    await apiClient.delete(`/inference/documents/${id}/`);
  },

  async download(id: number): Promise<Blob> {
    const r = await apiClient.get<Blob>(`/inference/documents/${id}/download/`, { responseType: 'blob' });
    return r.data;
  },

  async search(
    query: string,
    topK = 5,
    includePlatform = false,
    kbId?: number
  ): Promise<{ results: SearchResult[]; platform_results: SearchResult[] }> {
    const r = await apiClient.post<{ results: SearchResult[]; platform_results: SearchResult[] }>(
      '/inference/rag/search/',
      { query, top_k: topK, include_platform: includePlatform, kb_id: kbId }
    );
    return r.data;
  },

  async query(question: string, topK = 5): Promise<RAGQueryResponse> {
    const r = await apiClient.post<RAGQueryResponse>('/inference/rag/query/', { question, top_k: topK });
    return r.data;
  },
};

export default documentsService;
