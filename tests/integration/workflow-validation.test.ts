/**
 * Adversarial tests for the client-side workflow validator.
 * The frontend validator is the LAST line of defence before sending a graph
 * to the backend compiler — if it lets a malformed graph through, the user
 * sees a useless 400 instead of an inline error.
 */
import { describe, expect, it } from 'vitest';
import type { Node, Edge } from 'reactflow';
import { isDAG, hasTrigger, validateRequiredFields } from '../../src/lib/validateWorkflow';

const node = (id: string, nodeType: string, config: Record<string, unknown> = {}): Node => ({
  id,
  type: 'generic',
  position: { x: 0, y: 0 },
  data: { label: id, nodeType, config },
});

const edge = (source: string, target: string): Edge => ({
  id: `${source}->${target}`,
  source,
  target,
});

describe('isDAG — happy', () => {
  it('linear chain is a DAG', () => {
    const nodes = [node('a', 'manual_trigger'), node('b', 'http')];
    const edges = [edge('a', 'b')];
    expect(isDAG(nodes, edges)).toBe(true);
  });
});

describe('isDAG — sad', () => {
  it('detects 2-node cycle', () => {
    const nodes = [node('a', 'manual_trigger'), node('b', 'http')];
    const edges = [edge('a', 'b'), edge('b', 'a')];
    expect(isDAG(nodes, edges)).toBe(false);
  });
});

describe('isDAG — angry', () => {
  it('does not stack-overflow on 5000-node chain', () => {
    const nodes: Node[] = [node('t', 'manual_trigger')];
    const edges: Edge[] = [];
    for (let i = 0; i < 5000; i++) {
      nodes.push(node(`n${i}`, 'http'));
      edges.push(edge(i === 0 ? 't' : `n${i - 1}`, `n${i}`));
    }
    expect(isDAG(nodes, edges)).toBe(true);
  });

  it('detects a long cycle (5000 hops then close)', () => {
    const nodes: Node[] = [node('t', 'manual_trigger')];
    const edges: Edge[] = [];
    for (let i = 0; i < 1000; i++) {
      nodes.push(node(`n${i}`, 'http'));
      edges.push(edge(i === 0 ? 't' : `n${i - 1}`, `n${i}`));
    }
    edges.push(edge('n999', 't'));
    expect(isDAG(nodes, edges)).toBe(false);
  });

  it('handles edges referencing nonexistent nodes without crashing', () => {
    const nodes = [node('a', 'manual_trigger')];
    const edges = [edge('ghost', 'a'), edge('a', 'phantom')];
    // Function should not throw
    expect(() => isDAG(nodes, edges)).not.toThrow();
  });

  it('handles empty graph', () => {
    expect(isDAG([], [])).toBe(true);
  });

  it('hasTrigger is false when no trigger nodes exist', () => {
    expect(hasTrigger([node('a', 'http')])).toBe(false);
  });

  it('hasTrigger is true when manual_trigger present', () => {
    expect(hasTrigger([node('a', 'manual_trigger')])).toBe(true);
  });

  it('validateRequiredFields tolerates undefined config', () => {
    // @ts-expect-error - intentionally pass node without data.config
    const bad: Node = { id: 'x', type: 'generic', position: { x: 0, y: 0 }, data: { nodeType: 'http' } };
    expect(() => validateRequiredFields([bad])).not.toThrow();
  });
});
