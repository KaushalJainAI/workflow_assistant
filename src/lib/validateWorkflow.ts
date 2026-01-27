/**
 * Workflow Validation Utilities
 * 
 * Validates workflow structure, detects cycles, orphan nodes, missing fields,
 * subworkflow dependencies, and integrates with backend validation.
 */

import { type Node, type Edge } from 'reactflow';
import { getNodeConfig } from './nodeConfigs';

export interface ValidationError {
  type: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  nodeId?: string;
  field?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  info: ValidationError[];
}

export interface ValidationOptions {
  getNodeConfigFn?: (type: string) => any;
  checkTypeCompatibility?: boolean;
  checkCredentials?: boolean;
  checkSubworkflowCycles?: boolean;
  validateWithBackend?: boolean;
  maxNestingDepth?: number;
  ignoreErrorHandles?: boolean;
}

// Backend trigger types from your architecture
// Backend trigger types from your architecture
const TRIGGER_TYPES = [
  'manual_trigger', 
  'webhook_trigger', 
  'schedule_trigger', 
  'email_trigger',
  'form_trigger',
  'slack_trigger', 
  'google_sheets_trigger',
  'github_trigger',
  'discord_trigger', 
  'telegram_trigger', 
  'rss_feed_trigger'
];

// Backend LLM node types
const LLM_NODE_TYPES = ['openai', 'gemini', 'ollama'];

// Backend integration node types
const INTEGRATION_NODE_TYPES = ['slack', 'gmail', 'google_sheets'];

// Backend control flow node types
const CONTROL_FLOW_TYPES = ['if', 'switch', 'loop'];

/**
 * Check if the workflow graph is a valid DAG (Directed Acyclic Graph)
 * Returns true if there are NO cycles
 */
export function isDAG(
  nodes: Node[], 
  edges: Edge[],
  ignoreErrorHandles: boolean = false
): { isValid: boolean; cycleNodes: string[]; cycleEdges: string[] } {
  // Build adjacency list
  const adjacencyList = new Map<string, string[]>();
  const edgeMap = new Map<string, Edge>();
  
  nodes.forEach(node => adjacencyList.set(node.id, []));
  
  edges.forEach(edge => {
    // Optionally ignore error handle edges
    if (ignoreErrorHandles && edge.sourceHandle?.includes('error')) {
      return;
    }
    
    const neighbors = adjacencyList.get(edge.source);
    if (neighbors) {
      neighbors.push(edge.target);
      edgeMap.set(`${edge.source}->${edge.target}`, edge);
    }
  });

  // Detect cycles using DFS with coloring
  // 0 = unvisited, 1 = visiting (in current path), 2 = visited
  const color = new Map<string, number>();
  nodes.forEach(node => color.set(node.id, 0));
  
  const cycleNodes: string[] = [];
  const cycleEdges: string[] = [];
  let hasCycle = false;

  function dfs(nodeId: string, path: Set<string>, edgePath: string[]): boolean {
    if (color.get(nodeId) === 1) {
      // Found cycle - collect nodes and edges in cycle path
      path.forEach(id => cycleNodes.push(id));
      cycleEdges.push(...edgePath);
      return true;
    }
    if (color.get(nodeId) === 2) {
      return false;
    }

    color.set(nodeId, 1);
    path.add(nodeId);
    
    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      const edgeKey = `${nodeId}->${neighbor}`;
      if (dfs(neighbor, path, [...edgePath, edgeKey])) {
        return true;
      }
    }
    
    path.delete(nodeId);
    color.set(nodeId, 2);
    return false;
  }

  for (const node of nodes) {
    if (color.get(node.id) === 0) {
      if (dfs(node.id, new Set(), [])) {
        hasCycle = true;
        break;
      }
    }
  }

  return { 
    isValid: !hasCycle, 
    cycleNodes: [...new Set(cycleNodes)],
    cycleEdges: [...new Set(cycleEdges)]
  };
}

/**
 * Check if node is a trigger
 */
function isTriggerNode(node: Node): boolean {
  return TRIGGER_TYPES.includes(node.data?.nodeType);
}

/**
 * Check if node is a subworkflow
 */
function isSubworkflowNode(node: Node): boolean {
  return node.data?.nodeType === 'subworkflow';
}

/**
 * Find orphan nodes (nodes with no connections)
 * Excludes triggers and nodes inside collapsed groups
 */
export function findOrphanNodes(
  nodes: Node[], 
  edges: Edge[],
  ignoreGroupedNodes: boolean = true
): string[] {
  const connectedNodes = new Set<string>();
  
  edges.forEach(edge => {
    connectedNodes.add(edge.source);
    connectedNodes.add(edge.target);
  });

  return nodes
    .filter(node => {
      // Skip triggers
      if (isTriggerNode(node)) return false;
      
      // Skip grouped nodes if requested
      if (ignoreGroupedNodes && node.data?.parentNode) return false;
      
      // Node is orphan if not connected
      return !connectedNodes.has(node.id);
    })
    .map(node => node.id);
}

/**
 * Find nodes without trigger
 */
export function hasTrigger(nodes: Node[]): { 
  hasTrigger: boolean; 
  triggerCount: number; 
  triggerTypes: string[] 
} {
  const triggers = nodes.filter(node => isTriggerNode(node));
  
  return {
    hasTrigger: triggers.length > 0,
    triggerCount: triggers.length,
    triggerTypes: triggers.map(t => t.data?.nodeType || 'unknown')
  };
}

/**
 * Validate required fields for each node type
 */
export function validateRequiredFields(
  nodes: Node[], 
  getNodeConfigFn?: (type: string) => any
): ValidationError[] {
  const errors: ValidationError[] = [];

  nodes.forEach(node => {
    const nodeType = node.data?.nodeType;
    if (!nodeType) return;

    // Use provided getter or fallback to static config
    const config = getNodeConfigFn ? getNodeConfigFn(nodeType) : getNodeConfig(nodeType);
    if (!config?.fields) return;

    // Validate standard required fields
    config.fields
      .filter((field: any) => field.required)
      .forEach((field: any) => {
        const value = node.data?.config?.[field.id];
        if (value === undefined || value === null || value === '') {
          errors.push({
            type: 'error',
            code: 'MISSING_REQUIRED_FIELD',
            message: `Node "${node.data?.label || node.id}" is missing required field "${field.label}"`,
            nodeId: node.id,
            field: field.id,
          });
        }
      });

    // Special validation for subworkflow nodes
    if (isSubworkflowNode(node)) {
      const workflowId = node.data?.config?.workflow_id;
      if (!workflowId) {
        errors.push({
          type: 'error',
          code: 'MISSING_WORKFLOW_ID',
          message: `Subworkflow node "${node.data?.label || node.id}" must reference a workflow`,
          nodeId: node.id,
          field: 'workflow_id',
        });
      }

      // Validate JSON mappings if provided
      const inputMapping = node.data?.config?.input_mapping;
      if (inputMapping && typeof inputMapping === 'string') {
        try {
          JSON.parse(inputMapping);
        } catch {
          errors.push({
            type: 'error',
            code: 'INVALID_JSON',
            message: `Subworkflow node "${node.data?.label || node.id}" has invalid input_mapping JSON`,
            nodeId: node.id,
            field: 'input_mapping',
          });
        }
      }

      const outputMapping = node.data?.config?.output_mapping;
      if (outputMapping && typeof outputMapping === 'string') {
        try {
          JSON.parse(outputMapping);
        } catch {
          errors.push({
            type: 'error',
            code: 'INVALID_JSON',
            message: `Subworkflow node "${node.data?.label || node.id}" has invalid output_mapping JSON`,
            nodeId: node.id,
            field: 'output_mapping',
          });
        }
      }
    }

    // Special validation for LLM nodes
    if (LLM_NODE_TYPES.includes(nodeType)) {
      const prompt = node.data?.config?.prompt;
      if (!prompt || prompt.trim() === '') {
        errors.push({
          type: 'error',
          code: 'MISSING_PROMPT',
          message: `LLM node "${node.data?.label || node.id}" requires a prompt`,
          nodeId: node.id,
          field: 'prompt',
        });
      }

      const temperature = node.data?.config?.temperature;
      if (temperature !== undefined && (temperature < 0 || temperature > 2)) {
        errors.push({
          type: 'error',
          code: 'INVALID_TEMPERATURE',
          message: `LLM node "${node.data?.label || node.id}" temperature must be between 0 and 2`,
          nodeId: node.id,
          field: 'temperature',
        });
      }
    }

    // Special validation for HTTP request nodes
    if (nodeType === 'http_request') {
      const url = node.data?.config?.url;
      if (url) {
        try {
          new URL(url);
        } catch {
          errors.push({
            type: 'error',
            code: 'INVALID_URL',
            message: `HTTP node "${node.data?.label || node.id}" has invalid URL format`,
            nodeId: node.id,
            field: 'url',
          });
        }
      }

      const method = node.data?.config?.method;
      if (method && ['POST', 'PUT', 'PATCH'].includes(method)) {
        const body = node.data?.config?.body;
        if (!body) {
          errors.push({
            type: 'warning',
            code: 'MISSING_BODY',
            message: `HTTP ${method} node "${node.data?.label || node.id}" usually requires a body`,
            nodeId: node.id,
            field: 'body',
          });
        }
      }
    }

    // Special validation for code nodes
    if (nodeType === 'code') {
      const code = node.data?.config?.code;
      if (!code || code.trim() === '') {
        errors.push({
          type: 'error',
          code: 'MISSING_CODE',
          message: `Code node "${node.data?.label || node.id}" requires code`,
          nodeId: node.id,
          field: 'code',
        });
      }
    }

    // Special validation for schedule trigger
    if (nodeType === 'schedule_trigger') {
      const cron = node.data?.config?.cron_expression;
      if (!cron || cron.trim() === '') {
        errors.push({
          type: 'error',
          code: 'MISSING_CRON',
          message: `Schedule trigger "${node.data?.label || node.id}" requires cron expression`,
          nodeId: node.id,
          field: 'cron_expression',
        });
      }
    }
  });

  return errors;
}

/**
 * Validate credentials are selected for nodes that need them
 */
export function validateCredentials(nodes: Node[], getNodeConfigFn?: (type: string) => any): ValidationError[] {
  const errors: ValidationError[] = [];

  nodes.forEach(node => {
    const nodeType = node.data?.nodeType;
    if (!nodeType) return;

    const config = getNodeConfigFn ? getNodeConfigFn(nodeType) : getNodeConfig(nodeType);
    if (!config?.fields) return;

    // Find credential fields
    config.fields
      .filter((field: any) => field.type === 'credential' || field.type === 'select' && field.id === 'credential')
      .forEach((field: any) => {
        const credentialId = node.data?.config?.[field.id];
        if (!credentialId) {
          errors.push({
            type: 'error',
            code: 'MISSING_CREDENTIAL',
            message: `Node "${node.data?.label || node.id}" requires a credential`,
            nodeId: node.id,
            field: field.id,
          });
        }
      });

    // Integration nodes typically need credentials
    if (INTEGRATION_NODE_TYPES.includes(nodeType)) {
      const credential = node.data?.config?.credential;
      if (!credential) {
        errors.push({
          type: 'error',
          code: 'MISSING_CREDENTIAL',
          message: `Integration node "${node.data?.label || node.id}" requires a credential`,
          nodeId: node.id,
          field: 'credential',
        });
      }
    }
  });

  return errors;
}

/**
 * Find disconnected branches (nodes not reachable from any trigger)
 */
export function findUnreachableNodes(nodes: Node[], edges: Edge[]): {
  unreachable: string[];
  conditionallyReachable: string[];
} {
  const triggerIds = nodes
    .filter(node => isTriggerNode(node))
    .map(node => node.id);

  if (triggerIds.length === 0) {
    return {
      unreachable: nodes.filter(node => !isTriggerNode(node)).map(node => node.id),
      conditionallyReachable: []
    };
  }

  // Build adjacency list for forward traversal
  const adjacencyList = new Map<string, string[]>();
  const conditionalEdges = new Set<string>(); // Edges from IF/Switch nodes
  
  nodes.forEach(node => adjacencyList.set(node.id, []));
  
  edges.forEach(edge => {
    const neighbors = adjacencyList.get(edge.source);
    if (neighbors) {
      neighbors.push(edge.target);
      
      // Track if this edge is from a conditional node
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (sourceNode && CONTROL_FLOW_TYPES.includes(sourceNode.data?.nodeType)) {
        conditionalEdges.add(edge.target);
      }
    }
  });

  // BFS from all triggers
  const reachable = new Set<string>();
  const queue = [...triggerIds];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);
    
    const neighbors = adjacencyList.get(current) || [];
    queue.push(...neighbors);
  }

  // Categorize unreachable nodes
  const unreachable: string[] = [];
  const conditionallyReachable: string[] = [];

  nodes.forEach(node => {
    if (isTriggerNode(node)) return;
    if (reachable.has(node.id)) return;
    
    if (conditionalEdges.has(node.id)) {
      conditionallyReachable.push(node.id);
    } else {
      unreachable.push(node.id);
    }
  });

  return { unreachable, conditionallyReachable };
}

/**
 * Validate conditional nodes (IF/Switch) have proper configuration
 */
export function validateConditionalBranches(nodes: Node[], edges: Edge[]): ValidationError[] {
  const errors: ValidationError[] = [];

  nodes.forEach(node => {
    const nodeType = node.data?.nodeType;
    
    if (nodeType === 'if') {
      const condition = node.data?.config?.condition;
      if (!condition || condition.trim() === '') {
        errors.push({
          type: 'error',
          code: 'MISSING_CONDITION',
          message: `IF node "${node.data?.label || node.id}" requires a condition`,
          nodeId: node.id,
          field: 'condition',
        });
      }

      // Check for true/false outputs
      const outgoingEdges = edges.filter(e => e.source === node.id);
      const hasTrue = outgoingEdges.some(e => e.sourceHandle?.includes('true'));
      const hasFalse = outgoingEdges.some(e => e.sourceHandle?.includes('false'));

      if (!hasTrue && !hasFalse) {
        errors.push({
          type: 'warning',
          code: 'NO_CONDITIONAL_OUTPUTS',
          message: `IF node "${node.data?.label || node.id}" has no true/false outputs connected`,
          nodeId: node.id,
        });
      } else if (!hasFalse) {
        errors.push({
          type: 'warning',
          code: 'NO_ELSE_PATH',
          message: `IF node "${node.data?.label || node.id}" has no false (else) path`,
          nodeId: node.id,
        });
      }
    }

    if (nodeType === 'switch') {
      const cases = node.data?.config?.cases;
      if (!cases || cases.length < 2) {
        errors.push({
          type: 'warning',
          code: 'INSUFFICIENT_CASES',
          message: `Switch node "${node.data?.label || node.id}" should have at least 2 cases`,
          nodeId: node.id,
          field: 'cases',
        });
      }

      const outgoingEdges = edges.filter(e => e.source === node.id);
      const hasDefault = outgoingEdges.some(e => e.sourceHandle?.includes('default'));
      
      if (!hasDefault) {
        errors.push({
          type: 'warning',
          code: 'NO_DEFAULT_CASE',
          message: `Switch node "${node.data?.label || node.id}" has no default case`,
          nodeId: node.id,
        });
      }
    }
  });

  return errors;
}

/**
 * Validate timeout configurations
 */
export function validateTimeouts(nodes: Node[], maxTimeout: number = 300): ValidationError[] {
  const errors: ValidationError[] = [];

  nodes.forEach(node => {
    const timeout = node.data?.config?.timeout_seconds || node.data?.config?.timeout_override;
    
    if (timeout !== undefined) {
      if (timeout <= 0) {
        errors.push({
          type: 'error',
          code: 'INVALID_TIMEOUT',
          message: `Node "${node.data?.label || node.id}" timeout must be greater than 0`,
          nodeId: node.id,
          field: 'timeout_seconds',
        });
      }

      if (timeout > maxTimeout) {
        errors.push({
          type: 'error',
          code: 'TIMEOUT_EXCEEDS_LIMIT',
          message: `Node "${node.data?.label || node.id}" timeout exceeds maximum (${maxTimeout}s)`,
          nodeId: node.id,
          field: 'timeout_seconds',
        });
      }
    }
  });

  return errors;
}

/**
 * Validate workflow complexity and provide warnings
 */
export function validateWorkflowComplexity(nodes: Node[], edges: Edge[]): ValidationError[] {
  const warnings: ValidationError[] = [];

  // Check total node count
  if (nodes.length > 50) {
    warnings.push({
      type: 'warning',
      code: 'COMPLEX_WORKFLOW',
      message: `Workflow has ${nodes.length} nodes. Consider breaking it into smaller workflows.`,
    });
  }

  // Check LLM node count (expensive operations)
  const llmNodes = nodes.filter(n => LLM_NODE_TYPES.includes(n.data?.nodeType));
  if (llmNodes.length > 10) {
    warnings.push({
      type: 'warning',
      code: 'MANY_LLM_NODES',
      message: `Workflow has ${llmNodes.length} LLM nodes. This may be slow and expensive.`,
    });
  }

  // Check subworkflow nesting
  const subworkflowNodes = nodes.filter(n => isSubworkflowNode(n));
  if (subworkflowNodes.length > 5) {
    warnings.push({
      type: 'warning',
      code: 'MANY_SUBWORKFLOWS',
      message: `Workflow has ${subworkflowNodes.length} subworkflows. Monitor nesting depth.`,
    });
  }

  // Estimate total execution time
  let totalTimeout = 0;
  nodes.forEach(node => {
    const timeout = node.data?.config?.timeout_seconds || 
                   node.data?.config?.timeout_override || 
                   60; // Default timeout
    totalTimeout += timeout;
  });

  if (totalTimeout > 600) { // 10 minutes
    warnings.push({
      type: 'warning',
      code: 'LONG_EXECUTION_TIME',
      message: `Estimated execution time: ${Math.round(totalTimeout / 60)}+ minutes`,
    });
  }

  return warnings;
}

/**
 * Validate handle connections exist and are properly connected
 */
export function validateHandleConnections(
  nodes: Node[], 
  edges: Edge[],
  getNodeConfigFn?: (type: string) => any
): ValidationError[] {
  const errors: ValidationError[] = [];

  edges.forEach(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);

    if (!sourceNode || !targetNode) return;

    const sourceConfig = getNodeConfigFn ? 
      getNodeConfigFn(sourceNode.data?.nodeType) : 
      getNodeConfig(sourceNode.data?.nodeType);
    
    const targetConfig = getNodeConfigFn ? 
      getNodeConfigFn(targetNode.data?.nodeType) : 
      getNodeConfig(targetNode.data?.nodeType);

    // Validate source handle exists
    if (edge.sourceHandle && sourceConfig?.outputs) {
      const hasHandle = sourceConfig.outputs.some((output: any) => 
        output.id === edge.sourceHandle || edge.sourceHandle?.includes(output.id)
      );
      
      if (!hasHandle) {
        errors.push({
          type: 'warning',
          code: 'INVALID_SOURCE_HANDLE',
          message: `Edge from "${sourceNode.data?.label || edge.source}" uses non-existent output handle`,
          nodeId: edge.source,
        });
      }
    }

    // Validate target handle exists
    if (edge.targetHandle && targetConfig?.inputs) {
      const hasHandle = targetConfig.inputs.some((input: any) => 
        input.id === edge.targetHandle || edge.targetHandle?.includes(input.id)
      );
      
      if (!hasHandle) {
        errors.push({
          type: 'warning',
          code: 'INVALID_TARGET_HANDLE',
          message: `Edge to "${targetNode.data?.label || edge.target}" uses non-existent input handle`,
          nodeId: edge.target,
        });
      }
    }
  });

  return errors;
}

/**
 * Validate with backend API
 */
export async function validateWithBackend(
  nodes: Node[], 
  edges: Edge[],
  options: {
    checkCredentials?: boolean;
    checkTypes?: boolean;
    checkSubworkflowCycles?: boolean;
  } = {}
): Promise<ValidationResult> {
  try {
    const response = await fetch('/api/compile/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nodes,
        edges,
        check_credentials: options.checkCredentials ?? true,
        check_types: options.checkTypes ?? true,
        check_subworkflow_cycles: options.checkSubworkflowCycles ?? true,
      }),
    });

    if (!response.ok) {
      throw new Error('Backend validation failed');
    }

    const data = await response.json();
    
    return {
      isValid: data.is_valid,
      errors: data.errors || [],
      warnings: data.warnings || [],
      info: data.info || [],
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [{
        type: 'error',
        code: 'BACKEND_VALIDATION_FAILED',
        message: `Could not validate with backend: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
      warnings: [],
      info: [],
    };
  }
}

/**
 * Main validation function - checks everything
 */
export async function validateWorkflow(
  nodes: Node[], 
  edges: Edge[],
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const info: ValidationError[] = [];

  // Check if workflow is empty
  if (nodes.length === 0) {
    info.push({
      type: 'info',
      code: 'EMPTY_WORKFLOW',
      message: 'Workflow is empty. Add some nodes to get started.',
    });
    return { isValid: true, errors, warnings, info };
  }

  // Check for trigger
  const triggerCheck = hasTrigger(nodes);
  if (!triggerCheck.hasTrigger) {
    errors.push({
      type: 'error',
      code: 'NO_TRIGGER',
      message: 'Workflow must have at least one trigger node to start execution.',
    });
  } else if (triggerCheck.triggerCount > 1 && !triggerCheck.triggerTypes.includes('manual_trigger')) {
    warnings.push({
      type: 'warning',
      code: 'MULTIPLE_TRIGGERS',
      message: `Workflow has ${triggerCheck.triggerCount} triggers. Ensure logic handles multiple entry points.`,
    });
  }

  // Check for cycles
  const dagResult = isDAG(nodes, edges, options.ignoreErrorHandles);
  if (!dagResult.isValid) {
    errors.push({
      type: 'error',
      code: 'CYCLE_DETECTED',
      message: `Workflow contains a cycle. Cycles are not allowed in workflows.`,
      nodeId: dagResult.cycleNodes[0],
    });
    dagResult.cycleNodes.forEach(nodeId => {
      const node = nodes.find(n => n.id === nodeId);
      warnings.push({
        type: 'warning',
        code: 'NODE_IN_CYCLE',
        message: `Node "${node?.data?.label || nodeId}" is part of a cycle`,
        nodeId,
      });
    });
  }

  // Check for orphan nodes
  const orphans = findOrphanNodes(nodes, edges);
  orphans.forEach(nodeId => {
    const node = nodes.find(n => n.id === nodeId);
    warnings.push({
      type: 'warning',
      code: 'ORPHAN_NODE',
      message: `Node "${node?.data?.label || nodeId}" has no connections`,
      nodeId,
    });
  });

  // Check for unreachable nodes
  const { unreachable, conditionallyReachable } = findUnreachableNodes(nodes, edges);
  unreachable.forEach(nodeId => {
    const node = nodes.find(n => n.id === nodeId);
    if (!orphans.includes(nodeId)) {
      warnings.push({
        type: 'warning',
        code: 'UNREACHABLE_NODE',
        message: `Node "${node?.data?.label || nodeId}" is not reachable from any trigger`,
        nodeId,
      });
    }
  });

  conditionallyReachable.forEach(nodeId => {
    const node = nodes.find(n => n.id === nodeId);
    info.push({
      type: 'info',
      code: 'CONDITIONALLY_REACHABLE',
      message: `Node "${node?.data?.label || nodeId}" is only reachable under certain conditions`,
      nodeId,
    });
  });

  // Check required fields
  const fieldErrors = validateRequiredFields(nodes, options.getNodeConfigFn);
  errors.push(...fieldErrors);

  // Check credentials
  if (options.checkCredentials) {
    const credentialErrors = validateCredentials(nodes, options.getNodeConfigFn);
    errors.push(...credentialErrors);
  }

  // Check conditional branches
  const conditionalErrors = validateConditionalBranches(nodes, edges);
  errors.push(...conditionalErrors.filter(e => e.type === 'error'));
  warnings.push(...conditionalErrors.filter(e => e.type === 'warning'));

  // Check timeouts
  const timeoutErrors = validateTimeouts(nodes);
  errors.push(...timeoutErrors);

  // Check workflow complexity
  const complexityWarnings = validateWorkflowComplexity(nodes, edges);
  warnings.push(...complexityWarnings);

  // Check handle connections
  const handleErrors = validateHandleConnections(nodes, edges, options.getNodeConfigFn);
  warnings.push(...handleErrors);

  // Validate with backend if requested
  if (options.validateWithBackend) {
    try {
      const backendResult = await validateWithBackend(nodes, edges, {
        checkCredentials: options.checkCredentials,
        checkTypes: options.checkTypeCompatibility,
        checkSubworkflowCycles: options.checkSubworkflowCycles,
      });
      
      errors.push(...backendResult.errors);
      warnings.push(...backendResult.warnings);
      info.push(...backendResult.info);
    } catch (error) {
      warnings.push({
        type: 'warning',
        code: 'BACKEND_VALIDATION_UNAVAILABLE',
        message: 'Could not perform backend validation. Some issues may not be detected.',
      });
    }
  }

  // Determine overall validity
  const isValid = errors.length === 0;

  return { isValid, errors, warnings, info };
}

/**
 * Get validation summary for display
 */
export function getValidationSummary(result: ValidationResult): string {
  if (result.isValid && result.warnings.length === 0 && result.info.length === 0) {
    return '✅ Workflow is valid';
  }
  
  const parts: string[] = [];
  
  if (result.errors.length > 0) {
    parts.push(`❌ ${result.errors.length} error${result.errors.length > 1 ? 's' : ''}`);
  } else {
    parts.push('✅ No errors');
  }
  
  if (result.warnings.length > 0) {
    parts.push(`⚠️ ${result.warnings.length} warning${result.warnings.length > 1 ? 's' : ''}`);
  }
  
  if (result.info.length > 0) {
    parts.push(`ℹ️ ${result.info.length} info`);
  }
  
  return parts.join(' • ');
}

/**
 * Filter validation errors by severity
 */
export function filterBySeverity(result: ValidationResult, severity: 'error' | 'warning' | 'info'): ValidationError[] {
  switch (severity) {
    case 'error':
      return result.errors;
    case 'warning':
      return result.warnings;
    case 'info':
      return result.info;
    default:
      return [];
  }
}

/**
 * Get errors for a specific node
 */
export function getNodeErrors(result: ValidationResult, nodeId: string): ValidationError[] {
  return [
    ...result.errors.filter(e => e.nodeId === nodeId),
    ...result.warnings.filter(e => e.nodeId === nodeId),
    ...result.info.filter(e => e.nodeId === nodeId),
  ];
}

/**
 * Check if specific error code exists
 */
export function hasErrorCode(result: ValidationResult, code: string): boolean {
  return [...result.errors, ...result.warnings, ...result.info].some(e => e.code === code);
}
