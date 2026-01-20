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
  Zap
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/utils';

export interface OrchestratorStep {
  id: string;
  type: 'thinking' | 'planning' | 'executing' | 'waiting' | 'completed' | 'error';
  title: string;
  description?: string;
  details?: string[];
  timestamp: Date;
  duration?: number; // in ms
  nodeId?: string;
  nodeName?: string;
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
                onClick={() => step.details && toggleStep(step.id)}
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

                  {step.details && step.details.length > 0 && (
                    <button className="p-1 hover:bg-muted rounded">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>

                {/* Expanded details */}
                {isExpanded && step.details && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    {step.details.map((detail, i) => (
                      <div key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>{detail}</span>
                      </div>
                    ))}
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
