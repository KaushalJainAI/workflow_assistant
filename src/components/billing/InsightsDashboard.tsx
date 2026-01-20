import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Activity, 
  Clock, 
  Search,
  Filter,
  Download,
  DollarSign,
  Cpu,
  Users,
  Database,
  Globe,
  Zap,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from 'lucide-react';

// Types and Mock Data
type TimeRange = '7d' | '14d' | '30d';

interface WorkflowMetric {
  id: string;
  name: string;
  executions: number;
  failures: number;
  avgRuntime: string;
  timeSaved: string;
  lastRun: string;
}

interface ChartDataPoint {
  date: string;
  successful: number;
  failed: number;
}

const MOCK_WORKFLOWS: WorkflowMetric[] = [
  { id: '1', name: 'Lead Enrichment Pipeline', executions: 12450, failures: 124, avgRuntime: '240ms', timeSaved: '45h', lastRun: '2 mins ago' },
  { id: '2', name: 'Daily Slack Report', executions: 30, failures: 0, avgRuntime: '1.2s', timeSaved: '5h', lastRun: '4 hrs ago' },
  { id: '3', name: 'Customer Onboarding', executions: 850, failures: 42, avgRuntime: '450ms', timeSaved: '12h 30m', lastRun: '10 mins ago' },
  { id: '4', name: 'Invoice Processing', executions: 240, failures: 12, avgRuntime: '3.5s', timeSaved: '8h 15m', lastRun: '1 day ago' },
  { id: '5', name: 'Support Ticket Routing', executions: 4500, failures: 85, avgRuntime: '180ms', timeSaved: '22h', lastRun: '5 mins ago' },
];

const BASE_DAILY_API_USAGE = [
  { provider: 'OpenAI (GPT-4)', calls: 1100, cost: 3.20, icon: Zap, color: 'text-green-500 bg-green-500/10' },
  { provider: 'Anthropic (Claude)', calls: 580, cost: 1.80, icon: Zap, color: 'text-purple-500 bg-purple-500/10' },
  { provider: 'Internal DB', calls: 3200, cost: 0, icon: Database, color: 'text-blue-500 bg-blue-500/10' },
  { provider: 'Scraping API', calls: 230, cost: 0.90, icon: Globe, color: 'text-orange-500 bg-orange-500/10' },
];

const SYSTEM_HEALTH = {
  cpu: 42,
  memory: 65,
  storage: 28,
  activeStreams: 12,
  pendingApprovals: 3
};

const generateChartData = (days: number): ChartDataPoint[] => {
  return Array.from({ length: days }).map((_, i) => ({
    date: new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    successful: Math.floor(Math.random() * 500) + 100,
    failed: Math.floor(Math.random() * 50),
  }));
};

const WorkflowDetailView = ({ workflow, onClose }: { workflow: WorkflowMetric; onClose: () => void }) => {
  const navigate = useNavigate();
  
  // Mock API cost for this workflow
  const estimatedApiCost = (workflow.executions * 0.0042).toFixed(2);

  return (
    <div className="space-y-6 animate-in slide-in-from-right-10 duration-500">
      <button 
        onClick={onClose}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{workflow.name}</h2>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
             <span className="flex items-center gap-1">
               <Clock className="w-4 h-4" />
               Last run: {workflow.lastRun}
             </span>
             <span className="flex items-center gap-1">
               <Activity className="w-4 h-4" />
               Avg Runtime: {workflow.avgRuntime}
             </span>
          </div>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => navigate(`/workflows`)} 
             className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 flex items-center gap-2"
           >
             Edit Workflow
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
           <p className="text-sm font-medium text-muted-foreground mb-1">Total Executions</p>
           <h3 className="text-3xl font-bold">{workflow.executions.toLocaleString()}</h3>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
           <p className="text-sm font-medium text-muted-foreground mb-1">Success Rate</p>
           <h3 className="text-3xl font-bold text-green-500">
             {((1 - (workflow.failures / workflow.executions)) * 100).toFixed(1)}%
           </h3>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
           <p className="text-sm font-medium text-muted-foreground mb-1">Total Time Saved</p>
           <h3 className="text-3xl font-bold text-blue-500">{workflow.timeSaved}</h3>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
           <p className="text-sm font-medium text-muted-foreground mb-1">Est. API Cost</p>
           <h3 className="text-3xl font-bold text-purple-500">${estimatedApiCost}</h3>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col max-h-[400px]">
        <div className="p-4 border-b border-border bg-muted/30 shrink-0">
          <h3 className="font-semibold">Recent Executions</h3>
        </div>
        <div className="overflow-y-auto">
          <table className="w-full text-sm text-left">
             <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border sticky top-0 bg-card z-10">
                <tr>
                  <th className="px-6 py-3 bg-muted/50">Status</th>
                  <th className="px-6 py-3 bg-muted/50">Started</th>
                  <th className="px-6 py-3 bg-muted/50">Duration</th>
                  <th className="px-6 py-3 bg-muted/50">Cost (Est.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                 {Array.from({ length: 15 }).map((_, i) => (
                   <tr key={i} className="hover:bg-muted/30">
                      <td className="px-6 py-4">
                        {i % 5 === 2 ? (
                          <span className="flex items-center gap-2 text-red-500 font-medium select-none">
                             <XCircle className="w-4 h-4" /> Failed
                          </span>
                        ) : (
                          <span className="flex items-center gap-2 text-green-500 font-medium select-none">
                             <CheckCircle2 className="w-4 h-4" /> Success
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {new Date(Date.now() - i * 1000 * 60 * 15).toLocaleTimeString()}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                         {Math.floor(Math.random() * 500 + 100)}ms
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                         ${(Math.random() * 0.05).toFixed(4)}
                      </td>
                   </tr>
                 ))}
              </tbody>
          </table>
        </div>
      </div>
       
       <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-6 flex gap-4 items-start">
          <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg text-blue-600 dark:text-blue-200">
             <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-blue-900 dark:text-blue-100">Optimization Tip</h4>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              This workflow has a high frequency of identical API calls. Consider enabling caching on the "Enrich Company" node to reduce costs by up to 40%.
            </p>
          </div>
       </div>

    </div>
  );
};

export default function InsightsDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>('14d');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowMetric | null>(null);

  // Derived Data
  const days = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : 30;
  const chartData = useMemo(() => generateChartData(days), [days]);
  
  const totalExecutions = chartData.reduce((acc: number, curr: ChartDataPoint) => acc + curr.successful + curr.failed, 0);
  const estimatedTimeSaved = Math.round(totalExecutions * 2 / 60); // Assuming 2 mins saved per execution
  
  // Calculate dynamic API usage based on days
  const apiUsageStats = useMemo(() => {
    return BASE_DAILY_API_USAGE.map(usage => ({
      ...usage,
      calls: usage.calls * days,
      cost: usage.cost * days
    }));
  }, [days]);

  const totalApiCost = apiUsageStats.reduce((acc, curr) => acc + curr.cost, 0);

  // Max value for chart scaling
  const maxChartValue = Math.max(...chartData.map((d: ChartDataPoint) => d.successful + d.failed));

  const filteredWorkflows = MOCK_WORKFLOWS.filter(w => 
    w.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedWorkflow) {
    return <WorkflowDetailView workflow={selectedWorkflow} onClose={() => setSelectedWorkflow(null)} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System Insights</h2>
          <p className="text-muted-foreground">Detailed metrics on performance, costs, and system health</p>
        </div>
        
        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg border border-border">
          {(['7d', '14d', '30d'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                timeRange === range 
                  ? 'bg-card text-primary shadow-sm border border-border/50' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Executions */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm relative overflow-hidden group hover:border-primary/50 transition-colors">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Activity className="w-5 h-5" />
            </div>
            <span className="flex items-center gap-1 text-xs font-medium text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
              +12.5%
            </span>
          </div>
          <p className="text-sm font-medium text-muted-foreground">Total Executions</p>
          <h3 className="text-2xl font-bold mt-1">{totalExecutions.toLocaleString()}</h3>
        </div>

        {/* Time Saved */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm relative overflow-hidden group hover:border-primary/50 transition-colors">
          <div className="flex justify-between items-start mb-2">
             <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
              <Clock className="w-5 h-5" />
            </div>
            <span className="flex items-center gap-1 text-xs font-medium text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
              +8.2%
            </span>
          </div>
          <p className="text-sm font-medium text-muted-foreground">Hours Saved</p>
          <h3 className="text-2xl font-bold mt-1">{estimatedTimeSaved}h</h3>
        </div>

        {/* Total Cost */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm relative overflow-hidden group hover:border-primary/50 transition-colors">
           <div className="flex justify-between items-start mb-2">
             <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-sm font-medium text-muted-foreground">Est. API Cost</p>
          <h3 className="text-2xl font-bold mt-1">${totalApiCost.toFixed(2)}</h3>
        </div>

        {/* Pending Approvals */}
         <div className="bg-card border border-border rounded-xl p-5 shadow-sm relative overflow-hidden group hover:border-primary/50 transition-colors">
           <div className="flex justify-between items-start mb-2">
             <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500">
              <Users className="w-5 h-5" />
            </div>
            {SYSTEM_HEALTH.pendingApprovals > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </div>
          <p className="text-sm font-medium text-muted-foreground">Pending Approvals</p>
          <h3 className="text-2xl font-bold mt-1">{SYSTEM_HEALTH.pendingApprovals}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Performance Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Execution Trends
            </h3>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500/80"></span>
                <span className="text-muted-foreground">Success</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/80"></span>
                <span className="text-muted-foreground">Failed</span>
              </div>
            </div>
          </div>
          
          <div className="h-72 flex items-end justify-between gap-1 relative pl-10 pb-6">
            {/* Y-Axis Labels */}
            <div className="absolute left-0 top-0 bottom-6 w-8 flex flex-col justify-between text-xs text-muted-foreground text-right pr-2">
              <span>{maxChartValue}</span>
              <span>{Math.round(maxChartValue * 0.5)}</span>
              <span>0</span>
            </div>
            
            {/* Chart Bars */}
            {chartData.map((data, i) => {
              const successHeight = (data.successful / maxChartValue) * 100;
              const failHeight = (data.failed / maxChartValue) * 100;
              
              return (
                <div key={i} className="flex-1 flex flex-col justify-end h-full gap-0.5 group relative hover:opacity-90">
                  <div className="absolute bottom-[100%] left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 bg-popover text-popover-foreground text-xs p-2 rounded shadow-lg border border-border whitespace-nowrap">
                    <div className="font-semibold mb-1">{data.date}</div>
                    <div className="text-green-500">Success: {data.successful}</div>
                    <div className="text-red-500">Failed: {data.failed}</div>
                  </div>

                  {data.failed > 0 && (
                    <div className="w-full bg-red-500/80 rounded-t-[1px]" style={{ height: `${failHeight}%` }} />
                  )}
                  <div className="w-full bg-emerald-500/80 rounded-t-sm" style={{ height: `${successHeight}%` }} />
                  
                  {(i % Math.ceil(days / 6) === 0) && (
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground whitespace-nowrap">
                      {data.date}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* System Health & Costs */}
        <div className="space-y-6">
          {/* API Costs Breakdown */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              API Cost Estimate
            </h3>
            <div className="space-y-4">
              {apiUsageStats.map((usage) => (
                <div key={usage.provider} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-md ${usage.color}`}>
                      <usage.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{usage.provider}</p>
                      <p className="text-xs text-muted-foreground">{usage.calls.toLocaleString()} calls</p>
                    </div>
                  </div>
                  <span className="font-bold text-sm">${usage.cost.toFixed(2)}</span>
                </div>
              ))}
              <div className="pt-4 border-t border-border mt-2 flex justify-between items-center">
                <span className="text-sm font-medium">Total</span>
                <span className="text-lg font-bold">${totalApiCost.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* System Load */}
           <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              System Status
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-secondary/50 rounded-lg text-center">
                <span className="text-2xl font-bold text-primary">{SYSTEM_HEALTH.cpu}%</span>
                <p className="text-xs text-muted-foreground">CPU Usage</p>
              </div>
              <div className="p-3 bg-secondary/50 rounded-lg text-center">
                <span className="text-2xl font-bold text-blue-500">{SYSTEM_HEALTH.activeStreams}</span>
                <p className="text-xs text-muted-foreground">Active Streams</p>
              </div>
              <div className="col-span-2 space-y-2 mt-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Rate Limit (Executions)</span>
                  <span>45%</span>
                </div>
                <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                   <div className="h-full bg-green-500 w-[45%]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Performance Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <h3 className="font-semibold text-lg">Granular Performance</h3>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search workflows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button className="p-2 border border-input rounded-md hover:bg-muted" title="Filter">
              <Filter className="w-4 h-4 text-muted-foreground" />
            </button>
            <button className="p-2 border border-input rounded-md hover:bg-muted" title="Export CSV">
              <Download className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
              <tr>
                <th className="px-6 py-3">Workflow Name</th>
                <th className="px-6 py-3 text-right">Executions</th>
                <th className="px-6 py-3 text-right">Failure Rate</th>
                <th className="px-6 py-3 text-right">Avg Runtime</th>
                <th className="px-6 py-3 text-right">Time Saved</th>
                <th className="px-6 py-3 text-right">Last Run</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredWorkflows.map((workflow) => (
                <tr 
                  key={workflow.id} 
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedWorkflow(workflow)}
                >
                  <td className="px-6 py-4 font-medium flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-blue-500 opacity-20" />
                    {workflow.name}
                  </td>
                  <td className="px-6 py-4 text-right">{workflow.executions.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      workflow.failures > 0 
                        ? 'bg-red-500/10 text-red-500' 
                        : 'bg-green-500/10 text-green-500'
                    }`}>
                      {workflow.failures > 0 ? `${((workflow.failures / workflow.executions) * 100).toFixed(1)}%` : '0.00%'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-muted-foreground">{workflow.avgRuntime}</td>
                  <td className="px-6 py-4 text-right font-semibold text-primary">{workflow.timeSaved}</td>
                  <td className="px-6 py-4 text-right text-muted-foreground">{workflow.lastRun}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
