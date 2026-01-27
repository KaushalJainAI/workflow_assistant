import { useState, useEffect } from 'react';
import { Search, X, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getCustomNodes, type CustomNodeMetadata } from '../../lib/customNodes';
import { useNodeTypes } from '../../hooks/useNodeTypes';
import NodeBuilderModal from './NodeBuilderModal';

interface NodeAction {
  id: string;
  name: string;
  description: string;
}

interface NodeType {
  id: string; // This corresponds to 'nodeType' from backend
  name: string;
  description: string;
  category: string;
  color: string;
  icon: string;
  inputs?: any[]; // Array of inputs to determine if it's a trigger
  actions?: NodeAction[];
}

interface NodePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAddNode: (nodeType: NodeType) => void;
  isFirstNode?: boolean;
  triggersOnly?: boolean;
  showAll?: boolean;
}

export default function NodePanel({ isOpen, onClose, onAddNode, isFirstNode = false, triggersOnly = false, showAll = false }: NodePanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<NodeType | null>(null);
  const [customNodes, setCustomNodes] = useState<CustomNodeMetadata[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  
  const { nodes: backendNodes, loading, error, refresh } = useNodeTypes();

  useEffect(() => {
    if (isOpen) {
      setCustomNodes(getCustomNodes());
      refresh(); // Refresh backend nodes when opening panel
    }
  }, [isOpen, showBuilder, refresh]);

  // Debug logging: helpful to keep but cleaning up mock
  useEffect(() => {
    if (isOpen) {
      console.log('NodePanel Open - Backend Nodes:', backendNodes);
    }
  }, [isOpen, backendNodes]);

  // Map backend nodes to local NodeType interface
  const mappedBackendNodes: NodeType[] = backendNodes.map(node => ({
      // Handle both camelCase (frontend expected) and snake_case (current backend default)
      id: node.nodeType || (node as any).node_type || `unknown-${Math.random()}`,
      name: node.name,
      description: node.description,
      category: node.category,
      color: node.color,
      icon: node.icon,
      inputs: node.inputs,
      actions: []
  }));

  // Map custom nodes to NodeType
  const mappedCustomNodes: NodeType[] = customNodes.map(node => ({
    id: node.id,
    name: node.name,
    description: node.description,
    category: node.category,
    color: node.color,
    icon: node.icon,
    inputs: [], // Custom nodes structure might vary, assume no specific check for now or empty
    actions: []
  }));

  // Deduplicate using a Map<string, NodeType>
  const uniqueNodesMap = new Map<string, NodeType>();
  [...mappedCustomNodes, ...mappedBackendNodes].forEach(node => {
    uniqueNodesMap.set(node.id, node);
  });
  
  const allNodes = Array.from(uniqueNodesMap.values());

  const categories = Array.from(new Set(allNodes.map(n => n.category))).filter((cat) => {
    // Show all categories regardless of triggersOnly per user request
    return true;
  });

  const filteredNodes = allNodes.filter(node => {
    const matchesSearch = (node.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (node.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    // Per user request: "allow every node to be added"
    // Removed strict trigger filtering.
    // Triggers will still be identified but not used for exclusion/inclusion.
    
    const matchesCategory = !selectedCategory || node.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const groupedNodes = filteredNodes.reduce((acc, node) => {
    // Capitalize category for display if needed
    const displayCategory = node.category.charAt(0).toUpperCase() + node.category.slice(1);
    if (!acc[displayCategory]) {
      acc[displayCategory] = [];
    }
    acc[displayCategory].push(node);
    return acc;
  }, {} as Record<string, NodeType[]>);

  if (!isOpen) return null;

  // If an app with actions is selected, show the actions panel
  if (selectedApp && selectedApp.actions && selectedApp.actions.length > 0) {
    return (
      <div className="absolute top-0 right-0 h-full w-80 bg-card border-l border-border shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setSelectedApp(null)}
                className="p-1 hover:bg-muted rounded"
                title="Back to nodes"
              >
                <span className="text-lg">←</span>
              </button>
              <div className="flex items-center gap-2">
                <div 
                  className="w-6 h-6 rounded flex items-center justify-center text-sm"
                  style={{ backgroundColor: `${selectedApp.color}20` }}
                >
                  {selectedApp.icon}
                </div>
                <h3 className="font-semibold">{selectedApp.name}</h3>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-1 hover:bg-muted rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Actions List */}
        <div className="flex-1 overflow-auto p-2">
          <div className="space-y-1">
            {selectedApp.actions.map(action => (
              <button
                key={action.id}
                onClick={() => {
                  onAddNode({
                    ...selectedApp,
                    id: action.id,
                    name: `${selectedApp.name} - ${action.name}`,
                    description: action.description,
                  });
                  setSelectedApp(null);
                }}
                draggable
                onDragStart={(e) => {
                  const nodeData = {
                    ...selectedApp,
                    id: action.id,
                    name: `${selectedApp.name} - ${action.name}`,
                    description: action.description,
                  };
                  e.dataTransfer.setData('application/reactflow', JSON.stringify(nodeData));
                  e.dataTransfer.effectAllowed = 'move';
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left group cursor-grab active:cursor-grabbing"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm group-hover:text-primary transition-colors">
                    {action.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {action.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-card border-l border-border shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Add Node</h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-muted rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-1.5 p-3 border-b border-border">
        <button
          onClick={() => setSelectedCategory(null)}
          className={cn(
            "px-3 py-1.5 text-xs rounded-full transition-colors",
            !selectedCategory ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
          )}
        >
          All
        </button>
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={cn(
              "px-3 py-1.5 text-xs rounded-full transition-colors",
              selectedCategory === category ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            )}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Node List */}
      <div className="flex-1 overflow-auto p-2">
        {Object.entries(groupedNodes).map(([category, nodes]) => (
          <div key={category} className="mb-4">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 mb-2">
              {category}
            </h4>
            <div className="space-y-1">
              {nodes.map(node => (
                <button
                  key={node.id}
                  onClick={() => {
                    if (node.actions && node.actions.length > 0) {
                      setSelectedApp(node);
                    } else {
                      onAddNode(node);
                    }
                  }}
                  draggable={!node.actions || node.actions.length === 0}
                  onDragStart={(e) => {
                    if (!node.actions || node.actions.length === 0) {
                      e.dataTransfer.setData('application/reactflow', JSON.stringify(node));
                      e.dataTransfer.effectAllowed = 'move';
                    }
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left group",
                    (!node.actions || node.actions.length === 0) ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                  )}
                >
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                    style={{ backgroundColor: `${node.color}20` }}
                  >
                    {node.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm group-hover:text-primary transition-colors truncate">
                      {node.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {node.description}
                    </p>
                  </div>
                  {node.actions && node.actions.length > 0 && (
                    <span className="text-muted-foreground text-lg">→</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}

        {Object.keys(groupedNodes).length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Search className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No nodes found</p>
          </div>
        )}
      </div>

      {/* Footer - Node Builder */}
      <div className="p-3 border-t border-border bg-muted/10">
        <button
          onClick={() => setShowBuilder(true)}
          className="w-full py-2 bg-secondary text-secondary-foreground rounded-md text-xs font-semibold hover:bg-secondary/80 flex items-center justify-center gap-2"
        >
          <span>✨</span> Create New Node Type
        </button>
      </div>

      <NodeBuilderModal 
        isOpen={showBuilder} 
        onClose={() => setShowBuilder(false)}
        onSave={() => {
           setCustomNodes(getCustomNodes());
        }}
      />
    </div>
  );
}
