/**
 * Workflow Validation Utilities
 * 
 * Validates workflow structure, detects cycles, orphan nodes, and missing fields.
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

/**
 * Check if the workflow graph is a valid DAG (Directed Acyclic Graph)
 * Returns true if there are NO cycles
 */
export function isDAG(nodes: Node[], edges: Edge[]): { isValid: boolean; cycleNodes: string[] } {
  // Build adjacency list
  const adjacencyList = new Map<string, string[]>();
  nodes.forEach(node => adjacencyList.set(node.id, []));
  edges.forEach(edge => {
    const neighbors = adjacencyList.get(edge.source);
    if (neighbors) {
      neighbors.push(edge.target);
    }
  });

  // Detect cycles using DFS with coloring
  // 0 = unvisited, 1 = visiting (in current path), 2 = visited
  const color = new Map<string, number>();
  nodes.forEach(node => color.set(node.id, 0));
  
  const cycleNodes: string[] = [];
  let hasCycle = false;

  function dfs(nodeId: string, path: Set<string>): boolean {
    if (color.get(nodeId) === 1) {
      // Found cycle - collect nodes in cycle path
      path.forEach(id => cycleNodes.push(id));
      return true;
    }
    if (color.get(nodeId) === 2) {
      return false;
    }

    color.set(nodeId, 1);
    path.add(nodeId);
    
    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (dfs(neighbor, path)) {
        return true;
      }
    }
    
    path.delete(nodeId);
    color.set(nodeId, 2);
    return false;
  }

  for (const node of nodes) {
    if (color.get(node.id) === 0) {
      if (dfs(node.id, new Set())) {
        hasCycle = true;
        break;
      }
    }
  }

  return { isValid: !hasCycle, cycleNodes: [...new Set(cycleNodes)] };
}

/**
 * Find orphan nodes (nodes with no connections)
 */
export function findOrphanNodes(nodes: Node[], edges: Edge[]): string[] {
  const connectedNodes = new Set<string>();
  
  edges.forEach(edge => {
    connectedNodes.add(edge.source);
    connectedNodes.add(edge.target);
  });

  // A node is orphan if it's not a trigger and has no connections
  return nodes
    .filter(node => {
      const isTrigger = node.data?.nodeType?.includes('trigger') || node.type === 'trigger';
      return !isTrigger && !connectedNodes.has(node.id);
    })
    .map(node => node.id);
}

/**
 * Find nodes without trigger
 */
export function hasTrigger(nodes: Node[]): boolean {
  return nodes.some(node => 
    node.data?.nodeType?.includes('trigger') || 
    node.type === 'trigger'
  );
}

/**
 * Validate required fields for each node
 */
export function validateRequiredFields(nodes: Node[]): ValidationError[] {
  const errors: ValidationError[] = [];

  nodes.forEach(node => {
    const nodeType = node.data?.nodeType;
    if (!nodeType) return;

    const config = getNodeConfig(nodeType);
    if (!config) return;

    config.fields
      .filter(field => field.required)
      .forEach(field => {
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
  });

  return errors;
}

/**
 * Find disconnected branches (nodes not reachable from any trigger)
 */
export function findUnreachableNodes(nodes: Node[], edges: Edge[]): string[] {
  // Find all trigger nodes
  const triggerIds = nodes
    .filter(node => node.data?.nodeType?.includes('trigger') || node.type === 'trigger')
    .map(node => node.id);

  if (triggerIds.length === 0) {
    // No triggers - all nodes except triggers are "unreachable"
    return nodes
      .filter(node => !node.data?.nodeType?.includes('trigger'))
      .map(node => node.id);
  }

  // Build adjacency list for forward traversal
  const adjacencyList = new Map<string, string[]>();
  nodes.forEach(node => adjacencyList.set(node.id, []));
  edges.forEach(edge => {
    const neighbors = adjacencyList.get(edge.source);
    if (neighbors) {
      neighbors.push(edge.target);
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

  // Return nodes not reachable from any trigger
  return nodes
    .filter(node => !reachable.has(node.id))
    .map(node => node.id);
}

/**
 * Main validation function - checks everything
 */
export function validateWorkflow(nodes: Node[], edges: Edge[]): ValidationResult {
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
  if (!hasTrigger(nodes)) {
    errors.push({
      type: 'error',
      code: 'NO_TRIGGER',
      message: 'Workflow must have at least one trigger node to start execution.',
    });
  }

  // Check for cycles
  const dagResult = isDAG(nodes, edges);
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
  const unreachable = findUnreachableNodes(nodes, edges);
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

  // Check required fields
  const fieldErrors = validateRequiredFields(nodes);
  errors.push(...fieldErrors);

  // Determine overall validity
  const isValid = errors.length === 0;

  return { isValid, errors, warnings, info };
}

/**
 * Get validation summary for display
 */
export function getValidationSummary(result: ValidationResult): string {
  if (result.isValid && result.warnings.length === 0) {
    return '✅ Workflow is valid';
  }
  
  const parts: string[] = [];
  if (result.errors.length > 0) {
    parts.push(`${result.errors.length} error${result.errors.length > 1 ? 's' : ''}`);
  }
  if (result.warnings.length > 0) {
    parts.push(`${result.warnings.length} warning${result.warnings.length > 1 ? 's' : ''}`);
  }
  
  return parts.join(', ');
}
