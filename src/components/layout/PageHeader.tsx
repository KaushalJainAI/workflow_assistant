import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  iconClassName?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export default function PageHeader({ 
  title, 
  subtitle, 
  icon: Icon,
  iconClassName,
  actions,
  children,
  className 
}: PageHeaderProps) {
  return (
    <div className={cn("px-4 py-6 md:px-8 md:py-8 border-b border-border/60 bg-card/80 backdrop-blur-xl sticky top-0 z-20", className)}>
      <div className={cn("flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6", children && "mb-6 md:mb-8")}>
        {/* `pl-12` on mobile reserves the 40px the Sidebar's floating hamburger
            occupies (fixed top-3 left-3). Without it the button sits on top of
            the icon tile on every page that renders a PageHeader — it is a
            fixed element, so nothing else can make room for it. */}
        <div className="flex items-center gap-3 md:gap-4 pl-12 md:pl-0 min-w-0">
          <div className="p-2.5 md:p-3 bg-primary/10 rounded-xl shrink-0">
            <Icon className={cn("w-5 h-5 md:w-6 md:h-6 text-primary", iconClassName)} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{title}</h1>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>
        
        {actions && (
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            {actions}
          </div>
        )}
      </div>
      
      {children}
    </div>
  );
}
