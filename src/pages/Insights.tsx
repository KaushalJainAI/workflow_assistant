import InsightsDashboard from '../components/billing/InsightsDashboard';

export default function Insights() {
  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Insights</h1>
        <p className="text-muted-foreground mt-2">Analyze your workflow performance and ROI</p>
      </div>

      <InsightsDashboard />
    </div>
  );
}
