import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Database, Zap, Search } from 'lucide-react';
import { type Node, type Edge } from 'reactflow';
import DataPill from './DataPill';
import { useNodeTypes } from '../../hooks/useNodeTypes';

interface DataMappingPanelProps {
  /** Current node being configured */
  currentNode: Node;
  /** All nodes in the workflow */
  nodes: Node[];
  /** All edges in the workflow */
  edges: Edge[];
  /** Last execution data keyed by node ID */
  lastExecutionData?: Record<string, any>;
}

/** Infer JS type label from a value */
function inferType(value: unknown): 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'unknown' {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return 'array';
  const t = typeof value;
  if (t === 'string') return 'string';
  if (t === 'number') return 'number';
  if (t === 'boolean') return 'boolean';
  if (t === 'object') return 'object';
  return 'unknown';
}

/** Truncate a sample value for display */
function truncateValue(value: unknown, maxLen = 60): string {
  if (value === null || value === undefined) return 'null';
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

interface TreeNodeProps {
  name: string;
  value: unknown;
  path: string;
  color: string;
  depth?: number;
  defaultOpen?: boolean;
  isMock?: boolean;
}

function TreeNode({ name, value, path, color, depth = 0, defaultOpen = false, isMock = false }: TreeNodeProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const type = inferType(value);

  // For primitive values, render a pill
  if (type !== 'object' && type !== 'array') {
    return (
      <div className="flex items-center gap-2 py-0.5" style={{ paddingLeft: `${depth * 16}px` }}>
        <DataPill
          label={name}
          path={path}
          color={color}
          type={type}
          sampleValue={truncateValue(value)}
          size="sm"
          isMock={isMock}
        />
        <span className="text-[11px] text-muted-foreground truncate max-w-[220px] font-mono">
          {truncateValue(value, 60)}
        </span>
      </div>
    );
  }

  // For objects/arrays, render a collapsible tree
  const entries = type === 'array'
    ? (value as unknown[]).map((v, i) => [`[${i}]`, v] as [string, unknown])
    : Object.entries(value as Record<string, unknown>);

  return (
    <div style={{ paddingLeft: `${depth * 16}px` }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 py-1 w-full text-left hover:bg-muted rounded px-1 -ml-1 transition-colors group"
      >
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}
        <DataPill
          label={name}
          path={path}
          color={color}
          type={type}
          sampleValue={`${type === 'array' ? `Array(${(value as unknown[]).length})` : `Object(${Object.keys(value as object).length} keys)`}`}
          size="sm"
          isMock={isMock}
        />
        <span className="text-[11px] text-muted-foreground font-mono">
          {type === 'array' ? `[${(value as unknown[]).length}]` : `{${Object.keys(value as object).length}}`}
        </span>
      </button>
      {isOpen && entries.length > 0 && (
        <div className="ml-1 border-l border-border/60">
          {entries.map(([key, val]) => (
            <TreeNode
              key={key}
              name={key}
              value={val}
              path={type === 'array' ? `${path}${key}` : `${path}.${key}`}
              color={color}
              depth={1}
              isMock={isMock}
            />
          ))}
        </div>
      )}
      {isOpen && entries.length === 0 && (
        <div className="text-[10px] text-muted-foreground/60 py-1" style={{ paddingLeft: '16px' }}>
          (empty)
        </div>
      )}
    </div>
  );
}

export default function DataMappingPanel({
  currentNode,
  nodes,
  edges,
  lastExecutionData = {},
}: DataMappingPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

    const { getNodeConfigSync } = useNodeTypes();

  // Calculate upstream nodes via BFS
  const upstreamNodes = useMemo(() => {
    const reachable = new Set<string>();
    const queue = [currentNode.id];
    const visited = new Set<string>([currentNode.id]);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const upEdges = edges.filter((e) => e.target === currentId);
      for (const edge of upEdges) {
        if (!visited.has(edge.source)) {
          visited.add(edge.source);
          reachable.add(edge.source);
          queue.push(edge.source);
        }
      }
    }

    return nodes
      .filter((n) => reachable.has(n.id))
      .map((n) => {
        const config = getNodeConfigSync(n.data?.nodeType || '');
        return {
          id: n.id,
          label: n.data?.label || n.id,
          color: n.data?.color || '#7b68ee',
          icon: n.data?.icon || '📦',
          outputData: lastExecutionData[n.id] || n.data?.outputData,
          staticFields: [
            ...(config?.outputFields || []),
            ...(n.data?.customFieldDefs || []).map((f: { id: string; label: string }) => f.label || f.id.replace('custom_', '')),
          ],
        };
      });
  }, [currentNode.id, nodes, edges, lastExecutionData, getNodeConfigSync]);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  // Auto-expand all nodes on mount
  useMemo(() => {
    const allIds = new Set(upstreamNodes.map((n) => n.id));
    setExpandedNodes(allIds);
  }, [upstreamNodes.length]);

  return (
    <div className="h-full flex flex-col bg-background/40">
      {/* Header */}
      <div className="p-3 border-b border-border/60">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-primary" />
          <h3 className="text-base font-bold text-foreground">Input Data</h3>
          <span className="text-[11px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">
            Drag to map
          </span>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search fields..."
            className="w-full pl-8 pr-3 py-1.5 bg-muted/40 border border-border/60 rounded-lg text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </div>
      </div>

      {/* Node List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {upstreamNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-3">
              <Zap className="w-5 h-5 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">No upstream nodes</p>
            <p className="text-xs text-muted-foreground/60 mt-1 max-w-[200px]">
              Connect nodes before this one to see available data
            </p>
          </div>
        ) : (
          upstreamNodes.map((upNode) => {
            const isExpanded = expandedNodes.has(upNode.id);
            const hasData = (upNode.outputData && (
              (Array.isArray(upNode.outputData) && upNode.outputData.length > 0) ||
              (typeof upNode.outputData === 'object' && Object.keys(upNode.outputData).length > 0)
            )) || !!nodes.find(n => n.id === upNode.id)?.data?.test_data;

            // Extract the json data from items format
            let displayData: Record<string, unknown> = {};
            let isMock = false;

            if (Array.isArray(upNode.outputData) && upNode.outputData.length > 0) {
              const first = upNode.outputData[0];
              displayData = first?.json || first || {};
            } else if (typeof upNode.outputData === 'object' && upNode.outputData !== null && Object.keys(upNode.outputData).length > 0) {
              displayData = upNode.outputData.json || upNode.outputData;
            } else {
              // Fallback to test_data from node.data
              const node = nodes.find(n => n.id === upNode.id);
              if (node?.data?.test_data) {
                displayData = node.data.test_data;
                isMock = true;
              }
            }

            // Filter by search query
            const filteredKeys = searchQuery
              ? Object.keys(displayData).filter((k) =>
                  k.toLowerCase().includes(searchQuery.toLowerCase())
                )
              : Object.keys(displayData);

            return (
              <div
                key={upNode.id}
                className="rounded-lg border border-border/60 overflow-hidden bg-muted/20"
              >
                {/* Node Header */}
                <button
                  onClick={() => toggleNode(upNode.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/30 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  )}
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center text-sm shrink-0"
                    style={{ backgroundColor: `${upNode.color}20`, color: upNode.color }}
                  >
                    {upNode.icon}
                  </div>
                  <span className="text-xs font-semibold text-foreground truncate flex-1 text-left">
                    {upNode.label}
                  </span>
                  {!hasData && (
                    <span className="text-[9px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded-full">
                      No data
                    </span>
                  )}
                </button>

                {/* Data Tree */}
                {isExpanded && (
                  <div className="px-3 pb-2.5 pt-0.5 space-y-0.5">
                    {!hasData && upNode.staticFields.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/60 py-2 text-center">
                        Run the workflow to see output data
                      </p>
                    ) : (hasData && filteredKeys.length === 0) ? (
                      <p className="text-[11px] text-muted-foreground/60 py-2 text-center">
                        No matching fields
                      </p>
                    ) : hasData ? (
                      filteredKeys.map((key) => (
                        <TreeNode
                          key={key}
                          name={key}
                          value={displayData[key]}
                          path={`$node["${upNode.label}"].json.${key}`}
                          color={upNode.color}
                          defaultOpen={false}
                          isMock={isMock}
                        />
                      ))
                    ) : (
                      /* Display Static Fields if no data */
                      upNode.staticFields
                        .filter(key => !searchQuery || key.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((key) => (
                          <div key={key} className="flex items-center gap-2 py-0.5" style={{ paddingLeft: '0px' }}>
                            <DataPill
                              label={key}
                              path={`$node["${upNode.label}"].json.${key}`}
                              color={upNode.color}
                              type="unknown"
                              sampleValue="[static]"
                              size="sm"
                            />
                            <span className="text-[10px] text-muted-foreground/40 italic">
                              (available on run)
                            </span>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Hint */}
      <div className="p-2.5 border-t border-border/60 bg-background/60">
        <p className="text-[10px] text-muted-foreground/60 text-center flex items-center justify-center gap-1.5">
          <span className="inline-block w-4 h-4 bg-primary/20 text-primary rounded text-[9px] font-bold flex items-center justify-center">⇄</span>
          Drag pills into parameter fields to map data
        </p>
      </div>
    </div>
  );
}
