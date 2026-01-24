import { useState, useEffect, useCallback } from 'react';
import { 
  Brain, 
  Activity, 
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import OrchestratorTimeline, { type OrchestratorStep } from '../components/orchestrator/OrchestratorTimeline';
import OrchestratorThoughts, { type Thought } from '../components/orchestrator/OrchestratorThoughts';
import PendingApprovals, { type PendingAction } from '../components/orchestrator/PendingApprovals';
import ApprovalModal from '../components/modals/ApprovalModal';
import ClarificationModal from '../components/modals/ClarificationModal';
import ErrorRecoveryModal from '../components/modals/ErrorRecoveryModal';
import { cn } from '../lib/utils';
import { orchestratorService, type HITLRequest } from '../api';
import { useHITLWebSocket, type ExecutionEvent } from '../hooks/useWebSocket';

export default function Orchestrator() {
  // Note: setters are intentionally unused for now - will be used when backend integration is complete
  const [steps] = useState<OrchestratorStep[]>([]);
  const [thoughts] = useState<Thought[]>([]);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused] = useState(false);
  const [selectedAction, setSelectedAction] = useState<PendingAction | null>(null);

  // Handle HITL WebSocket messages
  const handleHITLRequest = useCallback((event: ExecutionEvent) => {
    if (event.type === 'hitl_request') {
      const request = event.data as unknown as HITLRequest;
      setPendingActions(prev => [...prev, {
        id: request.request_id,
        type: request.request_type,
        title: request.title,
        description: request.message,
        workflowName: request.workflow_name || 'Unknown',
        nodeName: request.node_id,
        timestamp: new Date(request.created_at),
        urgency: 'high',
      }]);
    }
  }, []);

  const { connected: wsConnected, respond: wsRespond } = useHITLWebSocket(handleHITLRequest);

  // Fetch pending HITL requests
  const fetchPendingRequests = useCallback(async () => {
    try {
      const data = await orchestratorService.getPendingHITL();
      const requests = data?.requests || [];
      setPendingActions(requests.map(r => ({
        id: r.request_id,
        type: r.request_type,
        title: r.title,
        description: r.message,
        workflowName: r.workflow_name || 'Unknown',
        nodeName: r.node_id,
        timestamp: new Date(r.created_at),
        urgency: 'medium',
      })));
    } catch (err) {
      console.error('Failed to fetch HITL requests:', err);
      setPendingActions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingRequests();
  }, [fetchPendingRequests]);

  const handleActionClick = (action: PendingAction) => {
    setSelectedAction(action);
  };

  const handleApprove = async () => {
    if (selectedAction) {
      try {
        await orchestratorService.respondToHITL(selectedAction.id, { action: 'approve' });
        wsRespond(selectedAction.id, { action: 'approve' });
        setPendingActions(prev => prev.filter(a => a.id !== selectedAction.id));
      } catch (err) {
        console.error('Failed to approve:', err);
      }
      setSelectedAction(null);
    }
  };

  const handleReject = async () => {
    if (selectedAction) {
      try {
        await orchestratorService.respondToHITL(selectedAction.id, { action: 'reject' });
        wsRespond(selectedAction.id, { action: 'reject' });
        setPendingActions(prev => prev.filter(a => a.id !== selectedAction.id));
      } catch (err) {
        console.error('Failed to reject:', err);
      }
      setSelectedAction(null);
    }
  };

  const handleClarificationRespond = async (response: string) => {
    if (selectedAction) {
      try {
        await orchestratorService.respondToHITL(selectedAction.id, { 
          action: 'respond', 
          response 
        });
        setPendingActions(prev => prev.filter(a => a.id !== selectedAction.id));
      } catch (err) {
        console.error('Failed to respond:', err);
      }
      setSelectedAction(null);
    }
  };

  const handleRetry = async () => {
    if (selectedAction) {
      try {
        await orchestratorService.respondToHITL(selectedAction.id, { action: 'retry' });
        setPendingActions(prev => prev.filter(a => a.id !== selectedAction.id));
      } catch (err) {
        console.error('Failed to retry:', err);
      }
      setSelectedAction(null);
    }
  };

  const handleSkip = async () => {
    if (selectedAction) {
      try {
        await orchestratorService.respondToHITL(selectedAction.id, { action: 'skip' });
        setPendingActions(prev => prev.filter(a => a.id !== selectedAction.id));
      } catch (err) {
        console.error('Failed to skip:', err);
      }
      setSelectedAction(null);
    }
  };

  const handleStop = async () => {
    if (selectedAction) {
      try {
        await orchestratorService.respondToHITL(selectedAction.id, { action: 'stop' });
        setPendingActions(prev => prev.filter(a => a.id !== selectedAction.id));
      } catch (err) {
        console.error('Failed to stop:', err);
      }
      setSelectedAction(null);
    }
  };

  return (
    <div className="h-full overflow-auto bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-600 to-blue-500 rounded-xl">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Orchestrator</h1>
              <p className="text-sm text-muted-foreground">AI thinking, planning, and execution monitor</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* WebSocket status */}
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
              wsConnected 
                ? "bg-green-500/10 text-green-600" 
                : "bg-yellow-500/10 text-yellow-600"
            )}>
              {wsConnected ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              {wsConnected ? 'Connected' : 'Connecting...'}
            </div>

            {/* Pending count */}
            {pendingActions.length > 0 && (
              <div className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium">
                {pendingActions.length} pending
              </div>
            )}

            <button
              onClick={fetchPendingRequests}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column: Timeline */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-card border rounded-xl p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  Execution Timeline
                </h3>
                {steps.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No activity yet</p>
                    <p className="text-sm">Execute a workflow to see the orchestrator in action</p>
                  </div>
                ) : (
                  <OrchestratorTimeline 
                    steps={steps} 
                    currentStepId={steps[steps.length - 1]?.id} 
                  />
                )}
              </div>
            </div>

            {/* Right column: Thoughts & Pending Actions */}
            <div className="space-y-6">
              <OrchestratorThoughts 
                thoughts={thoughts} 
                isThinking={!isPaused} 
              />
              <PendingApprovals 
                actions={pendingActions} 
                onActionClick={handleActionClick} 
              />
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <ApprovalModal
        isOpen={selectedAction?.type === 'approval'}
        title={selectedAction?.title || ''}
        description={selectedAction?.description || ''}
        onApprove={handleApprove}
        onReject={handleReject}
        onClose={() => setSelectedAction(null)}
      />

      <ClarificationModal
        isOpen={selectedAction?.type === 'clarification'}
        question={selectedAction?.description || ''}
        options={['Option 1', 'Option 2', 'Option 3']}
        onRespond={handleClarificationRespond}
        onClose={() => setSelectedAction(null)}
      />

      <ErrorRecoveryModal
        isOpen={selectedAction?.type === 'error'}
        error={selectedAction?.description || ''}
        nodeName={selectedAction?.nodeName || ''}
        onRetry={handleRetry}
        onSkip={handleSkip}
        onStop={handleStop}
        onClose={() => setSelectedAction(null)}
      />
    </div>
  );
}
