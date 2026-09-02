import apiClient from './client';

export type KnowledgeBaseBackend = 'vector' | 'fulltext' | 'raw' | 'hybrid';

export interface KnowledgeBase {
  id: number;
  name: string;
  description: string;
  backend: KnowledgeBaseBackend;
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

export const KB_BACKEND_LABELS: Record<KnowledgeBaseBackend, string> = {
  vector: 'Semantic',
  fulltext: 'Keyword',
  raw: 'Raw',
  hybrid: 'Hybrid',
};

export const KB_BACKEND_HELP: Record<KnowledgeBaseBackend, string> = {
  vector: 'Meaning-based search — best for prose and natural-language questions.',
  fulltext: 'Exact keyword & prefix matching — IDs, names, code identifiers.',
  raw: 'No index. The agent lists and reads whole documents on demand.',
  hybrid: 'Both semantic and keyword indexes; results are merged.',
};

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
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  status: 'pending' | 'processing' | 'indexed' | 'stored' | 'failed' | 'uploading';
  error_message?: string;
  sharing_mode?: 'private' | 'shared_read' | 'shared_write';
  author_name?: string;
  knowledge_base_id?: number | null;
  knowledge_base_name?: string | null;
  /** Where the file sits in the user's tree. `null` is their root. */
  folder_id?: number | null;
  /** Human-readable location for display only — never send it back. */
  folder_path?: string | null;
  deleted_at?: string | null;
  purges_at?: string | null;
}

/**
 * One node of the user's private tree.
 *
 * `path` holds *ids* (`/12/45/`), not names, and is display/debug only: the API
 * is id-addressed end to end and will not accept a path as a locator. Render
 * `breadcrumbs` instead.
 */
export interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  path: string;
  depth: number;
  child_count: number;
  document_count: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  purges_at?: string | null;
}

export interface Breadcrumb {
  id: number;
  name: string;
}

export interface FolderListPage {
  /** The folder being listed, or null when listing the root. */
  folder: Folder | null;
  breadcrumbs: Breadcrumb[];
  folders: Folder[];
  count: number;
  /** The listing is capped server-side; true means there are more. */
  truncated: boolean;
}

export interface FolderDetail extends Folder {
  breadcrumbs: Breadcrumb[];
}

export interface MoveResult {
  moved_folders: number;
  moved_documents: number;
  target_folder_id: number | null;
}

export interface TrashPage {
  folders: Folder[];
  folders_truncated: boolean;
  documents: Document[];
  next_cursor: string | null;
  has_more: boolean;
  /** Read this rather than hardcoding 30 — it is a server-side env var. */
  purges_after_days: number;
}

export interface RestoreOutcome {
  kind: 'folder' | 'document';
  id: number;
  relocated?: boolean;
  folder_id?: number | null;
  renamed_to?: string | null;
  reason?: string;
}

export interface RestoreResult {
  restored: RestoreOutcome[];
  refused: RestoreOutcome[];
}

export interface TrashResult {
  trashed_folders?: number;
  trashed_documents?: number;
  purges_after_days: number;
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
  thought_process?: unknown[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface DocumentListPage {
  my_documents: Document[];
  public_documents: Document[];
  my_next_cursor: string | null;
  public_next_cursor: string | null;
  my_has_more: boolean;
  public_has_more: boolean;
  next_cursor: string | null;
  has_more: boolean;
  limit: number;
}

// KB is internal — one implicit Default KB per user, no CRUD views.
// KnowledgeBase types retained for internal model reference only.

export const documentsService = {
  async list(params?: {
    limit?: number;
    cursor?: string | null;
    my_cursor?: string | null;
    public_cursor?: string | null;
    scope?: 'personal' | 'public' | 'all';
    /**
     * Narrow the personal half to one folder. Omit for the flat listing —
     * that is the pre-folder behaviour and stays the default. Pass `'root'`
     * for the documents sitting directly at the user's root.
     */
    folder_id?: number | 'root';
  }): Promise<DocumentListPage> {
    const r = await apiClient.get<DocumentListPage>('/inference/documents/', { params });
    return r.data;
  },

  async get(id: number): Promise<Document> {
    const r = await apiClient.get<Document>(`/inference/documents/${id}/`);
    return r.data;
  },

  async upload(file: File, folderId?: number | null): Promise<Document> {
    const formData = new FormData();
    formData.append('file', file);
    // Absent means the user's root, so only send it when we are inside one.
    if (folderId != null) formData.append('folder_id', String(folderId));
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

  /** Moves the document to the recycle bin; it stays restorable for
   *  `purges_after_days`. Not a permanent delete — that is the sweep's job. */
  async delete(id: number): Promise<TrashResult> {
    const r = await apiClient.delete<TrashResult>(`/inference/documents/${id}/`);
    return r.data;
  },

  async download(id: number): Promise<Blob> {
    const r = await apiClient.get<Blob>(`/inference/documents/${id}/download/`, { responseType: 'blob' });
    return r.data;
  },

  /** Authenticated preview for `<img src>`.
   *  Fetches via `Authorization` header (no token in URL) and returns a
   *  `blob:` URL. Use for previews; `download()` for saves. */
  async previewBlobUrl(id: number): Promise<string> {
    const blob = await this.download(id);
    return URL.createObjectURL(blob);
  },

  /** Legacy helper — kept for non-preview uses. Prefer `download()` / `previewBlobUrl()`.
   *  Direct `<img src>` to this URL without a header **will 401**; it is not
   *  public. `QueryParamJWTAuthentication` accepts `?token=` only as a fallback
   *  for browser-initiated GETs that cannot set headers, but the UI should use
   *  header-based fetch. */
  previewUrl(id: number): string {
    return `/api/inference/documents/${id}/download/`;
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

/**
 * The per-user folder tree and its recycle bin.
 *
 * Every call is id-addressed. The server answers 404 for a folder that does not
 * exist *and* for one belonging to someone else — deliberately the same answer,
 * so the API cannot be used to discover which ids are real.
 */
export const foldersService = {
  /** Children of `parentId` (null = the user's root), with breadcrumbs. */
  async list(parentId: number | null): Promise<FolderListPage> {
    const r = await apiClient.get<FolderListPage>('/inference/folders/', {
      params: parentId == null ? undefined : { parent: parentId },
    });
    return r.data;
  },

  async get(id: number): Promise<FolderDetail> {
    const r = await apiClient.get<FolderDetail>(`/inference/folders/${id}/`);
    return r.data;
  },

  async create(name: string, parentId: number | null): Promise<Folder> {
    const r = await apiClient.post<Folder>('/inference/folders/', {
      name,
      parent_id: parentId,
    });
    return r.data;
  },

  /** Rename and/or move in one call — what inline editing needs. */
  async update(
    id: number,
    changes: { name?: string; parent_id?: number | null }
  ): Promise<FolderDetail> {
    const r = await apiClient.patch<FolderDetail>(`/inference/folders/${id}/`, changes);
    return r.data;
  },

  /** Sends the folder and everything under it to the recycle bin. */
  async remove(id: number): Promise<TrashResult> {
    const r = await apiClient.delete<TrashResult>(`/inference/folders/${id}/`);
    return r.data;
  },

  /** Bulk on purpose: one request per dragged item would half-apply. */
  async move(payload: {
    folder_ids?: number[];
    document_ids?: number[];
    target_folder_id: number | null;
  }): Promise<MoveResult> {
    const r = await apiClient.post<MoveResult>('/inference/fs/move/', payload);
    return r.data;
  },

  trash: {
    async list(cursor?: string | null): Promise<TrashPage> {
      const r = await apiClient.get<TrashPage>('/inference/trash/', {
        params: cursor ? { cursor } : undefined,
      });
      return r.data;
    },

    /** No target: rows go back where they came from. */
    async restore(payload: {
      folder_ids?: number[];
      document_ids?: number[];
    }): Promise<RestoreResult> {
      const r = await apiClient.post<RestoreResult>('/inference/trash/restore/', payload);
      return r.data;
    },

    async empty(): Promise<{ purged_documents: number; purged_folders: number }> {
      const r = await apiClient.delete<{ purged_documents: number; purged_folders: number }>(
        '/inference/trash/empty/'
      );
      return r.data;
    },
  },
};

export default documentsService;
