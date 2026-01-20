import { 
  Brain, 
  Lightbulb, 
  Target, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface Thought {
  id: string;
  type: 'observation' | 'reasoning' | 'decision' | 'action';
  content: string;
  timestamp: Date;
}

interface OrchestratorThoughtsProps {
  thoughts: Thought[];
  isThinking: boolean;
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

export default function OrchestratorThoughts({ thoughts, isThinking }: OrchestratorThoughtsProps) {
  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg">
          <Sparkles className="w-5 h-5 text-purple-500" />
        </div>
        <div>
          <h3 className="font-semibold">AI Thought Process</h3>
          <p className="text-xs text-muted-foreground">Real-time reasoning and decisions</p>
        </div>
        {isThinking && (
          <div className="ml-auto flex items-center gap-2">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-sm text-muted-foreground">Thinking...</span>
          </div>
        )}
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {thoughts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No thoughts yet. Start a workflow to see the AI's reasoning.</p>
          </div>
        ) : (
          thoughts.map((thought) => {
            const config = thoughtConfig[thought.type];
            const Icon = config.icon;

            return (
              <div 
                key={thought.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg transition-all animate-in slide-in-from-bottom-2",
                  config.bgColor
                )}
              >
                <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", config.color)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("text-xs font-semibold", config.color)}>
                      {config.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {thought.timestamp.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <p className="text-sm">{thought.content}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
