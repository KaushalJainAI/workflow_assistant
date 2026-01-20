import { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, Copy, Check } from 'lucide-react';

interface JsonTreeProps {
  data: unknown;
  name?: string;
  level?: number;
  defaultExpanded?: boolean;
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * Collapsible JSON tree viewer component
 * Shows JSON data in a tree structure with syntax highlighting
 */
export default function JsonTree({ 
  data, 
  name, 
  level = 0, 
  defaultExpanded = true 
}: JsonTreeProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded && level < 2);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [data]);

  const getTypeColor = (value: unknown): string => {
    if (value === null) return 'text-gray-500';
    if (typeof value === 'string') return 'text-green-600 dark:text-green-400';
    if (typeof value === 'number') return 'text-blue-600 dark:text-blue-400';
    if (typeof value === 'boolean') return 'text-purple-600 dark:text-purple-400';
    return 'text-foreground';
  };

  const getTypeLabel = (value: unknown): string => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return `[${value.length}]`;
    if (typeof value === 'object') return `{${Object.keys(value).length}}`;
    return '';
  };

  const formatValue = (value: unknown): string => {
    if (value === null) return 'null';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
  };

  const isExpandable = (value: unknown): boolean => {
    return value !== null && typeof value === 'object';
  };

  const renderPrimitive = (value: unknown, key?: string) => (
    <div 
      className="flex items-center gap-1 py-0.5 hover:bg-muted/50 rounded px-1 group"
      style={{ paddingLeft: `${level * 16}px` }}
    >
      <span className="w-4" /> {/* Spacer for alignment */}
      {key !== undefined && (
        <>
          <span className="text-foreground font-medium">{key}</span>
          <span className="text-muted-foreground">:</span>
        </>
      )}
      <span className={getTypeColor(value)}>{formatValue(value)}</span>
      <button
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded transition-opacity ml-auto"
        title="Copy value"
      >
        {copied ? (
          <Check className="w-3 h-3 text-green-500" />
        ) : (
          <Copy className="w-3 h-3 text-muted-foreground" />
        )}
      </button>
    </div>
  );

  const renderObject = (obj: Record<string, unknown>, key?: string) => {
    const keys = Object.keys(obj);
    
    return (
      <div>
        <div 
          className="flex items-center gap-1 py-0.5 hover:bg-muted/50 rounded px-1 cursor-pointer group"
          style={{ paddingLeft: `${level * 16}px` }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          {key !== undefined && (
            <>
              <span className="text-foreground font-medium">{key}</span>
              <span className="text-muted-foreground">:</span>
            </>
          )}
          <span className="text-muted-foreground text-xs">{getTypeLabel(obj)}</span>
          {!isExpanded && keys.length > 0 && (
            <span className="text-muted-foreground text-xs truncate max-w-[200px]">
              {`{ ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', ...' : ''} }`}
            </span>
          )}
          <button
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded transition-opacity ml-auto"
            title="Copy object"
          >
            {copied ? (
              <Check className="w-3 h-3 text-green-500" />
            ) : (
              <Copy className="w-3 h-3 text-muted-foreground" />
            )}
          </button>
        </div>
        {isExpanded && (
          <div>
            {keys.map((k) => (
              <JsonTree 
                key={k} 
                data={obj[k]} 
                name={k} 
                level={level + 1}
                defaultExpanded={level < 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderArray = (arr: unknown[], key?: string) => {
    return (
      <div>
        <div 
          className="flex items-center gap-1 py-0.5 hover:bg-muted/50 rounded px-1 cursor-pointer group"
          style={{ paddingLeft: `${level * 16}px` }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          {key !== undefined && (
            <>
              <span className="text-foreground font-medium">{key}</span>
              <span className="text-muted-foreground">:</span>
            </>
          )}
          <span className="text-muted-foreground text-xs">[{arr.length}]</span>
          {!isExpanded && arr.length > 0 && (
            <span className="text-muted-foreground text-xs truncate max-w-[200px]">
              [{arr.slice(0, 2).map(v => typeof v === 'object' ? '{...}' : formatValue(v)).join(', ')}
              {arr.length > 2 ? ', ...' : ''}]
            </span>
          )}
          <button
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded transition-opacity ml-auto"
            title="Copy array"
          >
            {copied ? (
              <Check className="w-3 h-3 text-green-500" />
            ) : (
              <Copy className="w-3 h-3 text-muted-foreground" />
            )}
          </button>
        </div>
        {isExpanded && (
          <div>
            {arr.map((item, index) => (
              <JsonTree 
                key={index} 
                data={item} 
                name={String(index)} 
                level={level + 1}
                defaultExpanded={level < 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  // Main render logic
  if (!isExpandable(data)) {
    return renderPrimitive(data, name);
  }

  if (Array.isArray(data)) {
    return renderArray(data, name);
  }

  return renderObject(data as Record<string, unknown>, name);
}
