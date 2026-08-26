import { useCallback, useState } from 'react';
import { useSocket } from '../lib/websocket';
import { imagineAgent, type ImagineChatResponse, type ImagineGeneration, type ImagineIntent, type ImagineMessage } from '../api/imagineAgent';

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
}

export function useImagineAgent() {
  const [state, setState] = useState<State>({
    conversationId: null,
    items: [],
    pendingIntent: null,
    isSending: false,
  });

  /** Folds a terminal generation event into whichever chat item owns it. */
  const applyGenerationEvent = useCallback((data: any) => {
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
  }, []);

  const handleMessage = useCallback((msg: any) => {
    if (msg.type === 'generation.completed' || msg.type === 'generation.failed') {
      applyGenerationEvent(msg.data || {});
    }
  }, [applyGenerationEvent]);

  const { isConnected } = useSocket({
    path: '/imagine-agent/',
    onMessage: handleMessage,
  });

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

  const sendMessage = useCallback(async (message: string, model?: string | null) => {
    setState(s => ({ ...s, isSending: true }));
    try {
      const res = await imagineAgent.chat(message, state.conversationId ?? undefined, model);
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
    isConnected,
    sendMessage,
    resume,
    loadConversation,
    reset,
  };
}
