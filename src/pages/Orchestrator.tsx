import { useState, useEffect } from 'react';
import { 
  Brain, 
  Activity, 
  RefreshCw,
  Play,
  Pause
} from 'lucide-react';
import OrchestratorTimeline, { type OrchestratorStep } from '../components/orchestrator/OrchestratorTimeline';
import OrchestratorThoughts, { type Thought } from '../components/orchestrator/OrchestratorThoughts';
import PendingApprovals, { type PendingAction } from '../components/orchestrator/PendingApprovals';
import ApprovalModal from '../components/modals/ApprovalModal';
import ClarificationModal from '../components/modals/ClarificationModal';
import ErrorRecoveryModal from '../components/modals/ErrorRecoveryModal';
import { cn } from '../lib/utils';

// Mock data for demonstration
const mockSteps: OrchestratorStep[] = [
  {
    id: '1',
    type: 'thinking',
    title: 'Analyzing workflow structure',
    description: 'Examining node connections and data flow patterns',
    details: ['Found 5 nodes in the workflow', 'Identified 2 conditional branches', 'Detected 1 loop structure'],
    timestamp: new Date(Date.now() - 120000),
    duration: 1200,
  },
  {
    id: '2',
    type: 'planning',
    title: 'Creating execution plan',
    description: 'Determining optimal node execution order',
    details: ['Set HTTP Request as first node', 'Scheduled parallel processing for Transform nodes', 'Added error handling for API calls'],
    timestamp: new Date(Date.now() - 60000),
    duration: 800,
  },
  {
    id: '3',
    type: 'executing',
    title: 'Running HTTP Request node',
    description: 'Fetching data from external API',
    nodeName: 'HTTP Request',
    timestamp: new Date(Date.now() - 30000),
  },
];

const mockThoughts: Thought[] = [
  {
    id: '1',
    type: 'observation',
    content: 'The workflow has 5 nodes with complex branching logic.',
    timestamp: new Date(Date.now() - 120000),
  },
  {
    id: '2',
    type: 'reasoning',
    content: 'HTTP Request should execute first to fetch the initial data.',
    timestamp: new Date(Date.now() - 90000),
  },
  {
    id: '3',
    type: 'decision',
    content: 'Will run Transform nodes in parallel to optimize performance.',
    timestamp: new Date(Date.now() - 60000),
  },
  {
    id: '4',
    type: 'action',
    content: 'Executing HTTP Request node with configured parameters.',
    timestamp: new Date(Date.now() - 30000),
  },
];

const mockPendingActions: PendingAction[] = [
  {
    id: '1',
    type: 'approval',
    title: 'Database Write Operation',
    description: 'This workflow will insert 150 new records into the production database.',
    workflowName: 'Data Sync Pipeline',
    nodeName: 'PostgreSQL Insert',
    timestamp: new Date(Date.now() - 300000),
    urgency: 'high',
  },
  {
    id: '2',
    type: 'clarification',
    title: 'API Selection Required',
    description: 'Multiple APIs found for email sending. Please select one.',
    workflowName: 'Email Automation',
    nodeName: 'Send Email',
    timestamp: new Date(Date.now() - 600000),
    urgency: 'medium',
  },
];

export default function Orchestrator() {
  const [steps, setSteps] = useState<OrchestratorStep[]>(mockSteps);
  const [thoughts, setThoughts] = useState<Thought[]>(mockThoughts);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>(mockPendingActions);
  const [isThinking] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedAction, setSelectedAction] = useState<PendingAction | null>(null);

  // Demo: Add new thoughts periodically
  useEffect(() => {
    if (isPaused) return;
    
    const interval = setInterval(() => {
      const newThought: Thought = {
        id: Date.now().toString(),
        type: ['observation', 'reasoning', 'decision', 'action'][Math.floor(Math.random() * 4)] as Thought['type'],
        content: [
          'Monitoring node execution progress...',
          'Checking for data validation errors...',
          'Optimizing data transformation logic...',
          'Preparing output for next node...',
        ][Math.floor(Math.random() * 4)],
        timestamp: new Date(),
      };
      setThoughts((prev) => [...prev.slice(-9), newThought]);
    }, 5000);

    return () => clearInterval(interval);
  }, [isPaused]);

  const handleActionClick = (action: PendingAction) => {
    setSelectedAction(action);
  };

  const handleApprove = () => {
    if (selectedAction) {
      setPendingActions((prev) => prev.filter((a) => a.id !== selectedAction.id));
      setSelectedAction(null);
    }
  };

  const handleReject = () => {
    if (selectedAction) {
      setPendingActions((prev) => prev.filter((a) => a.id !== selectedAction.id));
      setSelectedAction(null);
    }
  };

  const handleClarificationRespond = (response: string) => {
    console.log('Clarification response:', response);
    if (selectedAction) {
      setPendingActions((prev) => prev.filter((a) => a.id !== selectedAction.id));
      setSelectedAction(null);
    }
  };

  const handleRetry = () => {
    console.log('Retrying node...');
    setSelectedAction(null);
  };

  const handleSkip = () => {
    console.log('Skipping node...');
    if (selectedAction) {
      setPendingActions((prev) => prev.filter((a) => a.id !== selectedAction.id));
      setSelectedAction(null);
    }
  };

  const handleStop = () => {
    console.log('Stopping workflow...');
    if (selectedAction) {
      setPendingActions((prev) => prev.filter((a) => a.id !== selectedAction.id));
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
            {/* Status indicator */}
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
              isPaused 
                ? "bg-yellow-500/10 text-yellow-600" 
                : "bg-green-500/10 text-green-600"
            )}>
              <Activity className={cn("w-4 h-4", !isPaused && "animate-pulse")} />
              {isPaused ? 'Paused' : 'Active'}
            </div>

            {/* Controls */}
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? (
                <Play className="w-5 h-5" />
              ) : (
                <Pause className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={() => {
                setThoughts([]);
                setSteps([]);
              }}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title="Clear history"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
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
              isThinking={isThinking && !isPaused} 
            />
            <PendingApprovals 
              actions={pendingActions} 
              onActionClick={handleActionClick} 
            />
          </div>
        </div>
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
        options={['SendGrid', 'Mailgun', 'AWS SES']}
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
