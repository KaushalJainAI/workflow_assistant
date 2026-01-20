import { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2, Code, Database, Settings } from 'lucide-react';
import { saveCustomNode, getCustomCategories } from '../../lib/customNodes';
import { type ConfigField } from '../../lib/nodeConfigs';

interface NodeBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

type TabType = 'general' | 'schema' | 'code';
const FIELD_TYPES = ['text', 'number', 'textarea', 'select', 'checkbox', 'json', 'password', 'credential', 'code'];

const COLORS = [
  '#ff6d5a', // Red (Triggers)
  '#7b68ee', // Purple (Core)
  '#20b2aa', // Teal
  '#ffa500', // Orange
  '#9370db', // Violet
  '#10a37f', // Green (AI)
  '#ea4335', // Google Red
  '#4a154b', // Slack Purple
  '#0088cc', // Telegram Blue
  '#24292e', // GitHub Black
];

const ICONS = ['📦', '🔧', '🤖', '⚡', '📝', '🔗', '📅', '🔍', '📧', '💬', '📊', '🌐', '📁', '☁️', '🛒', '💳', '👤', '🔐', '🛠️', '⚙️', '📈', '🚀', '🔔', '📢'];

export default function NodeBuilderModal({ isOpen, onClose, onSave }: NodeBuilderModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🧩');
  const [color, setColor] = useState('#7b68ee');
  const [category, setCategory] = useState('Custom');
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  const [fields, setFields] = useState<ConfigField[]>([]);
  const [code, setCode] = useState<string>(`class CustomNode:\n    def execute(self, inputs, config):\n        # Your logic here\n        return {"data": "Hello World"}`);

  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setCategories(getCustomCategories());
      // Reset state
      setName('');
      setDescription('');
      setIcon('🧩');
      setColor('#7b68ee');
      setCategory('Custom');
      setFields([]);
      setCode(`class CustomNode:\n    def execute(self, inputs, config):\n        # Your logic here\n        return {"data": "Hello World"}`);
      setActiveTab('general');
    }
  }, [isOpen]);

  const handleAddField = () => {
    setFields([
      ...fields,
      {
        id: `field_${Date.now()}`,
        label: 'New Field',
        type: 'text',
        required: false,
        placeholder: '',
        description: '',
      }
    ]);
  };

  const handleUpdateField = (index: number, updates: Partial<ConfigField>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    setFields(newFields);
  };

  const handleRemoveField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!name.trim()) return;

    const finalCategory = isNewCategory ? newCategoryName : category;
    
    saveCustomNode({
      baseNodeTypeId: 'custom_builder', // Special ID for builder nodes
      name,
      description,
      category: finalCategory,
      icon,
      color,
      config: {}, // No default config for type definition
      fields, // The Schema
      code,   // The Logic
      isBuilderNode: true,
    });

    onSave();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-2xl bg-primary/10 text-primary">
              {icon}
            </div>
            <div>
              <h2 className="text-xl font-bold">Node Builder</h2>
              <p className="text-sm text-muted-foreground">Define a new node type from scratch</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-muted/10">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'general' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Settings className="w-4 h-4" /> General
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'schema' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Database className="w-4 h-4" /> Inputs (Schema)
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'code' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Code className="w-4 h-4" /> Execution Logic
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-background custom-scrollbar">
          
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="max-w-xl mx-auto space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Node Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My Service Node"
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                   <div className="space-y-2">
                     <label className="text-sm font-medium">Icon (Emoji) <span className="text-red-500">*</span></label>
                     <div className="flex flex-wrap gap-2 h-[120px] overflow-y-auto custom-scrollbar p-2 border border-input rounded-md bg-background">
                        {ICONS.map(i => (
                          <button
                            key={i}
                            onClick={() => setIcon(i)}
                            className={`w-8 h-8 flex items-center justify-center rounded hover:bg-muted transition-colors text-lg ${icon === i ? 'bg-muted ring-1 ring-ring' : ''}`}
                          >
                            {i}
                          </button>
                        ))}
                        <input 
                           type="text" 
                           maxLength={2} 
                           className="w-8 h-8 text-center border border-input rounded text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-ring" 
                           placeholder="+"
                           onChange={(e) => e.target.value && setIcon(e.target.value)}
                        />
                     </div>
                  </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this node do?"
                  rows={3}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  {!isNewCategory ? (
                    <select
                      value={category}
                      onChange={(e) => {
                        if (e.target.value === 'NEW') setIsNewCategory(true);
                        else setCategory(e.target.value);
                      }}
                      className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="Custom">Custom</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      <option value="NEW">+ Create New...</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="New Category Name"
                        className="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button onClick={() => setIsNewCategory(false)} className="px-3 py-2 bg-muted rounded-md text-sm">Cancel</button>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                   <label className="text-sm font-medium">Color</label>
                   <div className="space-y-2">
                     <div className="flex flex-wrap gap-2">
                        {COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => setColor(c)}
                            className={`w-6 h-6 rounded-full border-2 transition-all ${color === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                     </div>
                     <div className="flex gap-2">
                       <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="h-9 w-9 p-0 border-0 rounded-md cursor-pointer"
                       />
                       <input
                        type="text"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring uppercase"
                       />
                     </div>
                   </div>
                </div>
              </div>
            </div>
          )}

          {/* Schema Tab */}
          {activeTab === 'schema' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Input Fields</h3>
                <button
                  onClick={handleAddField}
                  className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
                >
                  <Plus className="w-4 h-4" /> Add Field
                </button>
              </div>

              {fields.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-border rounded-lg text-muted-foreground">
                  No input fields defined. Click "Add Field" to start.
                </div>
              ) : (
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div key={index} className="flex gap-4 p-4 border border-border rounded-lg bg-card hover:border-primary/50 transition-colors group">
                      <div className="flex-1 grid grid-cols-12 gap-4">
                        <div className="col-span-3 space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">ID (Key)</label>
                          <input
                            type="text"
                            value={field.id}
                            onChange={(e) => handleUpdateField(index, { id: e.target.value })}
                            className="w-full px-2 py-1.5 bg-background border border-input rounded text-sm"
                            placeholder="api_key"
                          />
                        </div>
                        <div className="col-span-4 space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Label</label>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => handleUpdateField(index, { label: e.target.value })}
                            className="w-full px-2 py-1.5 bg-background border border-input rounded text-sm"
                            placeholder="API Key"
                          />
                        </div>
                        <div className="col-span-3 space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Type</label>
                          <select
                            value={field.type}
                            onChange={(e) => handleUpdateField(index, { type: e.target.value as any })}
                            className="w-full px-2 py-1.5 bg-background border border-input rounded text-sm"
                          >
                            {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div className="col-span-2 flex items-center pt-5">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => handleUpdateField(index, { required: e.target.checked })}
                              className="rounded border-input text-primary focus:ring-primary"
                            />
                            <span className="text-sm">Req.</span>
                          </label>
                        </div>
                        
                        {/* More options row */}
                        <div className="col-span-12 pt-2 border-t border-border mt-2">
                           <input
                            type="text"
                            value={field.placeholder || ''}
                            onChange={(e) => handleUpdateField(index, { placeholder: e.target.value })}
                            className="w-full px-2 py-1 bg-transparent border-none text-xs text-muted-foreground focus:text-foreground placeholder:text-muted-foreground/50"
                            placeholder="Optional placeholder text..."
                           />
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => handleRemoveField(index)}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded self-start mt-4"
                        title="Remove Field"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Code Tab */}
          {activeTab === 'code' && (
            <div className="h-full flex flex-col">
              <h3 className="text-lg font-semibold mb-2">Backend Logic</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Define the Python class that handles execution. This will be sent to the backend.
              </p>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="flex-1 w-full bg-[#1e1e1e] text-[#d4d4d4] font-mono p-4 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary text-sm leading-relaxed"
                spellCheck={false}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-6 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-md hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            Create Node Type
          </button>
        </div>
      </div>
    </div>
  );
}
