import { History,RotateCcw, Clock, X } from 'lucide-react';
import { type WorkflowVersion } from '../../hooks/useVersionHistory';

interface VersionHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  versions: WorkflowVersion[];
  onRestore: (version: WorkflowVersion) => void;
}

export default function VersionHistoryPanel({
  isOpen,
  onClose,
  versions,
  onRestore,
}: VersionHistoryPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-card border-l border-border shadow-xl z-40 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">Version History</h3>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-muted rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Version List */}
      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        {versions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No versions saved yet</p>
            <p className="text-xs mt-1">Versions are saved automatically when working</p>
          </div>
        ) : (
          <div className="space-y-4">
            {versions.map((version, index) => (
              <div 
                key={version.id}
                className="bg-muted/30 border border-border rounded-lg p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-sm">
                      {version.name || 'Untitled Version'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(version.timestamp).toLocaleString()}
                    </p>
                  </div>
                  {index === 0 && (
                     <span className="text-[10px] uppercase tracking-wider font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                       Latest
                     </span>
                  )}
                </div>
                
                <div className="text-xs text-muted-foreground mb-3 flex gap-3">
                  <span>{version.nodes.length} nodes</span>
                  <span>{version.edges.length} connections</span>
                </div>

                <button
                  onClick={() => onRestore(version)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-background border border-border rounded-md text-xs font-medium hover:bg-accent/10 hover:text-accent-foreground hover:border-accent/50 transition-all"
                >
                  <RotateCcw className="w-3 h-3" />
                  Restore this version
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
