import { forwardRef } from 'react';
import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

const INPUT_CLS =
  'w-full rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary disabled:opacity-50';

/**
 * The ~30 hand-rolled `border border-input bg-background h-7/8/9/10/11`
 * fields in 4 radii and 3 focus styles. Height via `size`, mono via prop —
 * secrets look the same everywhere now.
 */
export const TextInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { size?: 'sm' | 'md' | 'lg'; mono?: boolean }
>(({ size = 'md', mono, className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      INPUT_CLS,
      size === 'sm' ? 'h-8 px-2 text-[13px]' : size === 'lg' ? 'h-11 px-4' : 'h-10 px-3',
      mono && 'font-mono',
      className,
    )}
    {...props}
  />
));
TextInput.displayName = 'TextInput';

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean }
>(({ mono, className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(INPUT_CLS, 'min-h-20 px-3 py-2 resize-y', mono && 'font-mono', className)}
    {...props}
  />
));
TextArea.displayName = 'TextArea';

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && !error && (
        <span className="block text-xs text-muted-foreground">{hint}</span>
      )}
      {error && <span className="block text-xs text-destructive">{error}</span>}
    </label>
  );
}
