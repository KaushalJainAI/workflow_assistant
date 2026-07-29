/**
 * Change against a previous measurement.
 *
 * `null` means there was nothing to compare against. That is a different
 * statement from "no change" and has to read differently, or a first run looks
 * like a run that achieved nothing.
 */
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function Delta({ v, unit = 'pts' }: { v: number | null; unit?: string }) {
  if (v === null) return <span className="text-[12px] text-muted-foreground">first run</span>;

  if (v === 0) {
    return (
      <span className="flex items-center gap-1 text-muted-foreground text-[12px]">
        <Minus className="w-3 h-3" />
        no change
      </span>
    );
  }

  const up = v > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        'flex items-center gap-1 text-[12px] font-semibold',
        up ? 'text-success' : 'text-destructive'
      )}
    >
      <Icon className="w-3 h-3" />
      {up ? '+' : ''}
      {v.toFixed(1)} {unit}
    </span>
  );
}
