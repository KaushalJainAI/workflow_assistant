import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  FolderOpen,
  Clock,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  Copy,
  Play
} from 'lucide-react';
import { toast } from 'sonner';
import { workflowsService, orchestratorService, type WorkflowListItem } from '../api';

export default function WorkflowsDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Fetch workflows from API
  useEffect(() => {
    const fetchWorkflows = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await workflowsService.list(statusFilter || undefined);
        setWorkflows(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load workflows');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkflows();
  }, [statusFilter]);

  const filteredWorkflows = workflows.filter(w =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    
    try {
      await workflowsService.delete(id);
      setWorkflows(prev => prev.filter(w => w.id !== id));
      toast.success('Workflow deleted successfully');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete workflow');
    }
  };

  const handlePlay = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    try {
      // In a real app we might want to show a toast or navigate to executions
      const response = await orchestratorService.executeWorkflow(id);
      toast.success(`Execution started! ID: ${response.execution_id}`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to start execution');
    }
  };

  const handleDuplicate = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    try {
      const workflow = await workflowsService.get(id);
      const newWorkflow = await workflowsService.create({
        ...workflow,
        name: `${workflow.name} (Copy)`,
        status: 'draft',
        // Omit id, created_at, updated_at, execution stats
      });
      setWorkflows(prev => [{
        ...newWorkflow,
        node_count: newWorkflow.nodes?.length || 0,
        // Ensure other fields are present to satisfy WorkflowListItem
        last_executed_at: null,
        execution_count: 0
      } as WorkflowListItem, ...prev]);
      toast.success('Workflow duplicated successfully');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to duplicate workflow');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'inactive': return <XCircle className="w-4 h-4 text-gray-400" />;
      default: return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Workflows</h1>
              <p className="text-sm text-muted-foreground">
                {workflows.length} workflows • {workflows.filter(w => w.status === 'active').length} active
              </p>
            </div>
          </div>
          <Link
            to="/workflows/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Workflow
          </Link>
        </div>

        {/* Search and filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search workflows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Failed to load workflows</h3>
            <p className="text-muted-foreground">{error}</p>
          </div>
        ) : filteredWorkflows.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No workflows found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'Try a different search term' : 'Create your first workflow to get started'}
            </p>
            <Link
              to="/workflows/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
              Create Workflow
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredWorkflows.map((workflow) => (
              <Link
                key={workflow.id}
                to={`/workflow/${workflow.id}`}
                className="group bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                      style={{ backgroundColor: `${workflow.color}20` }}
                    >
                      {workflow.icon || '⚡'}
                    </div>
                    <div>
                      <h3 className="font-medium group-hover:text-primary transition-colors">
                        {workflow.name}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {getStatusIcon(workflow.status)}
                        <span className="capitalize">{workflow.status}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => handlePlay(e, workflow.id)}
                      className="p-1 hover:bg-muted rounded"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => handleDuplicate(e, workflow.id)}
                      className="p-1 hover:bg-muted rounded"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => { 
                        e.preventDefault(); 
                        handleDelete(workflow.id); 
                      }}
                      className="p-1 hover:bg-destructive/10 text-destructive rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {workflow.description || 'No description'}
                </p>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{workflow.node_count || 0} nodes</span>
                  <span>{workflow.execution_count} runs</span>
                  <span>Last run: {formatDate(workflow.last_executed_at)}</span>
                </div>

                {workflow.tags && workflow.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {workflow.tags.slice(0, 3).map((tag) => (
                      <span 
                        key={tag} 
                        className="px-2 py-0.5 bg-muted text-xs rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
