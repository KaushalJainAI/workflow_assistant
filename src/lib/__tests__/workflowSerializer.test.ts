import { describe, it, expect } from 'vitest';
import { type Node, type Edge } from 'reactflow';
import {
  exportWorkflow,
  serializeWorkflow,
  validateWorkflowImport,
  importWorkflow,
  parseWorkflow,
} from '../workflowSerializer';

const sampleNodes: Node[] = [
  {
    id: 'n1',
    type: 'generic',
    position: { x: 10, y: 20 },
    data: { label: 'Trigger', nodeType: 'manual_trigger', config: { name: 'Start' } },
  },
  {
    id: 'n2',
    type: 'generic',
    position: { x: 100, y: 200 },
    data: { label: 'Call API', nodeType: 'http_request', config: { url: 'https://x.test' } },
  },
];

const sampleEdges: Edge[] = [
  { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 'output-0', targetHandle: 'input-0' },
];

describe('exportWorkflow', () => {
  it('preserves nodeType, label, position, config', () => {
    const exported = exportWorkflow(sampleNodes, sampleEdges, 'My WF', 'desc');
    expect(exported.name).toBe('My WF');
    expect(exported.description).toBe('desc');
    expect(exported.nodes).toHaveLength(2);
    expect(exported.nodes[0].nodeType).toBe('manual_trigger');
    expect(exported.nodes[0].position).toEqual({ x: 10, y: 20 });
    expect(exported.nodes[1].data.config).toEqual({ url: 'https://x.test' });
  });

  it('serializeWorkflow round-trips through JSON', () => {
    const json = serializeWorkflow(sampleNodes, sampleEdges, 'Test');
    const parsed = JSON.parse(json);
    expect(parsed.nodes).toHaveLength(2);
    expect(parsed.edges).toHaveLength(1);
  });
});

describe('validateWorkflowImport', () => {
  it('rejects non-objects', () => {
    expect(validateWorkflowImport(null).some(e => e.type === 'error')).toBe(true);
    expect(validateWorkflowImport('string').some(e => e.type === 'error')).toBe(true);
  });

  it('requires nodes & edges arrays', () => {
    const errs = validateWorkflowImport({});
    expect(errs.some(e => e.message.includes('nodes'))).toBe(true);
    expect(errs.some(e => e.message.includes('edges'))).toBe(true);
  });

  it('warns on edges referencing missing nodes', () => {
    const errs = validateWorkflowImport({
      nodes: [{ id: 'a', position: { x: 0, y: 0 } }],
      edges: [{ source: 'a', target: 'ghost' }],
    });
    expect(errs.some(e => e.type === 'warning' && e.message.includes('ghost'))).toBe(true);
  });

  it('flags nodes missing id or position', () => {
    const errs = validateWorkflowImport({
      nodes: [{ position: { x: 0, y: 0 } }, { id: 'b' }],
      edges: [],
    });
    expect(errs.some(e => /missing "id"/.test(e.message))).toBe(true);
    expect(errs.some(e => /missing position/.test(e.message))).toBe(true);
  });
});

describe('importWorkflow', () => {
  it('round-trips an exported workflow', () => {
    const exported = exportWorkflow(sampleNodes, sampleEdges, 'RT');
    const imported = importWorkflow(exported);
    expect(imported.errors.filter(e => e.type === 'error')).toHaveLength(0);
    expect(imported.nodes).toHaveLength(2);
    expect(imported.edges).toHaveLength(1);
    expect(imported.nodes[0].data.nodeType).toBe('manual_trigger');
    expect(imported.name).toBe('RT');
  });

  it('returns empty arrays on hard validation errors', () => {
    const out = importWorkflow({ nodes: 'no', edges: [] });
    expect(out.nodes).toHaveLength(0);
    expect(out.errors.some(e => e.type === 'error')).toBe(true);
  });
});

describe('parseWorkflow', () => {
  it('reports JSON syntax errors', () => {
    const out = parseWorkflow('{ not json');
    expect(out.errors[0].message).toMatch(/Invalid JSON/);
  });

  it('parses a valid serialized workflow', () => {
    const json = serializeWorkflow(sampleNodes, sampleEdges, 'X');
    const out = parseWorkflow(json);
    expect(out.errors.filter(e => e.type === 'error')).toHaveLength(0);
    expect(out.nodes).toHaveLength(2);
  });
});
