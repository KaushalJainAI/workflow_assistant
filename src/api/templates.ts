/**
 * Explore — everything installable, and publishing into it.
 *
 * Two sources, one shape. A **curated** entry is code on the backend
 * (`agents/gallery.py`); a **community** entry is an agent another user
 * published. They differ in provenance and in nothing the installer cares
 * about, so this file has one type for both and `source` says which it is.
 *
 * The only writes are `install`, which creates an ordinary agent that the
 * entry then has no further hold over, and `publish`, which turns one of your
 * own agents into a listing.
 *
 * `config` is a partial `AgentConfig` — the same shape the builder speaks —
 * and the install screen renders its permissions straight from it. That is
 * deliberate: the screen and the runtime read the same keys, so the screen
 * cannot promise something the runtime never checks.
 */
import apiClient from './client';
import { asArray } from './unwrap';
import type { Agent } from './agents';
import type { AgentConfig } from '../types/agentConfig';

export type RequirementType = 'connector' | 'knowledge_base' | 'skill';

/** Something the installer owns that could satisfy a requirement. */
export interface RequirementCandidate {
  id: number;
  label: string;
  /** Connections only — maps to an icon via `lib/connectorIcons.ts`. */
  icon_slug?: string;
  category?: string;
  doc_count?: number;
  backend?: string;
}

/**
 * What a template needs, named portably.
 *
 * Never an id: a template that pointed at knowledge base 2 would, installed
 * elsewhere, silently read somebody else's row 2. The installer picks from
 * `candidates`, which the server computed from their own rows.
 */
export interface TemplateRequirement {
  key: string;
  type: RequirementType;
  label: string;
  why: string;
  optional: boolean;
  /** A hint (an `icon_slug`) that reorders `candidates`; it never filters. */
  provider?: string;
  candidates: RequirementCandidate[];
}

/** Where an entry came from. Presentation differs; installing does not. */
export type TemplateSource = 'curated' | 'community';

/**
 * Who may find a published agent. Three rungs, each strictly wider than the
 * last, and only the widest leaves the platform.
 */
export type ShareVisibility = 'link' | 'platform' | 'public';

export interface AgentTemplate {
  slug: string;
  source: TemplateSource;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  tags: string[];
  /** Community entries only: the publisher's display name, never their email. */
  author: string | null;
  /** Community entries only. */
  install_count: number | null;
  version: number | null;
  is_mine?: boolean;
  visibility?: ShareVisibility;
  is_listed?: boolean;
  updated_at?: string;
  requirements: TemplateRequirement[];
  /** The configuration this installs, and what the permissions screen shows. */
  config: Partial<AgentConfig>;
}

/**
 * What publishing an agent *would* send, before anything is written.
 *
 * The point of previewing is that the author sees the whole payload: the
 * allow-listed config, and the requirements their row ids became — labelled
 * with those rows' own names, which is a fact about their account and is
 * therefore theirs to rewrite before confirming.
 */
export interface SharePreview {
  published: boolean;
  slug: string | null;
  visibility: ShareVisibility;
  is_listed: boolean;
  version: number;
  install_count: number;
  tagline: string;
  description: string;
  requirements: Omit<TemplateRequirement, 'candidates'>[];
  config: Partial<AgentConfig>;
}

export interface PublishInput {
  tagline: string;
  description?: string;
  visibility?: ShareVisibility;
  /** Reworded labels only — the server ignores any attempt to change a kind. */
  requirements?: { key: string; label: string; why: string; optional?: boolean }[];
}

/** Requirement key -> the id the installer chose for it. */
export type RequirementChoices = Record<string, number>;

/**
 * A publicly shared agent, as somebody with no account sees it.
 *
 * A narrower shape than `AgentTemplate` on purpose, mirroring the server's own
 * narrower projection: there is no signed-in caller, so there are no
 * `candidates` to fill a picker with and no `is_mine` to compute. What is kept
 * is what a visitor needs to decide whether to sign up — what it does, what it
 * would be able to reach, and what they would have to supply.
 */
export interface PublicAgent {
  slug: string;
  source: 'community';
  name: string;
  tagline: string;
  description: string;
  icon: string;
  tags: string[];
  author: string;
  install_count: number;
  version: number;
  updated_at: string;
  requirements: Omit<TemplateRequirement, 'candidates'>[];
  config: Partial<AgentConfig>;
}

const templatesService = {
  list: async (params: { source?: TemplateSource; mine?: boolean } = {}): Promise<AgentTemplate[]> => {
    const { data } = await apiClient.get<AgentTemplate[]>('/orchestrator/templates/', {
      params: {
        ...(params.source ? { source: params.source } : {}),
        ...(params.mine ? { mine: 1 } : {}),
      },
    });
    return asArray<AgentTemplate>(data);
  },

  get: async (slug: string): Promise<AgentTemplate> => {
    const { data } = await apiClient.get<AgentTemplate>(`/orchestrator/templates/${slug}/`);
    return data;
  },

  /**
   * Install as one of your own agents.
   *
   * `timezone` only matters for a template that ships a schedule — the server
   * ignores it otherwise rather than storing a value nothing reads.
   */
  install: async (
    slug: string,
    body: { name?: string; requirements?: RequirementChoices; timezone?: string } = {},
  ): Promise<Agent> => {
    const { data } = await apiClient.post<Agent>(
      `/orchestrator/templates/${slug}/install/`,
      {
        ...body,
        timezone: body.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    );
    return data;
  },

  /** What publishing this agent would send. Writes nothing. */
  sharePreview: async (agentId: number | string): Promise<SharePreview> => {
    const { data } = await apiClient.get<SharePreview>(
      `/orchestrator/agents/${agentId}/share/`,
    );
    return data;
  },

  /** Publish or republish. Republishing keeps the slug and bumps the version. */
  publish: async (agentId: number | string, body: PublishInput): Promise<AgentTemplate> => {
    const { data } = await apiClient.post<AgentTemplate>(
      `/orchestrator/agents/${agentId}/share/`,
      body,
    );
    return data;
  },

  /**
   * Withdraw from the listing. Not a delete: copies people already installed
   * keep working, and relisting reuses the same link.
   */
  unpublish: async (agentId: number | string): Promise<void> => {
    await apiClient.delete(`/orchestrator/agents/${agentId}/share/`);
  },

  /**
   * One publicly shared agent, readable with no account.
   *
   * Every refusal is the same 404 by design — `link`-only, platform-only,
   * withdrawn and never-existed are indistinguishable from outside — so the
   * caller can only say "not found", never why.
   */
  publicGet: async (slug: string): Promise<PublicAgent> => {
    const { data } = await apiClient.get<PublicAgent>(
      `/orchestrator/public/agents/${slug}/`,
    );
    return data;
  },

  /** The public catalogue. Capped server-side; `truncated` says when it cut. */
  publicList: async (): Promise<{ results: PublicAgent[]; truncated: boolean }> => {
    const { data } = await apiClient.get<{ results: PublicAgent[]; truncated: boolean }>(
      '/orchestrator/public/agents/',
    );
    return data;
  },
};

export default templatesService;
