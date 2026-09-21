/**
 * Insights — what agents cost, did, and need.
 *
 * Promoted out of Settings (2026-09-21 plan): a page buried one tab deep is
 * a page nobody opens, and this one answers "is any of this working?" which
 * deserves a top-level destination. The Settings → Insights tab stays as an
 * embed of the same component so existing links keep working.
 */
import InsightsDashboard from '../components/billing/InsightsDashboard';

export default function Insights() {
  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <InsightsDashboard />
      </div>
    </div>
  );
}
