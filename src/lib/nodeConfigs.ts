/**
 * Node Configuration Schema
 * 
 * This file defines the configuration fields for each node type.
 * Each node type has a set of fields that appear in the NodeConfigPanel.
 */

export interface FieldOption {
  value: string;
  label: string;
}

export interface ConfigField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'number' | 'code' | 'json' | 'password' | 'credential' | 'skills';
  placeholder?: string;
  defaultValue?: string | number | boolean;
  options?: FieldOption[];
  required?: boolean;
  description?: string;
  credentialType?: string; // For credential fields - filters by this type
}

export interface HandleDefinition {
  id: string;
  label?: string;
  color?: string;
}

export interface NodeConfig {
  nodeType: string;
  displayName: string;
  description: string;
  fields: ConfigField[];
  inputs?: HandleDefinition[];
  outputs?: HandleDefinition[];
  color?: string;
  icon?: string;
}

// Configuration schemas for each node type
export const nodeConfigs: Record<string, NodeConfig> = {
  // ============= TRIGGERS =============
  manual_trigger: {
    nodeType: 'manual_trigger',
    displayName: 'Manual Trigger',
    description: 'Start the workflow manually',
    icon: '▶️',
    color: '#ff6d5a',
    inputs: [],
    outputs: [{ id: 'output-0', label: '' }],
    fields: [
      {
        id: 'name',
        label: 'Trigger Name',
        type: 'text',
        placeholder: 'Enter trigger name',
        defaultValue: 'Manual Trigger',
      },
    ],
  },

  schedule_trigger: {
    nodeType: 'schedule_trigger',
    displayName: 'Schedule Trigger',
    description: 'Run workflow on a schedule',
    icon: '⏰',
    color: '#ff6d5a',
    inputs: [],
    outputs: [{ id: 'output-0', label: '' }],
    fields: [
      {
        id: 'mode',
        label: 'Trigger Mode',
        type: 'select',
        options: [
          { value: 'interval', label: 'Interval' },
          { value: 'cron', label: 'Cron Expression' },
        ],
        defaultValue: 'interval',
      },
      {
        id: 'interval',
        label: 'Interval (minutes)',
        type: 'number',
        placeholder: '5',
        defaultValue: 5,
        description: 'How often to run the workflow',
      },
      {
        id: 'cronExpression',
        label: 'Cron Expression',
        type: 'text',
        placeholder: '0 * * * *',
        description: 'Standard cron format',
      },
    ],
  },

  webhook: {
    nodeType: 'webhook',
    displayName: 'Webhook',
    description: 'Receive HTTP requests',
    inputs: [],
    outputs: [{ id: 'output-0', label: '' }],
    fields: [
      {
        id: 'httpMethod',
        label: 'HTTP Method',
        type: 'select',
        options: [
          { value: 'GET', label: 'GET' },
          { value: 'POST', label: 'POST' },
          { value: 'PUT', label: 'PUT' },
          { value: 'DELETE', label: 'DELETE' },
          { value: 'PATCH', label: 'PATCH' },
        ],
        defaultValue: 'POST',
      },
      {
        id: 'path',
        label: 'Webhook Path',
        type: 'text',
        placeholder: '/my-webhook',
        required: true,
      },
      {
        id: 'responseMode',
        label: 'Response Mode',
        type: 'select',
        options: [
          { value: 'onReceived', label: 'On Received' },
          { value: 'lastNode', label: 'Last Node' },
          { value: 'responseNode', label: 'Response Node' },
        ],
        defaultValue: 'onReceived',
      },
    ],
  },

  // ============= CORE NODES =============
  http_request: {
    nodeType: 'http_request',
    displayName: 'HTTP Request',
    description: 'Make HTTP requests to any API',
    inputs: [{ id: 'input-0' }],
    outputs: [{ id: 'output-0' }],
    fields: [
      {
        id: 'method',
        label: 'Method',
        type: 'select',
        options: [
          { value: 'GET', label: 'GET' },
          { value: 'POST', label: 'POST' },
          { value: 'PUT', label: 'PUT' },
          { value: 'DELETE', label: 'DELETE' },
          { value: 'PATCH', label: 'PATCH' },
          { value: 'HEAD', label: 'HEAD' },
        ],
        defaultValue: 'GET',
      },
      {
        id: 'url',
        label: 'URL',
        type: 'text',
        placeholder: 'https://api.example.com/data',
        required: true,
      },
      {
        id: 'authentication',
        label: 'Authentication',
        type: 'select',
        options: [
          { value: 'none', label: 'None' },
          { value: 'basicAuth', label: 'Basic Auth' },
          { value: 'headerAuth', label: 'Header Auth' },
          { value: 'oauth2', label: 'OAuth2' },
        ],
        defaultValue: 'none',
      },
      {
        id: 'headers',
        label: 'Headers',
        type: 'json',
        placeholder: '{"Content-Type": "application/json"}',
        description: 'Request headers in JSON format',
      },
      {
        id: 'body',
        label: 'Body',
        type: 'json',
        placeholder: '{"key": "value"}',
        description: 'Request body (for POST, PUT, PATCH)',
      },
      {
        id: 'timeout',
        label: 'Timeout (ms)',
        type: 'number',
        defaultValue: 10000,
        description: 'Request timeout in milliseconds',
      },
    ],
  },

  code: {
    nodeType: 'code',
    displayName: 'Code',
    description: 'Run custom JavaScript code',
    inputs: [{ id: 'input-0' }],
    outputs: [{ id: 'output-0' }],
    fields: [
      {
        id: 'language',
        label: 'Language',
        type: 'select',
        options: [
          { value: 'javascript', label: 'JavaScript' },
          { value: 'python', label: 'Python' },
        ],
        defaultValue: 'javascript',
      },
      {
        id: 'code',
        label: 'Code',
        type: 'code',
        placeholder: '// Your code here\nreturn items;',
        description: 'Write your custom code',
      },
    ],
  },

  set: {
    nodeType: 'set',
    displayName: 'Set',
    description: 'Set or modify data fields',
    inputs: [{ id: 'input-0' }],
    outputs: [{ id: 'output-0' }],
    fields: [
      {
        id: 'mode',
        label: 'Mode',
        type: 'select',
        options: [
          { value: 'manual', label: 'Manual Mapping' },
          { value: 'raw', label: 'Raw JSON' },
        ],
        defaultValue: 'manual',
      },
      {
        id: 'values',
        label: 'Values to Set',
        type: 'json',
        placeholder: '{"field1": "value1", "field2": "value2"}',
        description: 'Key-value pairs to set',
      },
      {
        id: 'keepOnlySet',
        label: 'Keep Only Set',
        type: 'checkbox',
        defaultValue: false,
        description: 'Only keep fields that are explicitly set',
      },
    ],
  },

  if: {
    nodeType: 'if',
    displayName: 'IF',
    description: 'Conditional branching based on conditions',
    inputs: [{ id: 'input-0' }],
    outputs: [
      { id: 'true', label: 'True', color: '#22c55e' },
      { id: 'false', label: 'False', color: '#ef4444' },
    ],
    fields: [
      {
        id: 'conditions',
        label: 'Conditions',
        type: 'json',
        placeholder: '[{"field": "status", "operation": "equals", "value": 200}]',
        description: 'Array of conditions to evaluate',
      },
      {
        id: 'combineOperation',
        label: 'Combine With',
        type: 'select',
        options: [
          { value: 'all', label: 'AND (all must match)' },
          { value: 'any', label: 'OR (any must match)' },
        ],
        defaultValue: 'all',
      },
    ],
  },

  switch: {
    nodeType: 'switch',
    displayName: 'Switch',
    description: 'Multiple conditional branches',
    inputs: [{ id: 'input-0' }],
    outputs: [
      { id: 'output-0', label: 'Case 1', color: '#3b82f6' },
      { id: 'output-1', label: 'Case 2', color: '#8b5cf6' },
      { id: 'output-2', label: 'Default', color: '#6b7280' },
    ],
    fields: [
      {
        id: 'dataPropertyName',
        label: 'Value to Compare',
        type: 'text',
        placeholder: 'status',
        description: 'The field to evaluate',
      },
      {
        id: 'rules',
        label: 'Rules',
        type: 'json',
        placeholder: '[{"value": "active", "output": 0}, {"value": "inactive", "output": 1}]',
        description: 'Array of rules with values and output indices',
      },
    ],
  },

  merge: {
    nodeType: 'merge',
    displayName: 'Merge',
    description: 'Combine data from multiple inputs',
    inputs: [
      { id: 'input-0', label: 'Input 1' },
      { id: 'input-1', label: 'Input 2' },
    ],
    outputs: [{ id: 'output-0' }],
    fields: [
      {
        id: 'mode',
        label: 'Mode',
        type: 'select',
        options: [
          { value: 'append', label: 'Append' },
          { value: 'merge', label: 'Merge by Key' },
          { value: 'wait', label: 'Wait for All' },
        ],
        defaultValue: 'append',
      },
      {
        id: 'joinMode',
        label: 'Join Mode',
        type: 'select',
        options: [
          { value: 'inner', label: 'Inner Join' },
          { value: 'left', label: 'Left Join' },
          { value: 'outer', label: 'Outer Join' },
        ],
        defaultValue: 'inner',
      },
    ],
  },

  split_in_batches: {
    nodeType: 'split_in_batches',
    displayName: 'Split In Batches',
    description: 'Process items in batches',
    inputs: [{ id: 'input-0' }],
    outputs: [
      { id: 'loop', label: 'Loop', color: '#f59e0b' },
      { id: 'done', label: 'Done', color: '#22c55e' },
    ],
    fields: [
      {
        id: 'batchSize',
        label: 'Batch Size',
        type: 'number',
        defaultValue: 10,
        description: 'Number of items per batch',
      },
    ],
  },

  // ============= DATA NODES =============
  function: {
    nodeType: 'function',
    displayName: 'Function',
    description: 'Transform data with JavaScript',
    inputs: [{ id: 'input-0' }],
    outputs: [{ id: 'output-0' }],
    fields: [
      {
        id: 'functionCode',
        label: 'JavaScript Code',
        type: 'code',
        placeholder: '// Transform items\nfor (const item of items) {\n  item.json.processed = true;\n}\nreturn items;',
      },
    ],
  },

  item_lists: {
    nodeType: 'item_lists',
    displayName: 'Item Lists',
    description: 'Manipulate item lists',
    inputs: [{ id: 'input-0' }],
    outputs: [{ id: 'output-0' }],
    fields: [
      {
        id: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { value: 'concatenate', label: 'Concatenate Lists' },
          { value: 'limit', label: 'Limit Items' },
          { value: 'removeDuplicates', label: 'Remove Duplicates' },
          { value: 'sort', label: 'Sort' },
          { value: 'split', label: 'Split List' },
        ],
        defaultValue: 'concatenate',
      },
      {
        id: 'fieldToCheck',
        label: 'Field to Check',
        type: 'text',
        placeholder: 'id',
      },
      {
        id: 'limit',
        label: 'Limit',
        type: 'number',
        defaultValue: 10,
      },
    ],
  },

  date_time: {
    nodeType: 'date_time',
    displayName: 'Date & Time',
    description: 'Date and time operations',
    inputs: [{ id: 'input-0' }],
    outputs: [{ id: 'output-0' }],
    fields: [
      {
        id: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { value: 'formatDate', label: 'Format Date' },
          { value: 'addToDate', label: 'Add to Date' },
          { value: 'subtractFromDate', label: 'Subtract from Date' },
          { value: 'getTimeBetweenDates', label: 'Get Time Between' },
        ],
        defaultValue: 'formatDate',
      },
      {
        id: 'format',
        label: 'Date Format',
        type: 'text',
        placeholder: 'YYYY-MM-DD HH:mm:ss',
        defaultValue: 'YYYY-MM-DD',
      },
      {
        id: 'timezone',
        label: 'Timezone',
        type: 'text',
        placeholder: 'UTC',
        defaultValue: 'UTC',
      },
    ],
  },

  // ============= APP NODES =============
  gmail: {
    nodeType: 'gmail',
    displayName: 'Gmail',
    description: 'Send and receive emails via Gmail',
    outputs: [{ id: 'output-0', label: 'Output' }],
    fields: [
      {
        id: 'credential',
        label: 'Gmail Account',
        type: 'credential',
        credentialType: 'gmail',
        required: true,
        description: 'Select your Gmail credentials',
      },
      {
        id: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { value: 'send', label: 'Send Email' },
          { value: 'get', label: 'Get Email' },
          { value: 'getAll', label: 'Get All Emails' },
          { value: 'delete', label: 'Delete Email' },
        ],
        defaultValue: 'send',
      },
      {
        id: 'to',
        label: 'To',
        type: 'text',
        placeholder: 'recipient@example.com',
        required: true,
      },
      {
        id: 'subject',
        label: 'Subject',
        type: 'text',
        placeholder: 'Email subject',
      },
      {
        id: 'body',
        label: 'Body',
        type: 'textarea',
        placeholder: 'Email body content',
      },
    ],
  },

  slack: {
    nodeType: 'slack',
    displayName: 'Slack',
    description: 'Send messages to Slack',
    outputs: [{ id: 'output-0', label: 'Output' }],
    fields: [
      {
        id: 'credential',
        label: 'Slack Workspace',
        type: 'credential',
        credentialType: 'slack',
        required: true,
        description: 'Select your Slack credentials',
      },
      {
        id: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { value: 'postMessage', label: 'Post Message' },
          { value: 'update', label: 'Update Message' },
          { value: 'delete', label: 'Delete Message' },
        ],
        defaultValue: 'postMessage',
      },
      {
        id: 'channel',
        label: 'Channel',
        type: 'text',
        placeholder: '#general',
        required: true,
      },
      {
        id: 'text',
        label: 'Message Text',
        type: 'textarea',
        placeholder: 'Your message here',
        required: true,
      },
    ],
  },

  google_sheets: {
    nodeType: 'google_sheets',
    displayName: 'Google Sheets',
    description: 'Read/write Google Sheets data',
    outputs: [{ id: 'output-0', label: 'Output' }],
    fields: [
      {
        id: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { value: 'read', label: 'Read Rows' },
          { value: 'append', label: 'Append Row' },
          { value: 'update', label: 'Update Row' },
          { value: 'delete', label: 'Delete Row' },
        ],
        defaultValue: 'read',
      },
      {
        id: 'spreadsheetId',
        label: 'Spreadsheet ID',
        type: 'text',
        placeholder: '1abc123...',
        required: true,
      },
      {
        id: 'sheetName',
        label: 'Sheet Name',
        type: 'text',
        placeholder: 'Sheet1',
        defaultValue: 'Sheet1',
      },
      {
        id: 'range',
        label: 'Range',
        type: 'text',
        placeholder: 'A1:D10',
      },
    ],
  },

  notion: {
    nodeType: 'notion',
    displayName: 'Notion',
    description: 'Manage Notion pages and databases',
    outputs: [{ id: 'output-0', label: 'Output' }],
    fields: [
      {
        id: 'resource',
        label: 'Resource',
        type: 'select',
        options: [
          { value: 'page', label: 'Page' },
          { value: 'database', label: 'Database' },
          { value: 'block', label: 'Block' },
        ],
        defaultValue: 'page',
      },
      {
        id: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { value: 'create', label: 'Create' },
          { value: 'get', label: 'Get' },
          { value: 'getAll', label: 'Get All' },
          { value: 'update', label: 'Update' },
          { value: 'archive', label: 'Archive' },
        ],
        defaultValue: 'create',
      },
      {
        id: 'databaseId',
        label: 'Database ID',
        type: 'text',
        placeholder: 'abc123...',
      },
    ],
  },

  openai: {
    nodeType: 'openai',
    displayName: 'OpenAI',
    description: 'Use GPT and AI models',
    icon: '🤖',
    color: '#10a37f',
    outputs: [{ id: 'output-0', label: 'Output' }],
    fields: [
      {
        id: 'credential',
        label: 'OpenAI API Key',
        type: 'credential',
        credentialType: 'openai',
        required: true,
        description: 'Select your OpenAI API credentials',
      },
      {
        id: 'model',
        label: 'Model',
        type: 'select',
        options: [
          { value: 'gpt-5.6-luna', label: 'GPT-5.6 Luna (Cheap)' },
          { value: 'gpt-5.6-terra', label: 'GPT-5.6 Terra (Balanced)' },
          { value: 'gpt-5.6-sol', label: 'GPT-5.6 Sol (Frontier)' },
          { value: 'gpt-5.6-sol-pro', label: 'GPT-5.6 Sol Pro (Frontier)' },
          { value: 'o4-mini', label: 'o4-mini (Reasoning)' },
          { value: 'o3', label: 'o3 (Reasoning)' },
          { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Legacy)' },
          { value: 'gpt-4o', label: 'GPT-4o (Legacy)' },
        ],
        defaultValue: 'gpt-5.6-luna',
      },
      {
        id: 'system_message',
        label: 'System Message',
        type: 'textarea',
        defaultValue: 'You are a helpful assistant.',
        description: 'Sets the behavior and persona of the AI',
      },
      {
        id: 'skills',
        label: 'Skills',
        type: 'skills',
        description: 'Select skills to inject as context into the system prompt',
      },
      {
        id: 'prompt',
        label: 'Prompt',
        type: 'textarea',
        placeholder: 'Enter your prompt here...',
        required: true,
      },
      {
        id: 'temperature',
        label: 'Temperature',
        type: 'number',
        defaultValue: 0.7,
        description: '0-2, higher = more creative',
      },
      {
        id: 'max_tokens',
        label: 'Max Tokens',
        type: 'number',
        defaultValue: 2048,
        description: 'Maximum length of the response',
      },
    ],
  },

  gemini: {
    nodeType: 'gemini',
    displayName: 'Google Gemini',
    description: 'Use Google Gemini models',
    icon: '✨',
    color: '#4285f4',
    outputs: [{ id: 'output-0', label: 'Output' }],
    fields: [
      {
        id: 'credential',
        label: 'Gemini API Key',
        type: 'credential',
        credentialType: 'gemini_api',
        required: true,
      },
      {
        id: 'model',
        label: 'Model',
        type: 'select',
        options: [
          { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite (Cheap)' },
          { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash (Balanced)' },
          { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Frontier)' },
          { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Legacy)' },
          { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Legacy)' },
        ],
        defaultValue: 'gemini-3.6-flash',
      },
      {
        id: 'system_message',
        label: 'System Message',
        type: 'textarea',
        description: 'Sets the behavior and persona of the AI',
      },
      {
        id: 'skills',
        label: 'Skills',
        type: 'skills',
        description: 'Select skills to inject as context into the system prompt',
      },
      {
        id: 'prompt',
        label: 'Prompt',
        type: 'textarea',
        required: true,
      },
      {
        id: 'temperature',
        label: 'Temperature',
        type: 'number',
        defaultValue: 0.7,
        description: '0-2, higher = more creative',
      },
      {
        id: 'max_tokens',
        label: 'Max Tokens',
        type: 'number',
        defaultValue: 2048,
        description: 'Maximum length of the response',
      },
    ],
  },

  ollama: {
    nodeType: 'ollama',
    displayName: 'Ollama (Self-hosted)',
    description: 'Run LLMs via an Ollama server reachable from the backend. Set Base URL to your Ollama host (localhost only works if Ollama runs on the same server).',
    icon: '🦙',
    color: '#0d1117',
    outputs: [{ id: 'output-0', label: 'Output' }],
    fields: [
      {
        id: 'base_url',
        label: 'Base URL',
        type: 'text',
        placeholder: 'http://your-ollama-host:11434',
        defaultValue: 'http://localhost:11434',
        required: true,
      },
      {
        id: 'model',
        label: 'Model',
        type: 'select',
        options: [
          { value: 'gemma4:4b', label: 'Gemma 4 (4B)' },
          { value: 'qwen3:8b', label: 'Qwen 3 (8B)' },
          { value: 'deepseek-r1:8b', label: 'DeepSeek R1 (8B)' },
          { value: 'phi4:latest', label: 'Phi 4' },
          { value: 'mistral:7b', label: 'Mistral (7B)' },
          { value: 'qwen2.5-coder:32b', label: 'Qwen 2.5 Coder (32B)' },
          { value: 'qwen3.6:latest', label: 'Qwen 3.6' },
          { value: 'llama4:scout', label: 'Llama 4 Scout' },
        ],
        defaultValue: 'gemma4:4b',
      },
      {
        id: 'system_message',
        label: 'System Message',
        type: 'textarea',
        description: 'Sets the behavior and persona of the AI',
      },
      {
        id: 'skills',
        label: 'Skills',
        type: 'skills',
        description: 'Select skills to inject as context into the system prompt',
      },
      {
        id: 'prompt',
        label: 'Prompt',
        type: 'textarea',
        required: true,
      },
      {
        id: 'temperature',
        label: 'Temperature',
        type: 'number',
        defaultValue: 0.7,
        description: '0-2, higher = more creative',
      },
    ],
  },

  perplexity: {
    nodeType: 'perplexity',
    displayName: 'Perplexity',
    description: 'Web-connected AI search',
    icon: '🔍',
    color: '#1FB1E6',
    outputs: [{ id: 'output-0', label: 'Output' }],
    fields: [
      {
        id: 'credential',
        label: 'Perplexity API Key',
        type: 'credential',
        credentialType: 'perplexity_api',
        required: true,
      },
      {
        id: 'model',
        label: 'Model',
        type: 'select',
        options: [
          { value: 'sonar', label: 'Sonar (Cheap)' },
          { value: 'sonar-pro', label: 'Sonar Pro' },
          { value: 'sonar-reasoning', label: 'Sonar Reasoning' },
          { value: 'sonar-reasoning-pro', label: 'Sonar Reasoning Pro' },
          { value: 'sonar-deep-research', label: 'Sonar Deep Research' },
        ],
        defaultValue: 'sonar',
      },
      {
        id: 'skills',
        label: 'Skills',
        type: 'skills',
        description: 'Select skills to inject as context into the system prompt',
      },
      {
        id: 'prompt',
        label: 'Prompt',
        type: 'textarea',
        required: true,
      },
      {
        id: 'return_citations',
        label: 'Return Citations',
        type: 'checkbox',
        defaultValue: true,
      },
    ],
  },

  openrouter: {
    nodeType: 'openrouter',
    displayName: 'OpenRouter',
    description: 'Access 100+ LLMs',
    icon: '🌐',
    color: '#6366f1',
    outputs: [{ id: 'output-0', label: 'Output' }],
    fields: [
      {
        id: 'credential',
        label: 'OpenRouter Key',
        type: 'credential',
        credentialType: 'openrouter',
        required: true,
      },
      {
        id: 'model',
        label: 'Model',
        type: 'select',
        options: [
          { value: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron 3 Super 120B (Free)' },
          { value: 'openrouter/auto', label: 'Auto Router' },
          { value: 'openrouter/free', label: 'Free Models Router (Free)' },
          { value: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B (Free)' },
          { value: 'google/gemini-3.6-flash', label: 'Gemini 3.6 Flash (Cheap)' },
          { value: 'openai/gpt-5.6-luna', label: 'GPT-5.6 Luna (Cheap)' },
          { value: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku 4.5 (Cheap)' },
          { value: 'deepseek/deepseek-v4-flash', label: 'DeepSeek V4 Flash (Cheap)' },
          { value: 'openai/gpt-5.6-sol', label: 'GPT-5.6 Sol (Frontier)' },
          { value: 'anthropic/claude-opus-5', label: 'Claude Opus 5 (Frontier)' },
          { value: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Frontier)' },
          { value: 'x-ai/grok-4.5', label: 'Grok 4.5 (Frontier)' },
        ],
        defaultValue: 'nvidia/nemotron-3-super-120b-a12b:free',
      },
      {
        id: 'system_message',
        label: 'System Message',
        type: 'textarea',
        description: 'Sets the behavior and persona of the AI',
      },
      {
        id: 'skills',
        label: 'Skills',
        type: 'skills',
        description: 'Select skills to inject as context into the system prompt',
      },
      {
        id: 'prompt',
        label: 'Prompt',
        type: 'textarea',
        required: true,
      },
      {
        id: 'temperature',
        label: 'Temperature',
        type: 'number',
        defaultValue: 0.7,
        description: '0-2, higher = more creative',
      },
      {
        id: 'max_tokens',
        label: 'Max Tokens',
        type: 'number',
        defaultValue: 2048,
        description: 'Maximum length of the response',
      },
    ],
  },

  nvidia: {
    nodeType: 'nvidia',
    displayName: 'NVIDIA NIM',
    description: 'Optimized inference on NVIDIA and open-source models',
    icon: '⚙️',
    color: '#76b900',
    outputs: [{ id: 'output-0', label: 'Output' }],
    fields: [
      {
        id: 'credential',
        label: 'NVIDIA API Key',
        type: 'credential',
        credentialType: 'nvidia',
        required: true,
      },
      {
        id: 'model',
        label: 'Model',
        type: 'select',
        options: [
          { value: 'nvidia/nemotron-3-nano-30b-a3b', label: 'Nemotron 3 Nano 30B (Cheap)' },
          { value: 'nvidia/nemotron-3-super-120b-a12b', label: 'Nemotron 3 Super 120B (Balanced)' },
          { value: 'nvidia/nemotron-3-ultra-550b-a55b', label: 'Nemotron 3 Ultra 550B (Frontier)' },
          { value: 'nvidia/llama-3.3-nemotron-super-49b-v1.5', label: 'Nemotron Super 49B v1.5' },
          { value: 'nvidia/llama-3.1-nemotron-ultra-253b-v1', label: 'Nemotron Ultra 253B' },
          { value: 'deepseek-ai/deepseek-v4-flash', label: 'DeepSeek V4 Flash (Cheap)' },
          { value: 'deepseek-ai/deepseek-v4-pro', label: 'DeepSeek V4 Pro (Frontier)' },
          { value: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
          { value: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B (Cheap)' },
          { value: 'moonshotai/kimi-k2.6', label: 'Kimi K2.6' },
          { value: 'mistralai/mistral-medium-3.5-128b', label: 'Mistral Medium 3.5' },
          { value: 'meta/llama-3.3-70b-instruct', label: 'Llama 3.3 70B Instruct' },
          { value: 'google/gemma-4-31b-it', label: 'Gemma 4 31B' },
        ],
        defaultValue: 'nvidia/nemotron-3-super-120b-a12b',
      },
      {
        id: 'system_message',
        label: 'System Message',
        type: 'textarea',
        description: 'Sets the behavior and persona of the AI',
      },
      {
        id: 'prompt',
        label: 'Prompt',
        type: 'textarea',
        required: true,
      },
      {
        id: 'temperature',
        label: 'Temperature',
        type: 'number',
        defaultValue: 0.6,
        description: '0-1, higher = more creative',
      },
      {
        id: 'max_tokens',
        label: 'Max Tokens',
        type: 'number',
        defaultValue: 4096,
        description: 'Maximum length of the response',
      },
      {
        id: 'thinking',
        label: 'Show Reasoning',
        type: 'checkbox',
        defaultValue: false,
        description: 'Capture internal reasoning for reasoning models',
      },
    ],
  },

  // ============= DATABASE NODES =============
  postgres: {
    nodeType: 'postgres',
    displayName: 'PostgreSQL',
    description: 'Query PostgreSQL database',
    fields: [
      {
        id: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { value: 'executeQuery', label: 'Execute Query' },
          { value: 'insert', label: 'Insert' },
          { value: 'update', label: 'Update' },
          { value: 'delete', label: 'Delete' },
        ],
        defaultValue: 'executeQuery',
      },
      {
        id: 'query',
        label: 'Query',
        type: 'code',
        placeholder: 'SELECT * FROM users WHERE id = $1',
      },
      {
        id: 'table',
        label: 'Table',
        type: 'text',
        placeholder: 'users',
      },
    ],
  },

  mysql: {
    nodeType: 'mysql',
    displayName: 'MySQL',
    description: 'Query MySQL database',
    fields: [
      {
        id: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { value: 'executeQuery', label: 'Execute Query' },
          { value: 'insert', label: 'Insert' },
          { value: 'update', label: 'Update' },
          { value: 'delete', label: 'Delete' },
        ],
        defaultValue: 'executeQuery',
      },
      {
        id: 'query',
        label: 'Query',
        type: 'code',
        placeholder: 'SELECT * FROM users WHERE id = ?',
      },
    ],
  },

  mongodb: {
    nodeType: 'mongodb',
    displayName: 'MongoDB',
    description: 'Query MongoDB database',
    fields: [
      {
        id: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { value: 'find', label: 'Find' },
          { value: 'findOne', label: 'Find One' },
          { value: 'insert', label: 'Insert' },
          { value: 'update', label: 'Update' },
          { value: 'delete', label: 'Delete' },
          { value: 'aggregate', label: 'Aggregate' },
        ],
        defaultValue: 'find',
      },
      {
        id: 'collection',
        label: 'Collection',
        type: 'text',
        placeholder: 'users',
        required: true,
      },
      {
        id: 'query',
        label: 'Query',
        type: 'json',
        placeholder: '{"status": "active"}',
      },
    ],
  },

  redis: {
    nodeType: 'redis',
    displayName: 'Redis',
    description: 'Redis operations',
    fields: [
      {
        id: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { value: 'get', label: 'Get' },
          { value: 'set', label: 'Set' },
          { value: 'delete', label: 'Delete' },
          { value: 'keys', label: 'Get Keys' },
          { value: 'incr', label: 'Increment' },
        ],
        defaultValue: 'get',
      },
      {
        id: 'key',
        label: 'Key',
        type: 'text',
        placeholder: 'myKey',
        required: true,
      },
      {
        id: 'value',
        label: 'Value',
        type: 'text',
        placeholder: 'myValue',
      },
      {
        id: 'ttl',
        label: 'TTL (seconds)',
        type: 'number',
        description: 'Time to live in seconds',
      },
    ],
  },
  // ============= INTEGRATIONS =============
  github: {
    nodeType: 'github',
    displayName: 'GitHub',
    description: 'Manage GitHub repositories and issues',
    icon: '🐙',
    color: '#181717',
    inputs: [{ id: 'input-0' }],
    outputs: [{ id: 'output-0' }],
    fields: [
      {
        id: 'credential',
        label: 'GitHub Token',
        type: 'credential',
        credentialType: 'github',
      },
      {
        id: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { value: 'create_issue', label: 'Create Issue' },
          { value: 'update_issue', label: 'Update Issue' },
          { value: 'get_issue', label: 'Get Issue' },
          { value: 'create_pr', label: 'Create Pull Request' },
          { value: 'get_repo', label: 'Get Repository' },
        ],
        defaultValue: 'create_issue',
      },
      {
        id: 'owner',
        label: 'Repository Owner',
        type: 'text',
        placeholder: 'octocat',
        description: 'GitHub username or organization',
      },
      {
        id: 'repo',
        label: 'Repository Name',
        type: 'text',
        placeholder: 'hello-world',
        description: 'Repository name',
      },
      {
        id: 'issue_number',
        label: 'Issue Number',
        type: 'text',
        placeholder: '42',
        description: 'Required for update/get operations',
      },
      {
        id: 'title',
        label: 'Title',
        type: 'text',
        placeholder: 'Issue or PR title',
      },
      {
        id: 'body',
        label: 'Body',
        type: 'textarea',
        description: 'Description (supports Markdown)',
      },
    ],
  },
  
  github_trigger: {
    nodeType: 'github_trigger',
    displayName: 'GitHub Trigger',
    description: 'Start workflow on GitHub events',
    icon: '🐙',
    color: '#22c55e',
    inputs: [],
    outputs: [{ id: 'output-0' }],
    fields: [
      {
        id: 'credential',
        label: 'GitHub Token',
        type: 'credential',
        credentialType: 'github',
      },
      {
        id: 'repository',
        label: 'Repository',
        type: 'text',
        placeholder: 'owner/repo',
        description: 'Format: owner/repo',
      },
      {
        id: 'events',
        label: 'Events',
        type: 'json',
        defaultValue: '["push", "pull_request"]',
        description: 'Array of events to listen for',
      },
      {
        id: 'branch_filter',
        label: 'Branch Filter',
        type: 'text',
        placeholder: 'main',
        description: 'Only trigger for specific branch',
      },
    ],
  },

  airtable: {
    nodeType: 'airtable',
    displayName: 'Airtable',
    description: 'Manage Airtable records',
    icon: '🗂️',
    color: '#18bfff',
    inputs: [{ id: 'input-0' }],
    outputs: [{ id: 'output-0' }],
    fields: [
      {
        id: 'credential',
        label: 'Airtable API Key',
        type: 'credential',
        credentialType: 'airtable',
      },
      {
        id: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { value: 'create', label: 'Create Record' },
          { value: 'get', label: 'Get Record' },
          { value: 'update', label: 'Update Record' },
          { value: 'delete', label: 'Delete Record' },
          { value: 'list', label: 'List Records' },
        ],
        defaultValue: 'create',
      },
      {
        id: 'base_id',
        label: 'Base ID',
        type: 'text',
      },
      {
        id: 'table_name',
        label: 'Table Name',
        type: 'text',
      },
    ],
  },

  discord: {
    nodeType: 'discord',
    displayName: 'Discord',
    description: 'Send messages to Discord',
    icon: '🎮',
    color: '#5865F2',
    inputs: [{ id: 'input-0' }],
    outputs: [{ id: 'output-0' }],
    fields: [
      {
        id: 'credential',
        label: 'Discord Webhook',
        type: 'credential',
        credentialType: 'discord_webhook',
      },
      {
        id: 'content',
        label: 'Content',
        type: 'textarea',
        placeholder: 'Message content',
      },
      {
        id: 'username',
        label: 'Username',
        type: 'text',
        placeholder: 'Override username',
      },
    ],
  },

  telegram: {
    nodeType: 'telegram',
    displayName: 'Telegram',
    description: 'Send Telegram messages',
    icon: '✈️',
    color: '#0088cc',
    inputs: [{ id: 'input-0' }],
    outputs: [{ id: 'output-0' }],
    fields: [
      {
        id: 'credential',
        label: 'Bot Token',
        type: 'credential',
        credentialType: 'telegram',
      },
      {
        id: 'chat_id',
        label: 'Chat ID',
        type: 'text',
      },
      {
        id: 'text',
        label: 'Message Text',
        type: 'textarea',
      },
      {
        id: 'message_limit',
        label: 'Message Limit',
        type: 'number',
        defaultValue: 4096,
        description: 'Truncate message if it exceeds this length',
      },
    ],
  },

  tavily_search: {
    nodeType: 'tavily_search',
    displayName: 'Tavily Search',
    description: 'Search the web using Tavily',
    icon: 'Search',
    color: '#4c8bf5',
    inputs: [{ id: 'input-0' }],
    outputs: [{ id: 'output-0' }],
    fields: [
      {
        id: 'credential',
        label: 'Tavily API Key',
        type: 'credential',
        credentialType: 'tavily',
        required: true,
      },
      {
        id: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { value: 'search', label: 'Search' },
          { value: 'context', label: 'Context' },
          { value: 'qna', label: 'Q&A' },
        ],
        defaultValue: 'search',
      },
      {
        id: 'query',
        label: 'Query',
        type: 'text',
        placeholder: 'What is the capital of France?',
        required: true,
      },
      {
        id: 'search_depth',
        label: 'Search Depth',
        type: 'select',
        options: [
          { value: 'basic', label: 'Basic' },
          { value: 'advanced', label: 'Advanced' },
        ],
        defaultValue: 'basic',
      },
      {
        id: 'max_results',
        label: 'Max Results',
        type: 'number',
        defaultValue: 5,
      },
      {
        id: 'include_answer',
        label: 'Include Answer',
        type: 'checkbox',
        defaultValue: false,
      },
      {
        id: 'include_raw_content',
        label: 'Include Raw Content',
        type: 'checkbox',
        defaultValue: false,
      },
      {
        id: 'include_images',
        label: 'Include Images',
        type: 'checkbox',
        defaultValue: false,
      },
      {
        id: 'include_domains',
        label: 'Include Domains',
        type: 'text',
        placeholder: 'example.com, google.com',
      },
      {
        id: 'exclude_domains',
        label: 'Exclude Domains',
        type: 'text',
        placeholder: 'example.com, google.com',
      },
    ],
  },

  firecrawl_scrape: {
    nodeType: 'firecrawl_scrape',
    displayName: 'Firecrawl Scrape',
    description: 'Scrape websites and convert to LLM-ready formats using Firecrawl',
    icon: 'Globe',
    color: '#f59e0b',
    inputs: [{ id: 'input-0' }],
    outputs: [{ id: 'output-0' }],
    fields: [
      {
        id: 'credential',
        label: 'Firecrawl API Key',
        type: 'credential',
        credentialType: 'firecrawl',
        required: true,
      },
      {
        id: 'operation',
        label: 'Operation',
        type: 'select',
        options: [
          { value: 'scrape', label: 'Scrape' },
          { value: 'crawl', label: 'Crawl' },
          { value: 'map', label: 'Map' },
          { value: 'check_crawl', label: 'Check Crawl Status' },
        ],
        defaultValue: 'scrape',
      },
      {
        id: 'url',
        label: 'URL',
        type: 'text',
        placeholder: 'https://example.com',
      },
      {
        id: 'formats',
        label: 'Formats',
        type: 'text',
        defaultValue: 'markdown',
        description: 'Comma-separated: markdown, html, raw-html, screenshot, links',
      },
      {
        id: 'only_main_content',
        label: 'Only Main Content',
        type: 'checkbox',
        defaultValue: true,
      },
      {
        id: 'wait_for',
        label: 'Wait For (ms)',
        type: 'number',
        defaultValue: 0,
      },
      {
        id: 'extraction_schema',
        label: 'Extraction Schema (JSON)',
        type: 'code',
      },
      {
        id: 'system_prompt',
        label: 'System Prompt',
        type: 'textarea',
      },
      {
        id: 'prompt',
        label: 'Prompt',
        type: 'textarea',
      },
      {
        id: 'crawl_id',
        label: 'Crawl ID',
        type: 'text',
        description: 'Required for Check Crawl Status',
      },
    ],
  },
};

/**
 * Get configuration for a specific node type
 */
export function getNodeConfig(nodeType: string): NodeConfig | undefined {
  return nodeConfigs[nodeType];
}

/**
 * Get default values for a node type
 */
export function getDefaultValues(nodeType: string): Record<string, unknown> {
  const config = nodeConfigs[nodeType];
  if (!config) return {};

  const defaults: Record<string, unknown> = {};
  for (const field of config.fields) {
    if (field.defaultValue !== undefined) {
      defaults[field.id] = field.defaultValue;
    }
  }
  return defaults;
}
