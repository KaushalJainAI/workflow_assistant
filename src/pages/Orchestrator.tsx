import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Brain, 
  Activity, 
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  Settings,
  ChevronDown,
  Square
} from 'lucide-react';
import OrchestratorTimeline, { type OrchestratorStep } from '../components/orchestrator/OrchestratorTimeline';
import OrchestratorLogs, { type LogEntry } from '../components/orchestrator/OrchestratorLogs';
import PendingApprovals, { type PendingAction } from '../components/orchestrator/PendingApprovals';
import BackgroundTaskPanel, { type BackgroundTask } from '../components/orchestrator/BackgroundTaskPanel';
import AIAnalysis from '../components/orchestrator/AIAnalysis';
import Select from '../components/ui/Select';
import ApprovalModal from '../components/modals/ApprovalModal';
import ClarificationModal from '../components/modals/ClarificationModal';
import ErrorRecoveryModal from '../components/modals/ErrorRecoveryModal';
import ExecutionDetailModal from '../components/orchestrator/ExecutionDetailModal';
import { cn } from '../lib/utils';
import { 
  orchestratorService, 
  logsService,
  credentialsService,
  workflowsService,
  type HITLRequest,
  type OrchestratorThought,
  type ExecutionDetail,
  type Workflow
} from '@/api';
import { useWebSocket, useHITLWebSocket, type ExecutionEvent } from '../hooks/useWebSocket';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAssistant } from '../contexts/AssistantContext';
import { useAIModels } from '../hooks/useAIModels';

export default function Orchestrator() {
  const navigate = useNavigate();
  
  // State for Timeline and Thoughts
  const [liveSteps, setLiveSteps] = useState<OrchestratorStep[]>([]);
  const [historySteps, setHistorySteps] = useState<OrchestratorStep[]>([]);
  const [rawLogs, setRawLogs] = useState<LogEntry[]>([]);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAction, setSelectedAction] = useState<PendingAction | null>(null);
  const [activeSupervisionLevel, setActiveSupervisionLevel] = useState<string | null>(null);
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null);
  const [activeNarrative, setActiveNarrative] = useState<any>(null);
  const [activeActivities, setActiveActivities] = useState<any[]>([]);
  const [backgroundTasks, setBackgroundTasks] = useState<BackgroundTask[]>([]);
  const [isAutoTracking, setIsAutoTracking] = useState(true);
  const isInitialLoad = useRef(true);

  // History Modal State
  const [selectedHistoryExecution, setSelectedHistoryExecution] = useState<ExecutionDetail | null>(null);
  const [isHistoryModalLoading, setIsHistoryModalLoading] = useState(false);
  const [historyActivities, setHistoryActivities] = useState<OrchestratorThought[]>([]);
  const [historyNarrative, setHistoryNarrative] = useState<OrchestratorThought | null>(null);
  
  // LLM Settings State
  const { 
    llmProvider: globalProvider, 
    llmModel: globalModel,
    llmCredential: globalCredential,
    hasCredentials,
  } = useAssistant();

  const [showSettings, setShowSettings] = useState(false);
  const [llmProvider, setLlmProvider] = useState(globalProvider);
  const [llmModel, setLlmModel] = useState(globalModel);
  const [llmCredential, setLlmCredential] = useState<string | null>(globalCredential);
  const [availableCredentials, setAvailableCredentials] = useState<any[]>([]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const { providers: dynamicProviders } = useAIModels();

  // Sync local selection state when global state or dropdown changes
  useEffect(() => {
    if (!showSettings) {
      setLlmProvider(globalProvider);
      setLlmModel(globalModel);
      setLlmCredential(globalCredential);
    }
  }, [globalProvider, globalModel, globalCredential, showSettings]);

  // Fetch credentials list
  const fetchCredentialsList = useCallback(async () => {
    try {
      const { credentials } = await credentialsService.list();
      setAvailableCredentials(credentials);
    } catch (err) {
      console.error('Failed to fetch credentials:', err);
    }
  }, []);

  // Save LLM settings via unified context
  const { syncLlmSettings } = useAssistant();

  const hydrateTimeline = useCallback(async (executionId: string, status?: string) => {
    try {
      // 0. Build a fresh state - avoids merging across executions
      let freshSteps: OrchestratorStep[] = [];
      let freshLogs: any[] = [];

      // 1. Fetch persistent activities and execution detail
      const [activities, executionDetail] = await Promise.all([
        logsService.getActivityLogs(executionId),
        logsService.getExecution(executionId).catch(() => null)
      ]);
      
      const nodeLogs = executionDetail?.node_logs || [];
      const workflowId = executionDetail?.workflow_id;
      
      // 1.1 Fetch Workflow to see "upcoming" nodes
      let fullWorkflow: Workflow | null = null;
      if (workflowId) {
        fullWorkflow = await workflowsService.get(workflowId).catch(() => null);
      }
      
      if (activities && activities.length > 0) {
        const isFinished = status === 'completed' || status === 'failed' || status === 'success' || status === 'cancelled';
        
        // 2. Hydrate raw logs
        freshLogs = activities.map(t => ({
          id: `thought-${t.id}`,
          timestamp: new Date(t.created_at),
          level: (t.thought_type === 'error' ? 'error' : (t.node_id === 'orchestrator' ? 'ai' : 'info')) as any,
          message: t.content,
          source: t.node_id === 'orchestrator' ? 'Orchestrator' : `Node: ${t.node_id}`,
          data: {
            thought_type: t.thought_type,
            reasoning: t.reasoning,
            ...t.metadata
          }
        }));

        freshSteps = activities.map((t: OrchestratorThought) => {
          const nodeLog = t.node_id ? nodeLogs.find(nl => nl.node_id === t.node_id) : null;
          
          return {
            id: `persisted-${t.id}`,
            type: ((isFinished || t.thought_type === 'thought') ? 'completed' : 'thinking') as any,
            title: (t.node_name || t.node_id) ? `Task: ${t.node_name || t.node_id}` : 'AI Thought',
            timestamp: new Date(t.created_at),
            nodeId: t.node_id,
            thought: t.thought_type === 'thought' ? t.content : undefined,
            reasoning: t.reasoning,
            thinkingMessage: t.thought_type === 'thinking' ? t.content : undefined,
            input: nodeLog?.input_data,
            output: nodeLog?.output_data,
            duration: nodeLog?.duration_ms
          };
        }).sort((a: any, b: any) => a.timestamp.getTime() - b.timestamp.getTime());

        // 4. Calculate "upcoming" nodes
        if (fullWorkflow && fullWorkflow.nodes) {
          const executedNodeIds = new Set(nodeLogs.map(nl => nl.node_id));
          const upcomingNodes = fullWorkflow.nodes.filter(n => !executedNodeIds.has(n.id));
          
          const upcomingSteps: OrchestratorStep[] = upcomingNodes.map(n => ({
            id: `upcoming-${n.id}`,
            type: 'waiting' as any,
            title: n.data?.label || n.id,
            description: `Future node in ${fullWorkflow?.name || 'execution chain'}`,
            timestamp: new Date(), 
            nodeId: n.id
          }));
          
          freshSteps = [...freshSteps, ...upcomingSteps];
        }
      }

      // 4. Fetch narrative if finished
      if (status === 'completed' || status === 'failed' || status === 'success' || status === 'cancelled') {
          try {
              const narrative = await logsService.getNarrative(executionId);
              setActiveNarrative(narrative);
              if (narrative) {
                  freshSteps.push({
                    id: 'narrative-' + executionId,
                    type: 'completed',
                    title: 'Final AI Review',
                    timestamp: new Date(narrative.created_at),
                    nodeId: 'orchestrator-narrative',
                    thought: narrative.content,
                    description: narrative.reasoning
                  });
                }
            } catch (e) {
                console.warn('Narrative not found yet or failed to fetch');
                setActiveNarrative(null);
            }
        } else {
            setActiveNarrative(null);
        }

        setRawLogs(freshLogs.slice(-50));
        setActiveActivities(activities);
        setLiveSteps(freshSteps);
    } catch (err) {
      console.error('Failed to hydrate thought history:', err);
    }
  }, [liveSteps.length]); // Dependencies for hydrateTimeline

  const fetchActiveTasks = useCallback(async () => {
    try {
      const { tasks, history } = await orchestratorService.getBackgroundTasks();
      
      // Update historical view
      const historyEvents: OrchestratorStep[] = (history || []).map(h => ({
        id: h.id,
        type: h.status === 'completed' ? 'completed' : (h.status === 'cancelled' ? 'cancelled' : 'error'),
        title: h.name,
        timestamp: new Date(h.started_at),
        description: `Status: ${h.status}`,
        details: [`Workflow ID: ${h.workflow_id}`, `Supervision: ${h.supervision_level}`]
      }));
      setHistorySteps(historyEvents);
      setBackgroundTasks(tasks || []);
      
      // Smart Auto-Tracking: Only jump to live tasks if mode is enabled
      if (!isAutoTracking) return;

      // Handle active tasks and timeline hydration
      if (tasks && tasks.length > 0) {
        const latestTask = tasks[0];
        
        // Prevent re-hydrating the same active task if we already have it
        if (activeExecutionId === latestTask.id && liveSteps.length > 0) return;

        setActiveSupervisionLevel(latestTask.supervision_level);
        setActiveExecutionId(latestTask.id);
        await hydrateTimeline(latestTask.id, latestTask.status);
      } else if (history && history.length > 0 && liveSteps.length === 0 && isInitialLoad.current) {
        // Only auto-hydrate first history on initial load
        isInitialLoad.current = false;
        const latestHistory = history[0];
        setActiveSupervisionLevel(latestHistory.supervision_level);
        setActiveExecutionId(latestHistory.id);
        await hydrateTimeline(latestHistory.id, latestHistory.status);
      }
      // ... rest of stale resolution removed or simplified
    } catch (err) {
      console.error('Failed to fetch active tasks:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeExecutionId, isAutoTracking, liveSteps.length, hydrateTimeline]);

  const saveLLMSettings = useCallback(async (provider: string, model: string, credentialId: string | null) => {
    setIsSavingSettings(true);
    try {
      await syncLlmSettings(provider, model, credentialId);
      toast.success(`AI Model updated: ${provider}/${model}`);
      setShowSettings(false);
    } catch (err) {
      console.error('Failed to save LLM settings:', err);
      toast.error('Failed to save AI settings');
    } finally {
      setIsSavingSettings(false);
    }
  }, [syncLlmSettings]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((event: ExecutionEvent) => {
    // Add to Raw Logs (Cleaner version)
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      level: event.type.includes('error') ? 'error' : 
             (event.type.includes('notification') ? 'ai' : 'engine'),
      message: (event as any).data?.content || (event as any).data?.message || event.type,
      source: (event as any).type === 'notification' ? 'Orchestrator' : 'Execution Engine',
      data: event.data
    };
    // Only keep last 50 logs to prevent state bloat/lag
    setRawLogs(prev => [...prev, newLog].slice(-50));

    if (event.type === 'hitl_request' || (event as any).type === 'new_request') {
      const request = event.data as unknown as HITLRequest;
      setPendingActions(prev => {
        if (prev.some(a => a.id === request.request_id)) return prev;
        return [...prev, {
          id: request.request_id,
          type: request.request_type,
          title: request.title,
          description: request.message,
          workflowName: request.workflow_name || 'Unknown',
          nodeName: request.node_id,
          timestamp: new Date(request.created_at || new Date()),
          urgency: 'high',
        }];
      });
      return;
    }

    // Process Execution and Notification events with consolidation
    const payload = (event.data || (event as any).data) as any;
    // Unwrap nested data for StreamEvent (execution.event), otherwise use payload directly (notifications, state_sync)
    const eventData = payload?.data || payload;
    
    // Normalize Event Type and Node ID
    // Check both payload root (StreamEvent) and nested data (direct)
    const eventType = String(payload?.event_type || payload?.type || eventData?.type || '');
    const nodeId = String(eventData?.node_id || payload?.node_id || '');
    const status = eventData?.status || payload?.status;
    
    // Fix: Use server timestamp if available
    const eventTimestamp = eventData?.timestamp || payload?.timestamp || (event as any).timestamp;
    const timestamp = eventTimestamp ? new Date(eventTimestamp) : new Date();

    if (event.type === 'execution.state_sync' || (event as any).type === 'execution.state_sync') {
      if (payload.nodes || eventData.nodes) {
        const nodes = payload.nodes || eventData.nodes;
        setLiveSteps(prev => {
          // Merge logic: nodes from state_sync might already be in prev (from hydrateTimeline)
          // We prioritize state_sync status over existing one
          const newSteps = [...prev];
          nodes.forEach((node: any) => {
            const existingIndex = newSteps.findIndex(s => s.nodeId === node.node_id);
            const statusType = node.status === 'running' ? 'executing' : (node.status === 'failed' ? 'error' : (node.status === 'cancelled' ? 'cancelled' : 'completed'));
            
            if (existingIndex >= 0) {
              // Update existing step with sync data
              newSteps[existingIndex] = {
                ...newSteps[existingIndex],
                type: statusType,
                 // Don't overwrite title if it's already set nicely, unless it's just a default ID
                title: newSteps[existingIndex].title.includes(node.node_id) && node.status !== 'running' 
                  ? (node.status === 'failed' ? `Error: ${node.node_id}` : `Completed: ${node.node_id}`)
                  : newSteps[existingIndex].title,
                timestamp: node.started_at ? new Date(node.started_at) : newSteps[existingIndex].timestamp
              };
            } else {
              newSteps.push({
                id: Math.random().toString(36).substr(2, 9),
                type: statusType,
                title: node.node_id ? `${node.status === 'running' ? 'Executing' : 'Completed'}: ${node.node_id}` : 'Node Task',
                nodeId: node.node_id,
                timestamp: node.started_at ? new Date(node.started_at) : new Date()
              });
            }
          });
          return newSteps.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()).slice(-30);
        });
      }
      return;
    }

    // Explicitly check for execution events
    const isExecutionEvent = event.type === 'execution.event' || (event as any).type === 'execution.event' || eventType.startsWith('node_') || eventType.startsWith('workflow_');

    if (isExecutionEvent) {
      if (eventType === 'node_start' || eventType === 'node_started' || status === 'running') {
        setLiveSteps(prev => {
          const existing = nodeId ? prev.find(s => s.nodeId === nodeId) : null;
          if (existing) {
            return prev.map(s => s.nodeId === nodeId ? {
              ...s,
              type: 'executing',
              title: nodeId ? `Executing: ${nodeId}` : s.title,
            } : s);
          }
          const newStep: OrchestratorStep = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'executing',
            title: nodeId ? `Executing: ${nodeId}` : 'Executing Node',
            timestamp,
            // Only set nodeId if we actually have one
            nodeId: nodeId || undefined, 
          };
          return [...prev, newStep].slice(-25);
        });
      } else if (eventType === 'node_complete' || eventType === 'node_finished' || status === 'completed' || status === 'success') {
        const duration = eventData?.duration_ms || payload?.duration_ms;
        setLiveSteps(prev => prev.map(s => s.nodeId === nodeId ? {
          ...s,
          type: 'completed',
          title: nodeId ? `Completed: ${nodeId}` : s.title,
          description: duration ? `${duration}ms` : s.description
        } : s));
      } else if (eventType === 'node_error' || eventType === 'node_failed' || status === 'failed') {
        const errorMsg = eventData?.error || payload?.error || 'Node execution failed';
        setLiveSteps(prev => prev.map(s => s.nodeId === nodeId ? {
          ...s,
          type: 'error',
          title: nodeId ? `Error: ${nodeId}` : s.title,
          description: errorMsg,
          details: [errorMsg]
        } : s));
      } else if (eventType === 'workflow_complete' || eventType === 'workflow_error' || eventType === 'workflow_cancelled') {
        // Resolve all active steps when workflow finishes
        setLiveSteps(prev => prev.map(s => ({
          ...s,
          type: (s.type === 'executing' || s.type === 'thinking') 
            ? (eventType === 'workflow_complete' ? 'completed' : (eventType === 'workflow_cancelled' ? 'cancelled' : 'error')) 
            : s.type
        })));
        
        if (eventType === 'workflow_error') {
          toast.error(`Workflow Failed: ${eventData.error || payload.error || 'Unknown error'}`);
        } else if (eventType === 'workflow_cancelled') {
          toast.info('Workflow execution stopped');
          fetchActiveTasks();
        } else {
          toast.success('Workflow Completed Successfully');
          fetchActiveTasks();
        }
      }
    } else if (event.type === 'notification' || (event as any).type === 'notification') {
      const notifData = payload?.category ? payload : eventData;
      
      if (notifData.category === 'orchestrator_activity') {
        console.log('Orchestrator Activity Received:', notifData.type, notifData);
        if (notifData.type === 'thinking') {
          setLiveSteps(prev => {
            const existing = nodeId ? prev.find(s => 
              s.nodeId === nodeId || 
              (s.nodeId && nodeId && (s.nodeId.endsWith(nodeId) || nodeId.endsWith(s.nodeId)))
            ) : null;
            if (existing) {
              return prev.map(s => 
                (s.nodeId === nodeId || (s.nodeId && nodeId && (s.nodeId.endsWith(nodeId) || nodeId.endsWith(s.nodeId))))
                  ? { ...s, thinkingMessage: notifData.content } 
                  : s
              );
            }
            // If thinking starts but no step exists, create a thinking step
            const newStep: OrchestratorStep = {
              id: Math.random().toString(36).substr(2, 9),
              type: 'thinking',
              title: 'Orchestrating Workflow',
              timestamp,
              nodeId: nodeId || undefined,
              thinkingMessage: notifData.content,
              reasoning: notifData.reasoning
            };
            return [...prev, newStep].slice(-25);
          });
        } else if (notifData.type === 'thought') {
          setLiveSteps(prev => {
            const existingIndex = prev.findIndex(s => 
              s.nodeId === nodeId || 
              (s.nodeId && nodeId && (s.nodeId.endsWith(nodeId) || nodeId.endsWith(s.nodeId)))
            );
            if (existingIndex >= 0) {
              const newSteps = [...prev];
              newSteps[existingIndex] = {
                ...newSteps[existingIndex],
                thought: notifData.content,
                reasoning: notifData.reasoning,
                thinkingMessage: undefined
              };
              return newSteps;
            }
            // If we receive a thought but no exact step exists (e.g. orchestrator global thought)
            const newStep: OrchestratorStep = {
              id: Math.random().toString(36).substr(2, 9),
              type: 'completed',
              title: nodeId === 'orchestrator' ? 'Global Analysis' : `Analysis: ${nodeId}`,
              timestamp,
              nodeId: nodeId || undefined,
              thought: notifData.content
            };
            return [...prev, newStep].slice(-30);
          });
        } else if (notifData.type === 'status') {
          setLiveSteps(prev => {
            const existing = nodeId ? prev.find(s => s.nodeId === nodeId) : null;
            if (existing) {
              return prev.map(s => s.nodeId === nodeId && s.type !== 'completed' ? {
                ...s,
                title: notifData.content,
                description: nodeId ? `Active Node: ${nodeId}` : undefined
              } : s);
            }
            const newStep: OrchestratorStep = {
              id: Math.random().toString(36).substr(2, 9),
              type: 'thinking',
              title: notifData.content,
              timestamp,
              nodeId: nodeId || undefined,
              description: nodeId ? `Active Node: ${nodeId}` : undefined
            };
            return [...prev, newStep].slice(-10);
          });
          // toast.info(notifData.content); 
        }
      }
    }
    
  }, []);

  const { connected: wsConnected, respond: wsRespond } = useHITLWebSocket(handleWebSocketMessage);
  const { isConnected: execWsConnected } = useWebSocket(activeExecutionId, { onMessage: handleWebSocketMessage });

  // Fetch data
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



  const handleHistoryClick = async (executionId: string, status: string) => {
    try {
      setIsHistoryModalLoading(true);
      // We still update the main view background state if needed, 
      // but primary goal is opening the modal
      const [details, activities, narrative] = await Promise.all([
        logsService.getExecution(executionId),
        logsService.getActivityLogs(executionId).catch(() => []),
        logsService.getNarrative(executionId).catch(() => null)
      ]);
      
      setSelectedHistoryExecution(details);
      setHistoryActivities(activities);
      setHistoryNarrative(narrative);
      
      // Optional: also update the main timeline in background
      setActiveExecutionId(executionId);
      hydrateTimeline(executionId, status);
    } catch (err) {
      console.error('Failed to load history details:', err);
      toast.error('Failed to load execution details');
    } finally {
      setIsHistoryModalLoading(false);
    }
  };

  const handleResumeLive = () => {
    setIsAutoTracking(true);
    // fetchActiveTasks will handle picking up the live execution on the next tick
    // or we can trigger it immediately
    fetchActiveTasks();
  };

  // Initial Load - Only once
  useEffect(() => {
    fetchCredentialsList();
    fetchPendingRequests();
  }, [fetchCredentialsList, fetchPendingRequests]);

  // Active Task Polling - Slower interval, doesn't re-trigger creds/HITL
  useEffect(() => {
    fetchActiveTasks();
    const interval = setInterval(fetchActiveTasks, 20000); // 2-second polling as requested
    return () => clearInterval(interval);
  }, [fetchActiveTasks]);

  // HITL Handlers
  const handleActionClick = (action: PendingAction) => setSelectedAction(action);
  
  const handleApprove = async () => {
    if (selectedAction) {
      try {
        await orchestratorService.respondToHITL(selectedAction.id, { action: 'approve' });
        wsRespond(selectedAction.id, { action: 'approve' });
        setPendingActions(prev => prev.filter(a => a.id !== selectedAction.id));
      } catch (err) { console.error('Approve failed:', err); }
      setSelectedAction(null);
    }
  };

  const handleReject = async () => {
    if (selectedAction) {
      try {
        await orchestratorService.respondToHITL(selectedAction.id, { action: 'reject' });
        wsRespond(selectedAction.id, { action: 'reject' });
        setPendingActions(prev => prev.filter(a => a.id !== selectedAction.id));
      } catch (err) { console.error('Reject failed:', err); }
      setSelectedAction(null);
    }
  };

  const handleClarificationRespond = async (response: string) => {
    if (selectedAction) {
      try {
        await orchestratorService.respondToHITL(selectedAction.id, { action: 'respond', response });
        setPendingActions(prev => prev.filter(a => a.id !== selectedAction.id));
      } catch (err) { console.error('Respond failed:', err); }
      setSelectedAction(null);
    }
  };

  const handleRetry = async () => {
    if (selectedAction) {
      try {
        await orchestratorService.respondToHITL(selectedAction.id, { action: 'retry' });
        setPendingActions(prev => prev.filter(a => a.id !== selectedAction.id));
      } catch (err) { console.error('Retry failed:', err); }
      setSelectedAction(null);
    }
  };

  const handleSkip = async () => {
    if (selectedAction) {
      try {
        await orchestratorService.respondToHITL(selectedAction.id, { action: 'skip' });
        setPendingActions(prev => prev.filter(a => a.id !== selectedAction.id));
      } catch (err) { console.error('Skip failed:', err); }
      setSelectedAction(null);
    }
  };

  const handleStop = async () => {
    if (selectedAction) {
      try {
        await orchestratorService.respondToHITL(selectedAction.id, { action: 'stop' });
        setPendingActions(prev => prev.filter(a => a.id !== selectedAction.id));
      } catch (err) { console.error('Stop failed:', err); }
      setSelectedAction(null);
    }
  };

  const handleTerminateExecution = async () => {
    if (!activeExecutionId) return;
    
    if (!confirm('Are you sure you want to terminate this execution?')) return;
    
    try {
      await orchestratorService.stopExecution(activeExecutionId);
      toast.success('Termination signal sent');
      // The websocket will broadcast cancellation soon, 
      // but let's optimistic update the timeline if we can or just wait for WS
    } catch (err) {
      console.error('Termination failed:', err);
      toast.error('Failed to terminate execution');
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-xl border-b border-border/60">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl shadow-sm">
              <Brain className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground/90">Orchestrator</h1>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] opacity-60">Monitor • Think • Execute</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Auto-Tracking Status */}
            {!isAutoTracking ? (
              <button 
                onClick={handleResumeLive}
                className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary/20 transition-all text-xs font-bold animate-pulse"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                RESUME LIVE VIEW
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-xs font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                LIVE TRACKING
              </div>
            )}

            {/* WebSocket status badge - Restored */}
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300 shadow-sm",
              wsConnected 
                ? "bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20 shadow-emerald-500/5" 
                : "bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20 animate-pulse shadow-amber-500/5"
            )}>
              {wsConnected ? (
                <CheckCircle className="w-3.5 h-3.5" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5" />
              )}
              <span className="hidden md:inline">{wsConnected ? 'Connected' : 'Connecting...'}</span>
              <span className="md:hidden">{wsConnected ? 'Live' : '...'}</span>
            </div>

            {/* Model Selector in Header - Enlarged */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2 bg-muted/50 hover:bg-muted border border-border/60 rounded-xl transition-all text-sm font-semibold shadow-sm",
                  showSettings && "ring-2 ring-primary/20 border-primary/50 bg-muted"
                )}
              >
                <span className="text-xl leading-none grayscale-[0.5] group-hover:grayscale-0 transition-all">
                  {dynamicProviders.find(p => p.slug === globalProvider)?.icon || '🤖'}
                </span>
                <div className="text-left hidden sm:block leading-tight pr-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter opacity-70">Model Config</div>
                  <div className="line-clamp-1 max-w-[160px] text-foreground font-bold leading-none mt-0.5">
                    {dynamicProviders.find(p => p.slug === globalProvider)?.models.find(m => m.value === globalModel)?.name || globalModel}
                  </div>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-300", showSettings && "rotate-180")} />
              </button>

              {showSettings && (
                <div className="absolute right-0 mt-2 w-72 bg-card border border-border/80 rounded-xl shadow-2xl p-4 z-50 animate-in zoom-in-95 duration-200">
                  <div className="flex items-center gap-2 mb-4 text-primary">
                    <Settings className="w-4 h-4" />
                    <h4 className="font-bold text-sm">Orchestrator Config</h4>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <div className="flex items-center gap-2 text-amber-600 mb-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Transparency Note</span>
                      </div>
                      <p className="text-[11px] text-amber-700 leading-tight">
                        Changing the AI Orchestrator requires a <strong>verified credential</strong> for the selected provider. All AI planning and execution rely on these API keys.
                      </p>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Provider</label>
                      <Select
                        value={llmProvider}
                        onChange={(val) => {
                          setLlmProvider(val);
                          const provider = dynamicProviders.find(p => p.slug === val);
                          if (provider && provider.models.length > 0) {
                            setLlmModel(provider.models[0].value);
                          }
                        }}
                        options={dynamicProviders.map(p => ({
                          value: p.slug,
                          label: p.name,
                          icon: p.icon,
                          description: !p.has_credentials && p.slug !== 'ollama' ? 'Requires Credentials' : undefined,
                          className: !p.has_credentials && p.slug !== 'ollama' ? 'opacity-50 italic' : ''
                        }))}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Model</label>
                      <Select
                        value={llmModel}
                        onChange={setLlmModel}
                        showSearch={true}
                        options={dynamicProviders.find(p => p.slug === llmProvider)?.models.map(m => ({
                          value: m.value,
                          label: m.name,
                          is_free: m.is_free
                        })) || []}
                      />
                    </div>

                    {llmProvider !== 'ollama' && (
                      <div>
                        <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Credential</label>
                        <Select
                          value={llmCredential || ''}
                          onChange={setLlmCredential}
                          options={[
                            { value: '', label: 'Auto-select (recommended)' },
                            ...availableCredentials
                              .filter(c => c.credential_type_display.toLowerCase().includes(llmProvider.toLowerCase()) || 
                                          (llmProvider === 'gemini' && c.credential_type_display.toLowerCase().includes('google')) ||
                                          (llmProvider === 'openrouter' && c.credential_type_display.toLowerCase().includes('openrouter')))
                              .map(c => ({
                                value: String(c.id),
                                label: c.name
                              }))
                          ]}
                        />
                      </div>
                    )}

                    <button
                      onClick={() => saveLLMSettings(llmProvider, llmModel, llmCredential)}
                      disabled={isSavingSettings}
                      className="w-full bg-primary text-primary-foreground font-bold py-2 rounded-lg text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    >
                      {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={fetchPendingRequests}
              className="p-2 hover:bg-muted border border-border/60 rounded-lg transition-colors"
              title="Refresh All"
            >
              <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area - Fixed Height Viewport */}
      <main className="flex-1 overflow-hidden p-6">
        {hasCredentials === false ? (
          /* Credential Gate */
          <div className="max-w-xl mx-auto mt-16 bg-card border border-border/60 rounded-2xl p-10 text-center shadow-2xl animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-8 ring-8 ring-amber-500/5">
              <AlertCircle className="w-12 h-12 text-amber-500" />
            </div>
            <h2 className="text-3xl font-black mb-3">Setup Required</h2>
            <p className="text-muted-foreground text-lg mb-10 leading-relaxed">
              Access to the AI Orchestrator is restricted because your active provider (<strong>{dynamicProviders.find(p => p.slug === globalProvider)?.name || globalProvider}</strong>) lacks a verified API key. 
              <br /><br />
              All AI operations—including workflow generation, planning, and real-time execution monitoring—require a verified connection to provide the necessary intelligence.
            </p>
            <div className="flex flex-col gap-4">
              <button 
                onClick={() => navigate('/credentials')}
                className="w-full bg-primary text-primary-foreground font-black py-4 rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-primary/20 text-lg"
              >
                Configure Credentials
              </button>
              <button 
                onClick={() => setShowSettings(true)}
                className="w-full bg-muted hover:bg-muted/80 text-foreground font-bold py-3 rounded-xl transition-all"
              >
                Switch AI Provider
              </button>
            </div>
          </div>
        ) : isLoading || hasCredentials === null ? (
          <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground font-medium animate-pulse">Initializing Orchestrator...</p>
          </div>
        ) : (
          /* Main Dashboard */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full stagger-children">
            {/* Timeline & Logs column */}
            <div className="lg:col-span-2 flex flex-col gap-6 h-full overflow-hidden">
              {/* Live Activity Segment - Scrollable */}
              <div className="bg-card border border-border/60 rounded-2xl flex flex-col flex-1 overflow-hidden shadow-sm">
                <div className="flex items-center justify-between p-8 pb-4 border-b border-border/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Activity className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="text-xl font-bold">Execution Timeline</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeExecutionId && liveSteps.some(s => s.type === 'thinking' || s.type === 'executing') && (
                      <button
                        onClick={handleTerminateExecution}
                        className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full text-[10px] font-bold uppercase transition-all hover:bg-red-500 hover:text-white"
                      >
                        <Square className="w-3 h-3 fill-current" />
                        Terminate
                      </button>
                    )}
                    {activeSupervisionLevel && (
                      <div className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0",
                        activeSupervisionLevel === 'full' 
                          ? "bg-purple-500/10 text-purple-500 border-purple-500/20" 
                          : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                      )}>
                        <div className={cn("w-1 h-1 rounded-full", activeSupervisionLevel === 'full' ? "bg-purple-500" : "bg-blue-500")} />
                        <span className="uppercase tracking-tighter">
                          {activeSupervisionLevel === 'full' ? 'Full Supervision' : 'Error Only Mode'}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 px-3 py-1 bg-primary/5 rounded-full border border-primary/10">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        activeExecutionId && liveSteps.some(s => s.type === 'thinking' || s.type === 'executing') 
                          ? (execWsConnected ? "bg-primary animate-pulse" : "bg-orange-500 animate-pulse") 
                          : "bg-muted-foreground"
                      )} />
                      <span className="text-[10px] text-primary font-black uppercase tracking-widest">
                        {activeExecutionId 
                          ? (liveSteps.some(s => s.type === 'thinking' || s.type === 'executing') 
                            ? (execWsConnected ? 'Live Stream' : 'Live Stream (Connecting...)') 
                            : 'Execution Trace')
                          : 'Ready'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 pt-4 scrollbar-thin">
                  {liveSteps.length === 0 ? (
                    <div className="text-center py-20 bg-muted/20 rounded-2xl border border-dashed border-border/60">
                      <Brain className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                      <h3 className="font-bold text-lg">Waiting for Activity</h3>
                      <p className="max-w-xs mx-auto text-sm text-muted-foreground mt-2">
                         Start a workflow to see real-time AI reasoning and execution steps in this segment.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-8">
                       <OrchestratorTimeline 
                         steps={liveSteps} 
                         currentStepId={liveSteps[liveSteps.length - 1]?.id} 
                       />
                       
                       {/* Show Full AI Analysis if historical or narrative exists */}
                       {(activeNarrative || activeActivities.length > 0) && (
                         <div className="mt-12 pt-12 border-t border-border/20">
                            <AIAnalysis narrative={activeNarrative} activities={activeActivities} />
                         </div>
                       )}
                    </div>
                  )}
                </div>
              </div>

              {/* Log Segment - Fixed Height internal scroll */}
              <div className="shrink-0">
                <OrchestratorLogs logs={rawLogs} maxHeight="220px" />
              </div>
            </div>

            {/* Side Panel Column - Scrollable */}
            <div className="flex flex-col gap-8 h-full overflow-y-auto scrollbar-none pr-1">
              {/* Pending Approvals at the top */}
              <PendingApprovals 
                actions={pendingActions} 
                onActionClick={handleActionClick} 
              />
              
              <BackgroundTaskPanel 
                tasks={backgroundTasks} 
                loading={isLoading} 
                onRefresh={fetchActiveTasks}
                onStopTask={(taskId) => {
                  if (confirm('Stop this task?')) {
                    orchestratorService.stopExecution(taskId)
                      .then(() => {
                        toast.success('Stop signal sent');
                        fetchActiveTasks();
                      })
                      .catch(err => {
                        console.error('Stop failed:', err);
                        toast.error('Failed to stop task');
                      });
                  }
                }}
              />

              {/* Execution History Segment */}
              <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm shrink-0">
                <div className="flex items-center gap-3 mb-6">
                  <RefreshCw className="w-5 h-5 text-muted-foreground" />
                  <h2 className="text-lg font-bold">Execution History</h2>
                </div>

                {historySteps.length === 0 ? (
                  <p className="text-center py-8 text-sm text-muted-foreground italic bg-muted/20 rounded-xl border border-dashed border-border/40">
                    No recent history found
                  </p>
                ) : (
                  <div className="space-y-4">
                    {historySteps.map(step => (
                      <div 
                        key={step.id} 
                        onClick={() => handleHistoryClick(step.id, step.type === 'completed' ? 'completed' : 'failed')}
                        className={cn(
                          "flex items-start gap-3 p-3 bg-muted/30 rounded-xl border transition-all cursor-pointer group",
                          activeExecutionId === step.id 
                            ? "border-primary bg-primary/5 shadow-sm scale-[1.02]" 
                            : "border-border/40 hover:bg-muted/50 hover:border-border/80"
                        )}
                      >
                        <div className={cn(
                          "w-2 h-2 rounded-full mt-1.5 shrink-0 transition-transform group-hover:scale-125",
                          step.type === 'completed' ? "bg-green-500" : (step.type === 'cancelled' ? "bg-gray-400" : "bg-red-500")
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-bold truncate leading-none mb-1",
                            activeExecutionId === step.id ? "text-primary" : "text-foreground"
                          )}>
                            {step.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono truncate">
                            {new Date(step.timestamp).toLocaleTimeString()} • {step.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* HITL Modals */}
      <ApprovalModal
        isOpen={selectedAction?.type === 'approval'}
        title={selectedAction?.title || 'Approval Required'}
        description={selectedAction?.description || ''}
        onApprove={handleApprove}
        onReject={handleReject}
        onClose={() => setSelectedAction(null)}
      />

      <ClarificationModal
        isOpen={selectedAction?.type === 'clarification'}
        question={selectedAction?.description || ''}
        options={['Proceed', 'Stop', 'Modify']}
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

      {/* Reusable History Detail Modal */}
      <ExecutionDetailModal 
        execution={selectedHistoryExecution}
        loading={isHistoryModalLoading}
        activities={historyActivities}
        narrative={historyNarrative}
        onClose={() => setSelectedHistoryExecution(null)}
        onRefresh={(id) => handleHistoryClick(id, selectedHistoryExecution?.status || 'completed')}
      />
    </div>
  );
}
