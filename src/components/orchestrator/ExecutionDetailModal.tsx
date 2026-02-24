import { 
  X, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { type ExecutionDetail, type OrchestratorThought } from '../../api/logs';
import AIAnalysis from './AIAnalysis';

interface ExecutionDetailModalProps {
  execution: ExecutionDetail | null;
  loading: boolean;
  activities: OrchestratorThought[];
  narrative: OrchestratorThought | null;
  onClose: () => void;
  onRefresh?: (id: string) => void;
}

export default function ExecutionDetailModal({ 
  execution, 
  loading, 
  activities, 
  narrative, 
  onClose,
  onRefresh
}: ExecutionDetailModalProps) {
  if (!execution && !loading) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'success':
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 text-green-500 rounded-full text-xs font-medium border border-green-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Success
          </span>
        );
      case 'failed':
      case 'error':
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 text-red-500 rounded-full text-xs font-medium border border-red-500/20">
            <XCircle className="w-3 h-3" />
            Error
          </span>
        );
      case 'running':
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-full text-xs font-medium border border-blue-500/20">
            <Clock className="w-3 h-3 animate-spin" />
            Running
          </span>
        );
      case 'pending':
      case 'waiting':
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-yellow-500/10 text-yellow-500 rounded-full text-xs font-medium border border-yellow-500/20">
            <Clock className="w-3 h-3" />
            Waiting
          </span>
        );
      default:
         return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs font-medium border border-border">
            {status}
          </span>
        );
    }
  };


  return (
    <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-4xl max-h-[90%] flex flex-col animate-in fade-in zoom-in duration-200">
        {!execution && loading ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : execution ? (
          <>
            <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                {getStatusBadge(execution.status)}
                <h2 className="text-base font-semibold truncate max-w-md">Execution Details</h2>
                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                   {execution.execution_id}
                </span>
                {onRefresh && (
                  <button 
                    onClick={() => onRefresh(execution.execution_id)}
                    className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                    disabled={loading}
                    title="Refresh details"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                  </button>
                )}
              </div>
              <button 
                onClick={onClose} 
                className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 bg-muted/20 border-b border-border grid grid-cols-4 gap-4 text-xs">
              <div>
                <p className="text-muted-foreground mb-1 uppercase tracking-tighter font-semibold">Trigger</p>
                <p className="font-medium uppercase tracking-wider text-[10px]">{execution.trigger_type}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1 uppercase tracking-tighter font-semibold">Started</p>
                <p className="font-medium">{new Date(execution.created_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1 uppercase tracking-tighter font-semibold">Finished</p>
                <p className="font-medium">{execution.completed_at ? new Date(execution.completed_at).toLocaleString() : '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1 uppercase tracking-tighter font-semibold">Duration</p>
                <p className="font-medium font-mono">{execution.duration_ms ? `${(execution.duration_ms / 1000).toFixed(2)}s` : 'Unknown'}</p>
              </div>
            </div>

            {execution.error_message && (
               <div className="mx-4 mt-4 p-3 bg-red-500/10 text-red-500 text-xs rounded-md border border-red-500/20">
                  <p className="font-bold flex items-center gap-2 mb-1">
                     <AlertTriangle className="w-3.5 h-3.5" />
                     EXECUTION ERROR
                  </p>
                  <p className="font-mono break-all leading-relaxed">{execution.error_message}</p>
               </div>
            )}

            <div className="flex-1 overflow-auto p-4">
              <AIAnalysis 
                narrative={narrative} 
                activities={activities} 
                nodeLogs={execution.node_logs}
                supervisionLevel={execution.supervision_level}
              />
            </div>

            <div className="p-3 border-t border-border bg-muted/10 shrink-0 text-right">
              <button 
                onClick={onClose}
                className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded hover:bg-primary/90 transition-colors"
              >
                Close Details
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
