import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Command, ArrowRight, Plus, Play, Save, Settings, Workflow, Zap, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';

// Node definitions for search
const nodeTypes = [
  { id: 'manual_trigger', name: 'Manual Trigger', category: 'Triggers', icon: '🖱️' },
  { id: 'webhook', name: 'Webhook', category: 'Triggers', icon: '🔗' },
  { id: 'schedule', name: 'Schedule Trigger', category: 'Triggers', icon: '⏰' },
  { id: 'http_request', name: 'HTTP Request', category: 'Core', icon: '🌐' },
  { id: 'code', name: 'Code', category: 'Core', icon: '💻' },
  { id: 'set', name: 'Set', category: 'Core', icon: '📝' },
  { id: 'if', name: 'IF', category: 'Logic', icon: '🔀' },
  { id: 'switch', name: 'Switch', category: 'Logic', icon: '🎚️' },
  { id: 'merge', name: 'Merge', category: 'Logic', icon: '🔄' },
  { id: 'openai', name: 'OpenAI', category: 'AI', icon: '🤖' },
  { id: 'gmail', name: 'Gmail', category: 'Apps', icon: '📧' },
  { id: 'slack', name: 'Slack', category: 'Apps', icon: '💬' },
  { id: 'sheets', name: 'Google Sheets', category: 'Apps', icon: '📊' },
];

const actions = [
  { id: 'save', name: 'Save Workflow', shortcut: 'Ctrl+S', icon: Save },
  { id: 'execute', name: 'Execute Workflow', shortcut: 'Ctrl+Enter', icon: Play },
  { id: 'settings', name: 'Open Settings', shortcut: 'Ctrl+,', icon: Settings },
  { id: 'new', name: 'New Workflow', shortcut: 'Ctrl+N', icon: Plus },
];

const navigation = [
  { id: 'workflows', name: 'Go to Workflows', path: '/workflows', icon: Workflow },
  { id: 'executions', name: 'Go to Executions', path: '/executions', icon: Zap },
  { id: 'orchestrator', name: 'Go to Orchestrator', path: '/orchestrator', icon: Command },
];

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onAddNode?: (nodeType: string) => void;
  onAction?: (actionId: string) => void;
}

export default function CommandPalette({ isOpen, onClose, onAddNode, onAction }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Filter results based on query
  const results = useMemo(() => {
    const lowerQuery = query.toLowerCase();
    
    const filteredNodes = nodeTypes.filter(
      (n) => n.name.toLowerCase().includes(lowerQuery) || n.category.toLowerCase().includes(lowerQuery)
    );
    
    const filteredActions = actions.filter(
      (a) => a.name.toLowerCase().includes(lowerQuery)
    );
    
    const filteredNav = navigation.filter(
      (n) => n.name.toLowerCase().includes(lowerQuery)
    );

    return [
      ...filteredActions.map((a) => ({ type: 'action' as const, ...a })),
      ...filteredNav.map((n) => ({ type: 'nav' as const, ...n })),
      ...filteredNodes.map((n) => ({ type: 'node' as const, ...n })),
    ];
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          handleSelect(results[selectedIndex]);
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose]);

  const handleSelect = (item: typeof results[0]) => {
    if (!item) return;
    
    switch (item.type) {
      case 'node':
        onAddNode?.(item.id);
        break;
      case 'action':
        onAction?.(item.id);
        break;
      case 'nav':
        navigate(item.path);
        break;
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-xl bg-card border rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b">
          <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search nodes, actions, or navigate..."
            className="flex-1 bg-transparent border-0 outline-none text-lg placeholder:text-muted-foreground"
          />
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <kbd className="px-1.5 py-0.5 bg-muted rounded">Esc</kbd>
            <span>to close</span>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {results.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p>No results found</p>
            </div>
          ) : (
            <div className="py-2">
              {results.map((item, index) => (
                <button
                  key={`${item.type}-${item.id}`}
                  onClick={() => handleSelect(item)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                    index === selectedIndex ? "bg-accent" : "hover:bg-muted"
                  )}
                >
                  {item.type === 'node' ? (
                    <span className="text-xl w-8 text-center">{item.icon}</span>
                  ) : (
                    <item.icon className="w-5 h-5 text-muted-foreground" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{item.name}</div>
                    {item.type === 'node' && (
                      <div className="text-xs text-muted-foreground">{item.category}</div>
                    )}
                  </div>
                  {item.type === 'action' && 'shortcut' in item && (
                    <kbd className="text-xs px-2 py-1 bg-muted rounded">{item.shortcut}</kbd>
                  )}
                  {item.type === 'nav' && (
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  )}
                  {item.type === 'node' && (
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted rounded">↑</kbd>
              <kbd className="px-1 py-0.5 bg-muted rounded">↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted rounded">↵</kbd>
              to select
            </span>
          </div>
          <span>
            {results.length} result{results.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
