import { useState, useRef, useEffect, useMemo } from 'react';
import { Code2, Type, Variable, Zap } from 'lucide-react';

interface ExpressionEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
}

// Autocomplete suggestions
const SUGGESTIONS = [
  { label: '$json', description: 'Output data from previous node', icon: '📦' },
  { label: '$node', description: 'Access specific node data', icon: '🔗' },
  { label: '$input', description: 'Current input data', icon: '📥' },
  { label: '$env', description: 'Environment variables', icon: '🌐' },
  { label: '$now', description: 'Current timestamp', icon: '⏰' },
  { label: '$today', description: 'Today\'s date', icon: '📅' },
  { label: '$execution', description: 'Execution metadata', icon: '▶️' },
  { label: '$workflow', description: 'Workflow info', icon: '📊' },
];

export default function ExpressionEditor({
  value,
  onChange,
  placeholder = 'Enter value...',
  multiline = false,
  rows = 3,
  className = '',
}: ExpressionEditorProps) {
  const [isExpressionMode, setIsExpressionMode] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Check if value contains expressions
  const containsExpression = value.includes('{{') || value.includes('$');

  // Detect expression mode from content
  useEffect(() => {
    if (containsExpression && !isExpressionMode) {
      setIsExpressionMode(true);
    }
  }, [containsExpression, isExpressionMode]);

  // Handle input change
  const handleChange = (newValue: string) => {
    onChange(newValue);
    
    // Show suggestions when typing $
    if (newValue.slice(-1) === '$' || newValue.slice(-2) === '{{') {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: typeof SUGGESTIONS[0]) => {
    const input = inputRef.current;
    if (!input) return;

    const start = value.slice(0, cursorPosition);
    const end = value.slice(cursorPosition);
    
    // Replace the $ or {{ with the suggestion
    let newValue = value;
    if (start.endsWith('$')) {
      newValue = start.slice(0, -1) + suggestion.label + end;
    } else if (start.endsWith('{{')) {
      newValue = start + ' ' + suggestion.label + ' }}' + end;
    } else {
      newValue = start + suggestion.label + end;
    }
    
    onChange(newValue);
    setShowSuggestions(false);
    input.focus();
  };

  // Filter suggestions based on current input
  const filteredSuggestions = useMemo(() => {
    const lastDollar = value.lastIndexOf('$');
    if (lastDollar === -1) return SUGGESTIONS;
    
    const partial = value.slice(lastDollar).toLowerCase();
    return SUGGESTIONS.filter(s => s.label.toLowerCase().startsWith(partial));
  }, [value]);

  // Syntax highlight the expression
  const highlightedPreview = useMemo(() => {
    if (!isExpressionMode || !value) return null;
    
    let html = value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Apply syntax highlighting
    html = html.replace(/(\{\{)/g, '<span class="text-purple-500 font-bold">$1</span>');
    html = html.replace(/(\}\})/g, '<span class="text-purple-500 font-bold">$1</span>');
    html = html.replace(/(\$json)/g, '<span class="text-blue-500 font-medium">$1</span>');
    html = html.replace(/(\$node)/g, '<span class="text-green-500 font-medium">$1</span>');
    html = html.replace(/(\$input)/g, '<span class="text-orange-500 font-medium">$1</span>');
    html = html.replace(/(\$env)/g, '<span class="text-red-500 font-medium">$1</span>');
    html = html.replace(/(\$now|\$today|\$execution|\$workflow)/g, '<span class="text-pink-500 font-medium">$1</span>');
    
    return html;
  }, [value, isExpressionMode]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const baseInputClass = `
    w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] 
    rounded-lg text-sm transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]
    ${isExpressionMode ? 'font-mono text-xs' : ''}
    ${className}
  `;

  return (
    <div className="relative">
      {/* Mode Toggle */}
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setIsExpressionMode(!isExpressionMode)}
          className={`
            p-1.5 rounded transition-all text-xs flex items-center gap-1
            ${isExpressionMode 
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
              : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--border-primary)]'
            }
          `}
          title={isExpressionMode ? 'Switch to fixed value' : 'Switch to expression'}
        >
          {isExpressionMode ? (
            <>
              <Code2 className="w-3 h-3" />
              <span className="hidden sm:inline">Expression</span>
            </>
          ) : (
            <>
              <Type className="w-3 h-3" />
              <span className="hidden sm:inline">Fixed</span>
            </>
          )}
        </button>
      </div>

      {/* Input Field */}
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onSelect={(e) => setCursorPosition((e.target as HTMLTextAreaElement).selectionStart)}
          placeholder={isExpressionMode ? '{{ $json.field }}' : placeholder}
          rows={rows}
          className={`${baseInputClass} resize-none pr-24`}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onSelect={(e) => setCursorPosition((e.target as HTMLInputElement).selectionStart || 0)}
          placeholder={isExpressionMode ? '{{ $json.field }}' : placeholder}
          className={`${baseInputClass} pr-24`}
        />
      )}

      {/* Expression Preview */}
      {isExpressionMode && value && highlightedPreview && (
        <div className="mt-1 p-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded text-xs">
          <div className="flex items-center gap-1 text-[var(--text-secondary)] mb-1">
            <Zap className="w-3 h-3" />
            <span>Preview:</span>
          </div>
          <code 
            className="block font-mono text-[var(--text-primary)]"
            dangerouslySetInnerHTML={{ __html: highlightedPreview }}
          />
        </div>
      )}

      {/* Suggestions Dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg shadow-xl overflow-hidden"
        >
          <div className="p-1.5 border-b border-[var(--border-primary)] bg-[var(--bg-tertiary)]">
            <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
              <Variable className="w-3 h-3" />
              <span>Available variables</span>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredSuggestions.map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <span className="text-base">{suggestion.icon}</span>
                <div className="flex-1 min-w-0">
                  <code className="text-sm font-mono text-[var(--accent-primary)]">
                    {suggestion.label}
                  </code>
                  <p className="text-xs text-[var(--text-secondary)] truncate">
                    {suggestion.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Expression Mode Help */}
      {isExpressionMode && !value && (
        <div className="mt-1 text-xs text-[var(--text-secondary)] flex items-center gap-1">
          <Code2 className="w-3 h-3" />
          <span>Type <code className="text-purple-400">{'{{ }}'}</code> or <code className="text-blue-400">$</code> for variables</span>
        </div>
      )}
    </div>
  );
}
