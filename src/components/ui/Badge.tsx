import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'agent';

const TONES: Record<Tone, string> = {
  neutral: 'bg-secondary text-muted-foreground border-border',
  primary: 'bg-primary-subtle text-primary border-primary-line',
  success: 'bg-success-subtle text-success border-border',
  warning: 'bg-warning-subtle text-warning border-border',
  danger: 'bg-destructive-subtle text-destructive border-border',
  agent: 'bg-agent-subtle text-agent border-agent-line',
};

/**
 * One badge for counts, states and capability chips.
 *
 * Was 36 copies: `rounded / rounded-md / rounded-full`, `text-[10px]/[11px]`,
 * `font-bold/semibold`, hardcoded `bg-emerald-500/10 text-emerald-600` in
 * Evals, `getTierColor()` in Profile, `cfg.bg/cls` in Runs. Tone carries
 * meaning; size carries hierarchy — never both at once.
 */
export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[11px] font-semibold whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
