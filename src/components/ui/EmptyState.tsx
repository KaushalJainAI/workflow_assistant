import { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { FileQuestion, Inbox, Search, Workflow } from 'lucide-react';

type EmptyStateVariant = 'default' | 'workflows' | 'search' | 'data';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

const icons = {
  default: Inbox,
  workflows: Workflow,
  search: Search,
  data: FileQuestion,
};

const illustrations = {
  default: (
    <div className="relative w-32 h-32">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-full animate-pulse" />
      <div className="absolute inset-4 bg-gradient-to-br from-primary/30 to-purple-500/30 rounded-full" />
      <div className="absolute inset-8 bg-card rounded-full flex items-center justify-center border-2 border-dashed border-muted-foreground/30">
        <Inbox className="w-8 h-8 text-muted-foreground" />
      </div>
    </div>
  ),
  workflows: (
    <div className="relative w-32 h-32">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-2xl rotate-6" />
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl -rotate-6" />
      <div className="absolute inset-4 bg-card rounded-xl flex items-center justify-center border shadow-lg">
        <Workflow className="w-10 h-10 text-primary" />
      </div>
    </div>
  ),
  search: (
    <div className="relative w-32 h-32">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-20 h-20 border-4 border-dashed border-muted-foreground/30 rounded-full" />
      </div>
      <div className="absolute bottom-0 right-0 bg-card p-3 rounded-full shadow-lg border">
        <Search className="w-6 h-6 text-muted-foreground" />
      </div>
    </div>
  ),
  data: (
    <div className="relative w-32 h-32">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <div className="w-16 h-3 bg-muted rounded animate-pulse" />
        <div className="w-20 h-3 bg-muted rounded animate-pulse delay-100" />
        <div className="w-12 h-3 bg-muted rounded animate-pulse delay-200" />
        <div className="w-24 h-3 bg-muted rounded animate-pulse delay-300" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <FileQuestion className="w-12 h-12 text-muted-foreground/50" />
      </div>
    </div>
  ),
};

export default function EmptyState({ 
  variant = 'default', 
  title, 
  description, 
  action,
  className 
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-4 text-center",
      className
    )}>
      <div className="mb-6">
        {illustrations[variant]}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {description && (
        <p className="text-muted-foreground max-w-sm mb-6">{description}</p>
      )}
      {action}
    </div>
  );
}
