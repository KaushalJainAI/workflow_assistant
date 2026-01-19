import { useState } from 'react';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Play,
  Search,
  Filter,
  ChevronDown,
  Eye,
  RotateCcw,
  Trash2,
  AlertCircle,
  Info,
  AlertTriangle,
  Bug,
  Download,
  RefreshCw,
  X
} from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug' | 'success';
  nodeName: string;
  message: string;
  details?: string;
}

interface Execution {
  id: string;
  workflowName: string;
  workflowId: string;
  status: 'success' | 'error' | 'running' | 'waiting';
  startedAt: string;
  finishedAt?: string;
  duration?: string;
  mode: 'manual' | 'trigger' | 'webhook';
  logs: LogEntry[];
}

const mockExecutions: Execution[] = [
  {
    id: 'exec-1',
    workflowName: 'Email Automation',
    workflowId: '1',
    status: 'success',
    startedAt: '2024-01-15 10:30:00',
    finishedAt: '2024-01-15 10:30:05',
    duration: '5s',
    mode: 'trigger',
    logs: [
      { id: 'l1', timestamp: '10:30:00.100', level: 'info', nodeName: 'Manual Trigger', message: 'Workflow started' },
      { id: 'l2', timestamp: '10:30:01.250', level: 'info', nodeName: 'HTTP Request', message: 'Request sent to api.example.com', details: 'Status: 200 OK' },
      { id: 'l3', timestamp: '10:30:03.400', level: 'success', nodeName: 'Set Data', message: 'Data transformation completed', details: 'Processed 150 items' },
      { id: 'l4', timestamp: '10:30:05.000', level: 'success', nodeName: 'Email', message: 'Email sent successfully' },
    ]
  },
  {
    id: 'exec-2',
    workflowName: 'Data Sync Pipeline',
    workflowId: '2',
    status: 'running',
    startedAt: '2024-01-15 10:25:00',
    mode: 'manual',
    logs: [
      { id: 'l5', timestamp: '10:25:00.100', level: 'info', nodeName: 'Manual Trigger', message: 'Workflow started' },
      { id: 'l6', timestamp: '10:25:05.500', level: 'info', nodeName: 'PostgreSQL', message: 'Connecting to database...' },
      { id: 'l7', timestamp: '10:25:10.200', level: 'warning', nodeName: 'PostgreSQL', message: 'Query returned more rows than expected', details: 'Expected: 100, Received: 1523' },
      { id: 'l8', timestamp: '10:25:15.000', level: 'info', nodeName: 'Function', message: 'Processing data...' },
    ]
  },
  {
    id: 'exec-3',
    workflowName: 'Slack Notifications',
    workflowId: '3',
    status: 'error',
    startedAt: '2024-01-15 09:15:00',
    finishedAt: '2024-01-15 09:15:02',
    duration: '2s',
    mode: 'webhook',
    logs: [
      { id: 'l9', timestamp: '09:15:00.100', level: 'info', nodeName: 'Webhook', message: 'Received webhook trigger' },
      { id: 'l10', timestamp: '09:15:01.000', level: 'info', nodeName: 'Set Data', message: 'Preparing message payload' },
      { id: 'l11', timestamp: '09:15:02.000', level: 'error', nodeName: 'Slack', message: 'Failed to send message: channel_not_found', details: 'Error: The specified channel #alerts was not found' },
    ]
  },
  {
    id: 'exec-4',
    workflowName: 'Customer Onboarding',
    workflowId: '4',
    status: 'success',
    startedAt: '2024-01-15 08:00:00',
    finishedAt: '2024-01-15 08:00:12',
    duration: '12s',
    mode: 'trigger',
    logs: [
      { id: 'l12', timestamp: '08:00:00.100', level: 'info', nodeName: 'Schedule Trigger', message: 'Scheduled execution started' },
      { id: 'l13', timestamp: '08:00:02.500', level: 'debug', nodeName: 'Function', message: 'Variable state: user_count = 42' },
      { id: 'l14', timestamp: '08:00:08.000', level: 'info', nodeName: 'HTTP Request', message: 'Fetched user data from CRM' },
      { id: 'l15', timestamp: '08:00:12.000', level: 'success', nodeName: 'Email', message: 'Welcome emails sent to 42 users' },
    ]
  },
];

export default function Executions() {
  const [searchQuery, setSearchQuery] = useState('');
  const [executions] = useState<Execution[]>(mockExecutions);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [expandedExecution, setExpandedExecution] = useState<string | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null);

  const filteredExecutions = executions.filter(e => {
    const matchesSearch = e.workflowName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || e.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Execution['status']) => {
    switch (status) {
      case 'success':
        return (
          <span className="flex items-center gap-1.5 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            <CheckCircle2 className="w-3 h-3" />
            Success
          </span>
        );
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
      case 'waiting':
        return (
          <span className="flex items-center gap-1.5 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
            <Clock className="w-3 h-3" />
            Waiting
          </span>
        );
    }
  };

  const getModeBadge = (mode: Execution['mode']) => {
    const colors = {
      manual: 'bg-purple-100 text-purple-700',
      trigger: 'bg-blue-100 text-blue-700',
      webhook: 'bg-orange-100 text-orange-700',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[mode]}`}>
        {mode}
      </span>
    );
  };

  const getLevelIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'info': return <Info className="w-3.5 h-3.5 text-blue-500" />;
      case 'success': return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />;
      case 'error': return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
      case 'debug': return <Bug className="w-3.5 h-3.5 text-purple-500" />;
    }
  };

  const getLevelColor = (level: LogEntry['level']) => {
    const colors = {
      info: 'text-blue-600',
      success: 'text-green-600',
      warning: 'text-yellow-600',
      error: 'text-red-600',
      debug: 'text-purple-600',
    };
    return colors[level];
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Executions</h1>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-2 text-sm border border-input rounded-md hover:bg-muted">
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by workflow name..."
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
              <option value="success">Success</option>
              <option value="error">Error</option>
              <option value="running">Running</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-muted-foreground" />
          </div>

          <button className="flex items-center gap-2 px-3 py-2 border border-input rounded-md hover:bg-muted">
            <Filter className="w-4 h-4" />
            More Filters
          </button>
        </div>
      </div>

      {/* Executions Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-muted/50 sticky top-0">
            <tr className="text-left text-sm text-muted-foreground">
              <th className="px-6 py-3 font-medium w-8"></th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Workflow</th>
              <th className="px-6 py-3 font-medium">Mode</th>
              <th className="px-6 py-3 font-medium">Started</th>
              <th className="px-6 py-3 font-medium">Duration</th>
              <th className="px-6 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredExecutions.map((execution) => (
              <>
                <tr 
                  key={execution.id} 
                  className={`hover:bg-muted/30 transition-colors cursor-pointer ${expandedExecution === execution.id ? 'bg-muted/30' : ''}`}
                  onClick={() => setExpandedExecution(expandedExecution === execution.id ? null : execution.id)}
                >
                  <td className="px-6 py-4">
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expandedExecution === execution.id ? 'rotate-180' : ''}`} />
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(execution.status)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium hover:text-primary">
                      {execution.workflowName}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {getModeBadge(execution.mode)}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {execution.startedAt}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {execution.duration || '—'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button 
                        className="p-1.5 hover:bg-muted rounded-md" 
                        title="View Details"
                        onClick={() => setSelectedExecution(execution)}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        className="p-1.5 hover:bg-muted rounded-md" 
                        title="Retry"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button 
                        className="p-1.5 hover:bg-muted rounded-md" 
                        title="Run Again"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                
                {/* Expanded Logs Row */}
                {expandedExecution === execution.id && (
                  <tr key={`${execution.id}-logs`}>
                    <td colSpan={7} className="px-6 py-4 bg-muted/20">
                      <div className="border border-border rounded-lg overflow-hidden">
                        <div className="bg-card px-4 py-2 border-b border-border flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Execution Logs</span>
                            <span className="px-1.5 py-0.5 bg-muted text-xs rounded">{execution.logs.length} entries</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Scroll for more ↓</span>
                            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                              <Download className="w-3 h-3" />
                              Export
                            </button>
                          </div>
                        </div>
                        <div className="max-h-80 overflow-y-auto bg-background scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                          {execution.logs.map((log, index) => (
                            <div key={log.id} className="px-4 py-2 border-b border-border last:border-0 hover:bg-muted/30">
                              <div className="flex items-start gap-3">
                                <span className="text-xs text-muted-foreground font-mono min-w-[20px]">
                                  {index + 1}.
                                </span>
                                <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                                  {log.timestamp}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {getLevelIcon(log.level)}
                                </div>
                                <span className="text-xs font-medium text-muted-foreground min-w-[100px]">
                                  {log.nodeName}
                                </span>
                                <span className={`text-sm flex-1 ${getLevelColor(log.level)}`}>
                                  {log.message}
                                </span>
                              </div>
                              {log.details && (
                                <div className="ml-[200px] mt-1 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded font-mono">
                                  {log.details}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>

        {filteredExecutions.length === 0 && (
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
                <h2 className="text-lg font-semibold">{selectedExecution.workflowName}</h2>
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
                  <p className="text-muted-foreground">Execution ID</p>
                  <p className="font-mono">{selectedExecution.id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Mode</p>
                  <p>{getModeBadge(selectedExecution.mode)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Started</p>
                  <p>{selectedExecution.startedAt}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Duration</p>
                  <p>{selectedExecution.duration || 'In Progress'}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">Logs</h3>
                  <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </button>
                </div>
                <div className="border border-border rounded-lg overflow-hidden">
                  {selectedExecution.logs.map((log) => (
                    <div key={log.id} className="px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30">
                      <div className="flex items-start gap-3">
                        <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                          {log.timestamp}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {getLevelIcon(log.level)}
                        </div>
                        <span className="text-sm font-medium text-muted-foreground min-w-[120px]">
                          {log.nodeName}
                        </span>
                        <span className={`text-sm flex-1 ${getLevelColor(log.level)}`}>
                          {log.message}
                        </span>
                      </div>
                      {log.details && (
                        <div className="ml-[200px] mt-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded font-mono">
                          {log.details}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
