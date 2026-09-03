/**
 * Agent templates — the gallery you install a starting point from.
 *
 * The catalogue is code on the backend (`agents/gallery.py`), not rows, so
 * these are reads against a fixed list. The only write is `install`, which
 * creates an ordinary agent: what comes back is an `Agent`, and from that
 * moment the template has no further hold over it.
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

export interface AgentTemplate {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  tags: string[];
  requirements: TemplateRequirement[];
  /** The configuration this installs, and what the permissions screen shows. */
  config: Partial<AgentConfig>;
}

/** Requirement key -> the id the installer chose for it. */
export type RequirementChoices = Record<string, number>;

const templatesService = {
  list: async (): Promise<AgentTemplate[]> => {
    const { data } = await apiClient.get<AgentTemplate[]>('/orchestrator/templates/');
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
};

export default templatesService;
