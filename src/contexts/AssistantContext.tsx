import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { credentialsService } from '../api';
import { useAIModels } from '../hooks/useAIModels';
import { tokenManager } from '../api/client';

interface AssistantContextType {
  isAssistantOpen: boolean;
  toggleAssistant: () => void;
  openAssistant: () => void;
  closeAssistant: () => void;
  llmProvider: string;
  setLlmProvider: (provider: string) => void;
  llmModel: string;
  setLlmModel: (model: string) => void;
  llmCredential: string | null;
  setLlmCredential: (credential: string | null) => void;
  syncLlmSettings: (provider: string, model: string, credential?: string | null) => Promise<void>;
  hasCredentials: boolean | null;
  refreshCredentials: () => Promise<void>;
}

const AssistantContext = createContext<AssistantContextType | undefined>(undefined);

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [llmProvider, setLlmProvider] = useState(localStorage.getItem('orchestrator_llm_provider') || 'openrouter');
  const [llmModel, setLlmModel] = useState(localStorage.getItem('orchestrator_llm_model') || 'google/gemini-2.0-flash-exp:free');
  const [llmCredential, setLlmCredential] = useState<string | null>(localStorage.getItem('orchestrator_llm_credential'));

  const toggleAssistant = () => setIsAssistantOpen(prev => !prev);
  const openAssistant = () => setIsAssistantOpen(true);
  const closeAssistant = () => setIsAssistantOpen(false);

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

  const updateLlmProvider = async (provider: string) => {
    setLlmProvider(provider);
    localStorage.setItem('orchestrator_llm_provider', provider);
    
    // Get default model for this provider
    const prov = dynamicProviders.find(p => p.slug === provider);
    const defaultModel = prov?.models[0]?.value;
    
    if (defaultModel) {
      setLlmModel(defaultModel);
      localStorage.setItem('orchestrator_llm_model', defaultModel);
    }
    
    // Sync with backend
    try {
      const { apiClient } = await import('../api');
      await apiClient.post('/orchestrator/settings/update/', {
        llm_provider: provider,
        ...(defaultModel ? { llm_model: defaultModel } : {}),
        llm_credential: llmCredential,
      });
    } catch (err) {
      console.warn('Failed to sync Assistant provider change to backend:', err);
    }
  };

  const updateLlmCredential = async (credential: string | null) => {
    setLlmCredential(credential);
    if (credential) {
      localStorage.setItem('orchestrator_llm_credential', credential);
    } else {
      localStorage.removeItem('orchestrator_llm_credential');
    }
    
    // Sync with backend
    try {
      const { apiClient } = await import('../api');
      await apiClient.post('/orchestrator/settings/update/', {
        llm_provider: llmProvider,
        llm_model: llmModel,
        llm_credential: credential,
      });
    } catch (err) {
      console.warn('Failed to sync Assistant credential change to backend:', err);
    }
  };

  const updateLlmModel = async (model: string) => {
    setLlmModel(model);
    localStorage.setItem('orchestrator_llm_model', model);
    
    // Sync with backend
    try {
      const { apiClient } = await import('../api');
      await apiClient.post('/orchestrator/settings/update/', {
        llm_provider: llmProvider,
        llm_model: model,
        llm_credential: llmCredential,
      });
    } catch (err) {
      console.warn('Failed to sync Assistant model change to backend:', err);
    }
  };

  const syncLlmSettings = async (provider: string, model: string, credential?: string | null) => {
    setLlmProvider(provider);
    setLlmModel(model);
    if (credential !== undefined) setLlmCredential(credential);
    
    localStorage.setItem('orchestrator_llm_provider', provider);
    localStorage.setItem('orchestrator_llm_model', model);
    if (credential !== undefined) {
      if (credential) localStorage.setItem('orchestrator_llm_credential', credential);
      else localStorage.removeItem('orchestrator_llm_credential');
    }
    
    // Sync with backend (single call)
    try {
      const { apiClient } = await import('../api');
      await apiClient.post('/orchestrator/settings/update/', {
        llm_provider: provider,
        llm_model: model,
        llm_credential: credential !== undefined ? credential : llmCredential,
      });
    } catch (err) {
      console.warn('Failed to sync Assistant settings batch update to backend:', err);
    }
  };

  return (
    <AssistantContext.Provider value={{ 
      isAssistantOpen, 
      toggleAssistant, 
      openAssistant, 
      closeAssistant,
      llmProvider,
      setLlmProvider: updateLlmProvider,
      llmModel,
      setLlmModel: updateLlmModel,
      llmCredential,
      setLlmCredential: updateLlmCredential,
      syncLlmSettings,
      hasCredentials,
      refreshCredentials: async () => { await refetch(); }
    }}>
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  const context = useContext(AssistantContext);
  if (context === undefined) {
    throw new Error('useAssistant must be used within an AssistantProvider');
  }
  return context;
}
