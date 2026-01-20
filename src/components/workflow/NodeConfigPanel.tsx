import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp, Info, Copy, Check, Settings, Database, ArrowRightLeft, Play, Save } from 'lucide-react';
import { useMemo } from 'react';
import { type Node } from 'reactflow';
import { getNodeConfig, type ConfigField, type NodeConfig } from '../../lib/nodeConfigs';
import DataViewer from '../execution/DataViewer';
import CredentialPicker from './CredentialPicker';
import ExpressionEditor from './ExpressionEditor';
import SaveCustomNodeModal from './SaveCustomNodeModal';

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
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Get node configuration based on node type
  // Get node configuration based on node type
  // const nodeType = node?.data?.nodeType || '';
  // const nodeConfig: NodeConfig | undefined = getNodeConfig(nodeType);

  const nodeConfig = useMemo(() => {
    if (!node) return undefined;
    
    // Custom Builder Node
    if (node.data?.nodeType === 'custom_builder' || node.data?.isBuilderNode === true || (node.data?.fields && node.data?.fields.length > 0)) {
       return {
         nodeType: node.data.nodeType,
         displayName: node.data.label,
         description: node.data.description || 'Custom Node',
         fields: node.data.fields || [],
         inputs: [],
         outputs: [{ id: 'output-0' }],
         color: node.data.color,
         icon: node.data.icon,
       } as NodeConfig;
    }

    return getNodeConfig(node.data?.nodeType || '');
  }, [node]);

  const nodeType = nodeConfig?.nodeType || node?.data?.nodeType || '';

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
        return (
          <ExpressionEditor
            value={value as string}
            onChange={(v) => handleFieldChange(field.id, v)}
            placeholder={field.placeholder}
          />
        );

      case 'password':
        return (
          <input
            type="password"
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
          <ExpressionEditor
            value={value as string}
            onChange={(v) => handleFieldChange(field.id, v)}
            placeholder={field.placeholder}
            multiline
            rows={4}
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

      case 'credential':
        return (
          <CredentialPicker
            value={value as string}
            onChange={(credId) => handleFieldChange(field.id, credId)}
            credentialType={field.credentialType}
            placeholder={field.placeholder || 'Select a credential...'}
            required={field.required}
          />
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

    // State for simulated execution
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<unknown>(null);

  // Mock input/output data for demonstration
  const getMockData = (type: string, input: any = null) => {
    if (type === 'manual_trigger') {
      return [{ json: { timestamp: new Date().toISOString(), trigger: 'manual' } }];
    }
    if (type === 'http_request') {
      return [{ json: { status: 200, data: { id: 101, name: 'Response Data' }, headers: { 'content-type': 'application/json' } } }];
    }
    // Generic transformation
    return [{ json: { ...input?.[0]?.json, processed: true, processedAt: new Date().toISOString() } }];
  };

  const handleTestStep = () => {
    if (!node) return;
    
    setIsExecuting(true);
    // Simulate API call
    setTimeout(() => {
      const result = getMockData(nodeType, node.data.inputData || [{ json: { sample: 'input' } }]);
      setExecutionResult(result);
      setIsExecuting(false);
      
      // Update node data with output for persistence (like n8n does temporarily)
      onUpdateNode(node.id, {
        ...node.data,
        outputData: result
      });
      
      // Switch to output tab to show result
      setActiveTab('output');
    }, 1500);
  };

  if (!isOpen || !node) return null;

  return (
    <div className="absolute top-0 right-0 h-full w-[450px] bg-card border-l border-border shadow-xl z-50 flex flex-col transition-all animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shadow-sm"
              style={{ backgroundColor: `${node.data?.color || '#7b68ee'}20`, color: node.data?.color || '#7b68ee' }}
            >
              {node.data?.icon || '📦'}
            </div>
            <div>
              <h3 className="font-bold text-base">{node.data?.label || 'Node'}</h3>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                {nodeType.replace(/_/g, ' ')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'settings'
                ? 'bg-background shadow-sm text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Parameters
          </button>
          <button
            onClick={() => setActiveTab('input')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'input'
                ? 'bg-background shadow-sm text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            Input
          </button>
          <button
            onClick={() => setActiveTab('output')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'output'
                ? 'bg-background shadow-sm text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Output
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        {activeTab === 'settings' && nodeConfig && (
          <div className="space-y-5">
            {nodeConfig.fields.map((field) => (
              <div key={field.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {field.label}
                    {field.required && <span className="text-red-500">*</span>}
                  </label>
                  {field.description && field.type !== 'checkbox' && (
                    <span title={field.description} className="cursor-help text-muted-foreground hover:text-foreground transition-colors">
                      <Info className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
                {renderField(field)}
              </div>
            ))}

            {nodeConfig.fields.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                    <Settings className="w-6 h-6 opacity-30" />
                </div>
                <p className="text-sm font-medium">No configuration required</p>
                <p className="text-xs mt-1">This node works with default settings</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && !nodeConfig && (
          <div className="text-center py-12 text-muted-foreground">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                <Info className="w-6 h-6 opacity-30" />
            </div>
            <p className="text-sm font-medium">Configuration not available</p>
            <p className="text-xs mt-1">Node type: <span className="font-mono">{nodeType || 'unknown'}</span></p>
          </div>
        )}

        {(activeTab === 'input' || activeTab === 'output') && (
          <div className="h-full">
             <DataViewer 
               inputData={activeTab === 'input' ? (node.data.inputData || [{ json: { message: 'No input data yet' } }]) : undefined}
               outputData={activeTab === 'output' ? (node.data.outputData || executionResult) : undefined}
               nodeName={node.data.label}
               onPinData={activeTab === 'input' ? (data) => {
                 onUpdateNode(node.id, { ...node.data, inputData: data });
               } : undefined}
               isPinned={!!node.data.inputData}
             />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border flex gap-3 bg-muted/20">
        <button
          onClick={handleTestStep}
          disabled={isExecuting}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-bold transition-all ${
            isExecuting 
                ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm active:scale-95'
          }`}
        >
           {isExecuting ? (
             <>
               <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
               Executing...
             </>
           ) : (
             <>
               <Play className="w-4 h-4" />
               Test Step
             </>
           )}
        </button>
        {activeTab === 'settings' && nodeConfig && (
          <div className="flex-1 flex gap-2">
            <button
               onClick={() => setShowSaveModal(true)}
               className="px-3 py-2.5 bg-accent text-accent-foreground rounded-md hover:bg-accent/80 transition-colors"
               title="Save as Custom Node"
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-bold hover:bg-primary/90 shadow-sm transition-all active:scale-95"
            >
              Save
            </button>
          </div>
        )}
      </div>

      <SaveCustomNodeModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        baseNode={{
          id: node?.id || '',
          type: nodeType,
          config: formValues,
        }}
        onSave={() => {
           // Optionally show a toast here
           setShowSaveModal(false);
        }}
      />
    </div>
  );
}
