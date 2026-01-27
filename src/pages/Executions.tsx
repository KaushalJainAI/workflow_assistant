import { useState, useEffect, useCallback } from 'react';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Search,
  ChevronDown,
  Eye,
  AlertCircle,
  Info,
  AlertTriangle,
  RefreshCw,
  X,
  Loader2
} from 'lucide-react';
import { logsService, type ExecutionLog, type ExecutionDetail, type NodeLog } from '../api/logs';
import { workflowsService, type WorkflowListItem } from '../api/workflows';
import { toast } from 'sonner';
import { Layout } from 'lucide-react';

export default function Executions() {
  const [searchQuery, setSearchQuery] = useState('');
  const [executions, setExecutions] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedExecution, setSelectedExecution] = useState<ExecutionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // New state for sidebar
  const [activeWorkflows, setActiveWorkflows] = useState<WorkflowListItem[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);
  const [workflowsLoading, setWorkflowsLoading] = useState(true);

  const fetchExecutions = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { limit: 50 };
      if (selectedStatus !== 'all') {
        params.status = selectedStatus;
      }
      if (selectedWorkflowId) {
        params.workflow_id = selectedWorkflowId;
      }
      const data = await logsService.listExecutions(params);
      setExecutions(data.results);
    } catch (error) {
      console.error('Failed to fetch executions:', error);
      toast.error('Failed to load executions');
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, selectedWorkflowId]);

  // Fetch active workflows for the sidebar
  useEffect(() => {
    const fetchActiveWorkflows = async () => {
      try {
        setWorkflowsLoading(true);
        const data = await workflowsService.list('active');
        setActiveWorkflows(data);
      } catch (error) {
        console.error('Failed to fetch active workflows:', error);
        // Don't show error toast here to avoid cluttering if it fails silently
      } finally {
        setWorkflowsLoading(false);
      }
    };
    
    fetchActiveWorkflows();
  }, []);

  useEffect(() => {
    fetchExecutions();
  }, [fetchExecutions]);

  const handleViewDetails = async (executionId: string) => {
    try {
      setDetailLoading(true);
      const details = await logsService.getExecution(executionId);
      setSelectedExecution(details);
    } catch (error) {
      console.error('Failed to fetch execution details:', error);
      toast.error('Failed to load details');
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredExecutions = executions.filter(e => 
    e.workflow_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    e.execution_id.includes(searchQuery)
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'success':
        return (
          <span className="flex items-center gap-1.5 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            <CheckCircle2 className="w-3 h-3" />
            Success
          </span>
        );
      case 'failed':
      case 'error':
        return (
          <span className="flex items-center gap-1.5 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
            <XCircle className="w-3 h-3" />
            Error
          </span>
        );
      case 'running':
        return (
          <span className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
            <Clock className="w-3 h-3 animate-spin" />
            Running
          </span>
        );
      case 'pending':
      case 'waiting':
        return (
          <span className="flex items-center gap-1.5 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
            <Clock className="w-3 h-3" />
            Waiting
          </span>
        );
      default:
         return (
          <span className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
            {status}
          </span>
        );
    }
  };

  const getModeBadge = (mode: string) => {
    const colors: Record<string, string> = {
      manual: 'bg-purple-100 text-purple-700',
      schedule: 'bg-blue-100 text-blue-700',
      webhook: 'bg-orange-100 text-orange-700',
      api: 'bg-cyan-100 text-cyan-700',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[mode] || 'bg-gray-100 text-gray-700'}`}>
        {mode}
      </span>
    );
  };

  const getNodeStatusIcon = (status: NodeLog['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
      case 'failed': return <XCircle className="w-3.5 h-3.5 text-red-500" />;
      case 'running': return <Clock className="w-3.5 h-3.5 text-blue-500 animate-spin" />;
      case 'pending': return <Clock className="w-3.5 h-3.5 text-gray-400" />;
      case 'skipped': return <AlertCircle className="w-3.5 h-3.5 text-gray-400" />;
      default: return <Info className="w-3.5 h-3.5 text-blue-500" />;
    }
  };

  return (
    <div className="h-full flex">
      {/* Sidebar for Active Workflows */}
      <div className="w-64 border-r border-border bg-muted/10 flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold flex items-center gap-2">
            <Layout className="w-4 h-4" />
            Active Workflows
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <button
            onClick={() => setSelectedWorkflowId(null)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm mb-1 transition-colors flex items-center justify-between group ${
              selectedWorkflowId === null 
                ? 'bg-primary/10 text-primary font-medium' 
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>All Executions</span>
            {selectedWorkflowId === null && <CheckCircle2 className="w-3 h-3" />}
          </button>
          
          {workflowsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : activeWorkflows.length > 0 ? (
            <div className="space-y-0.5">
              {activeWorkflows.map(workflow => (
                <button
                  key={workflow.id}
                  onClick={() => setSelectedWorkflowId(workflow.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                    selectedWorkflowId === workflow.id 
                      ? 'bg-primary/10 text-primary font-medium' 
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                  <span className="truncate">{workflow.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 px-4 text-muted-foreground text-xs">
              No active workflows found. Activate workflows to see them here.
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Executions</h1>
          <div className="flex items-center gap-2">
            <button 
              onClick={fetchExecutions}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-input rounded-md hover:bg-muted"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by workflow name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Success</option>
              <option value="failed">Error</option>
              <option value="running">Running</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Executions Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-muted/50 sticky top-0">
            <tr className="text-left text-sm text-muted-foreground">
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Workflow</th>
              <th className="px-6 py-3 font-medium">Mode</th>
              <th className="px-6 py-3 font-medium">Started</th>
              <th className="px-6 py-3 font-medium">Duration</th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && executions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                   <div className="flex items-center justify-center gap-2">
                     <Loader2 className="w-4 h-4 animate-spin" />
                     Loading executions...
                   </div>
                </td>
              </tr>
            ) : filteredExecutions.map((execution) => (
              <tr 
                key={execution.execution_id} 
                className="hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => handleViewDetails(execution.execution_id)}
              >
                <td className="px-6 py-4">
                  {getStatusBadge(execution.status)}
                </td>
                <td className="px-6 py-4">
                  <span className="font-medium hover:text-primary">
                    {execution.workflow_name || 'Untitled Workflow'}
                  </span>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">
                    {execution.execution_id.slice(0, 8)}...
                  </div>
                </td>
                <td className="px-6 py-4">
                  {getModeBadge(execution.trigger_type)}
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  {new Date(execution.created_at).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  {execution.duration_ms ? `${(execution.duration_ms / 1000).toFixed(2)}s` : '—'}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <button 
                      className="p-1.5 hover:bg-muted rounded-md" 
                      title="View Details"
                      onClick={() => handleViewDetails(execution.execution_id)}
                    >
                      {detailLoading && selectedExecution?.execution_id === execution.execution_id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                    {/* Retry button can be implemented later */}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && filteredExecutions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <Clock className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No executions found</h3>
            <p className="text-muted-foreground">
              Executions will appear here when you run your workflows
            </p>
          </div>
        )}
      </div>

      {/* Execution Details Modal */}
      {selectedExecution && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                {getStatusBadge(selectedExecution.status)}
                <h2 className="text-lg font-semibold">{selectedExecution.workflow_name}</h2>
                <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                   {selectedExecution.execution_id}
                </span>
              </div>
              <button 
                onClick={() => setSelectedExecution(null)} 
                className="p-1.5 hover:bg-muted rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 border-b border-border shrink-0">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Trigger</p>
                  <p>{getModeBadge(selectedExecution.trigger_type)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Started</p>
                  <p>{new Date(selectedExecution.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Finished</p>
                  <p>{selectedExecution.completed_at ? new Date(selectedExecution.completed_at).toLocaleString() : '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Duration</p>
                  <p>{selectedExecution.duration_ms ? `${(selectedExecution.duration_ms / 1000).toFixed(2)}s` : 'Unknown'}</p>
                </div>
              </div>
              {selectedExecution.error_message && (
                 <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-md border border-red-200 dark:border-red-800">
                    <p className="font-semibold flex items-center gap-2">
                       <AlertTriangle className="w-4 h-4" />
                       Execution Error
                    </p>
                    <p className="mt-1 font-mono">{selectedExecution.error_message}</p>
                 </div>
              )}
            </div>

            <div className="flex-1 overflow-auto">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">Node Execution Logs</h3>
                  <button onClick={() => handleViewDetails(selectedExecution.execution_id)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </button>
                </div>
                <div className="border border-border rounded-lg overflow-hidden">
                  {selectedExecution.node_logs && selectedExecution.node_logs.length > 0 ? (
                      selectedExecution.node_logs.map((log) => (
                        <div key={log.id} className="px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30">
                          <div className="flex items-start gap-3">
                            <span className="text-xs text-muted-foreground font-mono whitespace-nowrap w-24">
                              {new Date(log.started_at).toLocaleTimeString()}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {getNodeStatusIcon(log.status)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">
                                        {log.node_type} 
                                        {log.node_name && <span className="text-muted-foreground ml-2 font-normal">({log.node_name})</span>}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {log.duration_ms ? `${log.duration_ms}ms` : ''}
                                    </span>
                                </div>
                                {log.error_message && (
                                    <p className="text-xs text-red-500 mt-1 font-mono break-all">
                                        {log.error_message}
                                    </p>
                                )}
                                {/* Expandable details could go here */}
                            </div>
                          </div>
                        </div>
                      ))
                  ) : (
                      <div className="p-8 text-center text-muted-foreground">
                          No node logs available
                      </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
