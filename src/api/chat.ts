import apiClient from './client';

export interface ChatSession {
  id: string;
  title: string;
  llm_provider: string;
  llm_model: string;
  intent: string;
  system_prompt: string;
  created_at: string;
  updated_at: string;
  messages: ChatMessage[];
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
    llmModel?: string
  ): Promise<void> {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
    const token = localStorage.getItem('access_token');
    const body: Record<string, any> = { content };
    if (intent && intent !== 'normal') body.intent = intent;
    if (reference) body.reference = reference;
    if (llmProvider) body.llm_provider = llmProvider;
    if (llmModel) body.llm_model = llmModel;

    const response = await fetch(`${API_URL}/chat/sessions/${sessionId}/message/stream/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`Stream request failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Parse SSE lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6));
            onEvent(event);
          } catch {
            // skip malformed events
          }
        }
      }
    }

    // Process any remaining buffer
    if (buffer.startsWith('data: ')) {
      try {
        const event = JSON.parse(buffer.slice(6));
        onEvent(event);
      } catch {
        // skip
      }
    }
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

  async runWorkflow(sessionId: string, workflowId: number): Promise<any> {
    const response = await apiClient.post(`/chat/sessions/${sessionId}/run-workflow/`, { workflow_id: workflowId });
    return response.data;
  }
};
