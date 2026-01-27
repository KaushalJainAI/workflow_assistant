/**
 * Orchestrator Service
 * 
 * Execution control, HITL, and AI features.
 */

import apiClient from './client';

// Execution types
export interface ExecutionStatus {
  execution_id: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  current_node: string | null;
  progress: number;
  started_at: string;
  completed_at: string | null;
  error: string | null;
  results: Record<string, unknown>;
}

export interface ExecuteWorkflowResponse {
  execution_id: string;
  status: string;
  message: string;
}

// HITL types
export interface HITLRequest {
  request_id: string;
  request_type: 'approval' | 'clarification' | 'error';
  node_id: string;
  title: string;
  message: string;
  options: string[];
  timeout_seconds: number;
  created_at: string;
  workflow_name?: string;
}

export interface HITLResponse {
  action: 'approve' | 'reject' | 'respond' | 'retry' | 'skip' | 'stop';
  response?: string;
  data?: Record<string, unknown>;
}

// AI Generation types
export interface GenerateWorkflowRequest {
  description: string;
  credential_id?: string;
  save?: boolean;
  conversation_id?: string;
}

export interface GenerateWorkflowResponse {
  name: string;
  description: string;
  nodes: unknown[];
  edges: unknown[];
  saved?: boolean;
  workflow_id?: number;
  error?: string;
  conversation_id?: string;
}

// Chat types
export interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface ConversationResponse {
  conversation_id?: string;
  messages?: ChatMessage[];
  conversations?: { conversation_id: string }[];
}

export interface ThoughtEntry {
  node_id: string;
  thought: string;
  reasoning: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export const orchestratorService = {
  // ========== Execution Control ==========
  
  /**
   * Execute a workflow
   */
  async executeWorkflow(workflowId: number): Promise<ExecuteWorkflowResponse> {
    const response = await apiClient.post<ExecuteWorkflowResponse>(
      `/orchestrator/workflows/${workflowId}/execute/`
    );
    return response.data;
  },

  /**
   * Get execution status
   */
  async getExecutionStatus(executionId: string): Promise<ExecutionStatus> {
    const response = await apiClient.get<ExecutionStatus>(
      `/orchestrator/executions/${executionId}/status/`
    );
    return response.data;
  },

  /**
   * Pause execution
   */
  async pauseExecution(executionId: string): Promise<void> {
    await apiClient.post(`/orchestrator/executions/${executionId}/pause/`);
  },

  /**
   * Resume execution
   */
  async resumeExecution(executionId: string): Promise<void> {
    await apiClient.post(`/orchestrator/executions/${executionId}/resume/`);
  },

  /**
   * Stop execution
   */
  async stopExecution(executionId: string): Promise<void> {
    await apiClient.post(`/orchestrator/executions/${executionId}/stop/`);
  },

  /**
   * Execute partial workflow (single node)
   */
  async executePartial(workflowId: number | null, nodeId: string, inputs: Record<string, unknown>, config: Record<string, unknown> | null): Promise<Record<string, unknown>> {
    const response = await apiClient.post('/orchestrator/workflows/execute_partial/', {
      workflow_id: workflowId,
      node_id: nodeId,
      inputs,
      config
    });
    return response.data;
  },

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

  // ========== AI Features ==========

  /**
   * Generate workflow from description
   */
  async generateWorkflow(request: GenerateWorkflowRequest): Promise<GenerateWorkflowResponse> {
    const response = await apiClient.post<GenerateWorkflowResponse>(
      '/orchestrator/ai/generate/',
      request
    );
    return response.data;
  },

  /**
   * Modify workflow with AI
   */
  /**
   * Modify workflow with AI
   */
  async modifyWorkflow(
    workflowId: number,
    modification: string,
    apply?: boolean,
    conversationId?: string
  ): Promise<GenerateWorkflowResponse> {
    const response = await apiClient.post<GenerateWorkflowResponse>(
      `/orchestrator/workflows/${workflowId}/ai/modify/`,
      { modification, apply, conversation_id: conversationId }
    );
    return response.data;
  },

  /**
   * Get AI suggestions
   */
  async getSuggestions(workflowId: number): Promise<{ suggestions: string[] }> {
    const response = await apiClient.get<{ suggestions: string[] }>(
      `/orchestrator/workflows/${workflowId}/ai/suggest/`
    );
    return response.data;
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
   * Send chat message
   */
  async sendMessage(
    content: string,
    workflowId?: number,
    conversationId?: string
  ): Promise<{ conversation_id: string; user_message: ChatMessage; ai_response: ChatMessage }> {
    const response = await apiClient.post('/orchestrator/chat/', {
      content,
      workflow_id: workflowId,
      conversation_id: conversationId,
    });
    return response.data;
  },

  /**
   * Send context-aware message
   */
  async sendContextAwareMessage(
    message: string,
    workflowId?: number,
    nodeId?: string,
    conversationId?: string
  ): Promise<{ response: string; tokens_used: number }> {
    const response = await apiClient.post('/orchestrator/chat/context-aware/', {
      message,
      workflow_id: workflowId,
      node_id: nodeId,
      conversation_id: conversationId,
    });
    return response.data;
  },

  // ========== Thought History ==========

  /**
   * Get thought history for execution
   */
  async getThoughtHistory(executionId: string): Promise<{
    thoughts: ThoughtEntry[];
    summary: string;
  }> {
    const response = await apiClient.get(`/orchestrator/executions/${executionId}/thoughts/`);
    return response.data;
  },
};

export default orchestratorService;
