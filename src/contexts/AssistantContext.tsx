import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { credentialsService } from '../api';
import { useAIModels } from '../hooks/useAIModels';
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from '../hooks/useChatModelSelection';
import { useAuth } from './authState';
import { tokenManager } from '../api/client';

import { AssistantContext } from './assistantState';

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  // **Inherit the account default, then diverge.** A stored local choice wins;
  // with none, this falls back to the profile's model (the Settings page), and
  // only to the shipped constants if the profile has not loaded or says
  // nothing. That ordering is the whole rule: the account default seeds this
  // place, and the moment someone chooses here it is independent for good.
  //
  // What it deliberately no longer does is write *back* to the profile.
  // `updateLlmProvider` / `updateLlmModel` / `syncLlmSettings` each used to
  // POST `/orchestrator/settings/update/`, which writes
  // `UserProfile.llm_provider` and `llm_model` — so choosing a model here
  // silently rewrote the account default that Settings edits, and every place
  // seeded from it. Two surfaces writing one row is not two settings.
  // The credential is still synced, because that genuinely is account-level:
  // it says which stored key to use, not which model this surface prefers.
  const { user } = useAuth();
  const [llmProvider, setLlmProvider] = useState(
    () => localStorage.getItem('orchestrator_llm_provider') || '',
  );
  const [llmModel, setLlmModel] = useState(
    () => localStorage.getItem('orchestrator_llm_model') || '',
  );
  // Blank means the model's own default, so `??` rather than `||` — see
  // `useEffortSelection`, where the same distinction is load-bearing.
  const [llmEffort, setLlmEffort] = useState(
    () => localStorage.getItem('orchestrator_llm_effort') ?? '',
  );

  // Derived, never written into state: an effect that copied the profile in
  // would race the profile load and could overwrite a local choice made before
  // it landed. Falling back at read time cannot.
  const effectiveProvider = llmProvider || user?.llm_provider || DEFAULT_PROVIDER;
  const effectiveModel = llmModel || user?.llm_model || DEFAULT_MODEL;
  const [llmCredential, setLlmCredential] = useState<string | null>(localStorage.getItem('orchestrator_llm_credential'));

  // Every function on the context value is memoised. They are all listed in the
  // `useMemo` at the bottom, so a fresh identity per render made that memo
  // recompute every render — which meant the context value changed identity
  // every render, and *every consumer of this provider re-rendered on every
  // render of it*. A `useMemo` whose dependencies are rebuilt each time is not
  // a memo, it is overhead.
  const toggleAssistant = useCallback(() => setIsAssistantOpen(prev => !prev), []);
  const openAssistant = useCallback(() => setIsAssistantOpen(true), []);
  const closeAssistant = useCallback(() => setIsAssistantOpen(false), []);

  const { providers: dynamicProviders, isLoading: isModelsLoading } = useAIModels();

  // Validate and sync settings once dynamic providers load
  useEffect(() => {
    if (!isModelsLoading && dynamicProviders.length > 0) {
      const currentProvider = dynamicProviders.find(p => p.slug === llmProvider);
      if (currentProvider) {
        // If the current model isn't in the provider's list, reset to default
        const modelExists = currentProvider.models.some(m => m.value === llmModel);
        if (!modelExists && currentProvider.models.length > 0) {
          const defaultModel = currentProvider.models[0].value;
          setLlmModel(defaultModel);
          localStorage.setItem('orchestrator_llm_model', defaultModel);
        }
      }
    }
  }, [dynamicProviders, isModelsLoading, llmProvider, llmModel]);

  const { data: hasCredentials = null, refetch } = useQuery({
    queryKey: ['credentials', llmProvider],
    enabled: tokenManager.isAuthenticated(),
    queryFn: async () => {
      try {
        if (llmProvider === 'ollama') {
          return true;
        }
        
        const { credentials } = await credentialsService.list();
        const providerSlug = llmProvider.toLowerCase();
        const hasValid = credentials.some(c => 
          c.is_valid && 
          (String(c.credential_type_display).toLowerCase().includes(providerSlug) || 
           String(c.name).toLowerCase().includes(providerSlug) ||
           (c.credential_type && String(c.credential_type).toLowerCase().includes(providerSlug)))
        );
        
        return hasValid;
      } catch (err) {
        console.error('Failed to check credentials:', err);
        // Fallback
        const prov = dynamicProviders.find(p => p.slug === llmProvider);
        if (prov) {
          return prov.has_credentials;
        } else {
          return false;
        }
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  // Local only. Changing the provider here must not move the account default —
  // see the note above the state declarations.
  const updateLlmProvider = useCallback((provider: string) => {
    setLlmProvider(provider);
    localStorage.setItem('orchestrator_llm_provider', provider);

    // The old model almost certainly belongs to the old provider, so both move
    // together rather than leaving a pair that cannot be routed.
    const defaultModel = dynamicProviders.find(p => p.slug === provider)?.models[0]?.value;
    if (defaultModel) {
      setLlmModel(defaultModel);
      localStorage.setItem('orchestrator_llm_model', defaultModel);
    }
  }, [dynamicProviders]);

  const updateLlmCredential = useCallback(async (credential: string | null) => {
    setLlmCredential(credential);
    if (credential) {
      localStorage.setItem('orchestrator_llm_credential', credential);
    } else {
      localStorage.removeItem('orchestrator_llm_credential');
    }
    
    // Credential only. The endpoint writes each field it is given, so sending
    // the provider/model alongside is what used to drag the account default
    // along with a credential change.
    try {
      const { apiClient } = await import('../api');
      await apiClient.post('/orchestrator/settings/update/', {
        llm_credential: credential ?? '',
      });
    } catch (err) {
      console.warn('Failed to sync Assistant credential change to backend:', err);
    }
  }, []);

  const updateLlmModel = useCallback((model: string) => {
    setLlmModel(model);
    localStorage.setItem('orchestrator_llm_model', model);
  }, []);

  const updateLlmEffort = useCallback((level: string) => {
    setLlmEffort(level);
    // `''` is a real choice — the model's own default — so it is stored as an
    // empty string rather than removed, which would read as "never chose" and
    // fall back to the account default on the next load.
    localStorage.setItem('orchestrator_llm_effort', level);
  }, []);

  const syncLlmSettings = useCallback(async (
    provider: string, model: string, credential?: string | null,
  ) => {
    setLlmProvider(provider);
    setLlmModel(model);
    if (credential !== undefined) setLlmCredential(credential);
    
    localStorage.setItem('orchestrator_llm_provider', provider);
    localStorage.setItem('orchestrator_llm_model', model);
    if (credential !== undefined) {
      if (credential) localStorage.setItem('orchestrator_llm_credential', credential);
      else localStorage.removeItem('orchestrator_llm_credential');
    }
    
    // Only the credential reaches the account; provider and model stay local.
    if (credential !== undefined) {
      try {
        const { apiClient } = await import('../api');
        await apiClient.post('/orchestrator/settings/update/', {
          llm_credential: credential ?? '',
        });
      } catch (err) {
        console.warn('Failed to sync Assistant credential to backend:', err);
      }
    }
  }, []);

  const refreshCredentials = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // The object literal was rebuilt on every render of this provider, so every
  // consumer re-rendered with it — including the whole chat panel, on a
  // provider that also owns model-selection state that changes while typing.
  const value = useMemo(
    () => ({
      isAssistantOpen,
      toggleAssistant,
      openAssistant,
      closeAssistant,
      // The *effective* pair, so a consumer never has to know that a blank
      // local choice means "use the account default".
      llmProvider: effectiveProvider,
      setLlmProvider: updateLlmProvider,
      llmModel: effectiveModel,
      setLlmModel: updateLlmModel,
      llmEffort,
      setLlmEffort: updateLlmEffort,
      llmCredential,
      setLlmCredential: updateLlmCredential,
      syncLlmSettings,
      hasCredentials,
      refreshCredentials,
    }),
    [isAssistantOpen, toggleAssistant, openAssistant, closeAssistant,
     effectiveProvider, updateLlmProvider, effectiveModel, updateLlmModel,
     llmEffort, updateLlmEffort, llmCredential,
     updateLlmCredential, syncLlmSettings, hasCredentials, refreshCredentials],
  );

  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  );
}

