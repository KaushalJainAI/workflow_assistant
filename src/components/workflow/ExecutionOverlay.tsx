import { cn } from '../../lib/utils';

export interface ExecutionState {
  isRunning: boolean;
  currentNodeId?: string;
  completedNodeIds: string[];
  errorNodeIds: string[];
  nodeOutputs: Record<string, any>;
}

interface ExecutionOverlayProps {
  nodeId: string;
  state: ExecutionState;
}

export function NodeExecutionBadge({ nodeId, state }: ExecutionOverlayProps) {
  const isCurrentNode = state.currentNodeId === nodeId;
  const isCompleted = state.completedNodeIds.includes(nodeId);
  const hasError = state.errorNodeIds.includes(nodeId);

  if (!state.isRunning && !isCompleted && !hasError) {
    return null;
  }

  return (
    <>
      {/* Pulse ring for currently executing node */}
      {isCurrentNode && (
        <div className="absolute -inset-1 rounded-lg pointer-events-none">
          <div className="absolute inset-0 rounded-lg bg-yellow-500/30 animate-ping" />
          <div className="absolute inset-0 rounded-lg border-2 border-yellow-500 animate-pulse" />
        </div>
      )}

      {/* Status badge */}
      <div 
        className={cn(
          "absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-lg z-10",
          isCurrentNode && "bg-yellow-500 text-yellow-950",
          isCompleted && !hasError && "bg-green-500 text-white",
          hasError && "bg-red-500 text-white"
        )}
      >
        {isCurrentNode && (
          <div className="w-3 h-3 border-2 border-yellow-950 border-t-transparent rounded-full animate-spin" />
        )}
        {isCompleted && !hasError && "✓"}
        {hasError && "✕"}
      </div>
    </>
  );
}

interface EdgeAnimationProps {
  isActive: boolean;
}

export function EdgeAnimation({ isActive }: EdgeAnimationProps) {
  if (!isActive) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div 
        className="w-2 h-2 bg-primary rounded-full shadow-lg shadow-primary/50"
        style={{
          animation: 'flowData 1s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes flowData {
          0% {
            transform: translateX(0%);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

interface DataPreviewTooltipProps {
  data: any;
  position: { x: number; y: number };
}

export function DataPreviewTooltip({ data, position }: DataPreviewTooltipProps) {
  if (!data) return null;

  const preview = JSON.stringify(data, null, 2).slice(0, 200);
  const isTruncated = JSON.stringify(data).length > 200;

  return (
    <div 
      className="fixed z-50 max-w-xs bg-popover border rounded-lg shadow-xl p-3 pointer-events-none animate-in fade-in zoom-in-95 duration-150"
      style={{ left: position.x + 10, top: position.y + 10 }}
    >
      <div className="text-xs font-semibold mb-2 text-muted-foreground">Output Data</div>
      <pre className="text-xs font-mono bg-muted p-2 rounded overflow-hidden">
        {preview}
        {isTruncated && '...'}
      </pre>
    </div>
  );
}

// Execution progress bar for workflow
interface ExecutionProgressProps {
  current: number;
  total: number;
  status: 'running' | 'success' | 'error';
}

export function ExecutionProgress({ current, total, status }: ExecutionProgressProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-card border rounded-lg shadow-lg">
      <div className="relative w-32 h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-300",
            status === 'running' && "bg-yellow-500",
            status === 'success' && "bg-green-500",
            status === 'error' && "bg-red-500"
          )}
          style={{ width: `${percentage}%` }}
        />
        {status === 'running' && (
          <div 
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            style={{
              animation: 'shimmer 1.5s infinite',
            }}
          />
        )}
      </div>
      <span className="text-sm font-medium">
        {current} / {total}
      </span>
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
