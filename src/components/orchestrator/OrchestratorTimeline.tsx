import { 
  Brain, 
  Loader2, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Workflow,
  Sparkles,
  Zap,
  XCircle
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface OrchestratorStep {
  id: string;
  type: 'thinking' | 'planning' | 'executing' | 'waiting' | 'completed' | 'error' | 'cancelled';
  title: string;
  description?: string;
  details?: string[];
  thought?: string; // Summary reasoning for the user
  reasoning?: string; // Deep technical reasoning (internal thinking)
  thinkingMessage?: string; // Current status "Thinking about..."
  timestamp: Date;
  duration?: number; // in ms
  nodeId?: string;
  nodeName?: string;
  input?: any;
  output?: any;
}

interface OrchestratorTimelineProps {
  steps: OrchestratorStep[];
  currentStepId?: string;
}

const stepConfig = {
  thinking: {
    icon: Brain,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500',
    label: 'Thinking',
  },
  planning: {
    icon: Sparkles,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500',
    label: 'Planning',
  },
  executing: {
    icon: Zap,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500',
    label: 'Executing',
  },
  waiting: {
    icon: Clock,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500',
    label: 'Waiting',
  },
  completed: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500',
    label: 'Completed',
  },
  error: {
    icon: AlertTriangle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500',
    label: 'Error',
  },
  cancelled: {
    icon: XCircle,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    borderColor: 'border-muted-foreground/30',
    label: 'Stopped',
  },
};

export default function OrchestratorTimeline({ steps, currentStepId }: OrchestratorTimelineProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const toggleStep = (id: string) => {
    setExpandedSteps((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

      <div className="space-y-4">
        {steps.map((step) => {
          const config = stepConfig[step.type];
          const Icon = config.icon;
          const isExpanded = expandedSteps.has(step.id);
          const isCurrent = step.id === currentStepId;
          const isActive = step.type === 'thinking' || step.type === 'executing' || step.type === 'waiting';
          const isExpandable = (step.details && step.details.length > 0) || !!step.thought || !!step.thinkingMessage;

          return (
            <div 
              key={step.id}
              className={cn(
                "relative pl-14 transition-all duration-200",
                isCurrent && "scale-[1.02]"
              )}
            >
              {/* Icon */}
              <div 
                className={cn(
                  "absolute left-3 w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all",
                  config.bgColor,
                  config.borderColor,
                  isCurrent && "ring-2 ring-offset-2 ring-offset-background",
                  isCurrent && config.borderColor.replace('border-', 'ring-')
                )}
              >
                {isActive && isCurrent ? (
                  <Loader2 className={cn("w-4 h-4 animate-spin", config.color)} />
                ) : (
                  <Icon className={cn("w-4 h-4", config.color)} />
                )}
              </div>

              {/* Content */}
              <div 
                className={cn(
                  "bg-card border rounded-lg p-4 transition-all cursor-pointer hover:shadow-md",
                  isCurrent && "border-primary shadow-lg"
                )}
                onClick={() => isExpandable && toggleStep(step.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        "text-xs font-semibold px-2 py-0.5 rounded-full",
                        config.bgColor,
                        config.color
                      )}>
                        {config.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(step.timestamp)}
                      </span>
                      {step.duration && (
                        <span className="text-xs text-muted-foreground">
                          • {formatDuration(step.duration)}
                        </span>
                      )}
                    </div>
                    <h4 className="font-medium">{step.title}</h4>
                    {step.description && (
                      <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                    )}
                    {step.nodeName && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Workflow className="w-3 h-3" />
                        <span>{step.nodeName}</span>
                      </div>
                    )}
                  </div>

                  {isExpandable && (
                    <button className="p-1 hover:bg-muted rounded">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>

                {/* Expanded details or Thought content */}
                {(isExpanded || step.thought || step.thinkingMessage) && (
                  <div className="mt-3 pt-3 border-t space-y-3">
                    {/* Node Metadata & Status */}
                    <div className="flex flex-wrap items-center gap-4 mb-4">
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md border border-border/40">
                         <div className={cn(
                           "w-1.5 h-1.5 rounded-full",
                           step.type === 'completed' ? "bg-green-500" : (step.type === 'error' ? "bg-red-500" : "bg-blue-500")
                         )} />
                         <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                           Status: {step.type}
                         </span>
                      </div>
                      {step.duration && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md border border-border/40">
                           <Clock className="w-3 h-3 text-muted-foreground" />
                           <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                             {formatDuration(step.duration)}
                           </span>
                        </div>
                      )}
                    </div>

                    {isExpanded && step.details && step.details.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {step.details.map((detail, i) => (
                          <div key={i} className="text-sm text-muted-foreground flex items-start gap-2 italic">
                            <span className="text-primary opacity-50">→</span>
                            <span>{detail}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Integrated AI Reasoning Block */}
                    {(step.thought || step.thinkingMessage || step.reasoning) && (
                      <div className={cn(
                        "p-4 rounded-xl border border-primary/20 bg-primary/5 transition-all mb-4",
                        !step.thought && !step.reasoning && "animate-pulse"
                      )}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                             <Brain className="w-3.5 h-3.5 text-primary" />
                             <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                               Cognitive Analysis
                             </span>
                          </div>
                          
                          {step.reasoning && (
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 toggleStep(`${step.id}-reasoning`);
                               }}
                               className="text-[9px] font-bold text-primary/60 hover:text-primary uppercase flex items-center gap-1 transition-colors"
                             >
                               {expandedSteps.has(`${step.id}-reasoning`) ? 'Hide Technical Details' : 'View Full Thought Process'}
                             </button>
                          )}
                        </div>

                        {/* Summary Thought */}
                        {(step.thought || step.thinkingMessage) && (
                          <div className={cn(
                            "text-sm leading-relaxed text-foreground/90 ai-chat-prose",
                            !step.thought && "italic text-muted-foreground",
                          )}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {step.thought || step.thinkingMessage || ''}
                            </ReactMarkdown>
                          </div>
                        )}

                        {/* Deep Reasoning (Technical Thinking) */}
                        {step.reasoning && expandedSteps.has(`${step.id}-reasoning`) && (
                          <div className="mt-3 pt-3 border-t border-primary/10 animate-in fade-in slide-in-from-top-1 duration-300">
                             <div className="flex items-center gap-1.5 mb-2 text-primary/70">
                               <Sparkles className="w-3 h-3" />
                               <span className="text-[9px] font-bold uppercase tracking-wider">Internal Technical Reasoning</span>
                             </div>
                             <div className="text-[12px] leading-snug text-foreground/70 bg-black/20 p-3 rounded-lg border border-primary/5 ai-chat-prose">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {step.reasoning || ''}
                                </ReactMarkdown>
                             </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Input/Output Data Blocks */}
                    {isExpanded && (step.input || step.output) && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
                        {step.input && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between px-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                Node Input
                              </span>
                              <div className="text-[9px] text-muted-foreground/60">JSON Schema</div>
                            </div>
                            <pre className="text-[11px] p-4 rounded-xl bg-muted/30 border border-border/40 overflow-x-auto font-mono scrollbar-thin max-h-[300px]">
                              {JSON.stringify(step.input, null, 2)}
                            </pre>
                          </div>
                        )}
                        {step.output && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between px-1">
                               <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                Node Output
                              </span>
                              <div className="text-[9px] text-emerald-600/60">Produced Result</div>
                            </div>
                            <pre className="text-[11px] p-4 rounded-xl bg-emerald-500/[0.03] border border-emerald-500/10 overflow-x-auto font-mono text-emerald-700 dark:text-emerald-400 scrollbar-thin max-h-[300px]">
                              {JSON.stringify(step.output, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
