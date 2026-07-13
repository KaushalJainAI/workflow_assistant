import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Code2, Variable, Zap, X } from 'lucide-react';

interface ExpressionEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  availableNodes?: Array<{ id: string; label: string; color?: string }>;
}

// Fixed base suggestions
const BASE_SUGGESTIONS = [
  { label: '$json', description: 'Output data from previous node', icon: '📦' },
  { label: '$node', description: 'Access specific node data', icon: '🔗' },
  { label: '$vars', description: 'Workflow variables', icon: '📊' },
  { label: '$input', description: 'Current input data', icon: '📥' },
  { label: '$env', description: 'Environment variables', icon: '🌐' },
  { label: '$now', description: 'Current timestamp', icon: '⏰' },
];

/** Extract expression pill segments from a string for rendering */
function parseExpressionPills(text: string): Array<{ type: 'text' | 'pill'; content: string; expression?: string }> {
  const segments: Array<{ type: 'text' | 'pill'; content: string; expression?: string }> = [];
  const regex = /\{\{\s*(.*?)\s*\}\}/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Text before the expression
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    // The expression pill
    const expr = match[1];
    // Extract a short label from the expression
    const nodeMatch = expr.match(/\$node\[["'](.+?)["']\]\.json\.?(.*)/);
    let label = expr;
    if (nodeMatch) {
      const fieldPath = nodeMatch[2] || 'json';
      const parts = fieldPath.split('.');
      label = parts[parts.length - 1] || 'json';
    }
    segments.push({ type: 'pill', content: label, expression: match[0] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return segments;
}

/** Get a color for an expression based on the node name */
function getExpressionColor(expr: string, availableNodes: Array<{ id: string; label: string; color?: string }>): string {
  const nodeMatch = expr.match(/\$node\[["'](.+?)["']\]/);
  if (nodeMatch) {
    const nodeName = nodeMatch[1];
    const node = availableNodes.find(n => n.label === nodeName);
    if (node?.color) return node.color;
  }
  if (expr.includes('$json') || expr.includes('$input')) return '#3b82f6';
  if (expr.includes('$vars')) return '#8b5cf6';
  if (expr.includes('$env')) return '#ef4444';
  return '#7b68ee';
}

export default function ExpressionEditor({
  value,
  onChange,
  placeholder = 'Enter value or drag data pills here...',
  multiline: _multiline = false,
  className = '',
  availableNodes = [],
}: ExpressionEditorProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Check if the value contains expressions
  const hasExpressions = value.includes('{{') && value.includes('}}');
  const pills = useMemo(() => hasExpressions ? parseExpressionPills(value) : [], [value, hasExpressions]);

  // Filter suggestions based on current context
  const filteredSuggestions = useMemo(() => {
    const textBeforeCursor = value.slice(0, cursorPosition);

    // Check if we are inside $node["..."] or just $node[
    const nodeMatch = textBeforeCursor.match(/\$node\[(['"]?)([^'"]*?)$/);
    if (nodeMatch) {
      const partial = nodeMatch[2].toLowerCase();
      return availableNodes
        .filter(n => n.label.toLowerCase().includes(partial))
        .map(n => ({
          label: n.label,
          description: `Output from ${n.label}`,
          icon: '📦',
          value: (nodeMatch[1] ? '' : '"') + n.label + (nodeMatch[1] === "'" ? "'" : '"') + '].json.'
        }));
    }

    // Check if we are typing a $ variable
    const dollarMatch = textBeforeCursor.match(/\$([a-zA-Z]*)$/);
    if (dollarMatch) {
      const partial = '$' + dollarMatch[1].toLowerCase();
      return BASE_SUGGESTIONS.filter(s => s.label.toLowerCase().startsWith(partial));
    }

    return BASE_SUGGESTIONS;
  }, [value, cursorPosition, availableNodes]);

  // Handle suggestion selection
  const handleSuggestionClick = useCallback((suggestion: any) => {
    const input = inputRef.current;
    if (!input) return;

    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);

    let newValue = value;
    let newCursorPos = cursorPosition;

    const nodeMatch = textBeforeCursor.match(/\$node\[(['"]?)([^'"]*?)$/);
    const dollarMatch = textBeforeCursor.match(/\$([a-zA-Z]*)$/);

    if (nodeMatch) {
      const start = textBeforeCursor.slice(0, -nodeMatch[2].length);
      newValue = start + (suggestion.value || suggestion.label) + textAfterCursor;
      newCursorPos = start.length + (suggestion.value || suggestion.label).length;
    } else if (dollarMatch) {
      const start = textBeforeCursor.slice(0, -(dollarMatch[1].length + 1));
      newValue = start + suggestion.label + textAfterCursor;
      newCursorPos = start.length + suggestion.label.length;
    } else {
      newValue = textBeforeCursor + suggestion.label + textAfterCursor;
      newCursorPos = cursorPosition + suggestion.label.length;
    }

    onChange(newValue);
    setShowSuggestions(false);
    setActiveIndex(0);

    setTimeout(() => {
      input.focus();
      input.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [value, cursorPosition, onChange]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // ---- Suggestion dropdown is open ----
    if (showSuggestions && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % filteredSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        // Enter (without Shift) selects the suggestion
        e.preventDefault();
        e.stopPropagation();
        handleSuggestionClick(filteredSuggestions[activeIndex]);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        handleSuggestionClick(filteredSuggestions[activeIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation(); // Prevent panel-level Escape from closing the entire panel
        setShowSuggestions(false);
        return;
      }
      // Shift+Enter falls through to default textarea behavior (new line)
    }
    // When no suggestions are open, Enter and Shift+Enter both insert newlines naturally
  }, [showSuggestions, filteredSuggestions, activeIndex, handleSuggestionClick]);

  // Handle input change
  const handleChange = useCallback((newValue: string) => {
    onChange(newValue);

    // Auto-show suggestions on trigger characters
    const curPos = inputRef.current?.selectionStart || 0;
    const lastChar = newValue.slice(0, curPos).slice(-1);
    const lastTwo = newValue.slice(0, curPos).slice(-2);

    if (lastChar === '$' || lastTwo === '{{' || lastChar === '[' || lastChar === '"' || lastChar === "'") {
      setShowSuggestions(true);
      setActiveIndex(0);
    }
  }, [onChange]);

  // Auto-resize textarea: starts compact, grows up to 400px, then scrollbar
  const autoResize = useCallback(() => {
    const textarea = inputRef.current as HTMLTextAreaElement | null;
    if (!textarea) return;
    // Reset height to auto so scrollHeight recalculates correctly
    textarea.style.height = 'auto';
    const minHeight = 44;
    const maxHeight = 400;
    const newHeight = Math.max(minHeight, Math.min(textarea.scrollHeight + 2, maxHeight));
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  // Re-run autoResize whenever value changes or on mount
  useEffect(() => {
    autoResize();
  }, [value, autoResize]);

  // ==================== DRAG & DROP ====================
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const expression = e.dataTransfer.getData('text/plain');
    if (!expression) return;

    const input = inputRef.current;
    const curPos = input?.selectionStart || value.length;

    // Insert expression at cursor
    const before = value.slice(0, curPos);
    const after = value.slice(curPos);
    const newValue = before + expression + after;

    onChange(newValue);

    // Position cursor after inserted expression
    const newPos = curPos + expression.length;
    setTimeout(() => {
      if (input) {
        input.focus();
        input.setSelectionRange(newPos, newPos);
      }
    }, 0);
  }, [value, onChange]);

  // Remove a specific pill from the value
  const handleRemovePill = useCallback((expression: string) => {
    const newValue = value.replace(expression, '').replace(/\s{2,}/g, ' ').trim();
    onChange(newValue);
  }, [value, onChange]);

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

  const isExpressionMode = hasExpressions || value.includes('$');

  const baseInputClass = `
    w-full px-4 py-3 bg-muted/20 border rounded-xl text-[15px] leading-relaxed transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 focus:bg-muted/10
    text-foreground placeholder-muted-foreground/50
    scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent custom-scrollbar
    shadow-sm
    ${isExpressionMode ? 'font-mono text-sm' : ''}
    ${isDragOver ? 'border-primary bg-primary/10 ring-2 ring-primary/20 scale-[1.01]' : 'border-border/60'}
    ${className}
  `;

  const handleSelect = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    setCursorPosition((e.target as HTMLTextAreaElement).selectionStart || 0);
  }, []);

  return (
    <div className="relative">
      {/* Pill Preview Banner (above the input when expressions exist) */}
      {hasExpressions && pills.length > 0 && (
        <div className="mb-1.5 flex flex-wrap items-center gap-1 p-2 bg-muted/50 rounded-lg border border-border/40">
          {pills.map((seg, i) =>
            seg.type === 'pill' ? (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold cursor-default group"
                style={{
                  backgroundColor: `${getExpressionColor(seg.expression || '', availableNodes)}18`,
                  color: getExpressionColor(seg.expression || '', availableNodes),
                  border: `1px solid ${getExpressionColor(seg.expression || '', availableNodes)}30`,
                }}
                title={seg.expression}
              >
                <Zap className="w-2.5 h-2.5" />
                {seg.content}
                <button
                  onClick={() => handleRemovePill(seg.expression || '')}
                  className="ml-0.5 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ) : (
              seg.content.trim() && (
                <span key={i} className="text-[11px] text-muted-foreground">{seg.content}</span>
              )
            )
          )}
        </div>
      )}

      {/* Input Field */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="relative"
      >
        {/* Always use textarea for all fields — enables multiline editing, auto-resize, and scrolling */}
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onSelect={handleSelect}
          placeholder={placeholder}
          rows={1}
          className={`${baseInputClass} resize-none`}
        />

        {/* Drop indicator overlay */}
        {isDragOver && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-lg border-2 border-dashed border-primary/60 bg-primary/5">
            <span className="text-xs font-semibold text-primary bg-background px-3 py-1 rounded-full">
              Drop here to insert
            </span>
          </div>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl overflow-hidden"
        >
          <div className="p-1.5 border-b border-border/60 bg-muted/30">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Variable className="w-3 h-3" />
              <span>Available variables</span>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredSuggestions.map((suggestion, index) => (
              <button
                key={suggestion.label}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 text-left transition-colors
                  ${index === activeIndex ? 'bg-primary/10' : 'hover:bg-muted/50'}
                `}
              >
                <span className="text-base">{suggestion.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <code className={`text-sm font-mono ${index === activeIndex ? 'text-primary font-bold' : 'text-primary'}`}>
                      {suggestion.label}
                    </code>
                    {index === activeIndex && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded border border-border/60">
                        Tab
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {suggestion.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Expression Mode Help */}
      {!value && (
        <div className="mt-1 text-xs text-muted-foreground/60 flex items-center gap-1">
          <Code2 className="w-3 h-3" />
          <span>Drag data pills here or type <code className="text-primary/70">$</code> for variables</span>
        </div>
      )}
    </div>
  );
}
