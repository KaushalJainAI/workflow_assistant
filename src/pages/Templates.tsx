import { useState } from 'react';
import { Search, Loader2, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import templatesService from '../api/templates';
import TemplateCard from './templates/TemplateCard';
import Select from '../components/ui/Select';
import { cn } from '../lib/utils';

const CATEGORIES = [
    { id: 'all', label: 'All Templates' },
    { id: 'marketing', label: 'Marketing' },
    { id: 'devops', label: 'DevOps' },
    { id: 'ai_ml', label: 'AI / ML' },
    { id: 'data', label: 'Data Pipeline' },
    { id: 'support', label: 'Customer Support' },
    { id: 'sales', label: 'Sales' },
];

export default function TemplatesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filters
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('usage_count');
  const [page, setPage] = useState(1);

  const { data, isLoading: loading, isFetching: searching } = useQuery({
    queryKey: ['templates', category, sort, page, searchQuery],
    queryFn: async () => {
      const params = {
          category: category === 'all' ? undefined : category,
          sort,
          page
      };

      if (searchQuery.trim()) {
          return await templatesService.search({ query: searchQuery, ...params });
      } else {
          return await templatesService.list(params);
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
      setPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden relative">
        <header className="px-4 md:px-8 py-6 md:py-8 border-b border-border/60 bg-card/80 backdrop-blur-xl sticky top-0 z-20">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground mb-1">
                            Templates
                        </h1>
                        <p className="text-muted-foreground">
                            Explore and deploy pre-built workflows for your automation needs
                        </p>
                    </div>
                    
                    <form onSubmit={handleSearch} className="relative w-full md:w-[400px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input 
                            type="text" 
                            placeholder="Search templates..."
                            className="w-full h-11 pl-11 pr-4 rounded-xl bg-background/50 border border-border/60 focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all text-foreground placeholder:text-muted-foreground shadow-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </form>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-6">
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                        {CATEGORIES.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => { setCategory(cat.id); setPage(1); }}
                                className={cn(
                                    "px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                                    category === cat.id 
                                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                                        : "bg-card border border-border/60 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                                )}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border/60 text-sm font-medium">
                            <Filter className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Sort by:</span>
                            <Select 
                                value={sort}
                                onChange={(val) => { setSort(val); setPage(1); }}
                                options={[
                                    { value: 'usage_count', label: 'Popularity' },
                                    { value: 'rating', label: 'Top Rated' },
                                    { value: 'trending', label: 'Trending' },
                                    { value: 'newest', label: 'Newest' }
                                ]}
                                className="w-[140px] border-none bg-transparent h-auto py-1 px-0 shadow-none hover:bg-transparent"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-10">
            <div className="max-w-7xl mx-auto">
                {loading || searching ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <span className="text-muted-foreground animate-pulse">Searching templates...</span>
                    </div>
                ) : !data || data.results.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 text-muted-foreground">
                            <Search className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-medium text-foreground">No templates found</h3>
                        <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                            Try adjusting your filters or using different keywords to find what you need.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12 stagger-children">
                            {data.results.map((template) => (
                                <TemplateCard 
                                    key={template.id} 
                                    template={template} 
                                />
                            ))}
                        </div>

                        {/* Pagination */}
                        {data.pages > 1 && (
                            <div className="flex flex-col md:flex-row items-center justify-between gap-6 py-10 border-t border-border/60">
                                <div className="text-sm text-muted-foreground order-2 md:order-1">
                                    Showing <span className="font-semibold text-foreground">{data.results.length}</span> of <span className="font-semibold text-foreground">{data.count}</span> templates
                                </div>
                                
                                <div className="flex items-center gap-2 order-1 md:order-2">
                                    <button
                                        onClick={() => handlePageChange(page - 1)}
                                        disabled={page === 1}
                                        className="p-2.5 rounded-lg bg-card border border-border/60 disabled:opacity-30 hover:bg-muted transition-colors shadow-sm"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    
                                    <div className="flex items-center gap-1.5">
                                        {Array.from({ length: Math.min(5, data.pages) }, (_, i) => {
                                            // Simple sliding window for pagination
                                            let pageNum = page - 2 + i;
                                            if (page <= 2) pageNum = i + 1;
                                            if (page > data.pages - 2) pageNum = data.pages - 4 + i;
                                            
                                            if (pageNum > 0 && pageNum <= data.pages) {
                                                return (
                                                    <button
                                                        key={pageNum}
                                                        onClick={() => handlePageChange(pageNum)}
                                                        className={cn(
                                                            "w-10 h-10 rounded-lg flex items-center justify-center text-sm font-semibold transition-all",
                                                            page === pageNum 
                                                                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                                                                : "bg-card border border-border/60 text-muted-foreground hover:bg-muted hover:text-primary transition-all"
                                                        )}
                                                    >
                                                        {pageNum}
                                                    </button>
                                                );
                                            }
                                            return null;
                                        })}
                                    </div>

                                    <button
                                        onClick={() => handlePageChange(page + 1)}
                                        disabled={page === data.pages}
                                        className="p-2.5 rounded-lg bg-card border border-border/60 disabled:opacity-30 hover:bg-muted transition-colors shadow-sm"
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </main>
    </div>
  );
}

// Helper components & icons (keep or replace as needed)
