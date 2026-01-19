import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
  Panel,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  Handle,
  Position,
} from 'reactflow';
import { Plus, Play, Save, Undo, Redo, Settings, Trash2, Rocket, CheckCircle2, X } from 'lucide-react';
import NodePanel from '../components/workflow/NodePanel';
import NodeConfigPanel from '../components/workflow/NodeConfigPanel';
import { useKeyboardShortcuts, getDefaultShortcuts } from '../hooks/useKeyboardShortcuts';
import { useUndoRedo } from '../hooks/useUndoRedo';

import 'reactflow/dist/style.css';

// Custom Node Component
interface CustomNodeData {
  label: string;
  icon?: string;
  color?: string;
  nodeType?: string;
}

function CustomNode({ data, selected }: { data: CustomNodeData; selected: boolean }) {
  return (
    <div 
      className={`px-4 py-3 rounded-lg border-2 shadow-md transition-all min-w-[140px] ${
        selected ? 'border-primary shadow-lg scale-105' : 'border-transparent'
      }`}
      style={{ 
        backgroundColor: data.color || '#7b68ee',
      }}
    >
      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-3 h-3 bg-white border-2 border-gray-400"
      />
      <div className="flex items-center gap-2 text-white">
        {data.icon && <span className="text-lg">{data.icon}</span>}
        <span className="font-medium text-sm">{data.label}</span>
      </div>
      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-3 h-3 bg-white border-2 border-gray-400"
      />
    </div>
  );
}

// Input Node (Trigger)
function TriggerNode({ data, selected }: { data: CustomNodeData; selected: boolean }) {
  return (
    <div 
      className={`px-4 py-3 rounded-lg border-2 shadow-md transition-all min-w-[140px] ${
        selected ? 'border-primary shadow-lg scale-105' : 'border-transparent'
      }`}
      style={{ backgroundColor: '#ff6d5a' }}
    >
      <div className="flex items-center gap-2 text-white">
        {data.icon && <span className="text-lg">{data.icon}</span>}
        <span className="font-medium text-sm">{data.label}</span>
      </div>
      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-3 h-3 bg-white border-2 border-gray-400"
      />
    </div>
  );
}

const initialNodes: Node<CustomNodeData>[] = [
  { 
    id: '1', 
    position: { x: 100, y: 200 }, 
    data: { label: 'Manual Trigger', icon: '▶️', color: '#ff6d5a' }, 
    type: 'trigger',
  },
  { 
    id: '2', 
    position: { x: 350, y: 200 }, 
    data: { label: 'HTTP Request', icon: '🌐', color: '#7b68ee' },
    type: 'custom',
  },
  { 
    id: '3', 
    position: { x: 600, y: 200 }, 
    data: { label: 'Set Data', icon: '📝', color: '#20b2aa' },
    type: 'custom',
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#888', strokeWidth: 2 } },
  { id: 'e2-3', source: '2', target: '3', animated: true, style: { stroke: '#888', strokeWidth: 2 } },
];

export default function WorkflowEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [workflowName, setWorkflowName] = useState('My Workflow');
  const [nodePanelOpen, setNodePanelOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [copiedNode, setCopiedNode] = useState<Node | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Undo/Redo hook
  const undoRedo = useUndoRedo({ maxHistory: 50 });
  const isFirstRender = useRef(true);

  const nodeTypes: NodeTypes = useMemo(() => ({
    custom: CustomNode,
    trigger: TriggerNode,
  }), []);

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge({ 
      ...params, 
      animated: true,
      style: { stroke: '#888', strokeWidth: 2 }
    }, eds)),
    [setEdges],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleAddNode = useCallback((nodeType: { id: string; name: string; icon: string; color: string }) => {
    const newNode: Node<CustomNodeData> = {
      id: `node-${Date.now()}`,
      type: nodeType.id.includes('trigger') ? 'trigger' : 'custom',
      position: { 
        x: Math.random() * 400 + 200, 
        y: Math.random() * 200 + 100 
      },
      data: { 
        label: nodeType.name, 
        icon: nodeType.icon, 
        color: nodeType.color,
        nodeType: nodeType.id 
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setNodePanelOpen(false);
  }, [setNodes]);

  const handleDeleteNode = useCallback(() => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
      setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
      setSelectedNode(null);
      setConfigPanelOpen(false);
    }
  }, [selectedNode, setNodes, setEdges]);

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
  const handleSave = useCallback(() => {
    // Simulate save - in real app would call API
    setSaveMessage('Workflow saved!');
    setTimeout(() => setSaveMessage(null), 2000);
    console.log('Workflow saved:', { workflowName, nodes, edges });
  }, [workflowName, nodes, edges]);

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
      const newNode: Node<CustomNodeData> = {
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
      const newNode: Node<CustomNodeData> = {
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
          {/* Save message indicator */}
          {saveMessage && (
            <span className="text-sm text-green-600 font-medium animate-pulse">
              {saveMessage}
            </span>
          )}
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
            onClick={handleSave}
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
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
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
          
          {/* Add Node Button */}
          <Panel position="bottom-center" className="mb-4">
            <button 
              onClick={() => setNodePanelOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all hover:scale-105"
            >
              <Plus className="w-5 h-5" />
              Add Node
            </button>
          </Panel>
        </ReactFlow>

        {/* Node Panel */}
        <NodePanel 
          isOpen={nodePanelOpen} 
          onClose={() => setNodePanelOpen(false)}
          onAddNode={handleAddNode}
        />

        {/* Node Config Panel */}
        <NodeConfigPanel
          isOpen={configPanelOpen}
          node={selectedNode}
          onClose={() => setConfigPanelOpen(false)}
          onUpdateNode={handleUpdateNode}
        />
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
