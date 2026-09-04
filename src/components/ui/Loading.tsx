/**
 * The shared waiting states.
 *
 * Two of them, deliberately. `Skeleton` is for content whose shape is already
 * known — a list of rows, a card grid — because holding the layout still while
 * data lands is what stops the page jumping under the cursor. `AppLoader` is
 * for the moments where nothing about the next screen is known yet (the auth
 * check before the first route renders), where a skeleton would be a lie.
 *
 * Both collapse to a static frame under `prefers-reduced-motion`, via the
 * global rule in `index.css` — no component here needs to check it.
 */

import { cn } from '../../lib/utils';

/** A single pulsing placeholder block. Give it the size of what it stands in for. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

/** `count` stacked skeleton rows — the list/table case, which is most of them. */
export function SkeletonRows({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-border/50 p-4">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            {/* Staggered widths: uniform bars read as a broken table rather
                than as content that is on its way. */}
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Full-screen loader for a boot-time wait. The ring and the label fade in
 * after a beat so a fast check (the common case) never flashes a loader.
 */
export function AppLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-2 border-primary/15" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary" />
        <div className="absolute inset-2 rounded-full bg-primary/10 animate-pulse-glow" />
      </div>
      <p className="text-xs font-medium tracking-wide text-muted-foreground animate-fade-in">
        {label}
      </p>
    </div>
  );
}
