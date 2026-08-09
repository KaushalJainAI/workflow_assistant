/**
 * Workflow validation results and the panel that shows them.
 *
 * `WorkflowEditor` ran validation from two places — on save and before execute —
 * and each one repeated the same four steps: call `validateWorkflow`, fan the
 * result into three state slices, derive the summary, then walk every node to
 * attach its own error. `run` is that sequence, declared once.
 */

import { useCallback, useState } from 'react';
import type { Edge, Node } from 'reactflow';
import {
  getValidationSummary,
  validateWorkflow,
  type ValidationError,
} from '../lib/validateWorkflow';

type ValidateOptions = Parameters<typeof validateWorkflow>[2];

interface RunOptions {
  /** Extra `data` fields merged into every node alongside `validationError`. */
  nodePatch?: Record<string, unknown>;
  /** Reveal the panel when the run produced errors or warnings. */
  openPanelOnIssues?: boolean;
}

interface Params {
  setNodes: (updater: (nodes: Node[]) => Node[]) => void;
}

export function useWorkflowValidation({ setNodes }: Params) {
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [warnings, setWarnings] = useState<ValidationError[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [isPanelOpen, setPanelOpen] = useState(false);

  const togglePanel = useCallback(() => setPanelOpen((open) => !open), []);

  /** Validates, publishes the result, and stamps each node with its own issue. */
  const run = useCallback(
    async (
      nodes: Node[],
      edges: Edge[],
      options?: ValidateOptions,
      { nodePatch, openPanelOnIssues = false }: RunOptions = {},
    ) => {
      const result = await validateWorkflow(nodes, edges, options);

      setErrors(result.errors);
      setWarnings(result.warnings);
      setSummary(getValidationSummary(result));
      if (openPanelOnIssues && (result.errors.length > 0 || result.warnings.length > 0)) {
        setPanelOpen(true);
      }

      setNodes((current) =>
        current.map((node) => ({
          ...node,
          data: {
            ...node.data,
            validationError:
              result.errors.find((e) => e.nodeId === node.id) ??
              result.warnings.find((w) => w.nodeId === node.id),
            ...nodePatch,
          },
        })),
      );

      return result;
    },
    [setNodes],
  );

  return { errors, warnings, summary, isPanelOpen, setPanelOpen, togglePanel, run };
}
