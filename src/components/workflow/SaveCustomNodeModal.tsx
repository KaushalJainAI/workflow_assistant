import { useState, useEffect } from 'react';
import { X, Check, Palette, Smile } from 'lucide-react';
import { getCustomCategories, saveCustomNode, type CustomNodeMetadata } from '../../lib/customNodes';

interface SaveCustomNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseNode: {
    id: string;
    type: string;
    config: Record<string, unknown>;
  };
  onSave: (node: CustomNodeMetadata) => void;
}

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

export default function SaveCustomNodeModal({ isOpen, onClose, baseNode, onSave }: SaveCustomNodeModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [selectedColor, setSelectedColor] = useState(COLORS[1]);
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);

  useEffect(() => {
    if (isOpen) {
      setCategories(getCustomCategories());
      setName('');
      setDescription('');
      setSelectedCategory('');
      setNewCategory('');
      setIsCreatingCategory(false);
      setSelectedColor(COLORS[1]);
      setSelectedIcon(ICONS[0]);
    }
  }, [isOpen]);

  const handleSave = () => {
    if (!name.trim()) return;
    
    const finalCategory = isCreatingCategory ? newCategory.trim() : selectedCategory;
    if (!finalCategory) return;

    const newNode = saveCustomNode({
      baseNodeTypeId: baseNode.type,
      name: name.trim(),
      description: description.trim(),
      category: finalCategory,
      icon: selectedIcon,
      color: selectedColor,
      config: baseNode.config,
    });

    onSave(newNode);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col scale-100 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold">Save as Custom Node</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Node Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Slack Alert - Dev Channel"
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this node do?"
              rows={2}
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Category (App) <span className="text-red-500">*</span></label>
            {!isCreatingCategory ? (
              <div className="flex gap-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    if (e.target.value === 'NEW') {
                      setIsCreatingCategory(true);
                      setNewCategory('');
                    } else {
                      setSelectedCategory(e.target.value);
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="" disabled>Select a category...</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="NEW">+ Create New App...</option>
                </select>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="App Name (e.g. My Tools)"
                  className="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={() => setIsCreatingCategory(false)}
                  className="px-3 py-2 bg-muted hover:bg-muted/80 rounded-md text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Palette className="w-4 h-4" /> Color
              </label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${selectedColor === color ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="w-6 h-6 p-0 border-0 rounded-full overflow-hidden cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Smile className="w-4 h-4" /> Icon
              </label>
              <div className="flex flex-wrap gap-2 h-[120px] overflow-y-auto custom-scrollbar p-1 border border-input rounded-md">
                 {ICONS.map(icon => (
                   <button
                     key={icon}
                     onClick={() => setSelectedIcon(icon)}
                     className={`w-8 h-8 flex items-center justify-center rounded hover:bg-muted transition-colors ${selectedIcon === icon ? 'bg-muted ring-1 ring-ring' : ''}`}
                   >
                     {icon}
                   </button>
                 ))}
                 <input 
                    type="text" 
                    maxLength={2} 
                    className="w-8 h-8 text-center border border-input rounded text-sm" 
                    placeholder="+"
                    onChange={(e) => e.target.value && setSelectedIcon(e.target.value)}
                 />
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2 bg-muted/20">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || (!selectedCategory && !newCategory.trim())}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Save Node
          </button>
        </div>
      </div>
    </div>
  );
}
