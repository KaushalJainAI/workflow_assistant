/**
 * SSE Hook
 * 
 * Server-Sent Events for execution streaming.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { tokenManager } from '../api/client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface UseSSEOptions {
  onMessage?: (event: SSEEvent) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
}

export function useSSE(
  executionId: string | null,
  options: UseSSEOptions = {}
) {
  const { onMessage, onError, onOpen } = options;
  
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!executionId) return;

    const token = tokenManager.getAccessToken();
    if (!token) {
      console.error('No auth token for SSE');
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `${API_URL}/streaming/execution/${executionId}/?token=${token}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
      onOpen?.();
    };

    eventSource.onerror = (event) => {
      setConnected(false);
      onError?.(event);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SSEEvent;
        setEvents((prev) => [...prev, data]);
        onMessage?.(data);
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
      }
    };

    // Listen for specific event types
    eventSource.addEventListener('node_started', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      onMessage?.({ type: 'node_started', data, timestamp: new Date().toISOString() });
    });

    eventSource.addEventListener('node_completed', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      onMessage?.({ type: 'node_completed', data, timestamp: new Date().toISOString() });
    });

    eventSource.addEventListener('execution_completed', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      onMessage?.({ type: 'execution_completed', data, timestamp: new Date().toISOString() });
      eventSource.close();
    });
  }, [executionId, onMessage, onError, onOpen]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setConnected(false);
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  // Connect when executionId changes
  useEffect(() => {
    if (executionId) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [executionId, connect, disconnect]);

  return {
    connected,
    events,
    connect,
    disconnect,
    clearEvents,
  };
}

export default useSSE;
