/**
 * Evals — does the agent still do the right thing after you change something?
 *
 * A suite is a set of cases with expected outcomes; a run scores the current
 * model and prompt against them. The number that matters is regressions: cases
 * that used to pass and now do not.
 */
import { LineChart, Play, TrendingUp, TrendingDown, Minus, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import PageHeader from '../components/layout/PageHeader';
import PreviewNotice from '../components/ui/PreviewNotice';

const SUITES = [
  { name: 'Invoice extraction accuracy', cases: 120, score: 94.2, delta: +1.8, model: 'gpt-4o-mini', run: '2h ago' },
  { name: 'Ticket classification', cases: 300, score: 88.6, delta: -2.4, model: 'claude-sonnet-4-6', run: '6h ago' },
  { name: 'GSTIN validation', cases: 64, score: 100, delta: 0, model: 'gpt-4o-mini', run: '1d ago' },
  { name: 'Reply tone & house style', cases: 45, score: 76.0, delta: +4.1, model: 'claude-sonnet-4-6', run: '2d ago' },
];

const CASES = [
  { id: 'inv-011', input: 'Handwritten total, smudged', expected: '₹8,650', got: '₹8,650', pass: true },
  { id: 'inv-024', input: 'Two invoices in one PDF', expected: '2 records', got: '1 record', pass: false },
  { id: 'inv-037', input: 'Rounded-off line, IGST split', expected: '₹48,200', got: '₹48,200', pass: true },
  { id: 'inv-052', input: 'Vendor name in Devanagari', expected: 'श्री ट्रेडर्स', got: 'Shree Traders', pass: false },
  { id: 'inv-068', input: 'Credit note, negative total', expected: '-₹4,100', got: '-₹4,100', pass: true },
];

function Delta({ v }: { v: number }) {
  if (v === 0) return <span className="flex items-center gap-1 text-muted-foreground text-[12px]"><Minus className="w-3 h-3" />no change</span>;
  const up = v > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn('flex items-center gap-1 text-[12px] font-semibold', up ? 'text-success' : 'text-destructive')}>
      <Icon className="w-3 h-3" />
      {up ? '+' : ''}{v.toFixed(1)} pts
    </span>
  );
}

export default function Evals() {
  const regressions = SUITES.filter((s) => s.delta < 0);

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        icon={LineChart}
        title="Evals"
        subtitle={`${SUITES.length} suites · ${SUITES.reduce((n, s) => n + s.cases, 0)} cases`}
        actions={
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded font-semibold text-sm hover:bg-primary/90">
            <Play className="w-4 h-4" />
            Run all suites
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <PreviewNotice what="Evals" />

        {regressions.length > 0 && (
          <div className="flex items-start gap-2.5 px-3 py-2 mb-5 rounded border border-red-200 bg-destructive-subtle text-[13px] text-destructive">
            <TrendingDown className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              <strong className="font-semibold">{regressions.length} suite regressed</strong> since the last run
              — {regressions.map((r) => r.name).join(', ')}.
            </span>
          </div>
        )}

        <div className="border border-border rounded overflow-hidden bg-card mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary border-b border-border text-left">
                {['Suite', 'Model', 'Cases', 'Score', 'Change', 'Last run'].map((h) => (
                  <th key={h} className="px-4 py-2 font-semibold text-[12px] text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SUITES.map((s) => (
                <tr key={s.name} className="border-b border-border last:border-b-0 hover:bg-secondary">
                  <td className="px-4 py-2.5 font-medium">{s.name}</td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-muted-foreground">{s.model}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{s.cases}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums font-semibold w-12">{s.score.toFixed(1)}%</span>
                      <div className="w-24 h-1.5 bg-secondary rounded overflow-hidden">
                        <span
                          className={cn('block h-full rounded', s.score >= 90 ? 'bg-success' : s.score >= 80 ? 'bg-warning' : 'bg-destructive')}
                          style={{ width: `${s.score}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><Delta v={s.delta} /></td>
                  <td className="px-4 py-2.5 text-[12px] text-muted-foreground">{s.run}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="font-semibold mb-2">Invoice extraction accuracy — failing cases first</h2>
        <div className="border border-border rounded overflow-hidden bg-card">
          {CASES.sort((a, b) => Number(a.pass) - Number(b.pass)).map((c) => (
            <div key={c.id} className="flex items-center gap-4 px-4 py-2.5 border-b border-border last:border-b-0">
              {c.pass
                ? <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                : <XCircle className="w-4 h-4 text-destructive shrink-0" />}
              <span className="font-mono text-[12px] text-muted-foreground w-20">{c.id}</span>
              <span className="text-[13px] flex-1 truncate">{c.input}</span>
              <span className="text-[12px] text-muted-foreground w-32 truncate text-right">want {c.expected}</span>
              <span className={cn('text-[12px] w-32 truncate text-right font-medium', c.pass ? 'text-muted-foreground' : 'text-destructive')}>
                got {c.got}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
