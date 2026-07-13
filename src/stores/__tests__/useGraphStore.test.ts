import { describe, it, expect, beforeEach } from 'vitest';
import { type Node, type Edge } from 'reactflow';
import { useGraphStore } from '../useGraphStore';

const mkNode = (id: string, label = id): Node => ({
  id,
  type: 'generic',
  position: { x: 0, y: 0 },
  data: { label },
});

beforeEach(() => {
  useGraphStore.setState({ nodes: [], edges: [] });
});

describe('useGraphStore', () => {
  it('addNode appends to nodes', () => {
    useGraphStore.getState().addNode(mkNode('a'));
    useGraphStore.getState().addNode(mkNode('b'));
    expect(useGraphStore.getState().nodes.map(n => n.id)).toEqual(['a', 'b']);
  });

  it('removeNode removes node and incident edges atomically', () => {
    const { addNode, setEdges, removeNode } = useGraphStore.getState();
    addNode(mkNode('a'));
    addNode(mkNode('b'));
    addNode(mkNode('c'));
    const edges: Edge[] = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'c' },
      { id: 'e3', source: 'a', target: 'c' },
    ];
    setEdges(edges);

    removeNode('b');

    const state = useGraphStore.getState();
    expect(state.nodes.map(n => n.id)).toEqual(['a', 'c']);
    // Both edges touching 'b' must be gone; the a->c edge survives
    expect(state.edges.map(e => e.id).sort()).toEqual(['e3']);
  });

  it('updateNodeData merges into data without dropping other keys', () => {
    useGraphStore.getState().addNode({
      ...mkNode('a'),
      data: { label: 'A', config: { x: 1 }, nodeType: 'http_request' } as any,
    });
    useGraphStore.getState().updateNodeData('a', { label: 'New' } as any);

    const node = useGraphStore.getState().nodes[0];
    expect(node.data.label).toBe('New');
    // unrelated keys preserved
    expect((node.data as any).config).toEqual({ x: 1 });
    expect((node.data as any).nodeType).toBe('http_request');
  });

  it('updateNodeData no-ops when id is unknown', () => {
    useGraphStore.getState().addNode(mkNode('a'));
    const before = useGraphStore.getState().nodes;
    useGraphStore.getState().updateNodeData('ghost', { label: 'X' } as any);
    expect(useGraphStore.getState().nodes).toEqual(before);
  });

  it('onConnect adds an edge with the source/target', () => {
    useGraphStore.getState().addNode(mkNode('a'));
    useGraphStore.getState().addNode(mkNode('b'));
    useGraphStore.getState().onConnect({
      source: 'a',
      target: 'b',
      sourceHandle: null,
      targetHandle: null,
    });
    const edges = useGraphStore.getState().edges;
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe('a');
    expect(edges[0].target).toBe('b');
    expect(edges[0].animated).toBe(true);
  });

  it('setNodes / setEdges replace state', () => {
    useGraphStore.getState().setNodes([mkNode('z')]);
    useGraphStore.getState().setEdges([{ id: 'e', source: 'z', target: 'z' }]);
    expect(useGraphStore.getState().nodes).toHaveLength(1);
    expect(useGraphStore.getState().edges).toHaveLength(1);
  });
});
