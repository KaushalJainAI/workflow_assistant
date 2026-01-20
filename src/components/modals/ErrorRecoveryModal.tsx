import { X, AlertTriangle, RefreshCcw, SkipForward, StopCircle } from 'lucide-react';

interface ErrorRecoveryModalProps {
  isOpen: boolean;
  error: string;
  nodeName: string;
  onRetry: () => void;
  onSkip: () => void;
  onStop: () => void;
  onClose: () => void;
}

export default function ErrorRecoveryModal({
  isOpen,
  error,
  nodeName,
  onRetry,
  onSkip,
  onStop,
  onClose,
}: ErrorRecoveryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Execution Error</h2>
                <p className="text-sm text-muted-foreground">Node: {nodeName}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-muted rounded-full">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          
          <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg mb-6">
            <p className="text-destructive font-mono text-sm break-words">{error}</p>
          </div>
          
          <div className="space-y-3">
            <p className="text-sm font-medium mb-2">How would you like to proceed?</p>
            
            <button
              onClick={onRetry}
              className="w-full flex items-center gap-3 px-4 py-3 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors border border-transparent hover:border-primary/20"
            >
              <div className="p-2 bg-background rounded-full">
                <RefreshCcw className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Retry Node</div>
                <div className="text-xs text-muted-foreground">Attempt to execute the node again</div>
              </div>
            </button>

            <button
              onClick={onSkip}
              className="w-full flex items-center gap-3 px-4 py-3 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors border border-transparent hover:border-primary/20"
            >
              <div className="p-2 bg-background rounded-full">
                <SkipForward className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Skip & Continue</div>
                <div className="text-xs text-muted-foreground">Ignore error and proceed to next node</div>
              </div>
            </button>

            <button
              onClick={onStop}
              className="w-full flex items-center gap-3 px-4 py-3 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors border border-transparent hover:border-destructive/20"
            >
              <div className="p-2 bg-background rounded-full">
                <StopCircle className="w-4 h-4 text-destructive" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-destructive">Stop Execution</div>
                <div className="text-xs text-muted-foreground">Abort the workflow execution</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
