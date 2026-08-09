import apiClient from './client';
import { streamSse } from './sse';

export interface ChatSession {
  id: string;
  title: string;
  llm_provider: string;
  llm_model: string;
  intent: string;
  system_prompt: string;
  /**
   * Gates *recall*, not retention. With this off the assistant answers from the
   * current message alone and loses the history-search tool — but nothing is
   * deleted, so switching it back on restores the full conversation.
   */
  memory_enabled: boolean;
  created_at: string;
  updated_at: string;
  messages: ChatMessage[];
}

/** A model-authored HTML snippet, already clamped server-side. */
export interface HtmlArtifact {
  title: string;
  html: string;
  width: number;
  height: number;
}

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: Record<string, any>;
  created_at: string;
}

export const chatService = {
  async getSessions(): Promise<ChatSession[]> {
    const response = await apiClient.get<any>('/chat/sessions/');
    return response.data.results ? response.data.results : response.data;
  },

  async getSession(id: string): Promise<ChatSession> {
    const response = await apiClient.get<ChatSession>(`/chat/sessions/${id}/`);
    return response.data;
  },

  async createSession(data: Partial<ChatSession>): Promise<ChatSession> {
    const response = await apiClient.post<ChatSession>('/chat/sessions/', data);
    return response.data;
  },

  async updateSession(id: string, data: Partial<ChatSession>): Promise<ChatSession> {
    const response = await apiClient.patch<ChatSession>(`/chat/sessions/${id}/`, data);
    return response.data;
  },

  async deleteSession(id: string): Promise<void> {
    await apiClient.delete(`/chat/sessions/${id}/`);
  },

  async deleteMessage(sessionId: string, messageId: number, rewind: boolean = false, rewindAfter: boolean = false): Promise<void> {
    const url = rewindAfter
      ? `/chat/sessions/${sessionId}/messages/${messageId}/?rewind_after=true`
      : rewind 
      ? `/chat/sessions/${sessionId}/messages/${messageId}/?rewind=true` 
      : `/chat/sessions/${sessionId}/messages/${messageId}/`;
    await apiClient.delete(url);
  },

  async sendMessage(
    sessionId: string, 
    content: string, 
    intent?: string,
    reference?: { message_id: number; snippet: string }
  ): Promise<{ user_message: ChatMessage; ai_response: ChatMessage }> {
    const body: Record<string, any> = { content };
    if (intent && intent !== 'normal') body.intent = intent;
    if (reference) body.reference = reference;
    const response = await apiClient.post(`/chat/sessions/${sessionId}/message/`, body);
    return response.data;
  },

  /**
   * Stream a message via SSE. Calls onEvent for each parsed event.
   * Event types: status, tool_call, sources_update, done, error
   */
  async sendMessageStream(
    sessionId: string,
    content: string,
    intent: string | undefined,
    onEvent: (event: { type: string; [key: string]: any }) => void,
    reference?: { message_id: number; snippet: string },
    signal?: AbortSignal,
    llmProvider?: string,
    llmModel?: string,
    approveToolCall?: string
  ): Promise<void> {
    const body: Record<string, unknown> = { content };
    if (intent && intent !== 'normal') body.intent = intent;
    if (reference) body.reference = reference;
    if (llmProvider) body.llm_provider = llmProvider;
    if (llmModel) body.llm_model = llmModel;
    if (approveToolCall) body.approve_tool_call = approveToolCall;

    return streamSse({
      path: `/chat/sessions/${sessionId}/message/stream/`,
      body,
      onEvent,
      signal,
    });
  },

  async uploadFile(sessionId: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post(`/chat/sessions/${sessionId}/upload/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // --- Guest (unauthenticated) chat ---
  guest: {
    async createSession(title: string = 'New Chat'): Promise<ChatSession> {
      const response = await apiClient.post<ChatSession>('/chat/guest/sessions/', { title });
      return response.data;
    },

    async getSession(id: string): Promise<ChatSession> {
      const response = await apiClient.get<ChatSession>(`/chat/guest/sessions/${id}/`);
      return response.data;
    },

    async sendMessageStream(
      sessionId: string,
      content: string,
      onEvent: (event: { type: string; [key: string]: any }) => void,
      signal?: AbortSignal,
    ): Promise<void> {
      return streamSse({
        path: `/chat/guest/sessions/${sessionId}/message/stream/`,
        body: { content },
        onEvent,
        signal,
        authenticated: false,
      });
    },
  },
};
