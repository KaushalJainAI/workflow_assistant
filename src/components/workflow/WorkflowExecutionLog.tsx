import { useState, useEffect, useCallback } from 'react';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Eye, 
  RefreshCw, 
  Loader2,
  Calendar,
  Activity
} from 'lucide-react';
import { logsService, type ExecutionLog, type ExecutionDetail, type NodeLog, type OrchestratorThought } from '../../api/logs';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import Select from '../ui/Select';
import ExecutionDetailModal from '../orchestrator/ExecutionDetailModal';

interface WorkflowExecutionLogProps {
  workflowId: number | null;
}

export default function WorkflowExecutionLog({ workflowId }: WorkflowExecutionLogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [executions, setExecutions] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedExecution, setSelectedExecution] = useState<ExecutionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeActivities, setActiveActivities] = useState<OrchestratorThought[]>([]);
  const [activeNarrative, setActiveNarrative] = useState<OrchestratorThought | null>(null);

  const fetchExecutions = useCallback(async (silent = false) => {
    if (!workflowId) return;
    try {
      if (!silent) setLoading(true);
      const params: any = { 
        limit: 50,
        workflow_id: workflowId
      };
      if (selectedStatus !== 'all') {
        params.status = selectedStatus;
      }
      const data = await logsService.listExecutions(params);
      setExecutions(data.results);
    } catch (error) {
      console.error('Failed to fetch executions:', error);
      if (!silent) toast.error('Failed to load executions');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [workflowId, selectedStatus]);

  // Polling for active executions
  useEffect(() => {
    if (!workflowId) return;
    
    fetchExecutions();
    
    const hasActiveExecutions = () => executions.some(e => 
      ['running', 'pending', 'waiting'].includes(e.status)
    );
    
    let interval: ReturnType<typeof setInterval> | null = null;
    
    if (hasActiveExecutions()) {
      interval = setInterval(() => {
        fetchExecutions(true);
      }, 5000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [workflowId, executions.length > 0 && executions.some(e => ['running', 'pending', 'waiting'].includes(e.status)), fetchExecutions]);

  useEffect(() => {
    if (workflowId) {
      fetchExecutions();
    }
  }, [workflowId, selectedStatus, fetchExecutions]);

  const handleViewDetails = async (executionId: string) => {
    try {
      setDetailLoading(true);
      const [details, activities, narrative] = await Promise.all([
        logsService.getExecution(executionId),
        logsService.getActivityLogs(executionId).catch(() => []),
        logsService.getNarrative(executionId).catch(() => null)
      ]);
      setSelectedExecution(details);
      setActiveActivities(activities);
      setActiveNarrative(narrative);
    } catch (error) {
      console.error('Failed to fetch execution details:', error);
      toast.error('Failed to load details');
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredExecutions = executions.filter(e => 
    e.execution_id.includes(searchQuery.toLowerCase())
  );

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

  const getModeBadge = (mode: string) => {
    const colors: Record<string, string> = {
      manual: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      schedule: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      webhook: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      api: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
    };
    return (
      <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium border uppercase tracking-wider", colors[mode] || 'bg-muted text-muted-foreground border-border')}>
        {mode}
      </span>
    );
  };


  if (!workflowId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
          <Activity className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-1">No Executions Yet</h3>
        <p className="text-muted-foreground max-w-sm">
          Save and run your workflow to see execution logs here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      {/* Mini Header */}
      <div className="border-b border-border bg-card px-4 py-3 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search Execution ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="shrink-0">
              <Select
                value={selectedStatus}
                onChange={setSelectedStatus}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'completed', label: 'Success' },
                  { value: 'failed', label: 'Error' },
                  { value: 'running', label: 'Running' },
                ]}
                className="w-[140px] h-9"
              />
            </div>
          </div>
          <button 
            onClick={() => fetchExecutions()}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-input rounded-md hover:bg-muted transition-colors shrink-0"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="bg-muted/50 sticky top-0 z-10">
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Execution ID</th>
              <th className="px-4 py-2.5">Mode</th>
              <th className="px-4 py-2.5">Started</th>
              <th className="px-4 py-2.5">Duration</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && executions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                   <div className="flex items-center justify-center gap-2">
                     <Loader2 className="w-4 h-4 animate-spin" />
                     Loading...
                   </div>
                </td>
              </tr>
            ) : filteredExecutions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Activity className="w-8 h-8 opacity-20" />
                    <p className="text-sm">No executions discovered</p>
                  </div>
                </td>
              </tr>
            ) : filteredExecutions.map((execution) => (
              <tr 
                key={execution.execution_id} 
                className="hover:bg-muted/30 transition-colors cursor-pointer group"
                onClick={() => handleViewDetails(execution.execution_id)}
              >
                <td className="px-4 py-3">
                  {getStatusBadge(execution.status)}
                </td>
                <td className="px-4 py-3">
                  <div className="font-mono text-xs font-medium">
                    {execution.execution_id.slice(0, 12)}...
                  </div>
                </td>
                <td className="px-4 py-3">
                  {getModeBadge(execution.trigger_type)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {new Date(execution.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                  {execution.duration_ms ? `${(execution.duration_ms / 1000).toFixed(2)}s` : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button 
                    className="p-1.5 hover:bg-muted rounded-md opacity-0 group-hover:opacity-100 transition-opacity" 
                    title="View Details"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewDetails(execution.execution_id);
                    }}
                  >
                    {detailLoading && selectedExecution?.execution_id === execution.execution_id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Execution Details Modal (Integrated) */}
      <ExecutionDetailModal 
        execution={selectedExecution}
        loading={detailLoading}
        activities={activeActivities}
        narrative={activeNarrative}
        onClose={() => setSelectedExecution(null)}
        onRefresh={handleViewDetails}
      />
    </div>
  );
}
