export type NodeType = 'trigger' | 'action' | 'router' | 'transform';

export interface NodeOption {
  name: string;
  value: string;
}

export interface NodeProperty {
  name: string;
  displayName: string;
  type: 'string' | 'number' | 'boolean' | 'options' | 'json' | 'code' | 'credential';
  default?: unknown;
  placeholder?: string;
  description?: string;
  required?: boolean;
  options?: NodeOption[]; // For 'options' type
  displayOptions?: {
    show?: Record<string, unknown>;
    hide?: Record<string, unknown>;
  };
}

export interface PortDefinition {
  type: 'main';
  index: number;
}

export interface NodeDefinition {
  type: string;        // e.g., "n8n-nodes-base.httpRequest"
  displayName: string; // e.g., "HTTP Request"
  icon: string;        // Emoji or Lucide icon name
  group: NodeType[];
  version: number;
  description: string;
  color?: string;      // The brand color
  
  defaults: {
    name: string;
    color: string;
  };

  inputs: string[];    // e.g., ['main']
  outputs: string[];   // e.g., ['main', 'main'] for IF

  properties: NodeProperty[]; // The form schema
}

export interface NodeExecutionData {
  executionTime: number;
  status: 'pending' | 'running' | 'success' | 'error';
  data: unknown;
  error?: unknown;
}

