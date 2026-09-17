import { cn } from '../../lib/utils';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

/**
 * Underline tabs for pages (Documents, Credentials, Connections) and the
 * segmented variant for mode switches (Imagine modality, view toggles).
 *
 * Was 5 dialects: `pb-3 + absolute h-0.5`, `border-b-2 -mb-px`,
 * `bg-muted/40 rounded-full pills`, `bg-muted rounded-lg pills`, filter chips.
 */
export function Tabs({
  items,
  value,
  onChange,
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-6" role="tablist">
      {items.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              'pb-3 text-sm font-semibold transition-colors relative flex items-center gap-2',
              active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
            {typeof t.count === 'number' && (
              <span className="text-xs text-muted-foreground">({t.count})</span>
            )}
            {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex p-1 bg-muted rounded-lg border border-border">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          aria-pressed={o.id === value}
          className={cn(
            'px-4 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors',
            o.id === value
              ? 'bg-card text-foreground shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
