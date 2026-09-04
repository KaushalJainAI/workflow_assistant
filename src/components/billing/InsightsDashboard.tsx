import { useState, useMemo, useEffect } from 'react';
import {
  Activity,
  Clock,
  DollarSign,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { authService, type UsageInsight } from '../../api/auth';

// How many days of daily_stats each range shows. The backend returns up to the
// last 30 days; the toggle slices that window client-side.
const RANGE_DAYS = { '7d': 7, '14d': 14, '30d': 30 } as const;
type TimeRange = keyof typeof RANGE_DAYS;

interface ChartDataPoint {
  date: string;
  executions: number;
}

export default function InsightsDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>('14d');
  const [insights, setInsights] = useState<UsageInsight | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchInsights = async () => {
      setIsLoading(true);
      setError(false);
      try {
        const data = await authService.getUsageInsights();
        if (!cancelled) setInsights(data);
      } catch (err) {
        console.error('Failed to fetch insights:', err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchInsights();
    return () => {
      cancelled = true;
    };
  }, []);

  // daily_stats arrives newest-first; oldest-first reads left-to-right on the
  // chart. Slice to the selected window, then order for display.
  const chartData: ChartDataPoint[] = useMemo(() => {
    const stats = insights?.daily_stats ?? [];
    return stats
      .slice(0, RANGE_DAYS[timeRange])
      .map((stat) => ({
        date: new Date(stat.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        executions: stat.execute_count,
      }))
      .reverse();
  }, [insights, timeRange]);

  const totalExecutions = insights?.total_executions ?? 0;
  const estimatedTimeSaved = Math.round(insights?.hours_saved ?? 0);
  const totalApiCost = parseFloat(insights?.total_cost ?? '0');
  const successRate = insights?.success_rate ?? 100;
  const tier = insights?.tier ?? 'free';
  const creditsRemaining = insights?.credits_remaining ?? 0;

  const maxChartValue = Math.max(...chartData.map((d) => d.executions), 10);
  const hasChartData = chartData.some((d) => d.executions > 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground animate-in fade-in duration-500">
        <Activity className="w-5 h-5 mr-2 animate-pulse" />
        Loading insights…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2 animate-in fade-in duration-500">
        <p>Could not load usage insights.</p>
        <p className="text-xs">Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card/50 p-6 rounded-xl border border-border/60 backdrop-blur-sm">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Insights</h2>
          <p className="text-muted-foreground">Your usage, cost, and execution activity</p>
        </div>

        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg border border-border">
          {(Object.keys(RANGE_DAYS) as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                timeRange === range
                  ? 'bg-background text-primary shadow-sm border border-border/50'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        {/* Total Executions */}
        <div className="bg-card border border-border/60 rounded-xl p-5 shadow-sm relative overflow-hidden group hover:border-primary/50 transition-all hover:shadow-md">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <p className="text-sm font-medium text-muted-foreground">Total executions</p>
          <h3 className="text-2xl font-bold mt-1">{totalExecutions.toLocaleString()}</h3>
        </div>

        {/* Time Saved */}
        <div className="bg-card border border-border/60 rounded-xl p-5 shadow-sm relative overflow-hidden group hover:border-primary/50 transition-all hover:shadow-md">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
              <Clock className="w-5 h-5" />
            </div>
            <span className="flex items-center gap-1 text-xs font-medium text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full">
              ROI
            </span>
          </div>
          <p className="text-sm font-medium text-muted-foreground">Time saved</p>
          <h3 className="text-2xl font-bold mt-1">{estimatedTimeSaved}h</h3>
        </div>

        {/* Total Cost */}
        <div className="bg-card border border-border/60 rounded-xl p-5 shadow-sm relative overflow-hidden group hover:border-primary/50 transition-all hover:shadow-md">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-sm font-medium text-muted-foreground">Est. API cost</p>
          <h3 className="text-2xl font-bold mt-1">${totalApiCost.toFixed(4)}</h3>
        </div>

        {/* Success Rate */}
        <div className="bg-card border border-border/60 rounded-xl p-5 shadow-sm relative overflow-hidden group hover:border-primary/50 transition-all hover:shadow-md">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-sm font-medium text-muted-foreground">Success rate</p>
          <h3 className="text-2xl font-bold mt-1">{successRate.toFixed(1)}%</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Execution Trends Chart */}
        <div className="lg:col-span-2 bg-card border border-border/60 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Execution trends
            </h3>
            <div className="flex items-center gap-2 text-sm">
              <span className="w-3 h-3 rounded-full bg-emerald-500/80"></span>
              <span className="text-muted-foreground">Executions</span>
            </div>
          </div>

          {hasChartData ? (
            <div className="h-72 flex items-end justify-between gap-1 relative pl-10 pb-6">
              {/* Y-Axis Labels */}
              <div className="absolute left-0 top-0 bottom-6 w-8 flex flex-col justify-between text-xs text-muted-foreground text-right pr-2">
                <span>{maxChartValue}</span>
                <span>{Math.round(maxChartValue * 0.5)}</span>
                <span>0</span>
              </div>

              {/* Chart Bars */}
              {chartData.map((data, i) => {
                const height = (data.executions / maxChartValue) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col justify-end h-full gap-0.5 group relative hover:opacity-90">
                    <div className="absolute bottom-[100%] left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 bg-popover text-popover-foreground text-xs p-2 rounded shadow-lg border border-border whitespace-nowrap">
                      <div className="font-semibold mb-1">{data.date}</div>
                      <div className="text-emerald-500">Executions: {data.executions}</div>
                    </div>
                    <div className="w-full bg-primary/60 rounded-t-sm min-h-[2px]" style={{ height: `${height}%` }} />

                    {i % Math.ceil(chartData.length / 6) === 0 && (
                      <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground whitespace-nowrap">
                        {data.date}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-72 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Activity className="w-8 h-8 opacity-40" />
              <p className="text-sm">No execution activity in this period yet.</p>
            </div>
          )}
        </div>

        {/* Plan & credits */}
        <div className="space-y-6">
          <div className="bg-card border border-border/60 rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Plan &amp; credits
            </h3>
            <div className="space-y-4">
              <div className="p-3 bg-secondary/50 rounded-lg border border-border/50 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current plan</span>
                <span className="text-sm font-semibold capitalize">{tier}</span>
              </div>
              <div className="p-3 bg-secondary/50 rounded-lg border border-border/50 text-center">
                <span className="text-2xl font-bold text-primary">{creditsRemaining.toLocaleString()}</span>
                <p className="text-xs text-muted-foreground mt-1">Credits remaining</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
