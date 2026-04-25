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
  type: 'node_started' | 'node_completed' | 'node_failed' | 'execution_completed' | 'execution_failed' | 'hitl_request' | 'progress' | 'execution.event' | 'notification' | 'new_request' | 'execution.state_sync' | 'connected' | 'hitl.request' | 'error';
  execution_id?: string;
  node_id?: string;
  data?: any;
  progress?: number;
  error?: string;
  timestamp?: string;
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
  const intentionalCloseRef = useRef(false);
  const connectRef = useRef<() => void>(() => {});

  // Hold the latest callbacks in refs so connect() doesn't reset on every parent
  // render (which would tear down and rebuild the socket on each render).
  const handlersRef = useRef({ onMessage, onConnect, onDisconnect, onError });
  useEffect(() => {
    handlersRef.current = { onMessage, onConnect, onDisconnect, onError };
  }, [onMessage, onConnect, onDisconnect, onError]);

  const connect = useCallback(() => {
    if (!executionId) return;

    const token = tokenManager.getAccessToken();
    if (!token) {
      console.error('No auth token for WebSocket');
      return;
    }

    // Close existing connection without triggering auto-reconnect
    if (wsRef.current) {
      intentionalCloseRef.current = true;
      wsRef.current.close();
    }
    intentionalCloseRef.current = false;

    setStatus('connecting');

    const ws = new WebSocket(`${WS_URL}/execution/${executionId}/?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      handlersRef.current.onConnect?.();
    };

    ws.onclose = () => {
      setStatus('disconnected');
      handlersRef.current.onDisconnect?.();

      // Skip reconnect if the close was caused by us (unmount, executionId change, manual disconnect)
      if (intentionalCloseRef.current) {
        intentionalCloseRef.current = false;
        return;
      }

      if (autoReconnect && executionId) {
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connectRef.current();
        }, reconnectInterval);
      }
    };

    ws.onerror = (event) => {
      setStatus('error');
      handlersRef.current.onError?.(event);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ExecutionEvent;
        setLastMessage(data);
        handlersRef.current.onMessage?.(data);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };
  }, [executionId, autoReconnect, reconnectInterval]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      intentionalCloseRef.current = true;
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
  const onRequestRef = useRef(onRequest);

  useEffect(() => {
    onRequestRef.current = onRequest;
  }, [onRequest]);

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
        if (data.type === 'hitl_request' || data.type === 'new_request') {
          onRequestRef.current(data);
        } else if (data.type === 'notification') {
          onRequestRef.current({
            type: 'notification' as any,
            execution_id: '',
            data: data.data,
            timestamp: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error('Failed to parse HITL message:', err);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

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
