import { useState } from 'react';
import { 
  History, 
  RotateCcw, 
  Clock, 
  ChevronRight,
  Trash2,
  X,
  GitBranch
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { WorkflowVersion } from '../../hooks/useVersionHistory';

interface VersionHistoryProps {
  versions: WorkflowVersion[];
  onRestore: (versionId: string) => void;
  onClear: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function VersionHistory({ 
  versions, 
  onRestore, 
  onClear, 
  isOpen, 
  onClose 
}: VersionHistoryProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-card border-l shadow-xl z-20 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Version History</h3>
        </div>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-muted rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {versions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground px-4">
            <GitBranch className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No versions saved yet</p>
            <p className="text-xs mt-1">Versions are saved when you save your workflow</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {versions.map((version, index) => (
              <button
                key={version.id}
                onClick={() => setSelectedId(selectedId === version.id ? null : version.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg transition-all",
                  selectedId === version.id 
                    ? "bg-primary/10 border border-primary/30" 
                    : "hover:bg-muted border border-transparent"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                    index === 0 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted text-muted-foreground"
                  )}>
                    {index === 0 ? 'L' : versions.length - index}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{version.name}</span>
                      {index === 0 && (
                        <span className="text-xs px-1.5 py-0.5 bg-primary/20 text-primary rounded">
                          Latest
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(version.timestamp)}</span>
                    </div>
                    {version.description && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {version.description}
                      </p>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      {version.nodes.length} nodes • {version.edges.length} connections
                    </div>
                  </div>
                  <ChevronRight className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform",
                    selectedId === version.id && "rotate-90"
                  )} />
                </div>

                {/* Expanded actions */}
                {selectedId === version.id && (
                  <div className="mt-3 pt-3 border-t flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRestore(version.id);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Restore
                    </button>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {versions.length > 0 && (
        <div className="p-4 border-t">
          {confirmClear ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Clear all?</span>
              <button
                onClick={() => {
                  onClear();
                  setConfirmClear(false);
                }}
                className="px-3 py-1.5 bg-destructive text-destructive-foreground rounded text-sm hover:bg-destructive/90"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="px-3 py-1.5 bg-muted rounded text-sm hover:bg-muted/80"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear History
            </button>
          )}
        </div>
      )}
    </div>
  );
}
