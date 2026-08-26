/**
 * State for the Imagine form ("Advanced") view.
 *
 * Two jobs the page used to do badly:
 *
 * 1. **Parameters follow the model.** Every control's options come from the
 *    selected model's own advertised values, and switching model re-snaps them.
 *    The page previously offered one hardcoded option set to every model, so
 *    picking a 2K/4K-only model still showed a 1K button that failed at the
 *    provider.
 * 2. **Completion arrives over the socket.** Pending video jobs were tracked by
 *    a `setInterval` in an effect that depended on `results` and called
 *    `setResults` inside itself — rebuilding the timer on every tick — while
 *    the backend was already broadcasting `generation.completed` on
 *    `imagine_agent_{user_id}`. The socket is the primary signal now; a slow
 *    poll remains only as a backstop for a dropped connection.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  EMPTY_CAPABILITIES,
  findModel,
  hasModels,
  imagineApi,
  type Capabilities,
  type Generation,
  type GenerationRequest,
  type MediaKind,
  type ModelCapability,
} from '../api/imagine';
import { applyStyle, findStyle } from '../lib/imagineStyles';
import { useSocket } from '../lib/websocket';
import { usePersistedState } from './usePersistedState';

/** Poll interval for pending jobs when the socket is not connected. */
const FALLBACK_POLL_MS = 15000;

export interface GenerationParams {
  resolution?: string;
  aspectRatio?: string;
  duration?: number;
  quality?: string;
  voice?: string;
  speed: number;
  seed: string;
  negativePrompt: string;
  generateAudio: boolean;
}

const INITIAL_PARAMS: GenerationParams = {
  speed: 1.0,
  seed: '',
  negativePrompt: '',
  generateAudio: true,
};

/**
 * Keeps a chosen value only when the model still offers it.
 *
 * Returns undefined for an empty option list rather than inventing a value —
 * "this model exposes no such control" and "the user has not chosen yet" both
 * have to mean *send nothing*.
 */
function snap<T>(current: T | undefined, allowed: T[] | undefined): T | undefined {
  if (!allowed || allowed.length === 0) return undefined;
  return current !== undefined && allowed.includes(current) ? current : allowed[0];
}

export function useImagineStudio({ enabled = true }: { enabled?: boolean } = {}) {
  const [capabilities, setCapabilities] = useState<Capabilities>(EMPTY_CAPABILITIES);
  const [credentialMissing, setCredentialMissing] = useState<string | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [mode, setMode] = usePersistedState<MediaKind>('imagine.mode', 'image');
  const [prompt, setPrompt] = usePersistedState('imagine.prompt', '', { storage: 'session' });
  // Model choice is remembered per modality — switching to Video and back
  // should not silently reset a deliberate image-model choice.
  const [modelByKind, setModelByKind] = usePersistedState<Partial<Record<MediaKind, string>>>(
    'imagine.modelByKind',
    {},
  );
  const [params, setParams] = useState<GenerationParams>(INITIAL_PARAMS);
  // Style is a prompt modifier, not a provider parameter — it lives beside the
  // prompt rather than in `params`, which mirrors only what the API accepts.
  const [styleId, setStyleId] = usePersistedState('imagine.style', 'none');

  const [results, setResults] = useState<Generation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const model = modelByKind[mode] ?? '';
  const activeModel: ModelCapability | null = useMemo(
    () => findModel(capabilities, mode, model),
    [capabilities, mode, model],
  );

  const setModel = useCallback(
    (id: string) => setModelByKind(prev => ({ ...prev, [mode]: id })),
    [mode, setModelByKind],
  );

  // ── catalog ────────────────────────────────────────────────────────────────

  const loadCatalog = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    try {
      const caps = await imagineApi.capabilities({ refresh });
      setCapabilities(caps);
      setCredentialMissing(null);
      if (refresh) toast.success('Model catalog refreshed');
      return caps;
    } catch (err: unknown) {
      const response = (err as { response?: { status?: number; data?: { detail?: string } } })
        .response;
      if (response?.status === 400) {
        // The only 400 this endpoint returns is "no OpenRouter credential",
        // which is the user's to fix — surface it rather than logging it.
        setCredentialMissing(
          response.data?.detail ?? 'No OpenRouter credential configured for this account.',
        );
      } else {
        console.error('Failed to load the Imagine model catalog', err);
        toast.error('Could not load the model catalog.');
      }
      setCapabilities(EMPTY_CAPABILITIES);
      return null;
    } finally {
      setIsLoadingCatalog(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  // Adopt the backend's default whenever the current modality has no valid
  // selection — on first load, and after a refresh drops a retired model.
  useEffect(() => {
    if (!hasModels(capabilities)) return;
    const pool = capabilities[mode];
    if (pool.length === 0) return;
    if (pool.some(m => m.id === model)) return;
    setModel(capabilities.defaults[mode] ?? pool[0].id);
  }, [capabilities, mode, model, setModel]);

  // Re-snap every parameter to what the selected model actually accepts.
  useEffect(() => {
    if (!activeModel) return;
    setParams(prev => ({
      ...prev,
      resolution: snap(prev.resolution, activeModel.resolutions),
      aspectRatio: snap(prev.aspectRatio, activeModel.aspect_ratios),
      duration: mode === 'video' ? snap(prev.duration, activeModel.durations) : undefined,
      quality: mode === 'image' ? snap(prev.quality, activeModel.qualities) : undefined,
      voice: mode === 'audio' ? snap(prev.voice, activeModel.voices) : undefined,
    }));
  }, [activeModel, mode]);

  // ── history ────────────────────────────────────────────────────────────────

  useEffect(() => {
    imagineApi
      .list()
      .then(setResults)
      .catch(err => console.error('Failed to load Imagine history', err));
  }, []);

  const pendingIds = useMemo(
    () =>
      results.filter(r => r.status === 'pending' || r.status === 'processing').map(r => r.id),
    [results],
  );

  const applyUpdate = useCallback((updated: Generation) => {
    setResults(prev => prev.map(r => (r.id === updated.id ? updated : r)));
  }, []);

  const refreshPending = useCallback(async (ids: number[]) => {
    if (ids.length === 0) return;
    const settled = await Promise.allSettled(ids.map(id => imagineApi.get(id)));
    const fresh = settled
      .filter((s): s is PromiseFulfilledResult<Generation> => s.status === 'fulfilled')
      .map(s => s.value);
    if (fresh.length === 0) return;
    setResults(prev => prev.map(r => fresh.find(f => f.id === r.id) ?? r));
  }, []);

  // Socket is the primary completion signal. `enabled` keeps this closed while
  // the Agent view (which opens its own socket on the same path) is showing.
  const { isConnected } = useSocket<{ type: string; data?: { generation_id?: number } }>({
    path: '/imagine-agent/',
    enabled,
    onMessage: msg => {
      if (msg.type !== 'generation.completed' && msg.type !== 'generation.failed') return;
      const id = msg.data?.generation_id;
      if (typeof id !== 'number') return;
      imagineApi.get(id).then(applyUpdate).catch(() => {});
    },
  });

  // Backstop only: a job left pending with no socket to tell us it finished.
  // `pendingIds` is derived, so the effect re-runs when the set changes rather
  // than on every mutation of `results`.
  const pendingKey = pendingIds.join(',');
  const pendingRef = useRef(pendingIds);
  pendingRef.current = pendingIds;
  useEffect(() => {
    if (!enabled || isConnected || pendingKey === '') return;
    const timer = setInterval(() => void refreshPending(pendingRef.current), FALLBACK_POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, isConnected, pendingKey, refreshPending]);

  // ── actions ────────────────────────────────────────────────────────────────

  const generate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    if (credentialMissing) {
      toast.error('Add an OpenRouter credential first.');
      return;
    }
    if (!model) {
      toast.error(`No ${mode} model selected.`);
      return;
    }

    setIsGenerating(true);
    try {
      const seed = params.seed.trim() === '' ? undefined : Number(params.seed);
      // The style modifier is folded in here so the stored prompt is the exact
      // string the model saw — reproducing a result later needs that, and a
      // history entry that omits half the prompt cannot be reproduced.
      const styledPrompt =
        mode === 'audio' ? trimmed : applyStyle(trimmed, findStyle(mode, styleId));
      const request: GenerationRequest = {
        type: mode,
        prompt: styledPrompt,
        model,
        resolution: params.resolution,
        aspect_ratio: mode === 'audio' ? undefined : params.aspectRatio,
        negative_prompt: mode === 'audio' ? undefined : params.negativePrompt.trim() || undefined,
        seed: Number.isFinite(seed) ? seed : undefined,
        quality: mode === 'image' ? params.quality : undefined,
        duration: mode === 'video' && params.duration ? String(params.duration) : undefined,
        generate_audio:
          mode === 'video' && activeModel?.supports_audio ? params.generateAudio : undefined,
        voice: mode === 'audio' ? params.voice : undefined,
        speed: mode === 'audio' && activeModel?.supports_speed ? params.speed : undefined,
      };

      const created = await imagineApi.create(request);
      setResults(prev => [created, ...prev]);
      setPrompt('');

      if (created.status === 'completed') toast.success('Generation complete');
      else if (created.status === 'failed') toast.error(created.error_message ?? 'Generation failed');
      else toast.info('Generation started — this can take a minute.');
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, unknown> } }).response?.data;
      // DRF field errors arrive as {field: [msg]}; surface the message rather
      // than the generic axios string, which says only "status code 400".
      const fieldError = data && Object.values(data).flat().find(v => typeof v === 'string');
      toast.error(
        (data?.detail as string) ??
          (fieldError as string) ??
          (err as Error).message ??
          'Generation failed.',
      );
      console.error('Imagine generation failed', err);
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, credentialMissing, model, mode, params, activeModel, styleId, setPrompt]);

  const remove = useCallback(async (id: number) => {
    const snapshot = results;
    setResults(prev => prev.filter(r => r.id !== id));
    try {
      await imagineApi.remove(id);
    } catch (err) {
      // Put it back — a row that reappears is honest; one that vanishes from
      // the UI while still on the server is not.
      setResults(snapshot);
      toast.error('Could not delete that generation.');
      console.error('Imagine delete failed', err);
    }
  }, [results]);

  return {
    capabilities,
    credentialMissing,
    isLoadingCatalog,
    isRefreshing,
    refreshCatalog: () => loadCatalog(true),
    mode,
    setMode,
    prompt,
    setPrompt,
    model,
    setModel,
    activeModel,
    params,
    setParams,
    styleId,
    setStyleId,
    results,
    isGenerating,
    isConnected,
    generate,
    remove,
  };
}
