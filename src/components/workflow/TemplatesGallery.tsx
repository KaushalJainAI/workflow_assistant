import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  Loader2, 
  Star, 
  ChevronRight,
  TrendingUp,
  Tag,
  User
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { templatesService, type WorkflowTemplate, type PaginatedTemplates } from '../../api/templates';

interface TemplatesGalleryProps {
  onClose: () => void;
  onSelect: (template: WorkflowTemplate) => void;
}

export const TemplatesGallery: React.FC<TemplatesGalleryProps> = ({ onClose, onSelect }) => {
  const [data, setData] = useState<PaginatedTemplates | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, [selectedCategory]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const res = await templatesService.list({ 
        category: selectedCategory || undefined,
        sort: 'usage_count' 
      });
      setData(res);
    } catch (error) {
      console.error('Failed to load templates', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      loadTemplates();
      return;
    }

    try {
      setSearching(true);
      const res = await templatesService.search({ 
        query: searchQuery,
        category: selectedCategory || undefined
      });
      setData(res);
    } catch (error) {
      console.error('Search failed', error);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0b0e14]/95 backdrop-blur-xl border-l border-white/10 w-[450px] animate-in slide-in-from-right duration-300 shadow-[0_0_50px_rgba(0,0,0,0.5)] z-50">
      <div className="flex items-center justify-between p-8 border-b border-white/5 bg-[#0b0e14]/50">
        <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
                Blueprint Library
            </h2>
            <p className="text-[10px] text-primary/70 font-bold uppercase tracking-[0.2em] mt-1">Foundational Nodes & Flows</p>
        </div>
        <button 
          onClick={onClose}
          className="p-2.5 hover:bg-white/5 rounded-xl transition-all group border border-transparent hover:border-white/10"
        >
          <X className="w-5 h-5 text-slate-400 group-hover:rotate-90 transition-transform group-hover:text-white" />
        </button>
      </div>

      <div className="p-8 space-y-6 border-b border-white/5 bg-white/[0.02]">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search blueprints..."
            className="w-full h-12 pl-12 pr-4 rounded-2xl bg-[#0b0e14] border border-white/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-sm text-white placeholder:text-slate-600 shadow-inner"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {['All', 'Marketing', 'DevOps', 'AI', 'Data', 'Sales'].map((cat) => (
                <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat === 'All' ? null : cat.toLowerCase())}
                    className={cn(
                        "px-4 py-1.5 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap border uppercase tracking-widest",
                        (selectedCategory === cat.toLowerCase() || (cat === 'All' && !selectedCategory))
                            ? "bg-primary text-primary-foreground border-primary shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                            : "bg-white/5 text-slate-500 border-white/5 hover:border-white/20 hover:text-slate-300"
                    )}
                >
                    {cat}
                </button>
            ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-5 scrollbar-thin scrollbar-thumb-white/5">
        {loading || searching ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest animate-pulse">Syncing Blueprints...</span>
          </div>
        ) : !data || data.results.length === 0 ? (
          <div className="text-center py-20">
            <Search className="w-12 h-12 mx-auto mb-4 text-slate-800" />
            <p className="text-sm font-bold text-slate-400 uppercase tracking-tight">No Specifications Found</p>
            <p className="text-[10px] text-slate-600 mt-1 uppercase tracking-widest">Modify search parameters</p>
          </div>
        ) : (
          data.results.map((template) => (
            <button
              key={template.id}
              onClick={() => onSelect(template)}
              className="w-full group p-5 rounded-2xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.05] hover:border-primary/50 transition-all text-left relative overflow-hidden"
            >
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary/80 bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
                        {template.category}
                    </span>
                    <div className="flex items-center gap-1.5 text-amber-500">
                        <Star className="w-3 h-3 fill-amber-500" />
                        <span className="text-[11px] font-bold">{template.average_rating.toFixed(1)}</span>
                    </div>
                </div>
                
                <h3 className="font-bold text-slate-200 group-hover:text-primary transition-colors mb-2 line-clamp-1 text-sm tracking-tight uppercase">
                  {template.name}
                </h3>
                
                <p className="text-[11px] text-slate-500 line-clamp-2 mb-5 leading-relaxed font-medium">
                  {template.description}
                </p>

                <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-primary/30 transition-colors">
                            <User className="w-2.5 h-2.5 text-slate-400 group-hover:text-primary" />
                        </div>
                        <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">@ {template.author_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-lg border border-white/5 group-hover:border-primary/10">
                            <TrendingUp className="w-2.5 h-2.5 text-emerald-500" />
                            <span className="text-[9px] font-mono text-slate-500">{template.usage_count}</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform text-primary/50" />
                    </div>
                </div>
              </div>
              
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))
        )}
      </div>

      <div className="p-8 border-t border-white/5 bg-[#0b0e14]">
          <div className="flex items-center gap-5 p-5 rounded-2xl bg-primary/[0.03] border border-primary/10 group cursor-pointer hover:border-primary/30 transition-all shadow-inner">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm group-hover:scale-110 transition-all duration-300">
                  <Tag className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                  <div className="text-xs font-bold text-white uppercase tracking-widest">Custom Nodes?</div>
                  <div className="text-[10px] text-slate-500 font-medium mt-1">Architect unique modules via AI-assisted synthesis.</div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default TemplatesGallery;
