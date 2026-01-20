import { useState, useCallback } from 'react';

export type HITLRequestType = 'approval' | 'clarification' | 'error';

export interface HITLRequest {
  id: string;
  type: HITLRequestType;
  title?: string;
  description?: string;
  question?: string;
  options?: string[];
  data?: Record<string, any>;
  nodeName?: string;
  error?: string;
  onResolve: (response: any) => void;
  onReject: () => void;
}

export function useHumanInTheLoop() {
  const [activeRequest, setActiveRequest] = useState<HITLRequest | null>(null);
  const [requestQueue, setRequestQueue] = useState<HITLRequest[]>([]);

  const addToQueue = useCallback((request: Omit<HITLRequest, 'id'>) => {
    const newRequest = { ...request, id: crypto.randomUUID() };
    
    setActiveRequest((current) => {
      if (!current) return newRequest;
      setRequestQueue((prev) => [...prev, newRequest]);
      return current;
    });
  }, []);

  const handleResolve = useCallback((response: any) => {
    if (activeRequest) {
      activeRequest.onResolve(response);
      processNext();
    }
  }, [activeRequest]);

  const handleReject = useCallback(() => {
    if (activeRequest) {
      activeRequest.onReject();
      processNext();
    }
  }, [activeRequest]);

  const processNext = useCallback(() => {
    setRequestQueue((prev) => {
      const next = prev[0];
      const remaining = prev.slice(1);
      setActiveRequest(next || null);
      return remaining;
    });
  }, []);

  const requestApproval = useCallback((title: string, description: string, data?: Record<string, any>): Promise<boolean> => {
    return new Promise((resolve) => {
      addToQueue({
        type: 'approval',
        title,
        description,
        data,
        onResolve: () => resolve(true),
        onReject: () => resolve(false),
      });
    });
  }, [addToQueue]);

  const requestClarification = useCallback((question: string, options?: string[]): Promise<string> => {
    return new Promise((resolve, reject) => {
      addToQueue({
        type: 'clarification',
        question,
        options,
        onResolve: (response) => resolve(response),
        onReject: () => reject(new Error('Clarification cancelled')),
      });
    });
  }, [addToQueue]);

  const reportError = useCallback((error: string, nodeName: string): Promise<'retry' | 'skip' | 'stop'> => {
    return new Promise((resolve) => {
      addToQueue({
        type: 'error',
        error,
        nodeName,
        onResolve: (action) => resolve(action),
        onReject: () => resolve('stop'),
      });
    });
  }, [addToQueue]);

  return {
    activeRequest,
    requestApproval,
    requestClarification,
    reportError,
    handleResolve,
    handleReject,
    requestQueue,
  };
}
