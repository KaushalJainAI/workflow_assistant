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
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl">
            <Icon className={cn("w-6 h-6 text-primary", iconClassName)} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>
        
        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
      
      {children}
    </div>
  );
}
