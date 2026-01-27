
import { AlertTriangle, AlertCircle, CheckCircle, X } from 'lucide-react';
import { type ValidationError } from '../../lib/validateWorkflow';

interface WorkflowValidationPanelProps {
  errors: ValidationError[];
  warnings: ValidationError[];
  onSelectNode: (nodeId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export default function WorkflowValidationPanel({ 
  errors, 
  warnings, 
  onSelectNode,
  isOpen,
  onToggle,
}: WorkflowValidationPanelProps) {
  const allIssues = [...errors, ...warnings];
  const hasIssues = allIssues.length > 0;

  if (!hasIssues && !isOpen) return null;

  return (
    <div 
      className={`relative z-10 w-full bg-card border-border transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]' : 'border-t-0'}`}
      style={{ height: isOpen ? '30vh' : '0', flexShrink: 0 }}
    >


      {/* Content */}
      <div className="flex flex-col h-full max-h-[30vh]">
        <div className="flex items-center justify-between p-3 border-b border-border bg-muted/20">
          <h3 className="font-semibold text-sm">Validation Issues</h3>
          <button onClick={onToggle} className="p-1 hover:bg-muted rounded text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="overflow-auto p-0">
          {allIssues.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
              <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
              <p>No issues found. Workflow is ready to execute.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {allIssues.map((issue, index) => (
                <div 
                  key={index} 
                  className={`p-3 flex items-start gap-3 hover:bg-muted/50 transition-colors cursor-pointer border-l-4 ${
                    issue.type === 'error' ? 'border-destructive' : 'border-yellow-500'
                  }`}
                  onClick={() => issue.nodeId && onSelectNode(issue.nodeId)}
                >
                  <div className="mt-0.5">
                    {issue.type === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded ${
                        issue.type === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-yellow-500/10 text-yellow-600'
                      }`}>
                        {issue.code.replace(/_/g, ' ')}
                      </span>
                      {issue.nodeId && (
                         <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                           Node: {issue.nodeId}
                         </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground">{issue.message}</p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Click to view
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
