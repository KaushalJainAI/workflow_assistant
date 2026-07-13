import { createContext, useContext } from 'react';

interface CanvasAgentContextType {
  sendInstruction: (instruction: string) => Promise<{ message: string; actionsApplied: number } | null>;
  isConnected: boolean;
  isProcessing: boolean;
}

const CanvasAgentContext = createContext<CanvasAgentContextType | null>(null);

export const CanvasAgentProvider = CanvasAgentContext.Provider;

export function useCanvasAgentContext() {
  return useContext(CanvasAgentContext);
}
