/**
 * WebSocket Hook
 * 
 * Real-time connection for execution updates and HITL.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { tokenManager } from '../api/client';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface ExecutionEvent {
  type: 'node_started' | 'node_completed' | 'node_failed' | 'execution_completed' | 'execution_failed' | 'hitl_request' | 'progress';
  execution_id: string;
  node_id?: string;
  data?: Record<string, unknown>;
  progress?: number;
  error?: string;
  timestamp: string;
}

export interface UseWebSocketOptions {
  onMessage?: (event: ExecutionEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

export function useWebSocket(
  executionId: string | null,
  options: UseWebSocketOptions = {}
) {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    autoReconnect = true,
    reconnectInterval = 3000,
  } = options;

  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<ExecutionEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  // Use ref to hold the connect function for self-reference in onclose
  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    if (!executionId) return;

    const token = tokenManager.getAccessToken();
    if (!token) {
      console.error('No auth token for WebSocket');
      return;
    }

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    setStatus('connecting');

    const ws = new WebSocket(`${WS_URL}/execution/${executionId}/?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      onConnect?.();
    };

    ws.onclose = () => {
      setStatus('disconnected');
      onDisconnect?.();

      // Auto-reconnect using ref to avoid accessing connect before declaration
      if (autoReconnect && executionId) {
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connectRef.current();
        }, reconnectInterval);
      }
    };

    ws.onerror = (event) => {
      setStatus('error');
      onError?.(event);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ExecutionEvent;
        setLastMessage(data);
        onMessage?.(data);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };
  }, [executionId, onMessage, onConnect, onDisconnect, onError, autoReconnect, reconnectInterval]);

  // Keep the ref updated with the latest connect function
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  const send = useCallback((data: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
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
    status,
    lastMessage,
    connect,
    disconnect,
    send,
    isConnected: status === 'connected',
  };
}

/**
 * HITL WebSocket Hook
 * 
 * Dedicated connection for HITL notifications.
 */
export function useHITLWebSocket(
  onRequest: (request: ExecutionEvent) => void
) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const token = tokenManager.getAccessToken();
    if (!token) return;

    const ws = new WebSocket(`${WS_URL}/hitl/?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'hitl_request') {
          onRequest(data);
        }
      } catch (err) {
        console.error('Failed to parse HITL message:', err);
      }
    };

    return () => {
      ws.close();
    };
  }, [onRequest]);

  const respond = useCallback((requestId: string, response: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'hitl_response',
        request_id: requestId,
        response,
      }));
    }
  }, []);

  return { connected, respond };
}

export default useWebSocket;
