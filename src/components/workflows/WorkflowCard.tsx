
import { Link } from 'react-router-dom';
import { 
  Play, 
  Copy, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Activity,
  Layers,
  Calendar
} from 'lucide-react';
import { type WorkflowListItem } from '../../api';
import { cn } from '../../lib/utils';

interface WorkflowCardProps {
  workflow: WorkflowListItem;
  onPlay: (e: React.MouseEvent, id: number) => void;
  onDuplicate: (e: React.MouseEvent, id: number) => void;
  onDelete: (id: number) => void;
}

export default function WorkflowCard({ workflow, onPlay, onDuplicate, onDelete }: WorkflowCardProps) {

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20';
      case 'inactive': return 'bg-slate-500/15 text-slate-500 border-slate-500/20';
      default: return 'bg-amber-500/15 text-amber-500 border-amber-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'inactive': return <XCircle className="w-3.5 h-3.5" />;
      default: return <Clock className="w-3.5 h-3.5" />;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Link
      to={`/workflow/${workflow.id}`}
      className="group relative flex flex-col bg-card border border-border/60 rounded-2xl p-5 transition-all duration-300 hover:border-primary/40 hover:shadow-xl hover:-translate-y-1 overflow-hidden"
    >
      {/* Top Section */}
      <div className="flex items-start justify-between mb-4 z-10">
        <div className="flex items-center gap-4">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm ring-1 ring-inset ring-black/5 dark:ring-white/5"
            style={{ backgroundColor: `${workflow.color}15`, color: workflow.color }}
          >
            {workflow.icon || '⚡'}
          </div>
          <div>
            <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors line-clamp-1">
              {workflow.name}
            </h3>
            <div className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border mt-1.5 ",
              getStatusColor(workflow.status)
            )}>
              {getStatusIcon(workflow.status)}
              <span className="capitalize">{workflow.status}</span>
            </div>
          </div>
        </div>
        
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-6 line-clamp-2 leading-relaxed h-10">
        {workflow.description || <span className="italic opacity-50">No description provided</span>}
      </p>

      {/* Bottom Stats & Actions */}
      <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/60">
        <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
          <div className="flex items-center gap-1.5" title="Node Count">
            <Layers className="w-3.5 h-3.5" />
            <span>{workflow.node_count || 0}</span>
          </div>
          <div className="flex items-center gap-1.5" title="Total Executions">
            <Activity className="w-3.5 h-3.5" />
            <span>{workflow.execution_count}</span>
          </div>
          <div className="flex items-center gap-1.5" title="Last Run">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDate(workflow.last_executed_at)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button 
            onClick={(e) => onPlay(e, workflow.id)}
            className="p-1.5 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors text-muted-foreground"
            title="Execute Workflow"
          >
            <Play className="w-4 h-4" />
          </button>
          <button 
            onClick={(e) => onDuplicate(e, workflow.id)}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            title="Duplicate"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button 
            onClick={(e) => { 
              e.preventDefault(); 
              onDelete(workflow.id); 
            }}
            className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors text-muted-foreground"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Link>
  );
}
