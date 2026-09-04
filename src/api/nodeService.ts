import apiClient from './client';

export interface NodeSchema {
  nodeType: string;
  name: string;
  displayName?: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  fields: NodeField[];
  inputs: NodeHandle[];
  outputs: NodeHandle[];
  outputFields?: string[];
}

export interface NodeField {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: unknown;
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

export interface AIModel {
  name: string;
  value: string;
  is_free: boolean;
  description: string;
  /**
   * Reasoning-effort rungs this model actually offers, cheapest first, from
   * `llm.effort.LADDER` on the backend. **Always present**, and `[]` is a real
   * answer — "this model has no effort control" — so a picker renders the
   * control off this array rather than guessing from the model's name.
   *
   * The backend cleans the list before sending it, so every entry here is one
   * the runtime will actually put on the wire.
   */
  effort_levels: string[];
  /** The rung used when nobody chooses. `''` means the provider's own default. */
  default_effort: string;
  /** Convenience for `effort_levels.length > 0`; the server computes both. */
  supports_effort: boolean;
}

export interface AIProvider {
  name: string;
  slug: string;
  description: string;
  icon: string;
  has_credentials: boolean;
  models: AIModel[];
}

const nodeService = {
  /**
   * Get all AI providers and their models with credential status
   */
  async getAIModels(): Promise<{ providers: AIProvider[] }> {
    // No cache-buster: the catalogue changes when a credential is added, not
    // between two renders of the same page, and `?t=` made every caller a
    // cache miss at every layer. Freshness is React Query's job now.
    const response = await apiClient.get<{ providers: AIProvider[] }>('/llm/models/');
    return response.data;
  },

  /**
   * Get all available node schemas
   */
  // getNodes / getNodeCategories / getNodeSchema lived here. The node-schema
  // endpoints (`/nodes/`, `/nodes/categories/`, `/nodes/{type}/`) were deleted
  // with the workflow product; only the model registry survives, and it moved
  // to `/llm/models/`.
};

export default nodeService;
