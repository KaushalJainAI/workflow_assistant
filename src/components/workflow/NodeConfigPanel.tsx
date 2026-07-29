import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, ChevronDown, ChevronUp, Info, Copy, Check, Settings, Database, ArrowRightLeft, Play, Save, ArrowLeft } from 'lucide-react';
import { type Node, type Edge } from 'reactflow';
import { getNodeConfig, nodeConfigs, type ConfigField, type NodeConfig } from '../../lib/nodeConfigs';
import DataViewer from '../execution/DataViewer';
import CredentialPicker from './CredentialPicker';
import ExpressionEditor from './ExpressionEditor';
import SaveCustomNodeModal from './SaveCustomNodeModal';
import DataMappingPanel from './DataMappingPanel';
import { useNodeTypes } from '../../hooks/useNodeTypes';
import CredentialModal from '../credentials/CredentialModal';
import { credentialsService, type CredentialType } from '../../api/credentials';
import { type NodeField, type NodeHandle } from '../../api/nodeService';
import orchestratorService from '../../api/orchestrator';
import { normalizeToItems } from '../../types/nodeData';
import { toast } from 'sonner';
import { useAIModels } from '../../hooks/useAIModels';

import apiClient from '../../api/client';
import { Plus, Trash2, Key, Zap, Search, Loader2 } from 'lucide-react';
import Select from '../ui/Select';

interface NodeConfigPanelProps {
  isOpen: boolean;
  node: Node | null;
  nodes: Node[];
  edges: Edge[];
  onClose: () => void;
  onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void;
  workflowId?: number | null;
  lastExecutionData?: Record<string, any>;
}

const DYNAMIC_NODE_TYPES = [
  'openai', 
  'gemini', 
  'ollama', 
  'perplexity', 
  'openrouter', 
  'anthropic',
  'custom_builder'
];

type TabType = 'settings' | 'input' | 'output';

export default function NodeConfigPanel({ 
  isOpen, 
  node, 
  nodes,
  edges,
  onClose, 
  onUpdateNode,
  workflowId,
  lastExecutionData = {},
}: NodeConfigPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('settings');
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [credentialTypes, setCredentialTypes] = useState<CredentialType[]>([]);

  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<unknown>(null);
  const [showCredentialModal, setShowCredentialModal] = useState(false);
  const [editingCredential, setEditingCredential] = useState<any>(null);
  
  const { providers: aiProviders } = useAIModels();
  
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const settingsContentRef = useRef<HTMLDivElement>(null);

  // Skills state — search-based picker with mine + public
  const [skillSearchQuery, setSkillSearchQuery] = useState('');
  const [skillSearchResults, setSkillSearchResults] = useState<{ mine: Array<{ id: string; title: string }>; public: Array<{ id: string; title: string }> }>({ mine: [], public: [] });
  const [isSearchingSkills, setIsSearchingSkills] = useState(false);
  const [skillsDropdownOpen, setSkillsDropdownOpen] = useState(false);

  // Custom parameter form state
  const [showAddParam, setShowAddParam] = useState(false);
  const [newParamName, setNewParamName] = useState('');
  const [newParamType, setNewParamType] = useState<'text' | 'number' | 'boolean' | 'json'>('text');

  useEffect(() => {
    isMountedRef.current = true;
    
    const fetchCredentials = async () => {
      try {
        const [typesRes] = await Promise.all([
          credentialsService.getTypes()
        ]);
        
        if (isMountedRef.current) {
          const types = typesRes.types ?? (Array.isArray(typesRes) ? typesRes : []);
          setCredentialTypes(types);
        }
      } catch (error) {
        console.error('Failed to fetch credentials:', error);
      }
    };

    fetchCredentials();

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Debounced skills search — fetches both mine and public
  useEffect(() => {
    const timer = setTimeout(async () => {
      setIsSearchingSkills(true);
      try {
        const [mineRes, publicRes] = await Promise.all([
          apiClient.get('/skills/search/', { params: { query: skillSearchQuery, tab: 'mine', page_size: 10 } }),
          apiClient.get('/skills/search/', { params: { query: skillSearchQuery, tab: 'public', page_size: 10 } }),
        ]);
        if (isMountedRef.current) {
          setSkillSearchResults({
            mine: (mineRes.data.results || []).map((s: any) => ({ id: String(s.id), title: s.title })),
            public: (publicRes.data.results || []).map((s: any) => ({ id: String(s.id), title: s.title })),
          });
        }
      } catch (error) {
        console.error('Failed to search skills:', error);
      } finally {
        if (isMountedRef.current) setIsSearchingSkills(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [skillSearchQuery]);

  const { getNodeConfigSync } = useNodeTypes();

  const nodeConfig = useMemo(() => {
    if (!node) return undefined;
    
    if (node.data?.nodeType === 'custom_builder' || 
        node.data?.isBuilderNode === true || 
        (node.data?.fields && node.data?.fields.length > 0)) {
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

    const dynamicConfig = getNodeConfigSync(node.data?.nodeType || '');
    if (dynamicConfig) return dynamicConfig;

    return getNodeConfig(node.data?.nodeType || '');
  }, [node, getNodeConfigSync]);

  const nodeType = nodeConfig?.nodeType || node?.data?.nodeType || '';

  // Initialize form values
  useEffect(() => {
    if (node && nodeConfig && nodeConfig.fields) {
      const initialValues: Record<string, unknown> = {};
      nodeConfig.fields.forEach((field) => {
        initialValues[field.id] = node.data?.config?.[field.id] ?? field.defaultValue ?? '';
      });
      // Also restore custom_* fields from saved config using customFieldDefs
      const savedConfig = node.data?.config || {};
      const fieldDefs: Array<{ id: string; label: string; type: string }> = node.data?.customFieldDefs || [];
      for (const def of fieldDefs) {
        if (savedConfig[def.id] !== undefined) {
          initialValues[def.id] = savedConfig[def.id];
        } else {
          // Set default based on type
          initialValues[def.id] = def.type === 'number' ? 0 : def.type === 'boolean' ? false : def.type === 'json' ? '{}' : '';
        }
      }
      setFormValues(initialValues);
    }
  }, [node?.id, node?.data?.config, nodeConfig]);

  const handleFieldChange = useCallback((fieldId: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  // Auto-save with debounce
  useEffect(() => {
    if (!node) return;

    const timer = setTimeout(() => {
      onUpdateNode(node.id, {
        ...node.data,
        config: formValues,
      });
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formValues, node?.id]);

  const handleForceSave = useCallback(() => {
    if (node) {
      onUpdateNode(node.id, {
        ...node.data,
        config: formValues,
      });
      onClose();
    }
  }, [node, formValues, onUpdateNode, onClose]);

  const handleCopy = async (fieldId: string, value: unknown) => {
    const text = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
    await navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

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

  // Calculate available (upstream) nodes for autocompletion
  const availableNodes = useMemo(() => {
    if (!node || !nodes || !edges) return [];
    
    const reachable = new Set<string>();
    const queue = [node.id];
    const visited = new Set<string>([node.id]);
    
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const upstreamEdges = edges.filter(e => e.target === currentId);
      for (const edge of upstreamEdges) {
        if (!visited.has(edge.source)) {
          visited.add(edge.source);
          reachable.add(edge.source);
          queue.push(edge.source);
        }
      }
    }
    
    return nodes
      .filter(n => reachable.has(n.id))
      .map(n => ({ id: n.id, label: n.data?.label || n.id, color: n.data?.color || '#7b68ee' }));
  }, [node, nodes, edges]);

  const renderField = (field: ConfigField | NodeField) => {
    const value = formValues[field.id] ?? '';
    const isExpanded = expandedFields.has(field.id);

    switch (field.type) {
      case 'text':
      case 'string':
        return (
          <ExpressionEditor
            value={value as string}
            onChange={(v) => handleFieldChange(field.id, v)}
            placeholder={field.placeholder}
            availableNodes={availableNodes}
          />
        );

      case 'password':
        return (
          <input
            type="password"
            value={value as string}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className="w-full px-3 py-2.5 bg-muted/40 border border-border/60 rounded-lg text-[15px] text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          />
        );

      case 'number': {
        // Use text input with string-backed display so users can naturally type
        // decimals ("0.") and negatives ("-") without value snapping.
        const NumberInput = () => {
          const [localStr, setLocalStr] = useState(String(value ?? ''));
          const localRef = useRef(localStr);
          // Sync from parent when value changes externally
          useEffect(() => {
            const parentStr = String(value ?? '');
            if (parentStr !== localRef.current) {
              setLocalStr(parentStr);
              localRef.current = parentStr;
            }
          }, []);
          return (
            <input
              type="text"
              inputMode="decimal"
              value={localStr}
              onChange={(e) => {
                const raw = e.target.value;
                // Allow empty, minus, dot, digits
                if (raw === '' || raw === '-' || raw === '.' || raw === '-.' || /^-?\d*\.?\d*$/.test(raw)) {
                  setLocalStr(raw);
                  localRef.current = raw;
                }
              }}
              onBlur={() => {
                const parsed = parseFloat(localStr);
                if (!isNaN(parsed)) {
                  handleFieldChange(field.id, parsed);
                  const canonical = String(parsed);
                  setLocalStr(canonical);
                  localRef.current = canonical;
                } else if (localStr === '' || localStr === '-' || localStr === '.') {
                  handleFieldChange(field.id, 0);
                  setLocalStr('0');
                  localRef.current = '0';
                }
              }}
              placeholder={field.placeholder}
              className="w-full px-3 py-2.5 bg-muted/40 border border-border/60 rounded-lg text-[15px] text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            />
          );
        };
        return <NumberInput />;
      }

      case 'textarea':
        return (
          <ExpressionEditor
            value={value as string}
            onChange={(v) => handleFieldChange(field.id, v)}
            placeholder={field.placeholder}
            multiline
            availableNodes={availableNodes}
          />
        );

      case 'select': {
        let options = field.options?.map((option) => {
          const { value, label } = typeof option === 'string'
            ? { value: option, label: option }
            : option;
          return { value, label };
        }) || [];

        // Check if this is a model field for an AI node
        const providerSlugMap: Record<string, string> = {
          'openai': 'openai',
          'gemini': 'gemini',
          'ollama': 'ollama',
          'perplexity': 'perplexity',
          'openrouter': 'openrouter',
          'anthropic': 'anthropic',
          'deepseek': 'deepseek',
          'mistral': 'mistral',
          'cohere': 'cohere',
          'groq': 'groq'
        };
        
        const slug = providerSlugMap[nodeType];
        
        if (field.id === 'model' && slug && aiProviders?.length > 0) {
          const provider = aiProviders.find((p: any) => p.slug === slug);
          if (provider && provider.models && provider.models.length > 0) {
            // Priority: Dynamic models from API always replace static models
            options = provider.models.map((m: any) => ({
              value: m.value,
              label: m.name
            }));
          }
        }

        return (
          <Select
            value={value as string}
            onChange={(val) => handleFieldChange(field.id, val)}
            options={options}
          />
        );
      }

      case 'checkbox':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value as boolean}
              onChange={(e) => handleFieldChange(field.id, e.target.checked)}
              className="w-4 h-4 rounded border-border/60 bg-muted/40 text-primary focus:ring-primary/30"
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
                className="w-full px-3 py-2.5 bg-muted/40 border border-border/60 rounded-lg text-[15px] font-mono text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none transition-all"
              />
              <div className="absolute top-2 right-2 flex gap-1">
                <button
                  type="button"
                  onClick={() => handleCopy(field.id, value)}
                  className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
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
                  className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                  title={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>
        );

      case 'credential':
        const requiredType = field.credentialType;
        let typeId: number | undefined;
        
        if (requiredType) {
          const typeDef = credentialTypes.find(t => t.service_identifier === requiredType);
          if (typeDef) {
             typeId = typeDef.id;
          }
        }

        return (
          <CredentialPicker
            value={value as string}
            onChange={(credId) => handleFieldChange(field.id, credId)}
            credentialType={field.credentialType}
            credentialTypeId={typeId}
            placeholder={field.placeholder || 'Select a credential...'}
            required={field.required}
            onCreate={() => {
              setEditingCredential(null);
              setShowCredentialModal(true);
            }}
            onEdit={(cred) => {
              setEditingCredential(cred);
              setShowCredentialModal(true);
            }}
          />
        );

      case 'skills': {
        const selectedIds: string[] = Array.isArray(value) ? (value as string[]) : [];
        const allResults = [...skillSearchResults.mine, ...skillSearchResults.public];

        const toggleSkill = (id: string) => {
          if (selectedIds.includes(id)) {
            handleFieldChange(field.id, selectedIds.filter(i => i !== id));
          } else {
            handleFieldChange(field.id, [...selectedIds, id]);
            setSkillSearchQuery('');
          }
        };

        return (
          <div className="space-y-2">
            {/* Selected skills as chips */}
            {selectedIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedIds.map(id => {
                  const skill = allResults.find(s => s.id === id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-md text-[11px] font-bold"
                    >
                      <Zap className="w-3 h-3" />
                      {skill?.title || `Skill ${id}`}
                      <button
                        type="button"
                        onClick={() => toggleSkill(id)}
                        className="p-0.5 rounded hover:bg-destructive/20 hover:text-destructive transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Search input */}
            <div className="relative">
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 transition-colors ${isSearchingSkills ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
                <input
                  type="text"
                  placeholder="Search skills..."
                  value={skillSearchQuery}
                  onFocus={() => setSkillsDropdownOpen(true)}
                  onChange={(e) => setSkillSearchQuery(e.target.value)}
                  className="w-full h-9 pl-9 pr-10 bg-muted/40 border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setSkillsDropdownOpen(!skillsDropdownOpen)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded text-muted-foreground transition-colors"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${skillsDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Dropdown */}
              {skillsDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSkillsDropdownOpen(false)} />
                  <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-xl max-h-56 overflow-y-auto p-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* My Skills */}
                    <div className="space-y-0.5 mb-2">
                      <div className="flex items-center gap-2 px-2 py-1">
                        <span className="text-[10px] font-bold text-muted-foreground ">My skills</span>
                        <div className="h-px flex-1 bg-border/50" />
                      </div>
                      {skillSearchResults.mine.length > 0 ? (
                        skillSearchResults.mine.map(skill => (
                          <button
                            key={`mine-${skill.id}`}
                            type="button"
                            onClick={() => toggleSkill(skill.id)}
                            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left transition-all text-sm ${
                              selectedIds.includes(skill.id)
                                ? 'bg-primary text-primary-foreground font-semibold'
                                : 'hover:bg-muted/50 text-foreground'
                            }`}
                          >
                            <Zap className={`w-3 h-3 flex-shrink-0 ${selectedIds.includes(skill.id) ? 'text-primary-foreground' : 'text-primary'}`} />
                            <span className="truncate">{skill.title}</span>
                            {selectedIds.includes(skill.id) && <X className="w-3 h-3 ml-auto flex-shrink-0" />}
                          </button>
                        ))
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic px-2.5 py-1.5">No personal skills found.</p>
                      )}
                    </div>

                    {/* Public Library */}
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 px-2 py-1">
                        <span className="text-[10px] font-bold text-muted-foreground ">Public library</span>
                        <div className="h-px flex-1 bg-border/50" />
                      </div>
                      {skillSearchResults.public.length > 0 ? (
                        skillSearchResults.public.map(skill => (
                          <button
                            key={`public-${skill.id}`}
                            type="button"
                            onClick={() => toggleSkill(skill.id)}
                            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left transition-all text-sm ${
                              selectedIds.includes(skill.id)
                                ? 'bg-primary text-primary-foreground font-semibold'
                                : 'hover:bg-muted/50 text-foreground'
                            }`}
                          >
                            <Zap className={`w-3 h-3 flex-shrink-0 ${selectedIds.includes(skill.id) ? 'text-primary-foreground' : 'text-primary'}`} />
                            <span className="truncate">{skill.title}</span>
                            {selectedIds.includes(skill.id) && <X className="w-3 h-3 ml-auto flex-shrink-0" />}
                          </button>
                        ))
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic px-2.5 py-1.5">No public skills found.</p>
                      )}
                    </div>

                    {isSearchingSkills && (
                      <div className="flex justify-center py-2">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      }

      default:
        return (
          <input
            type="text"
            value={value as string}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className="w-full px-3 py-2.5 bg-muted/40 border border-border/60 rounded-lg text-[15px] text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          />
        );
    }
  };

  const isDynamicNode = DYNAMIC_NODE_TYPES.includes(nodeType) || node?.data?.isBuilderNode;

  const handleAddCustomField = () => {
    if (!newParamName.trim()) {
      toast.error('Parameter name cannot be empty');
      return;
    }
    // Slugify: lowercase, replace spaces/special chars with underscores
    const slug = newParamName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
    const fieldId = `custom_${slug}`;
    
    // Check for collision
    if (formValues[fieldId] !== undefined) {
      toast.error(`Parameter "${slug}" already exists`);
      return;
    }
    
    // Set default value based on type
    const defaultVal = newParamType === 'number' ? 0 : newParamType === 'boolean' ? false : newParamType === 'json' ? '{}' : '';
    setFormValues(prev => ({ ...prev, [fieldId]: defaultVal }));

    // Persist field definition to node.data so it survives panel close/reopen
    if (node) {
      const existingDefs: Array<{ id: string; label: string; type: string }> = node.data?.customFieldDefs || [];
      const newDef = { id: fieldId, label: newParamName.trim(), type: newParamType };
      onUpdateNode(node.id, {
        ...node.data,
        customFieldDefs: [...existingDefs, newDef],
      });
    }

    setNewParamName('');
    setNewParamType('text');
    setShowAddParam(false);
  };

  const handleRemoveCustomField = (fieldId: string) => {
    setFormValues(prev => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });

    // Also remove from persisted customFieldDefs
    if (node) {
      const existingDefs: Array<{ id: string; label: string; type: string }> = node.data?.customFieldDefs || [];
      onUpdateNode(node.id, {
        ...node.data,
        customFieldDefs: existingDefs.filter(d => d.id !== fieldId),
      });
    }
  };

  const handleAddHandle = (type: 'inputs' | 'outputs') => {
    if (!node) return;
    const nodeType = node.data?.nodeType || node.type || '';
    // If data doesn't have handles yet, seed from nodeConfigs defaults
    let currentHandles = (node.data[type] || []) as NodeHandle[];
    if (currentHandles.length === 0) {
      const configHandles = nodeConfigs[nodeType]?.[type];
      if (configHandles) {
        currentHandles = configHandles.map((h: any) => 
          typeof h === 'string' ? { id: h, label: '' } : { id: h.id, label: h.label || '' }
        );
      }
    }
    const newHandleId = `${type === 'inputs' ? 'input' : 'output'}-${currentHandles.length}`;
    
    const updatedHandles = [...currentHandles, { id: newHandleId, label: '' }];
    onUpdateNode(node.id, {
      ...node.data,
      [type]: updatedHandles
    });
  };

  const handleRemoveHandle = (type: 'inputs' | 'outputs', handleId: string) => {
    if (!node) return;
    const currentHandles = (node.data[type] || []) as NodeHandle[];
    const updatedHandles = currentHandles.filter(h => h.id !== handleId);
    
    onUpdateNode(node.id, {
      ...node.data,
      [type]: updatedHandles
    });
  };

  const handleUpdateHandleLabel = (type: 'inputs' | 'outputs', handleId: string, label: string) => {
    if (!node) return;
    const currentHandles = (node.data[type] || []) as NodeHandle[];
    const updatedHandles = currentHandles.map(h => 
      h.id === handleId ? { ...h, label } : h
    );
    
    onUpdateNode(node.id, {
      ...node.data,
      [type]: updatedHandles
    });
  };

  const handleStopTest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsExecuting(false);
      setExecutionResult([{ json: { message: 'Execution stopped by user' } }]);
      setActiveTab('output');
    }
  }, []);

  const handleTestStep = useCallback(async () => {
    if (!node) return;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const inputItems = normalizeToItems(node.data.inputData);
      const inputJson = inputItems.length > 0 ? inputItems[0].json : {};
      
      const result = await orchestratorService.executePartial(
        workflowId || null,
        node.id,
        node.data.nodeType,
        inputJson,
        { ...formValues, customFieldDefs: node.data?.customFieldDefs || [] },
        signal
      );
      
      if (!signal.aborted && isMountedRef.current) {
        const formattedResult = normalizeToItems(result);
        
        setExecutionResult(formattedResult);
        
        onUpdateNode(node.id, {
          ...node.data,
          outputData: formattedResult
        });
        
        setActiveTab('output');
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || signal.aborted) {
        return;
      }
      
      if (isMountedRef.current) {
        console.error("Test step failed", error);
        const errorMsg = error.message || 'Execution failed';
        setExecutionResult([{ json: { error: errorMsg } }]);
        toast.error(`Test step failed: ${errorMsg}`);
        setActiveTab('output');
      }
    } finally {
      if (isMountedRef.current && !signal.aborted) {
        setIsExecuting(false);
      }
    }
  }, [node, workflowId, formValues, onUpdateNode]);

  // Close on Escape key
  // Auto-focus the first input/textarea in the settings tab when panel opens
  useEffect(() => {
    if (isOpen && activeTab === 'settings' && settingsContentRef.current) {
      const timer = setTimeout(() => {
        const firstInput = settingsContentRef.current?.querySelector<HTMLElement>(
          'input:not([type="hidden"]):not([type="checkbox"]), textarea, [role="listbox"]'
        );
        firstInput?.focus();
      }, 100); // small delay for animation
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeTab]);

  // Close on Escape key — only when event hasn't been handled by a child
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      // If the event was already stopped by a child (ExpressionEditor, Select, etc.), skip
      if (e.defaultPrevented) return;
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !node) return null;

  const nodeColor = node.data?.color || '#7b68ee';

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
 
      {/* Full-Page Panel — stopPropagation prevents ReactFlow from capturing Delete/Backspace */}
      <div
        className="absolute inset-0 z-50 flex items-stretch animate-in slide-in-from-bottom-4 fade-in duration-300"
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="w-full flex bg-background shadow-2xl overflow-hidden">
          {/* ============ LEFT COLUMN: Data Mapping ============ */}
          <div className="w-[480px] shrink-0 border-r border-border/60 flex flex-col bg-muted/20">
            <DataMappingPanel
              currentNode={node}
              nodes={nodes}
              edges={edges}
              lastExecutionData={lastExecutionData}
            />
          </div>

          {/* ============ RIGHT COLUMN: Node Configuration ============ */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <div className="p-4 border-b border-border/60 bg-background/80 backdrop-blur-md">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={onClose}
                    className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                    title="Back to canvas"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm"
                    style={{ backgroundColor: `${nodeColor}20`, color: nodeColor }}
                  >
                    {node.data?.icon || '📦'}
                  </div>
                  <div>
                    <h3 className="font-bold text-xl text-foreground">{node.data?.label || 'Node'}</h3>
                    <p className="text-[10px] text-muted-foreground  font-bold">
                      {nodeType.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
                  <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Tabs */}
              <div className="flex gap-1 bg-muted/40 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === 'settings'
                      ? 'bg-muted shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  Parameters
                </button>
                <button
                  onClick={() => setActiveTab('input')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === 'input'
                      ? 'bg-muted shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  Input
                </button>
                <button
                  onClick={() => setActiveTab('output')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === 'output'
                      ? 'bg-muted shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  Output
                </button>
              </div>
            </div>

            {/* Content */}
            <div ref={settingsContentRef} className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-background/20">
              <div className="max-w-5xl mx-auto">
                {activeTab === 'settings' && nodeConfig && (
                  <div className="space-y-6">
                    {nodeConfig.fields.map((field) => (
                      <div key={field.id} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground/80">
                            {field.label}
                            {field.required && <span className="text-destructive">*</span>}
                          </label>
                          {field.description && field.type !== 'checkbox' && (
                            <span title={field.description} className="cursor-help text-muted-foreground/60 hover:text-foreground transition-colors">
                              <Info className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                        {renderField(field)}
                      </div>
                    ))}

                    {nodeConfig.fields.length === 0 && !isDynamicNode && (
                      <div className="text-center py-16 text-muted-foreground">
                        <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                          <Settings className="w-7 h-7 opacity-30" />
                        </div>
                        <p className="text-sm font-medium">No configuration required</p>
                        <p className="text-xs mt-1 text-muted-foreground/60">This node works with default settings</p>
                      </div>
                    )}

                    {/* Dynamic Schema Editors */}
                    {isDynamicNode && (
                      <div className="space-y-6 pt-6 border-t border-border/60 mt-8">
                        {/* Custom Parameters */}
                        <div className="space-y-5 pt-6 border-t border-border/60">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-foreground flex items-center gap-2.5">
                              <Key className="w-4 h-4 text-primary" />
                              Custom Parameters
                            </h4>
                            <button
                              onClick={() => setShowAddParam(!showAddParam)}
                              className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-all shadow-md shadow-primary/10"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add Parameter
                            </button>
                          </div>

                          {/* Add new parameter form */}
                          {showAddParam && (
                            <div className="p-4 bg-muted/40 border border-border/80 rounded-2xl animate-in fade-in zoom-in-95 duration-200 shadow-inner">
                              <div className="flex flex-col gap-4">
                                <div className="space-y-1.5">
                                  <label className="text-[11px] font-bold  text-muted-foreground ml-1">Parameter name</label>
                                  <input
                                    type="text"
                                    value={newParamName}
                                    onChange={(e) => setNewParamName(e.target.value)}
                                    placeholder="e.g. max_history_tokens"
                                    className="w-full px-4 py-2.5 bg-background border border-border/60 rounded-xl text-[15px] focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleAddCustomField();
                                      if (e.key === 'Escape') setShowAddParam(false);
                                    }}
                                    autoFocus
                                  />
                                </div>
                                <div className="flex gap-3">
                                  <div className="flex-1 space-y-1.5">
                                    <label className="text-[11px] font-bold  text-muted-foreground ml-1">Type</label>
                                    <select
                                      value={newParamType}
                                      onChange={(e) => setNewParamType(e.target.value as 'text' | 'number' | 'boolean' | 'json')}
                                      className="w-full px-3 py-2.5 bg-background border border-border/60 rounded-xl text-sm text-foreground focus:ring-2 focus:ring-primary/30 outline-none cursor-pointer"
                                    >
                                      <option value="text">Text</option>
                                      <option value="number">Number</option>
                                      <option value="boolean">Boolean</option>
                                      <option value="json">JSON</option>
                                    </select>
                                  </div>
                                  <div className="flex items-end gap-2">
                                    <button
                                      onClick={handleAddCustomField}
                                      className="h-[42px] px-6 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 transition-all"
                                    >
                                      Add
                                    </button>
                                    <button
                                      onClick={() => { setShowAddParam(false); setNewParamName(''); }}
                                      className="h-[42px] px-4 bg-muted text-muted-foreground rounded-xl text-sm font-semibold hover:bg-muted/80 transition-all"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 gap-3">
                            {Object.entries(formValues)
                              .filter(([key]) => key.startsWith('custom_') && !nodeConfig.fields.some(f => f.id === key))
                              .map(([key, val]) => {
                                const fieldDef = (node?.data?.customFieldDefs || []).find((d: { id: string }) => d.id === key);
                                const displayName = fieldDef?.label || key.replace(/^custom_/, '').replace(/_/g, ' ');
                                const typeMap: Record<string, string> = { text: 'Text', number: 'Num', boolean: 'Bool', json: 'JSON' };
                                const typeLabel = fieldDef ? (typeMap[fieldDef.type] || 'Text') : (typeof val === 'number' ? 'Num' : typeof val === 'boolean' ? 'Bool' : typeof val === 'object' ? 'JSON' : 'Text');
                                return (
                                  <div key={key} className="p-4 bg-muted/20 border border-border/40 rounded-2xl group hover:border-primary/20 transition-all hover:bg-muted/30">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-3">
                                        <h5 className="text-sm font-bold text-foreground/90 capitalize truncate max-w-[200px]" title={key}>
                                          {displayName}
                                        </h5>
                                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full tracking-tighter">
                                          {typeLabel}
                                        </span>
                                      </div>
                                      <button
                                        onClick={() => handleRemoveCustomField(key)}
                                        className="p-1 px-3 text-[11px] font-bold text-muted-foreground hover:text-red-500 hover:bg-red-500/5 rounded-full transition-all"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                    <ExpressionEditor
                                      value={String(val ?? '')}
                                      onChange={(v) => {
                                        let finalVal: any = v;
                                        const vType = typeof val;
                                        if (vType === 'number') {
                                          const n = parseFloat(v);
                                          if (!isNaN(n)) finalVal = n;
                                        } else if (vType === 'boolean') {
                                          finalVal = v.toLowerCase() === 'true';
                                        }
                                        handleFieldChange(key, finalVal);
                                      }}
                                      availableNodes={availableNodes}
                                      placeholder="Enter value or {{...}}"
                                      className="w-full"
                                    />
                                  </div>
                                );
                              })}
                          </div>
                        </div>

                        {/* IO Handles */}
                        <div className="grid grid-cols-2 gap-8 pt-8 border-t border-border/40 mt-6">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                              <h4 className="text-sm font-bold text-foreground flex items-center gap-2.5">
                                <Plus className="w-4 h-4 text-emerald-500" />
                                Inputs
                              </h4>
                              <button
                                onClick={() => handleAddHandle('inputs')}
                                className="w-8 h-8 flex items-center justify-center bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded-full transition-all"
                                title="Add Input"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="space-y-3">
                              {((node.data.inputs || []) as NodeHandle[]).map((handle) => (
                                <div key={handle.id} className="flex items-center gap-2 group animate-in slide-in-from-left-2 duration-200">
                                  <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-muted/40 border border-border/60 rounded-xl hover:bg-muted/60 transition-all">
                                    <input
                                      type="text"
                                      value={handle.label || ''}
                                      onChange={(e) => handleUpdateHandleLabel('inputs', handle.id, e.target.value)}
                                      placeholder="label..."
                                      className="flex-1 bg-transparent text-[13px] font-medium text-foreground outline-none"
                                    />
                                    <button
                                      onClick={() => handleRemoveHandle('inputs', handle.id)}
                                      className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {(node.data.inputs || []).length === 0 && (
                                <p className="text-xs text-muted-foreground/50 italic py-2 ml-1">No custom inputs</p>
                              )}
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                              <h4 className="text-sm font-bold text-foreground flex items-center gap-2.5">
                                <Plus className="w-4 h-4 text-amber-500" />
                                Outputs
                              </h4>
                              <button
                                onClick={() => handleAddHandle('outputs')}
                                className="w-8 h-8 flex items-center justify-center bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 rounded-full transition-all"
                                title="Add Output"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="space-y-3">
                              {((node.data.outputs || []) as NodeHandle[]).map((handle) => (
                                <div key={handle.id} className="flex items-center gap-2 group animate-in slide-in-from-right-2 duration-200">
                                  <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-muted/40 border border-border/60 rounded-xl hover:bg-muted/60 transition-all">
                                    <input
                                      type="text"
                                      value={handle.label || ''}
                                      onChange={(e) => handleUpdateHandleLabel('outputs', handle.id, e.target.value)}
                                      placeholder="label..."
                                      className="flex-1 bg-transparent text-[13px] font-medium text-foreground outline-none"
                                    />
                                    <button
                                      onClick={() => handleRemoveHandle('outputs', handle.id)}
                                      className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {(node.data.outputs || []).length === 0 && (
                                <p className="text-xs text-muted-foreground/50 italic py-2 ml-1">No custom outputs</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'settings' && !nodeConfig && (
                  <div className="text-center py-16 text-muted-foreground">
                    <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                      <Info className="w-7 h-7 opacity-30" />
                    </div>
                    <p className="text-sm font-medium">Configuration not available</p>
                    <p className="text-xs mt-1 text-muted-foreground/60">Node type: <span className="font-mono text-foreground">{nodeType || 'unknown'}</span></p>
                  </div>
                )}

                {(activeTab === 'input' || activeTab === 'output') && (
                  <div className="h-full min-h-[400px]">
                    <DataViewer 
                      inputData={node.data.inputData || [{ json: { message: 'No input data yet' } }]}
                      outputData={node.data.outputData || executionResult}
                      activeTab={activeTab as 'input' | 'output'}
                      onTabChange={(tab) => setActiveTab(tab)}
                      hideTabs={true}
                      nodeName={node.data.label}
                      onPinData={(data) => {
                        onUpdateNode(node.id, { ...node.data, inputData: data });
                      }}
                      isPinned={!!node.data.inputData}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-border/60 bg-background/80 backdrop-blur-md flex gap-3">
              {isExecuting ? (
                <button
                  onClick={handleStopTest}
                  className="flex-1 max-w-xs flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20 active:scale-95 animate-pulse transition-all"
                >
                  <div className="w-3 h-3 bg-white rounded-sm" />
                  Stop Execution
                </button>
              ) : (
                <button
                  onClick={handleTestStep}
                  className="flex-1 max-w-xs flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-muted text-foreground hover:bg-muted/80 shadow-sm active:scale-95 transition-all border border-border/40"
                >
                  <Play className="w-4 h-4" />
                  Test Step
                </button>
              )}
              {activeTab === 'settings' && nodeConfig && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowSaveModal(true)}
                    className="w-12 h-12 flex items-center justify-center bg-muted text-muted-foreground rounded-xl hover:bg-muted/80 transition-all border border-border/40"
                    title="Save as Custom Node"
                  >
                    <Save className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleForceSave}
                    className="px-10 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold tracking-tight hover:opacity-90 shadow-lg shadow-primary/20 transition-all active:scale-95"
                  >
                    DONE
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
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
          setShowSaveModal(false);
        }}
      />
      
      {showCredentialModal && (
        <CredentialModal
          isOpen={showCredentialModal}
          onClose={() => setShowCredentialModal(false)}
          initialData={editingCredential}
          credentialTypes={credentialTypes}
          onSave={() => {
            // Credentials list is not maintained locally anymore
          }}
        />
      )}
    </>
  );
}
