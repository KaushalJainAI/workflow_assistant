import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Share2, 
  Copy, 
  Layout, 
  GitBranch, 
  ShieldCheck,
  Star,
  Bookmark,
  TrendingUp,
  Loader2,
  ChevronRight,
  Activity,
  Server,
  Cpu
} from 'lucide-react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import templatesService, { type WorkflowTemplate } from '../../api/templates';
import workflowsService from '../../api/workflows';
import ReactFlow, { Background, Controls, BackgroundVariant, type NodeTypes } from 'reactflow';
import 'reactflow/dist/style.css';
import { cn } from '../../lib/utils';
import GenericNode from '../../components/workflow/GenericNode';

export default function TemplateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<WorkflowTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Community stats
  const [similarTemplates, setSimilarTemplates] = useState<WorkflowTemplate[]>([]);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const nodeTypes: NodeTypes = useMemo(() => ({
    custom: GenericNode,
    trigger: GenericNode,
    generic: GenericNode,
    webhook: GenericNode,
    schedule: GenericNode
  }), []);

  const loadTemplate = useCallback(async (templateId: number) => {
    try {
        setLoading(true);
        const data = await templatesService.get(templateId);
        setTemplate(data);
        setIsBookmarked(data.is_bookmarked);
        
        // Load additional data
        const [similarData] = await Promise.all([
            templatesService.getSimilar(templateId)
        ]);
        setSimilarTemplates(similarData);
        
    } catch (error) {
        console.error("Error loading template", error);
        toast.error("Failed to load template details");
    } finally {
        setLoading(false);
    }
  }, []);

  useEffect(() => {
     if (id) {
         loadTemplate(parseInt(id));
     }
  }, [id, loadTemplate]);



  const handleToggleBookmark = async () => {
      if (!template) return;
      try {
          const { bookmarked } = await templatesService.toggleBookmark(template.id);
          setIsBookmarked(bookmarked);
          toast.success(bookmarked ? "Bookmarked" : "Removed bookmark");
      } catch (error) {
        console.error('Failed to toggle bookmark', error);
          toast.error("Failed to toggle bookmark");
      }
  };

  const handleUseTemplate = async () => {
      if (!template) return;
      
      try {
           toast.loading("Creating workflow...");
           const result = await workflowsService.create({
               name: `[Template] ${template.name}`,
               description: template.description || '',
               nodes: template.nodes || [],
               edges: template.edges || [],
               workflow_settings: template.workflow_settings || {},
               tags: template.tags
           });
           toast.dismiss();
           toast.success("Workflow created successfully!");
           navigate(`/workflow/${result.id}`);
      } catch (error) {
        console.error('Operation failed', error);
          toast.dismiss();
          toast.error("Failed to create workflow");
      }
  };



  if (loading) {
      return (
          <div className="flex flex-col items-center justify-center h-full bg-background gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary/50" />
              <p className="text-muted-foreground text-sm font-medium ">Loading template…</p>
          </div>
      )
  }

  if (!template) return <div className="h-full bg-background flex items-center justify-center text-muted-foreground font-mono">That template no longer exists</div>;

  return (
    <div className="flex flex-col h-full bg-background text-foreground animate-in fade-in duration-500 overflow-hidden">
      {/* System Header - Simplified */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-md px-6 py-4 flex items-center justify-between z-20 shadow-sm">
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Link to="/templates" className="hover:text-primary transition-colors">Templates</Link>
                <ChevronRight className="w-3 h-3" />
                <span className="text-foreground font-semibold">{template.category}</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-3">
                {template.name}
                {template.is_featured && (
                     <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary tracking-wider border border-primary/20">
                         Featured
                     </span>
                 )}
            </h1>
        </div>

        <div className="flex items-center gap-3">
              <button 
                  onClick={handleToggleBookmark}
                  className={cn(
                      "p-2 rounded-md border transition-all active:scale-95",
                      isBookmarked 
                          ? "bg-primary/10 border-primary/20 text-primary" 
                          : "bg-background border-border hover:bg-muted text-muted-foreground"
                  )}
                  title="Bookmark Template"
              >
                  <Bookmark className={cn("w-4 h-4", isBookmarked && "fill-primary")} />
              </button>
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md border border-transparent transition-all">
                  <Share2 className="w-4 h-4" />
                  Share
              </button>
              <button 
                  onClick={handleUseTemplate}
                  className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md font-bold text-sm transition-all shadow-lg shadow-primary/20 active:scale-95"
              >
                  <Copy className="w-4 h-4" />
                  Use Template
              </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* Main Canvas Area */}
          <div className="flex-1 relative bg-secondary/5 group">
              <div className="absolute inset-0">
                  <ReactFlow 
                    nodes={(template.nodes || [])
                        .filter((n: any) => n && typeof n === 'object') // Defensive check
                        .map((n:any) => ({
                        ...n, 
                        type: n.type || 'custom', // Ensure type uses custom node
                        position: n.position || { x: 100, y: 100 }, // Fallback for missing position
                        data: { 
                            ...n.data, 
                            label: n.data?.label || n.type,
                            nodeType: n.type, // Pass original type for icon resolution
                            executionStatus: undefined, // Hide execution status for preview
                            validationError: undefined  // Hide validation errors for preview
                        }
                    }))} 
                    edges={(template.edges || []).map((e: any) => ({
                        ...e,
                        animated: true,
                        style: { stroke: '#444', strokeWidth: 1.5 }
                    }))}
                    nodeTypes={nodeTypes}
                    fitView
                    proOptions={{ hideAttribution: true }}
                    nodesDraggable={false}
                    nodesConnectable={false}
                    nodesFocusable={false}
                    zoomOnScroll={true}
                    panOnScroll={true}
                  >
                    <Background color="#555" gap={20} size={1} variant={BackgroundVariant.Dots} />
                    <Controls showInteractive={false} className="bg-card border border-border text-foreground fill-foreground" />
                    
                    {/* Mini Map overlay */}
                    <div className="absolute bottom-4 right-4 z-10 pointer-events-none opacity-50 text-[10px] font-mono text-muted-foreground">
                        READ-ONLY PREVIEW
                    </div>
                  </ReactFlow>
              </div>
          </div>

          {/* Right Sidebar: Details & Stats */}
          <aside className="w-full lg:w-[400px] bg-card border-l border-border/60 flex flex-col overflow-y-auto no-scrollbar z-10 shadow-xl">
               
               <div className="p-6 space-y-8">
                   {/* Description Panel - Moved to Top */}
                   <section className="space-y-3">
                       <h3 className="text-xs font-bold font-mono  text-muted-foreground flex items-center gap-2">
                           <Layout className="w-4 h-4" /> Specification
                       </h3>
                       <div className="text-sm leading-relaxed text-muted-foreground bg-muted/30 p-4 rounded-lg border border-border/50">
                           {template.description || "No specification provided."}
                       </div>
                   </section>

                   {/* Metrics Grid - Moved Below Description */}
                   <div className="grid grid-cols-2 gap-3">
                        <div className="bg-muted/10 border border-border/40 rounded-lg p-3 flex flex-col items-center justify-center">
                            <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 mb-1">
                                <Server className="w-3 h-3" /> Nodes
                            </div>
                            <div className="text-lg font-bold font-mono tracking-tight">{template.nodes?.length || 0}</div>
                        </div>
                        <div className="bg-muted/10 border border-border/40 rounded-lg p-3 flex flex-col items-center justify-center">
                             <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 mb-1">
                                <Activity className="w-3 h-3 text-emerald-500" /> Uptime
                            </div>
                            <div className="text-lg font-bold font-mono tracking-tight text-emerald-500">{typeof template.success_rate === 'number' ? template.success_rate.toFixed(1) : '0'}%</div>
                        </div>
                        <div className="bg-muted/10 border border-border/40 rounded-lg p-3 flex flex-col items-center justify-center">
                             <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 mb-1">
                                <Cpu className="w-3 h-3 text-blue-500" /> Run Time
                            </div>
                            <div className="text-lg font-bold font-mono tracking-tight text-blue-500">~240ms</div>
                        </div>
                        <div className="bg-muted/10 border border-border/40 rounded-lg p-3 flex flex-col items-center justify-center">
                             <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 mb-1">
                                <TrendingUp className="w-3 h-3 text-amber-500" /> Usage
                            </div>
                            <div className="text-lg font-bold font-mono tracking-tight text-amber-500">{template.usage_count}</div>
                        </div>
                   </div>

                   {/* Integrations Panel */}
                   <section className="space-y-3">
                        <h3 className="text-xs font-bold font-mono  text-muted-foreground flex items-center gap-2">
                           <ShieldCheck className="w-4 h-4 text-primary" /> Required Integrations
                       </h3>
                       <div className="space-y-2">
                            {Array.from(new Set((template.nodes || [])
                               .filter((n:any) => n.data?.credential_id || n.type.toLowerCase().includes('integration'))
                               .map((n:any) => n.type.split('_')[0])
                            )).map((service: any) => (
                                <div key={service} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/60 shadow-sm group hover:border-primary/30 transition-all">
                                     <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-[10px] font-bold uppercase text-muted-foreground font-mono">
                                            {service.slice(0,2)}
                                        </div>
                                        <span className="text-sm font-medium capitalize">{service}</span>
                                     </div>
                                     <div className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" title="Auth Required" />
                                </div>
                            ))}
                            {(!template.nodes?.some((n:any) => n.data?.credential_id || n.type.toLowerCase().includes('integration'))) && (
                                <div className="text-xs text-muted-foreground font-mono text-center py-4 border border-dashed border-border rounded-lg bg-muted/20">
                                    NO_AUTH_REQUIRED
                                </div>
                            )}
                       </div>
                   </section>

                   {/* Similar Templates */}
                   <section className="space-y-3">
                        <h3 className="text-xs font-bold font-mono  text-muted-foreground flex items-center gap-2">
                           <GitBranch className="w-4 h-4" /> Related Workflows
                       </h3>
                       <div className="space-y-2">
                           {similarTemplates.slice(0, 3).map((sim) => (
                               <div 
                                 key={sim.id}
                                 onClick={() => navigate(`/templates/${sim.id}`)}
                                 className="group p-3 rounded-lg border border-border/60 bg-card hover:bg-muted/40 cursor-pointer transition-all hover:border-primary/30"
                               >
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className="text-sm font-bold group-hover:text-primary transition-colors line-clamp-1">{sim.name}</h4>
                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                                            <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                                            {sim.average_rating.toFixed(1)}
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground line-clamp-2">{sim.description}</p>
                               </div>
                           ))}
                       </div>
                   </section>
               </div>
          </aside>
      </div>
    </div>
  );
}
