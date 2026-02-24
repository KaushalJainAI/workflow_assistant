import apiClient from './client';

export interface ChatSession {
  id: string;
  title: string;
  llm_provider: string;
  llm_model: string;
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
    const response = await apiClient.get<ChatSession[]>('/chat/sessions/');
    return response.data;
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

  async sendMessage(sessionId: string, content: string): Promise<{ user_message: ChatMessage; ai_response: ChatMessage }> {
    const response = await apiClient.post(`/chat/sessions/${sessionId}/message/`, { content });
    return response.data;
  }
};
