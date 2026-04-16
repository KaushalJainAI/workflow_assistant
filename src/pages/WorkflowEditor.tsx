import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
  Panel,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeTypes,
} from 'reactflow';
import { Undo, Redo, Settings, Activity, Rocket, CheckCircle2, X, Plus, Copy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import NodePanel from '../components/workflow/NodePanel';
// import { useAssistant } from '../contexts/AssistantContext';
import NodeConfigPanel from '../components/workflow/NodeConfigPanel';
import { useKeyboardShortcuts, getDefaultShortcuts } from '../hooks/useKeyboardShortcuts';
import { useNodeTypes } from '../hooks/useNodeTypes';
import { useUndoRedo } from '../hooks/useUndoRedo';
import ImportWorkflowModal from '../components/workflow/ImportWorkflowModal';
import { validateWorkflow, getValidationSummary, type ValidationError } from '../lib/validateWorkflow';
import { workflowsService, orchestratorService } from '../api';
import { downloadWorkflow } from '../lib/workflowSerializer';
import { useVersionHistory } from '../hooks/useVersionHistory';
import VersionHistoryPanel from '../components/workflow/VersionHistoryPanel';
import WorkflowValidationPanel from '../components/workflow/WorkflowValidationPanel';
import WorkflowSettingsPanel, { type SupervisionLevel } from '../components/workflow/WorkflowSettingsPanel';
import { useHumanInTheLoop } from '../hooks/useHumanInTheLoop';
import ApprovalModal from '../components/modals/ApprovalModal';
import ClarificationModal from '../components/modals/ClarificationModal';
import { normalizeToItems } from '../types/nodeData';
import apiClient, { tokenManager } from '../api/client';
import WorkflowExecutionLog from '../components/workflow/WorkflowExecutionLog';
import { generateUniqueNodeLabel } from '../lib/utils';
// import ErrorRecoveryModal from '../components/modals/ErrorRecoveryModal';

import 'reactflow/dist/style.css';

import GenericNode from '../components/workflow/GenericNode';



const DeletableEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) => {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onEdgeClick = () => {
    setEdges((edges) => edges.filter((edge) => edge.id !== id));
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <button
            className="w-6 h-6 bg-card border border-border rounded-full text-xs hover:bg-destructive shadow-sm hover:text-white flex items-center justify-center transition-all duration-200"
            onClick={onEdgeClick}
            title="Remove connection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

const initialNodes: Node<any>[] = [];

const initialEdges: Edge[] = [];

const edgeTypes = {
  deletable: DeletableEdge,
};

const nodeTypes: NodeTypes = {
  generic: GenericNode,
  custom: GenericNode,
  trigger: GenericNode,
  conditional: GenericNode,
  switch: GenericNode,
};

export default function WorkflowEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { getNodeConfigSync } = useNodeTypes();
  const [workflowName, setWorkflowName] = useState('Untitled');
  const [workflowBackendId, setWorkflowBackendId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [nodePanelOpen, setNodePanelOpen] = useState(false);
  const [triggerPanelOpen, setTriggerPanelOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [copiedNode, setCopiedNode] = useState<Node | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  // const { closeAssistant } = useAssistant();
  const [workflowStatus, setWorkflowStatus] = useState<'draft' | 'active' | 'inactive' | 'archived'>('draft');
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedStateRef = useRef<{ nodes: Node[]; edges: Edge[]; workflowName: string } | null>(null);
  const edgesRef = useRef(edges);
  const [pendingSourceNodeId, setPendingSourceNodeId] = useState<string | null>(null);
  const [pendingSourceHandleId, setPendingSourceHandleId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<ValidationError[]>([]);
  const [validationSummary, setValidationSummary] = useState<string | null>(null);
  const [validationPanelOpen, setValidationPanelOpen] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [supervisionLevel, setSupervisionLevel] = useState<SupervisionLevel>('error_only');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [workflowContext, setWorkflowContext] = useState('');
  const [showExecutionLog, setShowExecutionLog] = useState(false);
  const [deployedWebhookUrl, setDeployedWebhookUrl] = useState<string | null>(null);
  const [isUndeploying, setIsUndeploying] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<{ id: string; title: string }[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  // Custom Hooks
  const { user } = useAuth();
  const undoRedo = useUndoRedo({ maxHistory: 50 });
  const { id: urlWorkflowId } = useParams<{ id: string }>();
  const { versions, saveVersion } = useVersionHistory(workflowBackendId?.toString() || urlWorkflowId || 'new-workflow');
  const { activeRequest, handleResolve, handleReject } = useHumanInTheLoop();

  // Find webhook URL if it exists in nodes
  const findWebhookUrl = useCallback(() => {
    const webhookNode = nodes.find(n => n.data?.nodeType === 'webhook_trigger');
    if (webhookNode && user) {
      const path = webhookNode.data?.config?.path?.replace(/^\/+/, '') || '';
      if (path) {
        // Construct backend URL (usually origin:8000 for local dev)
        const baseUrl = window.location.origin.replace(':3000', ':8000');
        return `${baseUrl}/api/webhooks/${user.id}/${path}`;
      }
    }
    return null;
  }, [nodes, user]);
  
  const isFirstRender = useRef(true);

  // Load existing workflow from backend when editing
  useEffect(() => {
    const loadWorkflow = async () => {
      if (urlWorkflowId && urlWorkflowId !== 'new') {
        try {
          const workflowIdNum = parseInt(urlWorkflowId, 10);
          if (!isNaN(workflowIdNum)) {
            const workflow = await workflowsService.get(workflowIdNum);
            setWorkflowBackendId(workflow.id);
            setWorkflowName(workflow.name);
            setWorkflowDescription(workflow.description || '');
            setWorkflowContext(workflow.context || '');
            setWorkflowStatus(workflow.status as any || 'draft');
            
            // Always set nodes/edges if provided, even if empty (to respect cleared state)
            if (workflow.nodes) {
              setNodes(workflow.nodes.filter((n: any) => n && typeof n === 'object').map((n: any) => ({
                ...n,
                type: n.type || 'custom',
                position: n.position || { x: 100, y: 100 }, // Fallback for missing position
              })) as Node<any>[]);
            }
            if (workflow.edges) {
              setEdges(workflow.edges.map(e => ({
                ...e,
                type: 'deletable',
                animated: true,
                style: { stroke: '#888', strokeWidth: 2 },
              })) as Edge[]);
            }
            
            // Load supervision level
            if (workflow.supervision_level) {
              setSupervisionLevel(workflow.supervision_level as SupervisionLevel);
            }
            
            // Load selected skills
            if (workflow.workflow_settings?.skills) {
              setSelectedSkills(workflow.workflow_settings.skills as string[]);
            }
            
            lastSavedStateRef.current = { 
              nodes: workflow.nodes as Node<any>[], 
              edges: workflow.edges as Edge[], 
              workflowName: workflow.name 
            };
          }
        } catch (error) {
          console.error('Failed to load workflow:', error);
        }
      }
    };
    loadWorkflow();
  }, [urlWorkflowId, setNodes, setEdges]);

  // Fetch available skills
  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const response = await apiClient.get('/skills/');
        // Mapping from Skill model to the simplified {id, title} format
        setAvailableSkills(response.data.map((s: any) => ({
          id: s.id.toString(),
          title: s.title
        })));
      } catch (error) {
        console.error('Failed to fetch skills:', error);
      }
    };
    fetchSkills();
  }, []);

  // Handler to open node panel from a specific node's + button
  const onAddNodeFromHandle = useCallback((sourceNodeId: string, sourceHandleId: string) => {
    setPendingSourceNodeId(sourceNodeId);
    setPendingSourceHandleId(sourceHandleId);
    setTriggerPanelOpen(false); // Close trigger panel if open
    
    // Auto-collapse other panels
    setConfigPanelOpen(false);
    
    setNodePanelOpen(true);
  }, [setConfigPanelOpen]);

  // Compute which nodes/handles have outgoing connections
  const nodesWithConnectionInfo = useMemo(() => {
    // Track which specific sourceHandle has an outgoing connection
    const handleConnections = new Map<string, Set<string>>();
    edges.forEach(e => {
      if (!handleConnections.has(e.source)) {
        handleConnections.set(e.source, new Set());
      }
      // Store the sourceHandle - could be undefined for default handle
      handleConnections.get(e.source)!.add(e.sourceHandle || 'output-0');
    });

    return nodes
      .filter(node => node && node.position) // Defensive check
      .map(node => ({
        ...node,
        data: {
          ...node.data,
          nodeId: node.id,
          connectedHandles: handleConnections.get(node.id) || new Set(),
          onAddNodeFromHandle,
        },
      }));
  }, [nodes, edges, onAddNodeFromHandle]);

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge({ 
      ...params, 
      type: 'deletable',
      animated: true,
      style: { stroke: '#888', strokeWidth: 2 }
    }, eds)),
    [setEdges],
  );

  // Keep edgesRef in sync
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    // If the node is already selected, clicking it again can open the panel
    // but n8n usually uses double click or a dedicated button.
    // We'll stick to double click but keep this for selection state.
  }, []);

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    
    // Auto-collapse others
    setNodePanelOpen(false);
    setTriggerPanelOpen(false);
    
    setConfigPanelOpen(true);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleAddNode = useCallback((nodeType: any) => {
    console.log('handleAddNode called with:', nodeType);

    // Determine the correct node type based on the node id
    const typeId = nodeType.baseNodeTypeId || nodeType.id || 'unknown';
    let type = 'custom';
    if (typeId && typeof typeId === 'string') {
       if (typeId.includes('trigger')) type = 'trigger';
       else if (typeId === 'if') type = 'conditional';
       else if (typeId === 'switch') type = 'switch';
    }

    console.log('Determined node type:', { typeId, type });

    // If adding from a node's + button, position to the right of that node
    let position = { x: 100, y: 200 };
    
    if (pendingSourceNodeId) {
      const sourceNode = nodes.find(n => n.id === pendingSourceNodeId);
      if (sourceNode) {
        position = {
          x: sourceNode.position.x + 250,
          y: sourceNode.position.y,
        };
      }
    } else if (nodes.length > 0) {
      // If adding generic node, place it offset from the last node or center
      // Simple strategy: find the right-most node and place it 100px down/right
      const lastNode = nodes[nodes.length - 1];
      if (lastNode && lastNode.position) {
          position = {
            x: lastNode.position.x + 50,
            y: lastNode.position.y + 50,
          };
      }
    }

    console.log('Adding node:', { type, typeId, position });

    const newNodeId = `node-${Date.now()}`;
    const uniqueLabel = generateUniqueNodeLabel(nodeType.name, nodes);

    const newNode: Node<any> = {
      id: newNodeId,
      type,
      position,
      data: { 
        label: uniqueLabel, 
        icon: nodeType.icon, 
        color: nodeType.color,
        nodeType: typeId,
        config: nodeType.config || {},
        ...(type === 'switch' ? { outputs: ['Case 1', 'Case 2', 'Default'] } : {}),
      },
    };
    setNodes((nds) => [...nds, newNode]);

    // Create edge from source node if adding from + button
    if (pendingSourceNodeId) {
      const newEdge: Edge = {
        id: `e-${pendingSourceNodeId}-${pendingSourceHandleId || 'output-0'}-${newNodeId}`,
        source: pendingSourceNodeId,
        sourceHandle: pendingSourceHandleId || 'output-0',
        target: newNodeId,
        targetHandle: 'input-0',
        type: 'deletable',
        animated: true,
        style: { stroke: '#888', strokeWidth: 2 },
      };
      setEdges((eds) => [...eds, newEdge]);
      setPendingSourceNodeId(null);
      setPendingSourceHandleId(null);
    }

    setNodePanelOpen(false);
    setTriggerPanelOpen(false);
  }, [setNodes, setEdges, pendingSourceNodeId, pendingSourceHandleId, nodes]);


  const handleDeleteNode = useCallback(() => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
      setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
      setSelectedNode(null);
      setConfigPanelOpen(false);
    }
  }, [selectedNode, setNodes, setEdges]);

  // Drag and drop handlers for adding nodes from panel
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    
    const nodeData = event.dataTransfer.getData('application/reactflow');
    if (!nodeData) return;

    try {
      const nodeType = JSON.parse(nodeData);
      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const position = {
        x: event.clientX - reactFlowBounds.left - 70,
        y: event.clientY - reactFlowBounds.top - 25,
      };

      const typeId = nodeType.baseNodeTypeId || nodeType.id;
      const uniqueLabel = generateUniqueNodeLabel(nodeType.name, nodes);

      const newNode: Node<any> = {
        id: `node-${Date.now()}`,
        type: typeId.includes('trigger') ? 'trigger' : 'custom',
        position,
        data: {
          label: uniqueLabel,
          icon: nodeType.icon,
          color: nodeType.color,
          nodeType: typeId,
          config: nodeType.config || {},
        },
      };

      setNodes((nds) => [...nds, newNode]);
      setNodePanelOpen(false);
    } catch (e) {
      console.error('Failed to parse dropped node data', e);
    }
  }, [setNodes]);


  // Handle updating node data from config panel
  const handleUpdateNode = useCallback((nodeId: string, newData: Record<string, unknown>) => {
    setNodes((nds) => 
      nds.map((n) => 
        n.id === nodeId 
          ? { ...n, data: { ...n.data, ...newData } }
          : n
      )
    );
  }, []); // ✅ Empty deps - setNodes is stable from useNodesState



  const handleDeploy = async () => {
    setIsDeploying(true);
    setDeployedWebhookUrl(null);
    try {
      if (!workflowBackendId) {
        await handleSave();
      }
      
      if (workflowBackendId) {
        await orchestratorService.deployWorkflow(workflowBackendId);
        setWorkflowStatus('active');
        
        // Find and set webhook URL if applicable
        const webhookUrl = findWebhookUrl();
        setDeployedWebhookUrl(webhookUrl);
        
        setDeploySuccess(true);
        toast.success('Workflow deployed successfully');
        
        // If there's a webhook URL, don't auto-close the modal so user can copy it
        if (!webhookUrl) {
          setTimeout(() => {
            setShowDeployModal(false);
            setDeploySuccess(false);
          }, 2000);
        }
      }
    } catch (error: any) {
      console.error('Deploy failed:', error);
      
      // Handle detailed backend validation errors
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Deployment failed';
      const details = error.response?.data?.details;
      
      if (details && Array.isArray(details)) {
        const detailMessages = details.map((d: any) => d.message || d).join('\n');
        toast.error(`${errorMessage}:\n${detailMessages}`);
      } else {
        const tip = error.response?.data?.tip;
        if (tip) {
          toast.error(`${errorMessage}\n\nTip: ${tip}`);
        } else {
          toast.error(errorMessage);
        }
      }
    } finally {
      setIsDeploying(false);
    }
  };

  const handleUndeploy = async () => {
    if (!workflowBackendId) return;
    
    setIsUndeploying(true);
    try {
      await orchestratorService.undeployWorkflow(workflowBackendId);
      setWorkflowStatus('draft');
      toast.success('Workflow undeployed successfully');
    } catch (error: any) {
      console.error('Undeploy failed:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Undeploy failed';
      toast.error(errorMessage);
    } finally {
      setIsUndeploying(false);
    }
  };

  // Handle batch save for settings
  const handleSettingsSave = async (desc: string, ctx: string, level: SupervisionLevel, skills: string[]) => {
    setWorkflowDescription(desc);
    setWorkflowContext(ctx);
    setSupervisionLevel(level);
    setSelectedSkills(skills);
    
    if (workflowBackendId) {
      try {
        await workflowsService.update(workflowBackendId, { 
          description: desc,
          context: ctx,
          supervision_level: level,
          workflow_settings: {
             ...((lastSavedStateRef.current as any)?.workflow_settings || {}),
             skills: skills
          }
        } as any);
        toast.success('Settings saved successfully');
      } catch (error) {
        console.error('Failed to save settings:', error);
        toast.error('Failed to save settings');
      }
    }
  };

  // ==================== KEYBOARD SHORTCUTS ====================

  // Record state changes for undo/redo
  useEffect(() => {
    // Skip first render to avoid recording initial state
    if (isFirstRender.current) {
      isFirstRender.current = false;
      undoRedo.pushState(nodes, edges);
      return;
    }
    // Debounced state recording handled by a timeout
    const timer = setTimeout(() => {
      undoRedo.pushState(nodes, edges);
    }, 300);
    return () => clearTimeout(timer);
  }, [nodes, edges, undoRedo]);

  // Handle save - calls actual backend API
  const handleSave = useCallback(async (isAutoSave = false) => {
    if (isSaving) return; // Prevent double saves
    
    setIsSaving(true);
    setIsSaving(true);
    if (isAutoSave) {
      setIsAutoSaving(true);
    }
    
    try {
      // Prepare nodes and edges for API (strip React Flow internal properties)
      const apiNodes = nodes.map(n => ({
        id: n.id,
        type: n.type || 'custom',
        position: n.position || { x: 100, y: 100 }, // Ensure position is never missing
        data: n.data,
      }));
      
      const apiEdges = edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        animated: e.animated,
      }));
      
      let savedWorkflow;
      
      if (workflowBackendId) {
        // Update existing workflow
        savedWorkflow = await workflowsService.update(workflowBackendId, {
          name: workflowName,
          description: workflowDescription,
          context: workflowContext,
          nodes: apiNodes as any,
          edges: apiEdges as any,
          workflow_settings: {
            skills: selectedSkills
          }
        });
      } else {
        // Create new workflow
        savedWorkflow = await workflowsService.create({
          name: workflowName || 'Untitled',
          description: workflowDescription,
          context: workflowContext,
          nodes: apiNodes as any,
          edges: apiEdges as any,
          status: 'draft',
          workflow_settings: {
            skills: selectedSkills
          }
        });
        setWorkflowBackendId(savedWorkflow.id);
        // Update URL to include the new workflow ID (without full page reload)
        window.history.replaceState(null, '', `/workflow/${savedWorkflow.id}`);
      }
      
      lastSavedStateRef.current = { nodes, edges, workflowName };
      setIsDirty(false);
      console.log('Workflow saved:', savedWorkflow);
      
      // Save version history for manual saves
      if (!isAutoSave) {
        saveVersion(nodes, edges, workflowName, 'Manual save');
      }

      // Run validation on save
      const result = await validateWorkflow(nodes, edges, { getNodeConfigFn: getNodeConfigSync });
      setValidationErrors(result.errors);
      setValidationWarnings(result.warnings);
      setValidationSummary(getValidationSummary(result));
      if (result.errors.length > 0 || result.warnings.length > 0) {
        setValidationPanelOpen(true);
      }
      
      // Update nodes with validation status
      setNodes(currentNodes => currentNodes.map(node => {
        const error = result.errors.find(e => e.nodeId === node.id);
        const warning = result.warnings.find(w => w.nodeId === node.id);
        return {
           ...node,
           data: {
              ...node.data,
              validationError: error || warning
           }
        };
      }));
      
    } catch (error) {
      console.error('Failed to save workflow:', error);
    } finally {
      setIsSaving(false);
      setIsAutoSaving(false);
    }
  }, [workflowName, nodes, edges, workflowBackendId, isSaving, saveVersion, workflowDescription, workflowContext, getNodeConfigSync]);

  // Auto-save effect: triggers 2 seconds after the last change
  useEffect(() => {
    // Skip on first render
    if (isFirstRender.current) {
      // Initialize last saved state
      lastSavedStateRef.current = { nodes, edges, workflowName };
      return;
    }

    // Check if there are actual changes from the last saved state
    const hasChanges = !lastSavedStateRef.current ||
      JSON.stringify(nodes) !== JSON.stringify(lastSavedStateRef.current.nodes) ||
      JSON.stringify(edges) !== JSON.stringify(lastSavedStateRef.current.edges) ||
      workflowName !== lastSavedStateRef.current.workflowName;

    if (hasChanges) {
      setIsDirty(true);
      
      // Clear any existing timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      // Set new auto-save timeout (2 seconds after last change)
      autoSaveTimeoutRef.current = setTimeout(() => {
        handleSave(true);
      }, 2000);
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [nodes, edges, workflowName, handleSave]);

  // Handle undo
  const handleUndo = useCallback(() => {
    const previousState = undoRedo.undo();
    if (previousState) {
      setNodes(previousState.nodes);
      setEdges(previousState.edges);
    }
  }, [undoRedo, setNodes, setEdges]);

  // Handle redo
  const handleRedo = useCallback(() => {
    const nextState = undoRedo.redo();
    if (nextState) {
      setNodes(nextState.nodes);
      setEdges(nextState.edges);
    }
  }, [undoRedo, setNodes, setEdges]);

  // Handle duplicate
  const handleDuplicate = useCallback(() => {
    if (selectedNode) {
      const newNode: Node<any> = {
        ...selectedNode,
        id: `node-${Date.now()}`,
        position: {
          x: selectedNode.position.x + 50,
          y: selectedNode.position.y + 50,
        },
        data: { ...selectedNode.data },
        selected: false,
      };
      setNodes((nds) => [...nds, newNode]);
    }
  }, [selectedNode, setNodes]);

  // Handle copy
  const handleCopy = useCallback(() => {
    if (selectedNode) {
      setCopiedNode({ ...selectedNode });
    }
  }, [selectedNode]);

  // Handle paste
  const handlePaste = useCallback(() => {
    if (copiedNode) {
      const newNode: Node<any> = {
        ...copiedNode,
        id: `node-${Date.now()}`,
        position: {
          x: copiedNode.position.x + 100,
          y: copiedNode.position.y + 100,
        },
        data: { ...copiedNode.data },
        selected: false,
      };
      setNodes((nds) => [...nds, newNode]);
    }
  }, [copiedNode, setNodes]);

  // Handle escape - deselect and close panels
  const handleEscape = useCallback(() => {
    setSelectedNode(null);
    setConfigPanelOpen(false);
    setNodePanelOpen(false);
  }, []);



  // Execution State
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [lastExecutionData, setLastExecutionData] = useState<Record<string, any>>({});
  
  // WebSocket Connection
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  
  useEffect(() => {
    if (executionId) {
      const token = tokenManager.getAccessToken();
      setWsUrl(`ws://localhost:8000/ws/execution/${executionId}/?token=${token}`);
    } else {
      setWsUrl(null);
    }
  }, [executionId]);
  
  useEffect(() => {
    if (!wsUrl) return;

    console.log('Connecting to WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'execution.event') {
           const eventData = message.data;
           const type = eventData.event_type || eventData.type;
           const data = eventData.data || eventData;
           
           if (type === 'node_started' || type === 'node_start') {
              const { node_id, input } = data;
              
              // Normalize input to items format
              const normalizedInput = input ? normalizeToItems(input?.items || input?.data || input) : undefined;

              setNodes(nds => nds.map(n => {
                if (n.id === node_id) {
                  return {
                    ...n,
                    data: {
                      ...n.data,
                      executionStatus: 'running',
                      inputData: normalizedInput || n.data.inputData
                    }
                  };
                }
                return n;
              }));
           }
           else if (type === 'node_complete') {
             const { node_id, output, status, error, warnings } = data;
             
             // Normalize output to items format
             const normalizedOutput = normalizeToItems(output?.items || output?.data || output);
             
             // Update node output data
             setNodes(nds => nds.map(n => {
               if (n.id === node_id) {
                 return {
                   ...n,
                   data: {
                     ...n.data,
                     outputData: normalizedOutput,
                     executionStatus: status,
                     errorMessage: error,
                     executionWarning: warnings && warnings.length > 0 ? warnings[0] : undefined
                   }
                 };
               }
               return n;
             }));

             // If a node failed, clear executionId immediately to revert Stop -> Test button
             if (status === 'failed') {
               setExecutionId(null);
             }

             // Trigger downstream updates (store last execution data for reference)
             setLastExecutionData(prev => ({ ...prev, [node_id]: normalizedOutput }));

             // Optimistic Update: Immediately set successor nodes to 'running'
             if (status === 'completed') {
               const currentEdges = edgesRef.current;
               const successorNodeIds = currentEdges
                 .filter(edge => edge.source === node_id)
                 .map(edge => edge.target);

               if (successorNodeIds.length > 0) {
                 setNodes(nds => nds.map(n => {
                   if (successorNodeIds.includes(n.id) && n.data.executionStatus !== 'completed') {
                     return {
                       ...n,
                       data: {
                         ...n.data,
                         executionStatus: 'running'
                       }
                     };
                   }
                   return n;
                 }));
               }
             }
           }
           else if (type === 'node_error') {
              const { node_id, error, status } = data;
              setNodes(nds => nds.map(n => {
                if (n.id === node_id) {
                  return {
                    ...n,
                    data: {
                      ...n.data,
                      executionStatus: status || 'failed',
                      errorMessage: error
                    }
                  };
                }
                return n;
              }));
           }
           else if (type === 'workflow_complete' || type === 'workflow_completed') {
             setExecutionId(null);
             toast.success('Workflow execution completed');
           }
           else if (type === 'workflow_cancelled') {
             setExecutionId(null);
             toast.info('Workflow stopped');
           }
           else if (type === 'workflow_error' || type === 'workflow_failed') {
             setExecutionId(null);
             const error = data.error || data.message || 'Unknown error';
             toast.error(`Workflow failed: ${error}`);
           }
        }
        else if (message.type === 'execution.state_sync') {
           const { nodes: syncedNodes, overall_status } = message.data;
           console.log('Received state sync for nodes:', syncedNodes.length, 'overall_status:', overall_status);
           
           // If the execution is already in a terminal state, reset the button
           if (overall_status === 'completed' || overall_status === 'failed' || overall_status === 'cancelled') {
             setExecutionId(null);
             if (overall_status === 'completed') {
               toast.success('Workflow execution completed');
             } else if (overall_status === 'failed') {
               toast.error('Workflow execution failed');
             }
           }
           
           setNodes(nds => nds.map(n => {
             const syncedNode = syncedNodes.find((sn: any) => sn.node_id === n.id);
             if (syncedNode) {
               const normalizedOutput = syncedNode.output ? normalizeToItems(syncedNode.output?.items || syncedNode.output?.data || syncedNode.output) : undefined;
               return {
                 ...n,
                 data: {
                   ...n.data,
                   executionStatus: syncedNode.status,
                   outputData: normalizedOutput || n.data.outputData,
                   errorMessage: syncedNode.error
                 }
               };
             }
             return n;
           }));

           // Also update lastExecutionData for all completed nodes
           const completedNodeData: Record<string, any> = {};
           syncedNodes.forEach((sn: any) => {
             if (sn.status === 'completed' && sn.output) {
               completedNodeData[sn.node_id] = normalizeToItems(sn.output?.items || sn.output?.data || sn.output);
             }
           });
           setLastExecutionData(prev => ({ ...prev, ...completedNodeData }));
        }

      } catch (e) {
        console.error('Failed to parse WebSocket message', e);
      }
    };

    ws.onerror = (e) => {
      console.error('WebSocket error:', e);
    };

    return () => {
      ws.close();
    };
  }, [wsUrl, setNodes]);

  // Propagate inputs based on upstream outputs
  // This runs whenever lastExecutionData updates (meaning a node finished)
  useEffect(() => {
     if (Object.keys(lastExecutionData).length === 0) return;

     setNodes(nds => nds.map(node => {
        // Find upstream nodes
        const incomingEdges = edges.filter(e => e.target === node.id);
        if (incomingEdges.length === 0) return node;

        // Collect and merge input items from all upstream nodes
        const allInputItems: any[] = [];
        incomingEdges.forEach(edge => {
           const sourceOutput = lastExecutionData[edge.source];
           if (sourceOutput && Array.isArray(sourceOutput)) {
              // Source output is already in items format
              allInputItems.push(...sourceOutput);
           }
        });

        if (allInputItems.length > 0) {
           // We have new inputs for this node in items format
           return {
              ...node,
              data: {
                 ...node.data,
                 inputData: allInputItems
              }
           };
        }
        return node;
     }));
  }, [lastExecutionData, edges, setNodes]);

  const handleStop = useCallback(async () => {
    if (!executionId) return;
    
    try {
      await orchestratorService.stopExecution(executionId);
      toast.success('Execution stopped');
    } catch (error) {
      console.error('Failed to stop execution:', error);
      toast.error('Failed to stop execution');
    } finally {
      // Always clear execution ID to revert button to "Test"
      setExecutionId(null);
      
      // Update nodes to reflect cancellation if they were still running/pending
      setNodes(nds => nds.map(n => {
        if (n.data.executionStatus === 'running' || n.data.executionStatus === 'pending') {
          return {
            ...n,
            data: {
              ...n.data,
              executionStatus: 'failed',
              errorMessage: 'Execution stopped'
            }
          };
        }
        return n;
      }));
    }
  }, [executionId, setNodes]);

  const handleExecute = useCallback(async () => {
    // Validate before execution
    const result = await validateWorkflow(nodes, edges, { 
      validateWithBackend: true,
      checkCredentials: true,
      checkTypeCompatibility: true
    });
    setValidationErrors(result.errors);
    setValidationWarnings(result.warnings);
    setValidationSummary(getValidationSummary(result));

    // Update nodes with validation status
    setNodes(currentNodes => currentNodes.map(node => {
      const error = result.errors.find(e => e.nodeId === node.id);
      const warning = result.warnings.find(w => w.nodeId === node.id);
      return {
          ...node,
          data: {
            ...node.data,
            validationError: error || warning,
            // Clear previous execution data
            outputData: undefined,
            inputData: undefined,
            executionStatus: 'pending'
          }
      };
    }));
    
    // Clear previous execution state
    setLastExecutionData({});

    if (result.errors.length > 0 || result.warnings.length > 0) {
      setValidationPanelOpen(true);
    }

    if (!result.isValid) {
      toast.error(`Cannot execute workflow:\n${result.errors.map(e => e.message).join('\n')}`);
      return;
    }

    // Save before executing if dirty or new
    if (isDirty || !workflowBackendId) {
      await handleSave();
    }
    
    // Execute if we have an ID
    if (workflowBackendId) {
      try {
        console.log('Executing workflow...', workflowBackendId);
        const response = await orchestratorService.executeWorkflow(workflowBackendId);
        toast.success(`Execution started! ID: ${response.execution_id}`);
        setExecutionId(response.execution_id);
      } catch (error) {
        console.error('Execution failed:', error);
        toast.error('Execution failed to start.');
        setExecutionId(null);
        
        // Reset nodes from pending back to null if it failed to start
        setNodes(nds => nds.map(n => {
          if (n.data.executionStatus === 'pending') {
            return {
              ...n,
              data: {
                ...n.data,
                executionStatus: undefined
              }
            };
          }
          return n;
        }));
      }
    }
  }, [nodes, edges, isDirty, workflowBackendId, handleSave]);
  
  // Setup keyboard shortcuts
  const shortcuts = useMemo(() => getDefaultShortcuts({
    onSave: handleSave,
    onUndo: handleUndo,
    onRedo: handleRedo,
    onDelete: handleDeleteNode,
    onDuplicate: handleDuplicate,
    onCopy: handleCopy,
    onPaste: handlePaste,
    onEscape: handleEscape,
    onExecute: handleExecute,
  }), [handleSave, handleUndo, handleRedo, handleDeleteNode, handleDuplicate, handleCopy, handlePaste, handleEscape, handleExecute]);

  useKeyboardShortcuts(shortcuts, !configPanelOpen);

  // ==================== END KEYBOARD SHORTCUTS ====================

  // Derive the actual node object from the state to ensure we always have the latest data
  // (inputs, outputs, execution status) even if selectedNode state is stale
  const liveSelectedNode = useMemo(() => {
    if (!selectedNode) return null;
    return nodes.find(n => n.id === selectedNode.id) || selectedNode;
  }, [nodes, selectedNode]);

  return (
    <div className="w-full h-full flex flex-col">
      {/* ======== STABLE ENTERPRISE TOP BAR ======== */}
      <header className="h-auto md:h-16 py-3 md:py-0 shrink-0 border-b border-border/60 bg-card/80 backdrop-blur-xl z-20">
        <div className="h-full px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0">

          {/* LEFT — Navigation & History */}
          <div className="flex items-center gap-3 min-w-[220px]">
            <button
              onClick={() => setShowExecutionLog(!showExecutionLog)}
              className={`p-2 rounded-md transition ${
                showExecutionLog
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              title="Executions"
            >
              <Activity className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-border/40" />

            <button
              onClick={handleUndo}
              disabled={!undoRedo.canUndo}
              className={`p-2 rounded-md transition ${
                undoRedo.canUndo
                  ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  : 'opacity-20 pointer-events-none'
              }`}
              title="Undo"
            >
              <Undo className="w-4 h-4" />
            </button>

            <button
              onClick={handleRedo}
              disabled={!undoRedo.canRedo}
              className={`p-2 rounded-md transition ${
                undoRedo.canRedo
                  ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  : 'opacity-20 pointer-events-none'
              }`}
              title="Redo"
            >
              <Redo className="w-4 h-4" />
            </button>
          </div>

          {/* CENTER — WORKFLOW IDENTITY (PRIMARY ANCHOR) */}
          <div className="flex flex-col items-center">
            <input
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              spellCheck={false}
              className="
                bg-transparent text-lg font-semibold text-foreground
                focus:outline-none text-center
                hover:text-primary transition
              "
              style={{ width: '320px' }}
            />

            <div className="mt-0.5 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              <span>{isDirty ? 'Unsaved changes' : 'Saved'}</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <span>{isAutoSaving ? 'Saving…' : 'Synced'}</span>
            </div>
          </div>

          {/* RIGHT — TOOLS + ACTIONS */}
          <div className="flex items-center gap-3 min-w-[320px] justify-end">

            {/* Tools */}
            <div className="flex items-center gap-1 rounded-md border border-border/40 bg-muted/20 px-1">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-md transition ${
                  showSettings
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>

            {/* Test / Stop (LOCKED WIDTH — NO SHIFTING) */}
            <div className="w-[96px]">
              {executionId ? (
                <button
                  onClick={handleStop}
                  className="w-full h-9 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold hover:bg-destructive hover:text-destructive-foreground transition"
                >
                  Stop
                </button>
              ) : (
                <button
                  onClick={handleExecute}
                  className="w-full h-9 rounded-md border border-border/60 text-muted-foreground text-xs font-semibold hover:bg-muted hover:text-foreground transition"
                >
                  Test
                </button>
              )}
            </div>

            {/* DEPLOY / UNDEPLOY — SINGLE PRIMARY CTA */}
            {workflowStatus === 'active' ? (
              <button
                onClick={handleUndeploy}
                disabled={isUndeploying}
                className="
                  h-9 px-6 rounded-md
                  bg-destructive/10 border border-destructive/20
                  text-destructive text-xs font-bold tracking-wider
                  hover:bg-destructive hover:text-destructive-foreground
                  transition shadow-md disabled:opacity-50
                "
              >
                {isUndeploying ? 'Undeploying...' : 'Undeploy'}
              </button>
            ) : (
              <button
                onClick={() => setShowDeployModal(true)}
                className="
                   h-9 px-6 rounded-md
                   bg-primary hover:bg-primary/90
                   text-primary-foreground text-xs font-bold tracking-wider
                   transition shadow-md
                "
              >
                Deploy
              </button>
            )}

            {/* STATUS — INFORMATIONAL ONLY */}
            {validationSummary && (
              <div
                onClick={() => {
                  setValidationPanelOpen(!validationPanelOpen);
                }}
                className={`cursor-pointer px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition
                  ${
                    validationErrors.length > 0
                      ? 'bg-destructive/10 text-destructive border-destructive/20'
                      : validationWarnings.length > 0
                      ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                      : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                  }
                `}
              >
                {validationErrors.length > 0 ? 'Invalid' : 'Valid'}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Canvas */}
      {/* Canvas Area */}
      <div 
        className="flex-1 relative flex overflow-hidden"
      >
        {/* Left Column: Flow Graph + Validation Panel */}
        <div className="flex-1 flex flex-col min-w-0 bg-background transition-all duration-300">
          <div 
             className="flex-1 relative min-h-0"
             onDragOver={handleDragOver}
             onDrop={handleDrop}
          >
            {showExecutionLog ? (
              <WorkflowExecutionLog workflowId={workflowBackendId} />
            ) : (
              <ReactFlow
                nodes={nodesWithConnectionInfo}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onNodeDoubleClick={onNodeDoubleClick}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                snapToGrid
                snapGrid={[15, 15]}
                defaultEdgeOptions={{
                  animated: true,
                  style: { stroke: '#888', strokeWidth: 2 }
                }}
                translateExtent={[[-2000, -2000], [5000, 5000]]}
                nodeExtent={[[-2000, -2000], [5000, 5000]]}
                minZoom={0.1}
                maxZoom={4}
                preventScrolling={true}
              >

                  <Controls className="bg-card border border-border shadow-lg rounded-lg" />
                  <MiniMap 
                    className="hidden md:block bg-card border border-border rounded-lg shadow-sm"
                    style={{ height: 100, width: 150 }} 
                    nodeColor={(node) => node.data?.color || 'hsl(var(--primary))'}
                    maskColor="rgba(0, 0, 0, 0.05)"
                  />
                  <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(var(--foreground) / 0.05)" />
                  
                  {/* Empty Canvas Message - Only show when no nodes exist */}
                  {nodes.length === 0 && (
                    <Panel position="top-center" className="mt-20">
                      <div className="flex flex-col items-center gap-4 bg-card border border-border rounded-lg p-8 shadow-lg max-w-sm">
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                          <Plus className="w-8 h-8 text-primary" />
                        </div>
                        
                        <div className="text-center space-y-1">
                          <h3 className="text-lg font-semibold">No nodes yet</h3>
                          <p className="text-sm text-muted-foreground">
                            Add a trigger to start building your workflow
                          </p>
                        </div>
                        
                        <button 
                          onClick={() => {
                            setTriggerPanelOpen(true);
                            setNodePanelOpen(false);
                            setPendingSourceNodeId(null);
                            // Auto-collapse competitors
                            setConfigPanelOpen(false);
                          }}
                          className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-all font-medium shadow-sm"
                        >
                          <Plus className="w-4 h-4" />
                          Add Trigger
                        </button>
                      </div>
                    </Panel>
                  )}

                  {/* Add Buttons - Only show when nodes exist */}
                  {nodes.length > 0 && (
                    <Panel position="bottom-center" className="mb-20 md:mb-4 flex flex-col sm:flex-row gap-2 z-10 pointer-events-none">
                      <button 
                        onClick={() => {
                          setTriggerPanelOpen(true);
                          setNodePanelOpen(false);
                          setPendingSourceNodeId(null);
                          // Auto-collapse competitors
                          setConfigPanelOpen(false);
                        }}
                        className="pointer-events-auto flex items-center justify-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-full shadow-xl hover:bg-primary/90 transition-all font-semibold whitespace-nowrap sm:w-auto w-48"
                      >
                        <Plus className="w-5 h-5" />
                        Add Trigger
                      </button>
                      <button 
                        onClick={() => {
                          setNodePanelOpen(true);
                          setTriggerPanelOpen(false);
                          setPendingSourceNodeId(null);
                          // Auto-collapse competitors
                          setConfigPanelOpen(false);
                        }}
                        className="pointer-events-auto flex items-center justify-center gap-2 px-5 py-3 bg-secondary text-secondary-foreground rounded-full shadow-xl hover:bg-secondary/80 transition-all font-semibold whitespace-nowrap sm:w-auto w-48"
                      >
                        <Plus className="w-5 h-5" />
                        Add Node
                      </button>
                    </Panel>
                  )}
                  {/* Canvas Controls Panel */}
                  <Panel position="top-right" className="flex flex-col gap-1 bg-card border border-border rounded-lg shadow-lg p-1">
                    <button
                      onClick={() => downloadWorkflow(nodes, edges, workflowName)}
                      className="p-2 hover:bg-muted rounded-md text-xs"
                      title="Export Workflow"
                    >
                      <span className="text-xl">📤</span>
                    </button>
                    <button
                      onClick={() => setShowImportModal(true)}
                      className="p-2 hover:bg-muted rounded-md text-xs"
                      title="Import Workflow"
                    >
                      <span className="text-xl">📥</span>
                    </button>
                  </Panel>

              </ReactFlow>
            )}


            {/* Import Modal */}
            <ImportWorkflowModal 
              isOpen={showImportModal}
              onClose={() => setShowImportModal(false)}
              onImport={(newNodes, newEdges, name) => {
                setNodes(newNodes);
                setEdges(newEdges);
                setWorkflowName(name);
                setShowImportModal(false);
              }}
            />

            {/* Removed NodePanel from here */}



            {/* Version History Panel */}
            <VersionHistoryPanel 
              isOpen={showVersionHistory}
              onClose={() => setShowVersionHistory(false)}
              versions={versions}
              onRestore={(version) => {
                if (confirm('Restoring will overwrite current changes. Continue?')) {
                  setNodes(version.nodes);
                  setEdges(version.edges);
                  setWorkflowName(version.name);
                  setShowVersionHistory(false);
                }
              }}
            />

            {/* Workflow Settings Panel */}
            <WorkflowSettingsPanel
              isOpen={showSettings}
              onClose={() => setShowSettings(false)}
              supervisionLevel={supervisionLevel}
              description={workflowDescription}
              context={workflowContext}
              skills={availableSkills}
              selectedSkills={selectedSkills}
              onSave={handleSettingsSave}
            />

            {/* HITL Modals */}
            {activeRequest?.type === 'approval' && (
              <ApprovalModal
                isOpen={true}
                title={activeRequest.title || 'Approval Required'}
                description={activeRequest.description || ''}
                data={activeRequest.data}
                onApprove={() => handleResolve(true)}
                onReject={() => handleReject()}
                onClose={() => handleReject()}
              />
            )}

            {activeRequest?.type === 'clarification' && (
              <ClarificationModal
                isOpen={true}
                question={activeRequest.question || ''}
                options={activeRequest.options}
                onRespond={handleResolve}
                onClose={() => handleReject()}
              />
            )}
          </div>
          
          {/* Validation Panel - Positioned below canvas so it shrinks the canvas when open */}
          <div className="transition-all duration-300">
            <WorkflowValidationPanel 
              isOpen={validationPanelOpen}
              onToggle={() => setValidationPanelOpen(!validationPanelOpen)}
              errors={validationErrors}
              warnings={validationWarnings}
              onSelectNode={(nodeId) => {
                // Select the node
                setNodes(nds => nds.map(n => ({
                  ...n,
                  selected: n.id === nodeId
                })));
                
                // Find the node to set as selected for config panel if needed
                const node = nodes.find(n => n.id === nodeId);
                if (node) setSelectedNode(node);
              }}
            />
          </div>
        </div>

        {/* Node Selection/Add Panel (Docked Sidebar or Mobile Overlay) */}
        {(nodePanelOpen || triggerPanelOpen) && (
          <div className="w-full md:w-[320px] absolute inset-y-0 right-0 md:relative border-l border-border bg-card shadow-xl z-30 flex flex-col transition-all duration-300 shrink-0 overflow-hidden">
            <NodePanel 
              isOpen={nodePanelOpen || triggerPanelOpen} 
              onClose={() => {
                setNodePanelOpen(false);
                setTriggerPanelOpen(false);
                setPendingSourceNodeId(null);
                setPendingSourceHandleId(null);
              }}
              onAddNode={handleAddNode}
              triggersOnly={triggerPanelOpen}
              showAll={nodePanelOpen && !pendingSourceNodeId && !triggerPanelOpen}
              isFirstNode={nodes.length === 0}
            />
          </div>
        )}

        {/* NodeConfigPanel is now a full-page overlay, rendered outside the flex layout */}

        {/* AI Chat Panel (Docked) - Removed local rendering, now handled globally */}
      </div>

      {/* Node Config Panel - Full-page overlay */}
      {configPanelOpen && liveSelectedNode && (
        <NodeConfigPanel
          isOpen={configPanelOpen}
          node={liveSelectedNode}
          nodes={nodes}
          edges={edges}
          onClose={() => setConfigPanelOpen(false)}
          onUpdateNode={handleUpdateNode}
          workflowId={workflowBackendId}
        />
      )}

      {/* Deploy Modal */}
      {showDeployModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted/80 rounded-lg">
                  <Rocket className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">Deploy Workflow</h2>
              </div>
              <button onClick={() => setShowDeployModal(false)} className="p-1 hover:bg-muted rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {deploySuccess ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Deployment Successful!</h3>
                <p className="text-muted-foreground mb-4">Your workflow is now live and ready to run.</p>
                
                {deployedWebhookUrl && (
                  <div className="mt-4 p-4 bg-muted rounded-lg border border-border text-left">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                      Webhook URL
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-background p-2 rounded border border-border overflow-x-auto whitespace-nowrap">
                        {deployedWebhookUrl}
                      </code>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(deployedWebhookUrl);
                          toast.success('Webhook URL copied to clipboard');
                        }}
                        className="p-2 hover:bg-background rounded-md border border-border transition-colors"
                        title="Copy to clipboard"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Use this URL to trigger your workflow from external services.
                    </p>
                  </div>
                )}

                {deployedWebhookUrl && (
                  <button 
                    onClick={() => {
                      setShowDeployModal(false);
                      setDeploySuccess(false);
                    }}
                    className="mt-6 w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 shadow-sm transition-all"
                  >
                    Got it
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="p-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Workflow Name</label>
                      <input 
                        type="text"
                        value={workflowName}
                        readOnly
                        className="w-full px-3 py-2 bg-muted border border-input rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Nodes</label>
                      <p className="text-muted-foreground">{nodes.length} nodes configured</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm font-medium mb-2">Deployment Options</p>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" defaultChecked className="rounded" />
                          <span className="text-sm">Enable workflow after deployment</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" className="rounded" />
                          <span className="text-sm">Send notification on completion</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4 border-t border-border flex justify-end gap-2">
                  <button 
                    onClick={() => setShowDeployModal(false)}
                    className="px-4 py-2 border border-input rounded-md hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleDeploy}
                    disabled={isDeploying}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isDeploying ? (
                      <>
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Deploying...
                      </>
                    ) : (
                      <>
                        <Rocket className="w-4 h-4" />
                        Deploy Now
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
