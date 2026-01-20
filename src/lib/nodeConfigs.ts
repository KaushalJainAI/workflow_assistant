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
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'number' | 'code' | 'json' | 'password';
  placeholder?: string;
  defaultValue?: string | number | boolean;
  options?: FieldOption[];
  required?: boolean;
  description?: string;
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
    fields: [
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
    fields: [
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
    fields: [
      {
        id: 'resource',
        label: 'Resource',
        type: 'select',
        options: [
          { value: 'chat', label: 'Chat' },
          { value: 'completion', label: 'Completion' },
          { value: 'image', label: 'Image' },
          { value: 'audio', label: 'Audio' },
        ],
        defaultValue: 'chat',
      },
      {
        id: 'model',
        label: 'Model',
        type: 'select',
        options: [
          { value: 'gpt-4', label: 'GPT-4' },
          { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
          { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
        ],
        defaultValue: 'gpt-4',
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
        id: 'maxTokens',
        label: 'Max Tokens',
        type: 'number',
        defaultValue: 1000,
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
