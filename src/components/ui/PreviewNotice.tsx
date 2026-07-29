import { FlaskConical } from 'lucide-react';

/**
 * Marks a screen whose backend does not exist yet.
 *
 * These pages exist so the shape of the product is reviewable before the API is
 * built, but the data on them is invented. Saying so on the page is cheaper than
 * someone trusting a number that came from a literal.
 */
export default function PreviewNotice({ what }: { what: string }) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2 mb-5 rounded border border-amber-200 bg-amber-50 text-[13px] text-amber-900">
      <FlaskConical className="w-4 h-4 mt-0.5 shrink-0" />
      <span>
        <strong className="font-semibold">Design preview.</strong> {what} has no backend yet —
        everything below is sample data and nothing here is saved.
      </span>
    </div>
  );
}
