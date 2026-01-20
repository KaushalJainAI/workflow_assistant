import { useState } from 'react';
import { X, Workflow, ArrowRight, Clock, User, Zap, Search, Filter } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  author: string;
  uses: number;
  nodes: any[];
  edges: any[];
  tags: string[];
  createdAt: Date;
}

const mockTemplates: WorkflowTemplate[] = [
  {
    id: '1',
    name: 'Slack to Email Notification',
    description: 'Forward important Slack messages to email with custom filters',
    category: 'Communication',
    author: 'Nexus Team',
    uses: 1234,
    nodes: [],
    edges: [],
    tags: ['slack', 'email', 'notifications'],
    createdAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    name: 'Webhook to Database',
    description: 'Receive webhook data and store in PostgreSQL database',
    category: 'Data',
    author: 'Nexus Team',
    uses: 856,
    nodes: [],
    edges: [],
    tags: ['webhook', 'database', 'postgresql'],
    createdAt: new Date('2024-02-10'),
  },
  {
    id: '3',
    name: 'Daily Report Generator',
    description: 'Compile data from multiple sources and send daily summary',
    category: 'Reporting',
    author: 'Nexus Team',
    uses: 2341,
    nodes: [],
    edges: [],
    tags: ['reporting', 'scheduled', 'email'],
    createdAt: new Date('2024-01-20'),
  },
  {
    id: '4',
    name: 'AI Content Moderator',
    description: 'Use OpenAI to analyze and moderate user-generated content',
    category: 'AI',
    author: 'Community',
    uses: 567,
    nodes: [],
    edges: [],
    tags: ['ai', 'openai', 'content', 'moderation'],
    createdAt: new Date('2024-03-01'),
  },
  {
    id: '5',
    name: 'GitHub Issue Tracker',
    description: 'Sync GitHub issues to Notion and send Slack updates',
    category: 'Development',
    author: 'Community',
    uses: 1089,
    nodes: [],
    edges: [],
    tags: ['github', 'notion', 'slack', 'development'],
    createdAt: new Date('2024-02-25'),
  },
  {
    id: '6',
    name: 'E-commerce Order Flow',
    description: 'Complete order processing from Shopify to fulfillment',
    category: 'E-commerce',
    author: 'Nexus Team',
    uses: 3456,
    nodes: [],
    edges: [],
    tags: ['shopify', 'orders', 'fulfillment'],
    createdAt: new Date('2024-01-05'),
  },
];

const categories = ['All', 'Communication', 'Data', 'Reporting', 'AI', 'Development', 'E-commerce'];

interface TemplatesGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (template: WorkflowTemplate) => void;
}

export default function TemplatesGallery({ isOpen, onClose, onImport }: TemplatesGalleryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);

  const filteredTemplates = mockTemplates.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.tags.some((tag) => tag.includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-card border rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Workflow className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Workflow Templates</h2>
              <p className="text-sm text-muted-foreground">Start with a pre-built workflow</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4 p-4 border-b bg-muted/30">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-10 pr-4 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Templates Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Workflow className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No templates found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className={cn(
                    "text-left p-4 rounded-xl border transition-all hover:shadow-md",
                    selectedTemplate?.id === template.id 
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                      : "hover:border-primary/50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Workflow className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{template.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {template.description}
                      </p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {template.author}
                        </span>
                        <span className="flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {template.uses.toLocaleString()} uses
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {template.tags.slice(0, 3).map((tag) => (
                          <span 
                            key={tag}
                            className="px-2 py-0.5 bg-muted rounded-full text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-muted/30">
          <p className="text-sm text-muted-foreground">
            {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} available
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => selectedTemplate && onImport(selectedTemplate)}
              disabled={!selectedTemplate}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                selectedTemplate 
                  ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              Use Template
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
