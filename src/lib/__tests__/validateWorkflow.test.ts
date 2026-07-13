import { describe, it, expect } from 'vitest';
import { type Node, type Edge } from 'reactflow';
import {
  isDAG,
  findOrphanNodes,
  hasTrigger,
  findUnreachableNodes,
  validateRequiredFields,
  validateCredentials,
  validateConditionalBranches,
  validateTimeouts,
  hasErrorCode,
  getNodeErrors,
  filterBySeverity,
  type ValidationResult,
} from '../validateWorkflow';

const mkNode = (id: string, nodeType: string, config: Record<string, unknown> = {}, label?: string): Node => ({
  id,
  type: 'generic',
  position: { x: 0, y: 0 },
  data: { label: label || id, nodeType, config },
});

const mkEdge = (id: string, source: string, target: string, sourceHandle?: string): Edge => ({
  id, source, target, sourceHandle,
});

describe('isDAG', () => {
  it('returns valid for empty graph', () => {
    expect(isDAG([], []).isValid).toBe(true);
  });

  it('returns valid for a linear chain', () => {
    const nodes = [mkNode('a', 'manual_trigger'), mkNode('b', 'http_request'), mkNode('c', 'http_request')];
    const edges = [mkEdge('e1', 'a', 'b'), mkEdge('e2', 'b', 'c')];
    expect(isDAG(nodes, edges).isValid).toBe(true);
  });

  it('detects a simple cycle', () => {
    const nodes = [mkNode('a', 'http_request'), mkNode('b', 'http_request'), mkNode('c', 'http_request')];
    const edges = [mkEdge('e1', 'a', 'b'), mkEdge('e2', 'b', 'c'), mkEdge('e3', 'c', 'a')];
    const result = isDAG(nodes, edges);
    expect(result.isValid).toBe(false);
    // Cycle members exactly: a, b, c (not a path leading into them)
    expect([...result.cycleNodes].sort()).toEqual(['a', 'b', 'c']);
  });

  it('reports only the cycle slice, not the prefix path', () => {
    // x -> a -> b -> c -> a   (x leads in, but is not on the cycle)
    const nodes = ['x', 'a', 'b', 'c'].map(id => mkNode(id, 'http_request'));
    const edges = [
      mkEdge('e1', 'x', 'a'),
      mkEdge('e2', 'a', 'b'),
      mkEdge('e3', 'b', 'c'),
      mkEdge('e4', 'c', 'a'),
    ];
    const result = isDAG(nodes, edges);
    expect(result.isValid).toBe(false);
    expect(result.cycleNodes).not.toContain('x');
    expect([...result.cycleNodes].sort()).toEqual(['a', 'b', 'c']);
  });

  it('respects ignoreErrorHandles', () => {
    const nodes = [mkNode('a', 'http_request'), mkNode('b', 'http_request')];
    const edges = [
      mkEdge('e1', 'a', 'b'),
      { ...mkEdge('e2', 'b', 'a'), sourceHandle: 'error-out' },
    ];
    expect(isDAG(nodes, edges, false).isValid).toBe(false);
    expect(isDAG(nodes, edges, true).isValid).toBe(true);
  });
});

describe('findOrphanNodes', () => {
  it('does not flag triggers', () => {
    const nodes = [mkNode('t', 'manual_trigger'), mkNode('o', 'http_request')];
    expect(findOrphanNodes(nodes, [])).toEqual(['o']);
  });

  it('flags nodes with no edges', () => {
    const nodes = [
      mkNode('t', 'manual_trigger'),
      mkNode('a', 'http_request'),
      mkNode('b', 'http_request'),
    ];
    const edges = [mkEdge('e1', 't', 'a')];
    expect(findOrphanNodes(nodes, edges)).toEqual(['b']);
  });
});

describe('hasTrigger', () => {
  it('returns false for no triggers', () => {
    expect(hasTrigger([mkNode('a', 'http_request')]).hasTrigger).toBe(false);
  });

  it('counts multiple triggers', () => {
    const result = hasTrigger([
      mkNode('a', 'manual_trigger'),
      mkNode('b', 'webhook_trigger'),
    ]);
    expect(result.triggerCount).toBe(2);
    expect(result.triggerTypes).toContain('webhook_trigger');
  });
});

describe('findUnreachableNodes', () => {
  it('all nodes unreachable when no triggers', () => {
    const nodes = [mkNode('a', 'http_request'), mkNode('b', 'http_request')];
    const result = findUnreachableNodes(nodes, []);
    expect(result.unreachable.sort()).toEqual(['a', 'b']);
  });

  it('reaches nodes connected to triggers', () => {
    const nodes = [mkNode('t', 'manual_trigger'), mkNode('a', 'http_request'), mkNode('b', 'http_request')];
    const edges = [mkEdge('e1', 't', 'a')];
    const { unreachable } = findUnreachableNodes(nodes, edges);
    expect(unreachable).toEqual(['b']);
  });
});

describe('validateRequiredFields', () => {
  it('flags missing prompts on LLM nodes', () => {
    const nodes = [mkNode('llm', 'openai', {})];
    const errs = validateRequiredFields(nodes);
    expect(errs.some(e => e.code === 'MISSING_PROMPT')).toBe(true);
  });

  it('rejects out-of-range temperature', () => {
    const nodes = [mkNode('llm', 'openai', { prompt: 'hi', temperature: 5 })];
    const errs = validateRequiredFields(nodes);
    expect(errs.some(e => e.code === 'INVALID_TEMPERATURE')).toBe(true);
  });

  it('rejects bad URLs on http_request', () => {
    const nodes = [mkNode('h', 'http_request', { url: 'not a url' })];
    const errs = validateRequiredFields(nodes);
    expect(errs.some(e => e.code === 'INVALID_URL')).toBe(true);
  });

  it('flags missing cron on schedule_trigger', () => {
    const nodes = [mkNode('s', 'schedule_trigger', {})];
    const errs = validateRequiredFields(nodes);
    expect(errs.some(e => e.code === 'MISSING_CRON')).toBe(true);
  });

  it('flags invalid JSON in subworkflow input_mapping', () => {
    const nodes = [mkNode('s', 'subworkflow', { workflow_id: 1, input_mapping: '{not json' })];
    const errs = validateRequiredFields(nodes);
    expect(errs.some(e => e.code === 'INVALID_JSON')).toBe(true);
  });
});

describe('validateCredentials', () => {
  it('accepts any of credential / credential_id / credentialId', () => {
    const accepted = ['credential', 'credential_id', 'credentialId'];
    for (const key of accepted) {
      const nodes = [mkNode('s', 'slack', { [key]: 'cred-1' })];
      const errs = validateCredentials(nodes);
      expect(errs, `key=${key}`).toEqual([]);
    }
  });

  it('flags integration nodes with no credential at all', () => {
    const nodes = [mkNode('s', 'slack', {})];
    const errs = validateCredentials(nodes);
    expect(errs.some(e => e.code === 'MISSING_CREDENTIAL')).toBe(true);
  });
});

describe('validateConditionalBranches', () => {
  it('warns on IF without false path', () => {
    const nodes = [mkNode('if', 'if', { condition: '$x > 1' })];
    const edges = [{ ...mkEdge('e', 'if', 'next'), sourceHandle: 'true' }];
    const errs = validateConditionalBranches(nodes, edges);
    expect(errs.some(e => e.code === 'NO_ELSE_PATH')).toBe(true);
  });

  it('errors on IF with no condition', () => {
    const nodes = [mkNode('if', 'if', {})];
    const errs = validateConditionalBranches(nodes, []);
    expect(errs.some(e => e.code === 'MISSING_CONDITION')).toBe(true);
  });
});

describe('validateTimeouts', () => {
  it('rejects zero or negative', () => {
    const errs = validateTimeouts([mkNode('a', 'http_request', { timeout_seconds: 0 })]);
    expect(errs.some(e => e.code === 'INVALID_TIMEOUT')).toBe(true);
  });

  it('rejects above max', () => {
    const errs = validateTimeouts([mkNode('a', 'http_request', { timeout_seconds: 10000 })], 300);
    expect(errs.some(e => e.code === 'TIMEOUT_EXCEEDS_LIMIT')).toBe(true);
  });
});

describe('result helpers', () => {
  const result: ValidationResult = {
    isValid: false,
    errors: [{ type: 'error', code: 'X', message: 'm', nodeId: 'n1' }],
    warnings: [{ type: 'warning', code: 'Y', message: 'm', nodeId: 'n2' }],
    info: [],
  };

  it('hasErrorCode finds across buckets', () => {
    expect(hasErrorCode(result, 'X')).toBe(true);
    expect(hasErrorCode(result, 'Y')).toBe(true);
    expect(hasErrorCode(result, 'Z')).toBe(false);
  });

  it('getNodeErrors filters by node', () => {
    expect(getNodeErrors(result, 'n1')).toHaveLength(1);
    expect(getNodeErrors(result, 'n2')).toHaveLength(1);
    expect(getNodeErrors(result, 'nope')).toHaveLength(0);
  });

  it('filterBySeverity returns the right bucket', () => {
    expect(filterBySeverity(result, 'error')).toHaveLength(1);
    expect(filterBySeverity(result, 'warning')).toHaveLength(1);
    expect(filterBySeverity(result, 'info')).toHaveLength(0);
  });
});
