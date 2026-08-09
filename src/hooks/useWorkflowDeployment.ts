/**
 * Deploy / undeploy for the workflow editor.
 *
 * Five state slices and two async handlers that only ever talked to each other,
 * lifted out of `WorkflowEditor` so the page component is not also the place
 * where backend deployment-error shapes get unpacked.
 */

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { orchestratorService } from '../api';

export type WorkflowStatus = 'draft' | 'active' | 'inactive' | 'archived';

/** Modal stays open when there is a webhook URL, so the user can copy it. */
const AUTO_CLOSE_MS = 2000;

/**
 * Flattens the several shapes a failed deploy can arrive in: a plain message, a
 * `details` array of per-node problems, or a message plus a remediation `tip`.
 */
function describeFailure(error: any, fallback: string): string {
  const message = error.response?.data?.message || error.response?.data?.error || fallback;
  const details = error.response?.data?.details;

  if (Array.isArray(details)) {
    return `${message}:\n${details.map((d: any) => d.message || d).join('\n')}`;
  }
  const tip = error.response?.data?.tip;
  return tip ? `${message}\n\nTip: ${tip}` : message;
}

interface Params {
  workflowId: number | null;
  onStatusChange: (status: WorkflowStatus) => void;
  /** Resolves the webhook URL for the current graph, if it has a webhook trigger. */
  findWebhookUrl: () => string | null;
  /** Persists an unsaved workflow so it has an id to deploy. */
  save: () => Promise<void>;
}

export function useWorkflowDeployment({
  workflowId,
  onStatusChange,
  findWebhookUrl,
  save,
}: Params) {
  const [isModalOpen, setModalOpen] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [didSucceed, setDidSucceed] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [isUndeploying, setIsUndeploying] = useState(false);

  const deploy = useCallback(async () => {
    setIsDeploying(true);
    setWebhookUrl(null);
    try {
      if (!workflowId) await save();
      // Still no id means the save failed; the save path has already reported it.
      if (!workflowId) return;

      await orchestratorService.deployWorkflow(workflowId);
      onStatusChange('active');

      const url = findWebhookUrl();
      setWebhookUrl(url);
      setDidSucceed(true);
      toast.success('Workflow deployed successfully');

      if (!url) {
        setTimeout(() => {
          setModalOpen(false);
          setDidSucceed(false);
        }, AUTO_CLOSE_MS);
      }
    } catch (error: any) {
      console.error('Deploy failed:', error);
      toast.error(describeFailure(error, 'Deployment failed'));
    } finally {
      setIsDeploying(false);
    }
  }, [workflowId, save, onStatusChange, findWebhookUrl]);

  const undeploy = useCallback(async () => {
    if (!workflowId) return;
    setIsUndeploying(true);
    try {
      await orchestratorService.undeployWorkflow(workflowId);
      onStatusChange('draft');
      toast.success('Workflow undeployed successfully');
    } catch (error: any) {
      console.error('Undeploy failed:', error);
      toast.error(describeFailure(error, 'Undeploy failed'));
    } finally {
      setIsUndeploying(false);
    }
  }, [workflowId, onStatusChange]);

  return {
    isModalOpen,
    setModalOpen,
    isDeploying,
    didSucceed,
    setDidSucceed,
    webhookUrl,
    isUndeploying,
    deploy,
    undeploy,
  };
}
