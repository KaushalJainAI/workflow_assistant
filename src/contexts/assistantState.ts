/**
 * The assistant context object and the hook that reads it.
 *
 * Split from `AssistantContext.tsx` so that file exports the provider alone —
 * a module exporting both a component and a plain function opts out of fast
 * refresh, so editing the provider would remount the tree and close the open
 * assistant panel. Same reasoning as BrowserOS's `osState.ts` / `OSContext.tsx`.
 */
import { createContext, useContext } from 'react';

export interface AssistantContextType {
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

export const AssistantContext = createContext<AssistantContextType | undefined>(undefined);

export function useAssistant() {
  const context = useContext(AssistantContext);
  if (context === undefined) {
    throw new Error('useAssistant must be used within an AssistantProvider');
  }
  return context;
}
