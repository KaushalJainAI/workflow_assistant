/**
 * Orchestrator Service
 *
 * HITL and the builder chat transcript.
 *
 * This used to also carry execution control (execute / status / pause / resume
 * / stop), deploy / undeploy, partial "test step" runs, AI authoring
 * (generate / modify / suggest), thought history and background tasks. Those
 * endpoints were deleted with the workflow canvas that was their only caller,
 * so the methods went with them rather than being left to 404. Agent execution
 * lives in `./agents`.
 */

import apiClient from './client';

// HITL types

/**
 * One button on a pending request.
 *
 * The backend writes these as `{label, value}` — the label is what the button
 * says, the value is what the response posts. This was typed `string[]` for as
 * long as the queue existed, which was survivable only because nothing wrote a
 * row: React refuses an object as a child, so the first genuine request took
 * the Inbox detail pane into the error boundary.
 *
 * A bare string is still accepted. Rows written before `open_request` existed
 * carry them, and `options` is a free JSON column that other writers may reach.
 */
export type HITLOption = { label: string; value: string } | string;

export interface HITLRequest {
  request_id: string;
  request_type: 'approval' | 'clarification' | 'error';
  node_id: string;
  title: string;
  message: string;
  options: HITLOption[];
  timeout_seconds: number;
  created_at: string;
  workflow_name?: string;
  /** What the agent is asking to do, rendered by the backend. See `describe_call`. */
  detail?: HITLDetail | null;
}

/**
 * A tool call as a person reads it, built once on the server so the Inbox,
 * the chat card and a notification all say the same thing.
 */
export interface HITLDetail {
  title: string;
  sentence: string;
  server: string;
  tool: string;
  fields: { label: string; value: string }[];
  raw?: Record<string, unknown>;
}

/** Normalise either stored shape into something renderable. */
export function hitlOption(option: HITLOption): { label: string; value: string } {
  if (typeof option === 'string') {
    return { label: option, value: option.toLowerCase() };
  }
  return {
    label: option?.label ?? String(option?.value ?? ''),
    value: option?.value ?? option?.label ?? '',
  };
}

export interface HITLResponse {
  action: 'approve' | 'reject' | 'respond' | 'retry' | 'skip' | 'stop';
  response?: string;
  data?: Record<string, unknown>;
}

// Chat types
export interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationResponse {
  conversation_id?: string;
  messages?: ChatMessage[];
  conversations?: { conversation_id: string }[];
}

export const orchestratorService = {
  // ========== HITL ==========

  /**
   * Get pending HITL requests
   */
  async getPendingHITL(): Promise<{ requests: HITLRequest[] }> {
    const response = await apiClient.get<{ requests: HITLRequest[] }>('/orchestrator/hitl/pending/');
    return response.data;
  },

  /**
   * Respond to HITL request
   */
  async respondToHITL(requestId: string, response: HITLResponse): Promise<void> {
    await apiClient.post(`/orchestrator/hitl/${requestId}/respond/`, response);
  },

  // ========== Chat ==========

  /**
   * Get conversation messages
   */
  async getMessages(conversationId?: string): Promise<ConversationResponse> {
    const url = conversationId
      ? `/orchestrator/chat/${conversationId}/`
      : '/orchestrator/chat/';
    const response = await apiClient.get<ConversationResponse>(url);
    return response.data;
  },

  /**
   * Delete conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    await apiClient.delete(`/orchestrator/chat/${conversationId}/`);
  },

  /**
   * Delete single message (supports rewinding)
   */
  async deleteMessage(conversationId: string, messageId: number, rewind: boolean = false, rewindAfter: boolean = false): Promise<void> {
    const url = rewindAfter
      ? `/orchestrator/chat/${conversationId}/messages/${messageId}/?rewind_after=true`
      : rewind
      ? `/orchestrator/chat/${conversationId}/messages/${messageId}/?rewind=true`
      : `/orchestrator/chat/${conversationId}/messages/${messageId}/`;
    await apiClient.delete(url);
  },

  /**
   * Send chat message
   */
  async sendMessage(
    content: string,
    workflowId?: number,
    conversationId?: string,
    provider?: string,
    model?: string,
    reference?: { message_id: number; snippet: string }
  ): Promise<{ conversation_id: string; user_message: ChatMessage; ai_response: ChatMessage }> {
    const response = await apiClient.post('/orchestrator/chat/', {
      content,
      workflow_id: workflowId,
      conversation_id: conversationId,
      provider,
      model,
      reference,
    });
    return response.data;
  },
};

export default orchestratorService;
