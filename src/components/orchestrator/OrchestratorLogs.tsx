import { 
  Terminal, 
  ChevronDown, 
  ChevronUp, 
  Code, 
  Cpu, 
  Brain,
  Wifi,
  AlertCircle
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'ai' | 'engine' | 'network';
  message: string;
  source?: string;
  data?: any;
}

interface OrchestratorLogsProps {
  logs: LogEntry[];
  maxHeight?: string;
}

const levelConfig = {
  info: { color: 'text-blue-600 dark:text-blue-400', icon: Terminal },
  warn: { color: 'text-amber-600 dark:text-amber-400', icon: AlertCircle },
  error: { color: 'text-red-600 dark:text-red-400', icon: AlertCircle },
  ai: { color: 'text-purple-600 dark:text-purple-400', icon: Brain },
  engine: { color: 'text-green-600 dark:text-green-400', icon: Cpu },
  network: { color: 'text-cyan-600 dark:text-cyan-400', icon: Wifi },
};

export default function OrchestratorLogs({ logs, maxHeight = "300px" }: OrchestratorLogsProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-card border border-border/40 rounded-xl overflow-hidden shadow-sm transition-all duration-300">
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border/50 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Activity Logs</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono font-medium border border-border/50">
            {logs.length} events
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-1 hover:bg-muted rounded transition-colors">
            <Code className="w-3.5 h-3.5 text-muted-foreground/70" />
          </button>
          {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>
 
      {/* Log Content */}
      {isExpanded && (
        <div 
          ref={scrollRef}
          className="p-4 font-mono text-[11px] overflow-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 bg-card"
          style={{ height: maxHeight }}
        >
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full opacity-40 grayscale">
              <Terminal className="w-8 h-8 mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">Waiting for output...</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {logs.map((log) => {
                const Config = levelConfig[log.level];
                const Icon = Config.icon;
                
                return (
                  <div key={log.id} className="group flex gap-3 hover:bg-muted/30 -mx-2 px-2 py-1 rounded transition-colors border border-transparent hover:border-border/30">
                    <span className="text-muted-foreground/60 shrink-0 select-none font-medium">
                      [{log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
                    </span>
                    
                    <div className="flex items-start gap-2 min-w-0">
                      <Icon className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", Config.color)} />
                      <div className="min-w-0">
                        {log.source && (
                          <span className={cn("font-bold mr-2 uppercase text-[10px] tracking-wide", Config.color)}>
                            {log.source}:
                          </span>
                        )}
                        <span className="text-foreground/80 break-words leading-relaxed">
                          {log.message}
                        </span>
                        {log.data && (
                          <pre 
                            className="mt-2 text-[10px] bg-muted/50 p-2 rounded overflow-x-auto border border-border/50 font-mono"
                            dangerouslySetInnerHTML={{ 
                              __html: syntaxHighlight(log.data) 
                            }} 
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
 
// Helper function for JSON syntax highlighting
const syntaxHighlight = (json: any) => {
  if (typeof json !== 'string') {
    json = JSON.stringify(json, undefined, 2);
  }
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match: string) => {
    let cls = 'text-blue-600 dark:text-blue-400'; // number
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'text-red-600 dark:text-red-400 font-semibold'; // key
      } else {
        cls = 'text-green-600 dark:text-green-400'; // string
      }
    } else if (/true|false/.test(match)) {
      cls = 'text-purple-600 dark:text-purple-400 font-bold'; // boolean
    } else if (/null/.test(match)) {
      cls = 'text-gray-500 italic'; // null
    }
    return `<span class="${cls}">${match}</span>`;
  });
};
