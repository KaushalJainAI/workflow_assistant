import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
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
import { Play, Save, Undo, Redo, Settings, Trash2, Rocket, CheckCircle2, X, History } from 'lucide-react';
import NodePanel from '../components/workflow/NodePanel';
import NodeConfigPanel from '../components/workflow/NodeConfigPanel';
import { useKeyboardShortcuts, getDefaultShortcuts } from '../hooks/useKeyboardShortcuts';
import { useUndoRedo } from '../hooks/useUndoRedo';
import ImportWorkflowModal from '../components/workflow/ImportWorkflowModal';
import { validateWorkflow, getValidationSummary, type ValidationError } from '../lib/validateWorkflow';
import { downloadWorkflow } from '../lib/workflowSerializer';
import { useVersionHistory } from '../hooks/useVersionHistory';
import VersionHistoryPanel from '../components/workflow/VersionHistoryPanel';
import { useHumanInTheLoop } from '../hooks/useHumanInTheLoop';
import ApprovalModal from '../components/modals/ApprovalModal';
import ClarificationModal from '../components/modals/ClarificationModal';
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
            fontSize: 12,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <button
            className="w-5 h-5 bg-card border border-border rounded-full text-xs hover:bg-destructive/10 hover:text-destructive flex items-center justify-center transition-all shadow-sm"
            onClick={onEdgeClick}
            title="Remove connection"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

const initialNodes: Node<any>[] = [
  { 
    id: '1', 
    position: { x: 100, y: 200 }, 
    data: { label: 'Manual Trigger', icon: '▶️', color: '#ff6d5a', nodeType: 'manual_trigger' }, 
    type: 'generic',
  },
  { 
    id: '2', 
    position: { x: 350, y: 200 }, 
    data: { label: 'HTTP Request', icon: '🌐', color: '#7b68ee', nodeType: 'http_request' },
    type: 'generic',
  },
  { 
    id: '3', 
    position: { x: 600, y: 200 }, 
    data: { label: 'Set Data', icon: '📝', color: '#20b2aa', nodeType: 'set' },
    type: 'generic',
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', type: 'deletable', animated: true, style: { stroke: '#888', strokeWidth: 2 } },
  { id: 'e2-3', source: '2', target: '3', type: 'deletable', animated: true, style: { stroke: '#888', strokeWidth: 2 } },
];

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
  const [workflowName, setWorkflowName] = useState('My Workflow');
  const [nodePanelOpen, setNodePanelOpen] = useState(false);
  const [triggerPanelOpen, setTriggerPanelOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [copiedNode, setCopiedNode] = useState<Node | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedStateRef = useRef<{ nodes: Node[]; edges: Edge[]; workflowName: string } | null>(null);
  const [pendingSourceNodeId, setPendingSourceNodeId] = useState<string | null>(null);
  const [pendingSourceHandleId, setPendingSourceHandleId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validationSummary, setValidationSummary] = useState<string | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const { workflowId } = useParams<{ workflowId: string }>();

  // Custom Hooks
  const undoRedo = useUndoRedo({ maxHistory: 50 });
  const { versions, saveVersion, restoreVersion } = useVersionHistory(workflowId || 'new-workflow');
  const { activeRequest, requestApproval, requestClarification, reportError, handleResolve, handleReject } = useHumanInTheLoop();
  
  const isFirstRender = useRef(true);

  // Handler to open node panel from a specific node's + button
  const onAddNodeFromHandle = useCallback((sourceNodeId: string, sourceHandleId: string) => {
    setPendingSourceNodeId(sourceNodeId);
    setPendingSourceHandleId(sourceHandleId);
    setTriggerPanelOpen(false); // Close trigger panel if open
    setNodePanelOpen(true);
  }, []);

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

    return nodes.map(node => ({
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

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    // If the node is already selected, clicking it again can open the panel
    // but n8n usually uses double click or a dedicated button.
    // We'll stick to double click but keep this for selection state.
  }, []);

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setConfigPanelOpen(true);
    setNodePanelOpen(false);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleAddNode = useCallback((nodeType: any) => {
    // Determine the correct node type based on the node id
    const typeId = nodeType.baseNodeTypeId || nodeType.id;
    let type = 'custom';
    if (typeId.includes('trigger')) {
      type = 'trigger';
    } else if (typeId === 'if') {
      type = 'conditional';
    } else if (typeId === 'switch') {
      type = 'switch';
    }

    // If adding from a node's + button, position to the right of that node
    let position = { x: Math.random() * 400 + 200, y: Math.random() * 200 + 100 };
    if (pendingSourceNodeId) {
      const sourceNode = nodes.find(n => n.id === pendingSourceNodeId);
      if (sourceNode) {
        position = {
          x: sourceNode.position.x + 250,
          y: sourceNode.position.y,
        };
      }
    }

    const newNodeId = `node-${Date.now()}`;
    const newNode: Node<any> = {
      id: newNodeId,
      type,
      position,
      data: { 
        label: nodeType.name, 
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
        type: 'deletable',
        animated: true,
        style: { stroke: '#888', strokeWidth: 2 },
      };
      setEdges((eds) => [...eds, newEdge]);
      setPendingSourceNodeId(null);
      setPendingSourceHandleId(null);
    }

    setNodePanelOpen(false);
  }, [setNodes, setEdges, pendingSourceNodeId, nodes]);

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
    event.dataTransfer.dropEffect = 'move';
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
      const newNode: Node<any> = {
        id: `node-${Date.now()}`,
        type: typeId.includes('trigger') ? 'trigger' : 'custom',
        position,
        data: {
          label: nodeType.name,
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

  // Handle opening the config panel
  const handleOpenConfigPanel = useCallback(() => {
    if (selectedNode) {
      setConfigPanelOpen(true);
      setNodePanelOpen(false);
    }
  }, [selectedNode]);

  // Handle updating node data from config panel
  const handleUpdateNode = useCallback((nodeId: string, newData: Record<string, unknown>) => {
    setNodes((nds) => 
      nds.map((n) => 
        n.id === nodeId 
          ? { ...n, data: { ...n.data, ...newData } }
          : n
      )
    );
  }, [setNodes]);

  const handleDeploy = () => {
    setIsDeploying(true);
    // Simulate deployment
    setTimeout(() => {
      setIsDeploying(false);
      setDeploySuccess(true);
      setTimeout(() => {
        setShowDeployModal(false);
        setDeploySuccess(false);
      }, 2000);
    }, 2000);
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

  // Handle save
  const handleSave = useCallback((isAutoSave = false) => {
    // Simulate save - in real app would call API
    if (isAutoSave) {
      setIsAutoSaving(true);
      setSaveMessage('Auto-saving...');
    } else {
      setSaveMessage('Saving...');
    }
    
    // Simulate API call delay
    setTimeout(() => {
      lastSavedStateRef.current = { nodes, edges, workflowName };
      setIsDirty(false);
      setIsAutoSaving(false);
      setSaveMessage(isAutoSave ? 'Changes saved' : 'Workflow saved!');
      setTimeout(() => setSaveMessage(null), 2000);
      console.log('Workflow saved:', { workflowName, nodes, edges });
      
      // Save version history
      if (!isAutoSave) {
        saveVersion(nodes, edges, workflowName, `Manual save`);
      } else {
        // Optional: auto-save versions periodically or on specific triggers
        // For now we only version manual saves to avoid noise
      }

      // Run validation on save
      const result = validateWorkflow(nodes, edges);
      setValidationErrors(result.errors);
      setValidationSummary(getValidationSummary(result));
    }, isAutoSave ? 300 : 100);
  }, [workflowName, nodes, edges]);

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

  // Handle test/execute
  const handleExecute = useCallback(() => {
    // Validate before execution
    const result = validateWorkflow(nodes, edges);
    setValidationErrors(result.errors);
    setValidationSummary(getValidationSummary(result));

    if (!result.isValid) {
      alert(`Cannot execute workflow:\n${result.errors.map(e => e.message).join('\n')}`);
      return;
    }

    console.log('Executing workflow...', { nodes, edges });
    // TODO: Implement actual execution
  }, [nodes, edges]);

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

  useKeyboardShortcuts(shortcuts);

  // ==================== END KEYBOARD SHORTCUTS ====================

  return (
    <div className="w-full h-full flex flex-col">
      {/* Top Toolbar */}
      <div className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="bg-transparent border-none text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary rounded px-2 py-1"
          />
          {selectedNode && (
            <div className="flex items-center gap-2 ml-4 pl-4 border-l border-border">
              <span className="text-sm text-muted-foreground">Selected:</span>
              <span className="text-sm font-medium">{selectedNode.data.label}</span>
              <button 
                onClick={handleDeleteNode}
                className="p-1 hover:bg-destructive/10 text-destructive rounded-md"
                title="Delete Node"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button 
                onClick={handleOpenConfigPanel}
                className="p-1 hover:bg-muted rounded-md"
                title="Node Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Save status indicator */}
          {saveMessage ? (
            <span className={`text-sm font-medium ${isAutoSaving ? 'text-blue-500' : 'text-green-600'} ${isAutoSaving ? '' : 'animate-pulse'}`}>
              {saveMessage}
            </span>
          ) : isDirty ? (
            <span className="text-sm text-yellow-600 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
              Unsaved changes
            </span>
          ) : null}
          <button 
            onClick={handleUndo}
            disabled={!undoRedo.canUndo}
            className={`p-2 hover:bg-muted rounded-md ${!undoRedo.canUndo ? 'opacity-40 cursor-not-allowed' : ''}`}
            title="Undo (Ctrl+Z)"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button 
            onClick={handleRedo}
            disabled={!undoRedo.canRedo}
            className={`p-2 hover:bg-muted rounded-md ${!undoRedo.canRedo ? 'opacity-40 cursor-not-allowed' : ''}`}
            title="Redo (Ctrl+Y)"
          >
            <Redo className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-border mx-2" />
          <button 
            onClick={() => setShowVersionHistory(!showVersionHistory)}
            className={`p-2 hover:bg-muted rounded-md ${showVersionHistory ? 'bg-muted text-primary' : ''}`}
            title="Version History"
          >
            <History className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-border mx-2" />
          <button 
            onClick={() => handleSave(false)}
            className="flex items-center gap-2 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80"
            title="Save (Ctrl+S)"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
          <button 
            onClick={handleExecute}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700"
            title="Test (Ctrl+Enter)"
          >
            <Play className="w-4 h-4" />
            Test
          </button>
          <button 
            onClick={() => setShowDeployModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-md hover:from-purple-700 hover:to-blue-700"
          >
            <Rocket className="w-4 h-4" />
            Deploy
          </button>
        </div>
        
        {/* Validation Status */}
        {validationSummary && (
          <div className={`
            px-3 py-1 text-xs rounded-full mr-4 hidden md:block
            ${validationErrors.length > 0 ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20'}
          `}>
            {validationSummary}
          </div>
        )}
      </div>

      {/* Canvas */}
      <div 
        className="flex-1 relative"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
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
        >
          <Controls className="bg-card border border-border shadow-lg rounded-lg" />
          <MiniMap 
            className="bg-card border border-border rounded-lg" 
            nodeColor={(node) => node.data?.color || '#7b68ee'}
            maskColor="rgba(0, 0, 0, 0.1)"
          />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#ddd" />
          
          {/* Add Trigger Button */}
          <Panel position="bottom-center" className="mb-4">
            <button 
              onClick={() => setTriggerPanelOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full shadow-lg hover:from-orange-600 hover:to-red-600 transition-all hover:scale-105"
            >
              <span className="text-lg">⚡</span>
              Add Trigger
            </button>
          </Panel>
          
          {/* Canvas Controls Panel */}
          <Panel position="top-right" className="flex flex-col gap-1 bg-card border border-border rounded-lg shadow-lg p-1">
            <button
              onClick={() => downloadWorkflow(nodes, edges, workflowName)}
              className="p-2 hover:bg-muted rounded-md text-xs"
              title="Export Workflow"
            >
              📤 Export
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="p-2 hover:bg-muted rounded-md text-xs"
              title="Import Workflow"
            >
              📥 Import
            </button>
          </Panel>
        </ReactFlow>

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

        {/* Node Panel (for non-triggers from + button) */}
        <NodePanel 
          isOpen={nodePanelOpen} 
          onClose={() => {
            setNodePanelOpen(false);
            setPendingSourceNodeId(null);
            setPendingSourceHandleId(null);
          }}
          onAddNode={handleAddNode}
          triggersOnly={false}
        />

        {/* Trigger Panel (for triggers only) */}
        <NodePanel 
          isOpen={triggerPanelOpen} 
          onClose={() => setTriggerPanelOpen(false)}
          onAddNode={handleAddNode}
          triggersOnly={true}
        />

        {/* Node Config Panel */}
        <NodeConfigPanel
          isOpen={configPanelOpen}
          node={selectedNode}
          onClose={() => setConfigPanelOpen(false)}
          onUpdateNode={handleUpdateNode}
        />

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

        {/* {activeRequest?.type === 'error' && (
          <ErrorRecoveryModal
            isOpen={true}
            error={activeRequest.error || 'Unknown error'}
            nodeName={activeRequest.nodeName || 'Unknown Node'}
            onRetry={() => handleResolve('retry')}
            onSkip={() => handleResolve('skip')}
            onStop={() => handleResolve('stop')}
            onClose={() => handleResolve('stop')}
          />
        )} */}
      </div>

      {/* Deploy Modal */}
      {showDeployModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg">
                  <Rocket className="w-5 h-5 text-white" />
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
                <p className="text-muted-foreground">Your workflow is now live and ready to run.</p>
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
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-md hover:from-purple-700 hover:to-blue-700 disabled:opacity-50"
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
