/**
 * Workflow Serializer
 * 
 * Utilities for exporting and importing workflows as JSON.
 */

import { type Node, type Edge } from 'reactflow';

// Workflow export format
export interface WorkflowExport {
  version: string;
  name: string;
  description?: string;
  createdAt: string;
  nodes: ExportedNode[];
  edges: ExportedEdge[];
  settings?: WorkflowSettings;
}

export interface ExportedNode {
  id: string;
  type: string;
  nodeType: string;
  position: { x: number; y: number };
  data: {
    label: string;
    icon?: string;
    color?: string;
    config?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export interface ExportedEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  animated?: boolean;
}

export interface WorkflowSettings {
  timezone?: string;
  errorWorkflow?: string;
  saveExecutionProgress?: boolean;
  saveManualExecutions?: boolean;
}

// Validation errors
export interface ValidationError {
  type: 'error' | 'warning';
  message: string;
  nodeId?: string;
  field?: string;
}

/**
 * Export workflow to JSON format
 */
export function exportWorkflow(
  nodes: Node[],
  edges: Edge[],
  name: string = 'Untitled Workflow',
  description?: string
): WorkflowExport {
  const exportedNodes: ExportedNode[] = nodes.map((node) => ({
    id: node.id,
    type: node.type || 'generic',
    nodeType: node.data?.nodeType || 'unknown',
    position: node.position,
    data: {
      label: node.data?.label || 'Node',
      icon: node.data?.icon,
      color: node.data?.color,
      config: node.data?.config,
      ...node.data,
    },
  }));

  const exportedEdges: ExportedEdge[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle || undefined,
    targetHandle: edge.targetHandle || undefined,
    animated: edge.animated,
  }));

  return {
    version: '1.0.0',
    name,
    description,
    createdAt: new Date().toISOString(),
    nodes: exportedNodes,
    edges: exportedEdges,
  };
}

/**
 * Serialize workflow to JSON string
 */
export function serializeWorkflow(
  nodes: Node[],
  edges: Edge[],
  name?: string,
  description?: string
): string {
  const workflow = exportWorkflow(nodes, edges, name, description);
  return JSON.stringify(workflow, null, 2);
}

/**
 * Validate imported workflow data
 */
export function validateWorkflowImport(data: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof data !== 'object' || data === null) {
    errors.push({ type: 'error', message: 'Invalid workflow data: expected an object' });
    return errors;
  }

  const workflow = data as Record<string, unknown>;

  // Check required fields
  if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
    errors.push({ type: 'error', message: 'Missing or invalid "nodes" array' });
  }

  if (!workflow.edges || !Array.isArray(workflow.edges)) {
    errors.push({ type: 'error', message: 'Missing or invalid "edges" array' });
  }

  // Validate nodes
  if (Array.isArray(workflow.nodes)) {
    workflow.nodes.forEach((node: unknown, index: number) => {
      if (typeof node !== 'object' || node === null) {
        errors.push({ type: 'error', message: `Node at index ${index} is invalid` });
        return;
      }
      const n = node as Record<string, unknown>;
      if (!n.id) {
        errors.push({ type: 'error', message: `Node at index ${index} is missing "id"` });
      }
      if (!n.position || typeof n.position !== 'object') {
        errors.push({ type: 'error', message: `Node "${n.id}" is missing position` });
      }
    });
  }

  // Validate edges
  if (Array.isArray(workflow.edges)) {
    const nodeIds = new Set(
      (workflow.nodes as Array<Record<string, unknown>>)?.map((n) => n.id) || []
    );

    workflow.edges.forEach((edge: unknown, index: number) => {
      if (typeof edge !== 'object' || edge === null) {
        errors.push({ type: 'error', message: `Edge at index ${index} is invalid` });
        return;
      }
      const e = edge as Record<string, unknown>;
      if (!e.source) {
        errors.push({ type: 'error', message: `Edge at index ${index} is missing "source"` });
      }
      if (!e.target) {
        errors.push({ type: 'error', message: `Edge at index ${index} is missing "target"` });
      }
      if (e.source && !nodeIds.has(e.source as string)) {
        errors.push({ type: 'warning', message: `Edge references non-existent source node "${e.source}"` });
      }
      if (e.target && !nodeIds.has(e.target as string)) {
        errors.push({ type: 'warning', message: `Edge references non-existent target node "${e.target}"` });
      }
    });
  }

  return errors;
}

/**
 * Import workflow from JSON data
 */
export function importWorkflow(data: unknown): { 
  nodes: Node[]; 
  edges: Edge[]; 
  name: string;
  errors: ValidationError[] 
} {
  const errors = validateWorkflowImport(data);
  const hasErrors = errors.some((e) => e.type === 'error');

  if (hasErrors) {
    return { nodes: [], edges: [], name: 'Import Failed', errors };
  }

  const workflow = data as WorkflowExport;

  const nodes: Node[] = workflow.nodes.map((node) => ({
    id: node.id,
    type: node.type || 'generic',
    position: node.position,
    data: {
      ...node.data,
      nodeType: node.nodeType,
    },
  }));

  const edges: Edge[] = workflow.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    animated: edge.animated ?? true,
    style: { stroke: '#888', strokeWidth: 2 },
    type: 'deletable',
  }));

  return {
    nodes,
    edges,
    name: workflow.name || 'Imported Workflow',
    errors,
  };
}

/**
 * Parse JSON string to workflow data
 */
export function parseWorkflow(jsonString: string): {
  nodes: Node[];
  edges: Edge[];
  name: string;
  errors: ValidationError[];
} {
  try {
    const data = JSON.parse(jsonString);
    return importWorkflow(data);
  } catch (e) {
    return {
      nodes: [],
      edges: [],
      name: 'Parse Error',
      errors: [{ type: 'error', message: `Invalid JSON: ${(e as Error).message}` }],
    };
  }
}

/**
 * Download workflow as JSON file
 */
export function downloadWorkflow(
  nodes: Node[],
  edges: Edge[],
  filename: string = 'workflow'
): void {
  const json = serializeWorkflow(nodes, edges, filename);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Read file as text (for file input)
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
