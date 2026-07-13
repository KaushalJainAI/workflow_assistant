import { useState } from 'react';
import { 
  Brain, 
  Lightbulb, 
  Target, 
  ArrowRight,
  Sparkles,
  ChevronDown,
  ChevronUp,
  History
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface Thought {
  id: string;
  type: 'observation' | 'reasoning' | 'decision' | 'action';
  content: string;
  timestamp: Date;
  nodeId?: string;
}

interface OrchestratorThoughtsProps {
  thoughts: Thought[];
  isThinking: boolean;
  thinkingMessage?: string | null;
}

const thoughtConfig = {
  observation: {
    icon: Brain,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    label: 'Observing',
  },
  reasoning: {
    icon: Lightbulb,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    label: 'Reasoning',
  },
  decision: {
    icon: Target,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    label: 'Deciding',
  },
  action: {
    icon: ArrowRight,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    label: 'Acting',
  },
};

export default function OrchestratorThoughts({ thoughts, isThinking, thinkingMessage }: OrchestratorThoughtsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-card border border-border/60 rounded-xl overflow-hidden shadow-lg transition-all duration-500">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-border/40 bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg ring-1 ring-primary/20">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-tight">AI Thought Process</h3>
            <div className="flex items-center gap-2">
              <div className={cn("w-1.5 h-1.5 rounded-full", isThinking ? "bg-emerald-500 animate-ping" : "bg-muted-foreground/30")} />
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                {isThinking ? 'Processing Intelligence' : 'Awaiting Input'}
              </p>
            </div>
          </div>
        </div>
        
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground"
          title={isExpanded ? "Collapse" : "View History"}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <History className="w-4 h-4" />}
        </button>
      </div>

      {/* Content Area */}
      <div className="p-4 space-y-4">
        {/* Thinking Status / Latest Thought */}
        {isThinking && thinkingMessage && (
          <div className="flex items-start gap-3 p-3 bg-primary/5 border border-primary/10 rounded-lg animate-in fade-in slide-in-from-top-1 duration-300">
            <Loader2 className="w-4 h-4 text-primary animate-spin mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-bold text-primary uppercase tracking-tighter mb-1">Active Reasoning</p>
              <p className="text-sm font-medium italic text-foreground/80">{thinkingMessage}</p>
            </div>
          </div>
        )}

        {!isThinking && thoughts.length === 0 && (
          <div className="text-center py-6 text-muted-foreground/50">
            <Brain className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-xs font-medium">No activity recorded yet.</p>
          </div>
        )}

        <div className={cn(
          "space-y-3 transition-all duration-500 overflow-hidden",
          isExpanded ? "max-h-[500px] overflow-y-auto pr-1" : thoughts.length > 1 ? "max-h-24" : "max-h-none"
        )}>
          {thoughts.map((thought, idx) => {
            const config = thoughtConfig[thought.type] || thoughtConfig.reasoning;
            const Icon = config.icon;
            const isLatest = idx === 0;

            return (
              <div 
                key={thought.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border border-transparent transition-all",
                  isLatest ? "bg-muted/50 border-border/40 shadow-sm" : "opacity-60 hover:opacity-100"
                )}
              >
                <div className={cn("p-1.5 rounded-md flex-shrink-0", config.bgColor)}>
                  <Icon className={cn("w-3.5 h-3.5", config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[10px] font-black uppercase tracking-tight", config.color)}>
                        {config.label}
                      </span>
                      {thought.nodeId && (
                        <span className="px-1.5 py-0.5 bg-muted rounded text-[9px] font-mono text-muted-foreground uppercase">
                          {thought.nodeId}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {thought.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">{thought.content}</p>
                </div>
              </div>
            );
          })}
        </div>

        {thoughts.length > 1 && !isExpanded && (
          <button 
            onClick={() => setIsExpanded(true)}
            className="w-full py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-primary transition-colors flex items-center justify-center gap-1 bg-muted/20 rounded-md border border-dashed border-border/60"
          >
            <ChevronDown className="w-3 h-3" />
            View {thoughts.length - 1} more thoughts
          </button>
        )}
      </div>
    </div>
  );
}

function Loader2({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
