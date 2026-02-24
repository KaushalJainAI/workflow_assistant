import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus,
  FolderOpen,
  Zap,
  XCircle,
  Loader2, 
} from 'lucide-react';
import { toast } from 'sonner';
import { workflowsService, orchestratorService, type WorkflowListItem } from '../api';
import PageHeader from '../components/layout/PageHeader';
import SearchInput from '../components/ui/SearchInput';
import WorkflowCard from '../components/workflows/WorkflowCard';
import { cn } from '../lib/utils';

export default function WorkflowsDashboard() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
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

  const handleCreateWorkflow = async () => {
    try {
      setIsCreating(true);
      const newWorkflow = await workflowsService.create({
        name: 'Untitled Workflow',
        description: 'A new empty workflow',
        status: 'draft',
        nodes: [], // Explicitly empty
        edges: []
      });
      navigate(`/workflow/${newWorkflow.id}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to create workflow');
    } finally {
      setIsCreating(false);
    }
  };

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


  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <PageHeader 
        title="Workflows"
        subtitle={`${workflows.length} workflows • ${workflows.filter(w => w.status === 'active').length} active`}
        icon={Zap}
        actions={
          <button
            onClick={handleCreateWorkflow}
            disabled={isCreating}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-primary/20 active:scale-[0.98] font-medium whitespace-nowrap"
          >
            {isCreating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {isCreating ? 'Creating...' : 'New Workflow'}
          </button>
        }
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
            {[
              { value: '', label: 'All Status' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'draft', label: 'Draft' }
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setStatusFilter(option.value)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                  statusFilter === option.value
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "bg-card border border-border/60 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                )}
              >
                {option.label}
                {option.value === '' ? ` (${workflows.length})` : ` (${workflows.filter(w => w.status === option.value).length})`}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-[400px] group">
            <SearchInput
              placeholder="Search workflows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </PageHeader>

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
          <div className="text-center py-12 animate-fade-in">
            <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No workflows found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'Try a different search term' : 'Create your first workflow to get started'}
            </p>
            <button
              onClick={handleCreateWorkflow}
              disabled={isCreating}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm active:scale-[0.98] font-medium"
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {isCreating ? 'Creating Workflow...' : 'Create Workflow'}
            </button>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 stagger-children">
            {filteredWorkflows.map((workflow) => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                onPlay={handlePlay}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
