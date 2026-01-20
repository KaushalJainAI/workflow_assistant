import { 
  Clock, 
  ShieldQuestion, 
  AlertTriangle, 
  HelpCircle,
  ChevronRight,
  Workflow
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface PendingAction {
  id: string;
  type: 'approval' | 'clarification' | 'error';
  title: string;
  description: string;
  workflowName: string;
  nodeName: string;
  timestamp: Date;
  urgency: 'low' | 'medium' | 'high';
}

interface PendingApprovalsProps {
  actions: PendingAction[];
  onActionClick: (action: PendingAction) => void;
}

const actionConfig = {
  approval: {
    icon: ShieldQuestion,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    label: 'Approval Required',
  },
  clarification: {
    icon: HelpCircle,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    label: 'Clarification Needed',
  },
  error: {
    icon: AlertTriangle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    label: 'Error Recovery',
  },
};

const urgencyConfig = {
  low: 'bg-green-500/20 text-green-600',
  medium: 'bg-yellow-500/20 text-yellow-600',
  high: 'bg-red-500/20 text-red-600',
};

export default function PendingApprovals({ actions, onActionClick }: PendingApprovalsProps) {
  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-orange-500/10 rounded-lg">
          <Clock className="w-5 h-5 text-orange-500" />
        </div>
        <div>
          <h3 className="font-semibold">Pending Actions</h3>
          <p className="text-xs text-muted-foreground">
            {actions.length} action{actions.length !== 1 ? 's' : ''} awaiting your response
          </p>
        </div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {actions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ShieldQuestion className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No pending actions</p>
            <p className="text-xs">All workflows are running smoothly</p>
          </div>
        ) : (
          actions.map((action) => {
            const config = actionConfig[action.type];
            const Icon = config.icon;

            return (
              <button
                key={action.id}
                onClick={() => onActionClick(action)}
                className={cn(
                  "w-full text-left p-4 rounded-lg border transition-all hover:shadow-md group",
                  config.bgColor,
                  config.borderColor
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("p-2 rounded-lg", config.bgColor)}>
                    <Icon className={cn("w-5 h-5", config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("text-xs font-semibold", config.color)}>
                        {config.label}
                      </span>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        urgencyConfig[action.urgency]
                      )}>
                        {action.urgency.charAt(0).toUpperCase() + action.urgency.slice(1)}
                      </span>
                    </div>
                    <h4 className="font-medium truncate">{action.title}</h4>
                    <p className="text-sm text-muted-foreground truncate">{action.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Workflow className="w-3 h-3" />
                        <span>{action.workflowName}</span>
                      </div>
                      <span>•</span>
                      <span>{action.nodeName}</span>
                      <span>•</span>
                      <span>{getTimeAgo(action.timestamp)}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
