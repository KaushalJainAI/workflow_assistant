/**
 * WebSocket Hook
 *
 * Real-time connection for execution updates and HITL. Both hooks here are thin
 * adapters over `useSocket` — connection lifecycle, backoff, and the remount
 * race guard live in `lib/websocket.ts`.
 */

import { useCallback } from 'react';
import { useSocket, type SocketStatus } from '../lib/websocket';

export type WebSocketStatus = SocketStatus;

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
  /** First retry delay; subsequent retries back off exponentially to 60s. */
  reconnectInterval?: number;
}

export function useWebSocket(
  executionId: string | null,
  options: UseWebSocketOptions = {},
) {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    autoReconnect = true,
    reconnectInterval = 3000,
  } = options;

  const socket = useSocket<ExecutionEvent>({
    path: executionId ? `/execution/${executionId}/` : null,
    onMessage,
    onOpen: onConnect,
    onClose: onDisconnect,
    onError,
    reconnect: autoReconnect ? { baseMs: reconnectInterval } : false,
  });

  return {
    status: socket.status,
    lastMessage: socket.lastMessage,
    connect: socket.reconnectNow,
    disconnect: socket.disconnect,
    send: socket.send,
    isConnected: socket.isConnected,
  };
}

/**
 * HITL WebSocket Hook
 *
 * Dedicated connection for HITL notifications.
 */
export function useHITLWebSocket(onRequest: (request: ExecutionEvent) => void) {
  const handleMessage = useCallback(
    (data: any) => {
      if (data.type === 'hitl_request' || data.type === 'new_request') {
        onRequest(data);
      } else if (data.type === 'notification') {
        onRequest({
          type: 'notification',
          execution_id: '',
          data: data.data,
          timestamp: new Date().toISOString(),
        });
      }
    },
    [onRequest],
  );

  const { isConnected, send } = useSocket<ExecutionEvent>({
    path: '/hitl/',
    onMessage: handleMessage,
  });

  const respond = useCallback(
    (requestId: string, response: unknown) => {
      send({ type: 'hitl_response', request_id: requestId, response });
    },
    [send],
  );

  return { connected: isConnected, respond };
}

export default useWebSocket;
