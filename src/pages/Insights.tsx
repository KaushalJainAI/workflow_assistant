import InsightsDashboard from '../components/billing/InsightsDashboard';

export default function Insights() {
  return (
    <div className="h-full flex flex-col p-8 overflow-y-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Insights</h1>
        <p className="text-sm text-muted-foreground mt-1.5">Analyze your workflow performance and ROI</p>
      </div>

      <InsightsDashboard />
    </div>
  );
}
