/**
 * Extract — turn a pile of documents into rows.
 *
 * You define the fields once, point it at a folder or an inbox, and it fills a
 * table. Anything the model is unsure about is flagged for review rather than
 * quietly guessed, which is what makes the output usable for accounting.
 */
import { ScanText, Plus, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import PageHeader from '../components/layout/PageHeader';
import PreviewNotice from '../components/ui/PreviewNotice';

const SCHEMAS = [
  { name: 'Purchase invoices', fields: 9, source: 'Gmail · label “invoices”', docs: 34, review: 2 },
  { name: 'Vendor GST certificates', fields: 4, source: 'Drive · /compliance', docs: 18, review: 0 },
  { name: 'Delivery challans', fields: 6, source: 'Manual upload', docs: 51, review: 5 },
];

const ROWS = [
  { doc: 'invoice_4471.pdf', vendor: 'Shree Traders', date: '2026-07-12', gstin: '27AAECS1234F1Z5', total: '₹48,200', conf: 0.99 },
  { doc: 'invoice_4472.pdf', vendor: 'Acme Supplies', date: '2026-07-14', gstin: '29AAACA5678M1Z2', total: '₹12,750', conf: 0.97 },
  { doc: 'invoice_4473.pdf', vendor: 'Baxter Traders', date: '2026-07-15', gstin: '24AABCB9012K1Z8', total: '₹8,650', conf: 0.62 },
  { doc: 'invoice_4474.pdf', vendor: 'Cole & Co', date: '2026-07-18', gstin: '27AADCC3456L1Z0', total: '₹69,600', conf: 0.94 },
  { doc: 'invoice_4475.pdf', vendor: 'Nirmal Packaging', date: '2026-07-21', gstin: '27AAFCN7890P1Z3', total: '₹5,120', conf: 0.41 },
];

const NEEDS_REVIEW = 0.8;

export default function Extract() {
  const flagged = ROWS.filter((r) => r.conf < NEEDS_REVIEW).length;

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        icon={ScanText}
        title="Extract"
        subtitle="Pull structured fields out of documents"
        actions={
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded font-semibold text-sm hover:bg-primary/90">
            <Plus className="w-4 h-4" />
            New schema
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <PreviewNotice what="Extract" />

        <div className="grid gap-3 md:grid-cols-3 mb-6">
          {SCHEMAS.map((s) => (
            <button key={s.name} className="text-left bg-card border border-border rounded p-4 hover:border-border-strong transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">{s.name}</h3>
              </div>
              <p className="text-[12px] text-muted-foreground mb-3">{s.fields} fields · {s.source}</p>
              <div className="flex items-center gap-3 text-[12px]">
                <span className="text-muted-foreground tabular-nums">{s.docs} documents</span>
                {s.review > 0 ? (
                  <span className="flex items-center gap-1 text-warning font-semibold">
                    <AlertTriangle className="w-3 h-3" />
                    {s.review} to review
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-success font-semibold">
                    <CheckCircle2 className="w-3 h-3" />
                    all clear
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Purchase invoices</h2>
          {flagged > 0 && (
            <span className="text-[13px] text-warning font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              {flagged} rows below the confidence threshold
            </span>
          )}
        </div>

        <div className="border border-border rounded overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary border-b border-border text-left">
                {['Document', 'Vendor', 'Invoice date', 'GSTIN', 'Total', 'Confidence'].map((h) => (
                  <th key={h} className="px-4 py-2 font-semibold text-[12px] text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => {
                const low = r.conf < NEEDS_REVIEW;
                return (
                  <tr key={r.doc} className={cn('border-b border-border last:border-b-0', low && 'bg-amber-50')}>
                    <td className="px-4 py-2 font-mono text-[12px]">{r.doc}</td>
                    <td className="px-4 py-2">{r.vendor}</td>
                    <td className="px-4 py-2 tabular-nums">{r.date}</td>
                    <td className="px-4 py-2 font-mono text-[12px]">{r.gstin}</td>
                    <td className="px-4 py-2 tabular-nums">{r.total}</td>
                    <td className="px-4 py-2">
                      <span className={cn('inline-flex items-center gap-1.5 text-[12px] font-semibold', low ? 'text-warning' : 'text-success')}>
                        {low && <AlertTriangle className="w-3 h-3" />}
                        {Math.round(r.conf * 100)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-[12px] text-muted-foreground mt-3">
          Rows under {Math.round(NEEDS_REVIEW * 100)}% confidence are held back from downstream steps until someone confirms them.
        </p>
      </div>
    </div>
  );
}
