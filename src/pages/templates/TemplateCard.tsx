import { useNavigate } from 'react-router-dom';
import { 
  FolderIcon, 
  ArrowRight, 
  Star, 
  GitBranch
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { type WorkflowTemplate } from '../../api/templates';

interface TemplateCardProps {
  template: WorkflowTemplate;
  onUse?: (template: WorkflowTemplate) => void;
  featured?: boolean;
}

export default function TemplateCard({ template, onUse }: TemplateCardProps) {
  const navigate = useNavigate();

  return (
    <div 
      className={cn(
        "group relative bg-card border border-border/60 rounded-xl p-5 card-hover cursor-pointer flex flex-col h-full"
      )}
      onClick={() => navigate(`/templates/${template.id}`)}
    >
      <div className="flex items-start justify-between mb-5">
        <div className={cn(
          "p-2.5 rounded-lg transition-transform group-hover:scale-110",
          template.is_featured ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted text-muted-foreground group-hover:text-primary transition-colors"
        )}>
          <FolderIcon className="w-5 h-5" />
        </div>
        <div className="flex flex-col gap-1.5 items-end">
            {template.is_featured && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-primary/15 text-primary font-bold ">
                     Featured
                </span>
            )}
        </div>
      </div>

      <div className="flex-1">
          <div className="flex flex-col gap-0.5 mb-3">
              <h3 className="text-lg font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
                {template.name}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-muted-foreground ">
                    BY {template.author_name}
                </span>
              </div>
          </div>
          
          <p className="text-sm text-muted-foreground line-clamp-2 mb-5 leading-relaxed">
            {template.description}
          </p>

          <div className="flex flex-wrap gap-2 mb-5">
            {template.tags?.slice(0, 3).map(tag => (
              <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/60 uppercase">
                {tag}
              </span>
            ))}
          </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border/60 mt-auto">
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-1" title="Trust Score">
                <Star className={cn("w-3.5 h-3.5 text-amber-500", template.average_rating > 0 && "fill-amber-500")} />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{template.average_rating.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground" title="Deployments">
                <GitBranch className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">{template.usage_count}</span>
            </div>
        </div>
        
        <div 
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold ring-1 ring-primary/20 hover:bg-primary/20 transition-colors"
          onClick={(e) => {
              e.stopPropagation();
              if (onUse) onUse(template);
              else navigate(`/templates/${template.id}`);
          }}
        >
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            <span>Deploy</span>
        </div>
      </div>
    </div>
  );
}
