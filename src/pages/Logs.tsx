import { useState } from 'react';
import { 
  Activity, 
  Search, 
  Filter,
  Download,
  ChevronDown,
  AlertCircle,
  Info,
  AlertTriangle,
  Bug,
  CheckCircle2,
  Clock,
  RefreshCw
} from 'lucide-react';
import Select from '../components/ui/Select';

type LogLevel = 'info' | 'warning' | 'error' | 'debug' | 'success';

interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  workflowName: string;
  workflowId: string;
  executionId: string;
  nodeName: string;
  message: string;
  details?: string;
}

const mockLogs: LogEntry[] = [
  {
    id: '1',
    timestamp: '2024-01-15 10:30:45.123',
    level: 'info',
    workflowName: 'Email Automation',
    workflowId: '1',
    executionId: 'exec-001',
    nodeName: 'HTTP Request',
    message: 'Request sent successfully to api.example.com',
    details: 'Status: 200 OK, Response time: 245ms'
  },
  {
    id: '2',
    timestamp: '2024-01-15 10:30:44.890',
    level: 'success',
    workflowName: 'Email Automation',
    workflowId: '1',
    executionId: 'exec-001',
    nodeName: 'Set Data',
    message: 'Data transformation completed',
    details: 'Processed 150 items'
  },
  {
    id: '3',
    timestamp: '2024-01-15 10:30:12.456',
    level: 'error',
    workflowName: 'Slack Notifications',
    workflowId: '3',
    executionId: 'exec-002',
    nodeName: 'Slack',
    message: 'Failed to send message: channel_not_found',
    details: 'Error: The specified channel #alerts was not found or has been archived'
  },
  {
    id: '4',
    timestamp: '2024-01-15 10:29:55.789',
    level: 'warning',
    workflowName: 'Data Sync Pipeline',
    workflowId: '2',
    executionId: 'exec-003',
    nodeName: 'PostgreSQL',
    message: 'Query returned more rows than expected',
    details: 'Expected: 100, Received: 1523. Consider adding LIMIT clause.'
  },
  {
    id: '5',
    timestamp: '2024-01-15 10:29:30.111',
    level: 'debug',
    workflowName: 'Customer Onboarding',
    workflowId: '4',
    executionId: 'exec-004',
    nodeName: 'Function',
    message: 'Variable state: user_count = 42',
  },
  {
    id: '6',
    timestamp: '2024-01-15 10:28:00.000',
    level: 'info',
    workflowName: 'Email Automation',
    workflowId: '1',
    executionId: 'exec-005',
    nodeName: 'Manual Trigger',
    message: 'Workflow execution started',
  },
  {
    id: '7',
    timestamp: '2024-01-15 10:27:45.555',
    level: 'error',
    workflowName: 'API Integration',
    workflowId: '5',
    executionId: 'exec-006',
    nodeName: 'OpenAI',
    message: 'Rate limit exceeded',
    details: 'Too many requests. Please retry after 60 seconds.'
  },
];

export default function Logs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [logs] = useState<LogEntry[]>(mockLogs);
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<string[]>([]);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.workflowName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.nodeName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = selectedLevel === 'all' || log.level === selectedLevel;
    return matchesSearch && matchesLevel;
  });

  const getLevelIcon = (level: LogLevel) => {
    switch (level) {
      case 'info': return <Info className="w-4 h-4 text-blue-500" />;
      case 'success': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'debug': return <Bug className="w-4 h-4 text-purple-500" />;
    }
  };

  const getLevelBadge = (level: LogLevel) => {
    const colors = {
      info: 'bg-blue-500/15 text-blue-400',
      success: 'bg-emerald-500/15 text-emerald-400',
      warning: 'bg-amber-500/15 text-amber-400',
      error: 'bg-red-500/15 text-red-400',
      debug: 'bg-purple-500/15 text-purple-400',
    };
    return (
      <span className={`px-2 py-0.5 rounded-md text-xs font-medium uppercase ${colors[level]}`}>
        {level}
      </span>
    );
  };

  const toggleExpand = (id: string) => {
    setExpandedLogs(prev => 
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  const logCounts = {
    all: logs.length,
    error: logs.filter(l => l.level === 'error').length,
    warning: logs.filter(l => l.level === 'warning').length,
    info: logs.filter(l => l.level === 'info').length,
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border/60 bg-card/80 backdrop-blur-xl px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-muted border border-border rounded-xl">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Logs</h1>
              <p className="text-sm text-muted-foreground">
                Monitor workflow executions and debug issues
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-all duration-200 ${
                autoRefresh ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 hover:bg-muted'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              Auto-refresh
            </button>
            <button className="flex items-center gap-2 px-3 py-2 border border-border/60 rounded-lg hover:bg-muted transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background/50 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200"
            />
          </div>

            <Select
              value={selectedLevel}
              onChange={setSelectedLevel}
              options={[
                { value: 'all', label: `All Levels (${logCounts.all})` },
                { value: 'error', label: `Errors (${logCounts.error})` },
                { value: 'warning', label: `Warnings (${logCounts.warning})` },
                { value: 'info', label: `Info (${logCounts.info})` },
                { value: 'debug', label: 'Debug' },
                { value: 'success', label: 'Success' },
              ]}
              className="w-[180px]"
            />

          <button className="flex items-center gap-2 px-3 py-2 border border-border/60 rounded-lg hover:bg-muted transition-colors">
            <Filter className="w-4 h-4" />
            More Filters
          </button>

          <button className="flex items-center gap-2 px-3 py-2 border border-border/60 rounded-lg hover:bg-muted transition-colors">
            <Clock className="w-4 h-4" />
            Last 24 hours
          </button>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-4 mt-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-medium text-red-400">{logCounts.error} errors</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-400">{logCounts.warning} warnings</span>
          </div>
        </div>
      </div>

      {/* Log Entries */}
      <div className="flex-1 overflow-auto">
        <div className="divide-y divide-border">
          {filteredLogs.map((log) => (
            <div 
              key={log.id} 
              className="px-6 py-3 hover:bg-muted/40 transition-colors duration-200 cursor-pointer"
              onClick={() => log.details && toggleExpand(log.id)}
            >
              <div className="flex items-start gap-4">
                <div className="flex items-center gap-2 min-w-[90px]">
                  {getLevelIcon(log.level)}
                  {getLevelBadge(log.level)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{log.workflowName}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-sm text-muted-foreground">{log.nodeName}</span>
                  </div>
                  <p className="text-sm">{log.message}</p>
                  
                  {expandedLogs.includes(log.id) && log.details && (
                    <div className="mt-2 p-3 bg-muted/60 rounded-lg border border-border/40 animate-scale-in">
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                        {log.details}
                      </pre>
                    </div>
                  )}
                </div>

                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {log.timestamp}
                </div>

                {log.details && (
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${
                    expandedLogs.includes(log.id) ? 'rotate-180' : ''
                  }`} />
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredLogs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
            <Activity className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No logs found</h3>
            <p className="text-muted-foreground">
              Logs will appear here when you execute workflows
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
