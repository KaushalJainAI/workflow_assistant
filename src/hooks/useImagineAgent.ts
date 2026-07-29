import { useCallback, useEffect, useRef, useState } from 'react';
import { tokenManager } from '../api/client';
import { imagineAgent, type ImagineChatResponse, type ImagineGeneration, type ImagineIntent, type ImagineMessage } from '../api/imagineAgent';

const WS_URL = import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

export interface ChatItem {
  key: string;
  role: 'user' | 'assistant';
  content: string;
  intent?: ImagineIntent;
  requiresHitl?: boolean;
  generation?: ImagineGeneration | null;
  pending?: boolean;
}

interface State {
  conversationId: number | null;
  items: ChatItem[];
  pendingIntent: ImagineIntent | null;
  isSending: boolean;
  isConnected: boolean;
}

export function useImagineAgent() {
  const [state, setState] = useState<State>({
    conversationId: null,
    items: [],
    pendingIntent: null,
    isSending: false,
    isConnected: false,
  });
  const wsRef = useRef<WebSocket | null>(null);
  const intentionalCloseRef = useRef(false);
  const reconnectAttempts = useRef(0);
  const maxReconnect = 5;

  const connect = useCallback(() => {
    const token = tokenManager.getAccessToken();
    if (!token) return;
    if (wsRef.current) {
      intentionalCloseRef.current = true;
      wsRef.current.close();
    }
    intentionalCloseRef.current = false;

    const ws = new WebSocket(`${WS_URL}/imagine-agent/?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setState(s => ({ ...s, isConnected: true }));
      reconnectAttempts.current = 0;
    };
    ws.onclose = () => {
      setState(s => ({ ...s, isConnected: false }));
      if (intentionalCloseRef.current) {
        intentionalCloseRef.current = false;
        return;
      }
      if (reconnectAttempts.current < maxReconnect) {
        reconnectAttempts.current += 1;
        const backoff = Math.min(1000 * 2 ** reconnectAttempts.current, 15000);
        setTimeout(connect, backoff);
      }
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const t = msg.type;
        const data = msg.data || {};
        if (t === 'generation.completed' || t === 'generation.failed') {
          setState(s => ({
            ...s,
            items: s.items.map(it =>
              it.generation && it.generation.id === data.generation_id
                ? {
                    ...it,
                    generation: {
                      ...it.generation,
                      status: data.status,
                      output_url: data.output_url ?? it.generation.output_url,
                      error_message: data.error ?? it.generation.error_message,
                    },
                    pending: false,
                  }
                : it
            ),
          }));
        }
      } catch {
        /* ignore */
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      intentionalCloseRef.current = true;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  const _applyResponse = useCallback((res: ImagineChatResponse, userMsg?: string) => {
    setState(s => {
      const next: ChatItem[] = [...s.items];
      if (userMsg) {
        next.push({ key: `u-${Date.now()}-${Math.random()}`, role: 'user', content: userMsg });
      }
      next.push({
        key: `a-${res.message_id}`,
        role: 'assistant',
        content: res.assistant_message,
        intent: res.intent_preview,
        requiresHitl: res.requires_hitl,
        generation: res.generation,
        pending: res.generation?.status === 'pending',
      });
      return {
        ...s,
        conversationId: res.conversation_id,
        items: next,
        pendingIntent: res.requires_hitl ? (res.intent_preview ?? null) : null,
        isSending: false,
      };
    });
  }, []);

  const sendMessage = useCallback(async (message: string) => {
    setState(s => ({ ...s, isSending: true }));
    try {
      const res = await imagineAgent.chat(message, state.conversationId ?? undefined);
      _applyResponse(res, message);
    } catch (e: any) {
      setState(s => ({
        ...s,
        isSending: false,
        items: [
          ...s.items,
          { key: `u-${Date.now()}`, role: 'user', content: message },
          { key: `e-${Date.now()}`, role: 'assistant', content: `Error: ${e?.message || e}` },
        ],
      }));
    }
  }, [state.conversationId, _applyResponse]);

  const resume = useCallback(async (decision: 'approve' | 'edit' | 'cancel', overrides?: Partial<ImagineIntent>) => {
    if (!state.conversationId) return;
    setState(s => ({ ...s, isSending: true }));
    try {
      const res = await imagineAgent.resume(state.conversationId, decision, overrides);
      _applyResponse(res);
    } catch (e: unknown) {
      // Clearing isSending without a word left a resume that failed looking
      // identical to one that succeeded and returned nothing.
      console.error('Imagine agent resume failed', e);
      setState(s => ({ ...s, isSending: false }));
    }
  }, [state.conversationId, _applyResponse]);

  const loadConversation = useCallback(async (id: number) => {
    const conv = await imagineAgent.getConversation(id);
    const items: ChatItem[] = (conv.messages || []).map((m: ImagineMessage) => ({
      key: `m-${m.id}`,
      role: m.role === 'system' ? 'assistant' : m.role,
      content: m.content,
      intent: m.intent ?? undefined,
      requiresHitl: m.requires_hitl,
      generation: m.generation,
      pending: m.generation?.status === 'pending',
    }));
    setState(s => ({
      ...s,
      conversationId: conv.id,
      items,
      pendingIntent: conv.status === 'awaiting_hitl' ? conv.pending_intent : null,
    }));
  }, []);

  const reset = useCallback(() => {
    setState(s => ({ ...s, conversationId: null, items: [], pendingIntent: null }));
  }, []);

  return {
    ...state,
    sendMessage,
    resume,
    loadConversation,
    reset,
  };
}
