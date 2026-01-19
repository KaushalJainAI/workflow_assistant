import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Play, 
  Clock, 
  CheckCircle2, 
  XCircle,
  FolderOpen,
  Tag,
  Filter
} from 'lucide-react';

interface Workflow {
  id: string;
  name: string;
  active: boolean;
  lastRun?: string;
  lastStatus?: 'success' | 'error' | 'running';
  tags: string[];
  createdAt: string;
}

const mockWorkflows: Workflow[] = [
  {
    id: '1',
    name: 'Email Automation',
    active: true,
    lastRun: '2 hours ago',
    lastStatus: 'success',
    tags: ['email', 'automation'],
    createdAt: '2024-01-10',
  },
  {
    id: '2',
    name: 'Data Sync Pipeline',
    active: true,
    lastRun: '5 minutes ago',
    lastStatus: 'running',
    tags: ['sync', 'database'],
    createdAt: '2024-01-08',
  },
  {
    id: '3',
    name: 'Slack Notifications',
    active: false,
    lastRun: '1 day ago',
    lastStatus: 'error',
    tags: ['slack', 'notifications'],
    createdAt: '2024-01-05',
  },
  {
    id: '4',
    name: 'Customer Onboarding',
    active: true,
    lastRun: '3 hours ago',
    lastStatus: 'success',
    tags: ['crm', 'onboarding'],
    createdAt: '2024-01-03',
  },
];

export default function WorkflowsDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [workflows] = useState<Workflow[]>(mockWorkflows);

  const filteredWorkflows = workflows.filter(w => 
    w.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusIcon = (status?: 'success' | 'error' | 'running') => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <Clock className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Workflows</h1>
            <Link 
              to="/workflows/new"
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Workflow
            </Link>
          </div>
          
          {/* Search and Filters */}
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
            <button className="flex items-center gap-2 px-3 py-2 border border-input rounded-md hover:bg-muted transition-colors">
              <FolderOpen className="w-4 h-4" />
              All Folders
            </button>
            <button className="flex items-center gap-2 px-3 py-2 border border-input rounded-md hover:bg-muted transition-colors">
              <Tag className="w-4 h-4" />
              Tags
            </button>
            <button className="flex items-center gap-2 px-3 py-2 border border-input rounded-md hover:bg-muted transition-colors">
              <Filter className="w-4 h-4" />
              Filter
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 flex gap-6 border-t border-border">
          <button className="py-3 border-b-2 border-primary text-sm font-medium">
            All ({workflows.length})
          </button>
          <button className="py-3 border-b-2 border-transparent text-sm text-muted-foreground hover:text-foreground">
            Active ({workflows.filter(w => w.active).length})
          </button>
          <button className="py-3 border-b-2 border-transparent text-sm text-muted-foreground hover:text-foreground">
            Inactive ({workflows.filter(w => !w.active).length})
          </button>
        </div>
      </div>

      {/* Workflow List */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-2">
          {filteredWorkflows.map((workflow) => (
            <Link
              key={workflow.id}
              to={`/workflow/${workflow.id}`}
              className="flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:border-primary/50 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-4">
                {/* Active Toggle */}
                <button 
                  className={`w-10 h-6 rounded-full transition-colors ${
                    workflow.active ? 'bg-green-500' : 'bg-muted'
                  }`}
                  onClick={(e) => e.preventDefault()}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    workflow.active ? 'translate-x-5' : 'translate-x-1'
                  }`} />
                </button>

                <div>
                  <h3 className="font-medium group-hover:text-primary transition-colors">
                    {workflow.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    {workflow.tags.map(tag => (
                      <span 
                        key={tag}
                        className="px-2 py-0.5 text-xs bg-muted rounded-full text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                {/* Last Run Status */}
                {workflow.lastRun && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {getStatusIcon(workflow.lastStatus)}
                    <span>{workflow.lastRun}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    className="p-2 hover:bg-muted rounded-md"
                    onClick={(e) => e.preventDefault()}
                    title="Execute"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <button 
                    className="p-2 hover:bg-muted rounded-md"
                    onClick={(e) => e.preventDefault()}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {filteredWorkflows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No workflows found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'Try a different search term' : 'Create your first workflow to get started'}
            </p>
            <Link 
              to="/workflows/new"
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
              Add Workflow
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
