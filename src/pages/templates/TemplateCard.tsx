import { useNavigate } from 'react-router-dom';
import { 
  FolderIcon, 
  ArrowRight, 
  Star, 
  Tag, 
  Clock, 
  CheckCircle2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { type WorkflowTemplate } from '../../api/templates';

interface TemplateCardProps {
  template: WorkflowTemplate;
  onUse?: (template: WorkflowTemplate) => void;
  featured?: boolean;
}

export default function TemplateCard({ template, onUse, featured = false }: TemplateCardProps) {
  const navigate = useNavigate();

  return (
    <div 
      className={cn(
        "group relative bg-card/40 hover:bg-card border border-white/5 hover:border-purple-500/30 rounded-xl p-5 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10 flex flex-col h-full backdrop-blur-sm cursor-pointer",
        featured && "bg-gradient-to-br from-purple-900/10 to-blue-900/10 border-purple-500/10"
      )}
      onClick={() => navigate(`/templates/${template.id}`)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn(
          "p-2.5 rounded-lg text-purple-400 transition-colors",
          featured ? "bg-purple-500/20" : "bg-white/5 group-hover:bg-purple-500/20"
        )}>
          <FolderIcon className="w-5 h-5" />
        </div>
        <div className="flex gap-2">
            {template.success_rate > 90 && (
                <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                     Verified
                </span>
            )}
            {template.score && (
                <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {Math.round(template.score * 100)}% Match
                </span>
            )}
        </div>
      </div>

      <h3 className="text-lg font-semibold text-foreground mb-2 line-clamp-1 group-hover:text-purple-400 transition-colors">
        {template.name}
      </h3>
      <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
        {template.description}
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        {template.tags?.slice(0, 3).map(tag => (
          <span key={tag} className="text-xs px-2 py-1 rounded-md bg-white/5 text-muted-foreground border border-white/5 flex items-center gap-1">
            <Tag className="w-3 h-3" />
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-auto">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-yellow-500/50" />
              <span>{template.usage_count} uses</span>
          </div>
          <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{template.success_rate}% success</span>
          </div>
        </div>
        
        {onUse && (
            <button
            onClick={(e) => {
                e.stopPropagation();
                onUse(template);
            }}
            className="flex items-center gap-2 text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors"
            >
            Use Template
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
        )}
      </div>
    </div>
  );
}
