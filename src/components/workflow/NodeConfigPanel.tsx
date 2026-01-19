import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp, Info, Copy, Check, Settings, Database, ArrowRightLeft } from 'lucide-react';
import { type Node } from 'reactflow';
import { getNodeConfig, type ConfigField, type NodeConfig } from '../../lib/nodeConfigs';

interface NodeConfigPanelProps {
  isOpen: boolean;
  node: Node | null;
  onClose: () => void;
  onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void;
}

type TabType = 'settings' | 'input' | 'output';

export default function NodeConfigPanel({ isOpen, node, onClose, onUpdateNode }: NodeConfigPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('settings');
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Get node configuration based on node type
  const nodeType = node?.data?.nodeType || '';
  const nodeConfig: NodeConfig | undefined = getNodeConfig(nodeType);

  // Initialize form values when node changes
  useEffect(() => {
    if (node && nodeConfig) {
      const initialValues: Record<string, unknown> = {};
      nodeConfig.fields.forEach((field) => {
        // Use existing node data if available, otherwise use default
        initialValues[field.id] = node.data?.config?.[field.id] ?? field.defaultValue ?? '';
      });
      setFormValues(initialValues);
    }
  }, [node?.id, nodeConfig]);

  // Handle field value change
  const handleFieldChange = (fieldId: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  // Save configuration
  const handleSave = () => {
    if (node) {
      onUpdateNode(node.id, {
        ...node.data,
        config: formValues,
      });
    }
  };

  // Copy value to clipboard
  const handleCopy = async (fieldId: string, value: unknown) => {
    const text = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
    await navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Toggle field expansion
  const toggleExpand = (fieldId: string) => {
    setExpandedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
      }
      return next;
    });
  };

  // Render form field based on type
  const renderField = (field: ConfigField) => {
    const value = formValues[field.id] ?? '';
    const isExpanded = expandedFields.has(field.id);

    switch (field.type) {
      case 'text':
      case 'password':
        return (
          <input
            type={field.type}
            value={value as string}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value as number}
            onChange={(e) => handleFieldChange(field.id, parseFloat(e.target.value) || 0)}
            placeholder={field.placeholder}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        );

      case 'textarea':
        return (
          <textarea
            value={value as string}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            rows={4}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        );

      case 'select':
        return (
          <select
            value={value as string}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'checkbox':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value as boolean}
              onChange={(e) => handleFieldChange(field.id, e.target.checked)}
              className="w-4 h-4 rounded border-input"
            />
            <span className="text-sm text-muted-foreground">{field.description || 'Enable'}</span>
          </label>
        );

      case 'json':
      case 'code':
        return (
          <div className="space-y-2">
            <div className="relative">
              <textarea
                value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value as string}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    handleFieldChange(field.id, parsed);
                  } catch {
                    handleFieldChange(field.id, e.target.value);
                  }
                }}
                placeholder={field.placeholder}
                rows={isExpanded ? 12 : 4}
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
              <div className="absolute top-2 right-2 flex gap-1">
                <button
                  type="button"
                  onClick={() => handleCopy(field.id, value)}
                  className="p-1 hover:bg-muted rounded text-muted-foreground"
                  title="Copy"
                >
                  {copiedField === field.id ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => toggleExpand(field.id)}
                  className="p-1 hover:bg-muted rounded text-muted-foreground"
                  title={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={value as string}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        );
    }
  };

  // Mock input/output data for demonstration
  const mockInputData = {
    items: [
      {
        json: {
          id: 1,
          name: 'Sample Item',
          status: 'active',
        },
      },
    ],
  };

  const mockOutputData = {
    items: [
      {
        json: {
          id: 1,
          name: 'Sample Item',
          status: 'active',
          processed: true,
          timestamp: new Date().toISOString(),
        },
      },
    ],
  };

  if (!isOpen || !node) return null;

  return (
    <div className="absolute top-0 right-0 h-full w-96 bg-card border-l border-border shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
              style={{ backgroundColor: `${node.data?.color || '#7b68ee'}30` }}
            >
              {node.data?.icon || '📦'}
            </div>
            <div>
              <h3 className="font-semibold text-sm">{node.data?.label || 'Node'}</h3>
              <p className="text-xs text-muted-foreground">
                {nodeConfig?.description || 'Configure this node'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'settings'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Settings className="w-3 h-3" />
            Settings
          </button>
          <button
            onClick={() => setActiveTab('input')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'input'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Database className="w-3 h-3" />
            Input
          </button>
          <button
            onClick={() => setActiveTab('output')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'output'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ArrowRightLeft className="w-3 h-3" />
            Output
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'settings' && nodeConfig && (
          <div className="space-y-4">
            {nodeConfig.fields.map((field) => (
              <div key={field.id} className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium">
                  {field.label}
                  {field.required && <span className="text-red-500">*</span>}
                  {field.description && field.type !== 'checkbox' && (
                    <span title={field.description} className="cursor-help">
                      <Info className="w-3 h-3 text-muted-foreground" />
                    </span>
                  )}
                </label>
                {renderField(field)}
              </div>
            ))}

            {nodeConfig.fields.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No configuration required</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && !nodeConfig && (
          <div className="text-center py-8 text-muted-foreground">
            <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Configuration not available for this node type</p>
            <p className="text-xs mt-1">Node type: {nodeType || 'unknown'}</p>
          </div>
        )}

        {activeTab === 'input' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Input Data</h4>
              <span className="text-xs text-muted-foreground">1 item</span>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <pre className="text-xs font-mono overflow-auto whitespace-pre-wrap">
                {JSON.stringify(mockInputData, null, 2)}
              </pre>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Info className="w-3 h-3" />
              This is sample data. Run the workflow to see actual input.
            </p>
          </div>
        )}

        {activeTab === 'output' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Output Data</h4>
              <span className="text-xs text-muted-foreground">1 item</span>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <pre className="text-xs font-mono overflow-auto whitespace-pre-wrap">
                {JSON.stringify(mockOutputData, null, 2)}
              </pre>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Info className="w-3 h-3" />
              This is sample data. Run the workflow to see actual output.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      {activeTab === 'settings' && nodeConfig && (
        <div className="p-4 border-t border-border">
          <button
            onClick={handleSave}
            className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Save Configuration
          </button>
        </div>
      )}
    </div>
  );
}
