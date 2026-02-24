import { useState, useEffect, useMemo } from 'react';
import { Database, ArrowRightLeft, Copy, Check, Download, PinIcon, Table as TableIcon, Code, Save, X, ChevronDown, ChevronRight } from 'lucide-react';
import JsonTree from './JsonTree';
import TableView from './TableView';
import { toast } from 'sonner';
import { normalizeToItems, getItemCountLabel, type NodeItem } from '../../types/nodeData';

interface DataViewerProps {
  inputData?: unknown;
  outputData?: unknown;
  nodeName?: string;
  executionTime?: string;
  onPinData?: (data: unknown) => void;
  isPinned?: boolean;
  activeTab?: 'input' | 'output';
  onTabChange?: (tab: 'input' | 'output') => void;
  hideTabs?: boolean;
}

/**
 * Data viewer component showing input/output for node executions
 * Supports n8n-style items format with JSON Tree and Table views
 */
export default function DataViewer({ 
  inputData, 
  outputData, 
  nodeName,
  onPinData,
  isPinned = false,
  activeTab: externalActiveTab,
  onTabChange,
  hideTabs = false
}: DataViewerProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<'input' | 'output'>('output');
  const activeTab = externalActiveTab || internalActiveTab;
  
  const setActiveTab = (tab: 'input' | 'output') => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalActiveTab(tab);
    }
  };
  const [viewMode, setViewMode] = useState<'json' | 'table'>('table');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [copied, setCopied] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set([0]));

  const currentData = activeTab === 'input' ? inputData : outputData;
  
  // Normalize data to items format
  const items: NodeItem[] = useMemo(() => {
    return normalizeToItems(currentData);
  }, [currentData]);
  
  const itemCountLabel = getItemCountLabel(items);

  // For table view, flatten items' json data
  const tableData = useMemo(() => {
    return items.map(item => item.json);
  }, [items]);

  useEffect(() => {
    if (activeTab === 'input' && !inputData) setViewMode('json');
  }, [activeTab, inputData]);

  const handleCopyAll = async () => {
    await navigator.clipboard.writeText(JSON.stringify(items, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${nodeName || 'data'}-${activeTab}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEdit = () => {
    // Default to n8n items format for editing
    const editData = items.length > 0 ? items : [{ json: {} }];
    setEditValue(JSON.stringify(editData, null, 2));
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    try {
      const parsed = JSON.parse(editValue);
      if (onPinData) {
        // Ensure items format
        const normalizedItems = normalizeToItems(parsed);
        onPinData(normalizedItems);
      }
      setIsEditing(false);
    } catch (e) {
      toast.error('Invalid JSON');
    }
  };

  const toggleItemExpanded = (index: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const renderItemsList = () => {
    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <Database className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm">No {activeTab} data available</p>
          <p className="text-xs mt-1">Run the workflow to see data</p>
        </div>
      );
    }

    return (
      <div className="divide-y divide-border">
        {items.map((item, index) => {
          const isExpanded = expandedItems.has(index);
          return (
            <div key={index} className="bg-background">
              {/* Item Header */}
              <button
                onClick={() => toggleItemExpanded(index)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
                <span className="text-xs font-medium text-primary">Item {index}</span>
                <span className="text-xs text-muted-foreground">
                  {Object.keys(item.json).length} fields
                </span>
                {item.binary && (
                  <span className="text-xs bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded">
                    binary
                  </span>
                )}
              </button>
              
              {/* Item Content */}
              {isExpanded && (
                <div className="px-3 pb-3">
                  <div className="bg-muted/30 rounded-md p-2 text-xs font-mono overflow-auto max-h-[300px]">
                    <JsonTree data={item.json} defaultExpanded={true} />
                  </div>
                  {item.binary && (
                    <div className="mt-2">
                      <span className="text-xs font-medium text-muted-foreground">Binary Data:</span>
                      <div className="bg-muted/30 rounded-md p-2 mt-1">
                        <JsonTree data={item.binary} defaultExpanded={false} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 overflow-hidden">
          {nodeName && (
            <span className="text-sm font-medium truncate max-w-[120px]" title={nodeName}>{nodeName}</span>
          )}
          <span className="text-xs text-muted-foreground whitespace-nowrap bg-muted px-1.5 py-0.5 rounded">
            {itemCountLabel}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          {activeTab === 'input' && onPinData && (
             <button
               onClick={isEditing ? () => setIsEditing(false) : handleEdit}
               className={`p-1.5 rounded transition-colors ${isPinned || isEditing ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-muted'}`}
               title={isEditing ? "Cancel Edit" : "Pin/Edit Data"}
             >
               {isEditing ? <X className="w-4 h-4" /> : <PinIcon className="w-4 h-4" />}
             </button>
          )}

          <div className="w-px h-4 bg-border mx-1" />

          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'table' ? 'text-foreground bg-muted' : 'text-muted-foreground hover:bg-muted'}`}
            title="Table View"
          >
            <TableIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('json')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'json' ? 'text-foreground bg-muted' : 'text-muted-foreground hover:bg-muted'}`}
            title="JSON View"
          >
            <Code className="w-4 h-4" />
          </button>
          
          <div className="w-px h-4 bg-border mx-1" />

          <button
            onClick={handleCopyAll}
            className="p-1.5 hover:bg-muted rounded transition-colors"
            title="Copy all data"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 hover:bg-muted rounded transition-colors"
            title="Download as JSON"
          >
            <Download className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      {!hideTabs && (
        <div className="flex border-b border-border bg-muted/10">
          <button
            onClick={() => setActiveTab('input')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium transition-colors ${
              activeTab === 'input'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            Input
          </button>
          <button
            onClick={() => setActiveTab('output')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium transition-colors ${
              activeTab === 'output'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Output
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {isEditing ? (
          <div className="absolute inset-0 flex flex-col bg-background z-10">
            <div className="p-2 border-b border-border flex justify-between items-center bg-muted/20">
              <span className="text-xs font-medium text-muted-foreground">Editing Input Data (Items Format)</span>
              <button 
                onClick={handleSaveEdit}
                className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground text-xs rounded hover:bg-primary/90"
              >
                <Save className="w-3 h-3" /> Save
              </button>
            </div>
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1 w-full p-4 font-mono text-xs focus:outline-none resize-none"
              spellCheck={false}
              placeholder='[{"json": {"key": "value"}}]'
            />
          </div>
        ) : (
          <div className="h-full overflow-auto">
            {viewMode === 'table' && tableData.length > 0 ? (
              <TableView data={tableData} className="h-full border-0 rounded-none" />
            ) : viewMode === 'json' && items.length > 0 ? (
              <div className="p-2 text-xs font-mono h-full overflow-auto">
                <JsonTree data={items} defaultExpanded={true} />
              </div>
            ) : (
              renderItemsList()
            )}
          </div>
        )}
      </div>
    </div>
  );
}

