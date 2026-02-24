import React, { useState, useEffect } from 'react';
import { 
  Loader2, 
  History, 
  RefreshCw, 
  Clock, 
  Activity,
  XCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface BackgroundTask {
  id: string;
  type: string;
  name: string;
  status: string;
  started_at: string;
  workflow_id?: number;
}

interface BackgroundTaskPanelProps {
  tasks: BackgroundTask[];
  loading?: boolean;
  onStopTask?: (taskId: string) => void;
  onRefresh?: () => void;
}

const BackgroundTaskPanel: React.FC<BackgroundTaskPanelProps> = ({ 
  tasks, 
  loading = false, 
  onStopTask,
  onRefresh
}) => {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    if (!loading) {
      setLastUpdated(new Date());
    }
  }, [loading]);

  const handleStopTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onStopTask?.(taskId);
  };

  if (loading && tasks.length === 0) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="bg-card border border-border/60 rounded-xl overflow-hidden shadow-sm">
      <div className="p-4 flex items-center justify-between border-b border-border/60">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Active Tasks</h3>
          <span className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
            tasks.length > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            {tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-tight">
            Last update: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <button 
            onClick={onRefresh} 
            disabled={loading}
            className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="p-4">
        {tasks.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground">
            <p className="text-sm">No active background tasks</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div 
                key={task.id}
                className="group p-3 rounded-lg border border-border/40 bg-muted/30 hover:bg-muted/50 transition-all flex items-center justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Typography variant="subtitle2" component="span" className="font-bold text-sm truncate">
                      {task.name}
                    </Typography>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="capitalize">{task.type.replace('_', ' ')}</span>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(task.started_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="ml-4 flex items-center gap-2">
                  <div className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight",
                    task.status === 'running' ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                  )}>
                    {task.status}
                  </div>
                  
                  {task.status === 'running' && (
                    <button
                      onClick={(e) => handleStopTask(task.id, e)}
                      className="p-1 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded transition-colors group/stop"
                      title="Stop Task"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}

                  {task.status === 'running' ? (
                    <Activity className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                  ) : (
                    <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Helper for Typography-like behavior since we don't have MUI
const Typography: React.FC<{ variant?: string, component?: string, className?: string, children: React.ReactNode }> = ({ className, children }) => {
  return <span className={className}>{children}</span>;
};

export default BackgroundTaskPanel;
