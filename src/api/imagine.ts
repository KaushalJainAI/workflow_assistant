/**
 * Typed client for the Imagine form/REST surface.
 *
 * The page previously called `apiClient` inline and typed the capability
 * response as `any`, which is how a backend that returned three empty arrays
 * went unnoticed: `capabilities[mode]` was `undefined`, `.map` was never
 * reached, and the model picker rendered nothing without a single error.
 * `ModelCapability` is now the contract, and `hasModels` is the explicit check
 * a caller makes before assuming the catalog arrived.
 */
import apiClient from './client';

export type MediaKind = 'image' | 'video' | 'audio';
export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** One model as served by `GET /imagine/capabilities/`. */
export interface ModelCapability {
  id: string;
  name: string;
  provider: string;
  description: string;
  /** Image: `1K`/`2K`/`4K`. Video: `480p`/`720p`/`1080p`. Absent for audio. */
  resolutions?: string[];
  aspect_ratios?: string[];
  /** Video only — the exact clip lengths this model accepts, in seconds. */
  durations?: number[];
  /** Image only, and only where the model exposes a quality switch. */
  qualities?: string[];
  max_batch?: number;
  supports_seed?: boolean;
  supports_references?: boolean;
  /** Video only — whether the model can score the clip with audio. */
  supports_audio?: boolean;
  /** Audio only. Empty means the model takes a free-form voice id. */
  voices?: string[];
  supports_speed?: boolean;
}

export interface Capabilities {
  image: ModelCapability[];
  video: ModelCapability[];
  audio: ModelCapability[];
  /** Backend's preferred starting model per modality. */
  defaults: Partial<Record<MediaKind, string | null>>;
  /** Ids to surface above the fold in the picker. */
  recommended: Partial<Record<MediaKind, string[]>>;
}

export interface Generation {
  id: number;
  type: MediaKind;
  prompt: string;
  negative_prompt: string | null;
  model: string;
  resolution: string | null;
  aspect_ratio: string | null;
  duration: string | null;
  seed: number | null;
  quality: string | null;
  output_format: string | null;
  generate_audio: boolean | null;
  voice: string | null;
  speed: number | null;
  output_url: string | null;
  status: GenerationStatus;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Only the fields a client is allowed to set — `metadata` is server-owned. */
export interface GenerationRequest {
  type: MediaKind;
  prompt: string;
  model: string;
  negative_prompt?: string;
  resolution?: string;
  aspect_ratio?: string;
  duration?: string;
  seed?: number;
  quality?: string;
  output_format?: string;
  generate_audio?: boolean;
  voice?: string;
  speed?: number;
}

export const EMPTY_CAPABILITIES: Capabilities = {
  image: [],
  video: [],
  audio: [],
  defaults: {},
  recommended: {},
};

/** True when at least one modality has models — i.e. the catalog really loaded. */
export function hasModels(caps: Capabilities | null): boolean {
  if (!caps) return false;
  return caps.image.length > 0 || caps.video.length > 0 || caps.audio.length > 0;
}

export function findModel(
  caps: Capabilities | null,
  kind: MediaKind,
  id: string | null,
): ModelCapability | null {
  if (!caps || !id) return null;
  return caps[kind].find(m => m.id === id) ?? null;
}

/**
 * Strips keys the user left blank.
 *
 * The backend drops nulls too, but sending them at all defeats a model's own
 * defaults — and models disagree about which resolutions and ratios they take,
 * so "unset" has to survive the whole way down rather than being filled in
 * with a guess at any layer.
 */
export function pruneRequest(req: GenerationRequest): GenerationRequest {
  const out = { ...req };
  (Object.keys(out) as Array<keyof GenerationRequest>).forEach(key => {
    const value = out[key];
    if (value === undefined || value === null || value === '') delete out[key];
  });
  return out;
}

export const imagineApi = {
  capabilities: (opts?: { refresh?: boolean }) =>
    apiClient
      .get<Capabilities>('/imagine/capabilities/', {
        params: opts?.refresh ? { refresh: 1 } : undefined,
      })
      .then(r => ({ ...EMPTY_CAPABILITIES, ...r.data })),

  list: () =>
    apiClient
      .get<{ results?: Generation[] } | Generation[]>('/imagine/')
      .then(r => (Array.isArray(r.data) ? r.data : r.data.results ?? [])),

  get: (id: number) => apiClient.get<Generation>(`/imagine/${id}/`).then(r => r.data),

  create: (req: GenerationRequest) =>
    apiClient.post<Generation>('/imagine/', pruneRequest(req)).then(r => r.data),

  remove: (id: number) => apiClient.delete(`/imagine/${id}/`).then(() => undefined),
};
