import React, { useState } from 'react';
import { Brain, Activity, Sparkles, Database, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface NodeLog {
  id: number;
  node_id: string;
  node_name?: string;
  node_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  error_message: string | null;
  duration_ms: number;
}

interface OrchestratorThought {
  id: number | string;
  thought_type: 'thinking' | 'thought' | 'narrative' | 'error' | 'status';
  content: string;
  reasoning: string;
  node_id: string;
  node_name?: string;
  model_id?: string;
  model_name?: string;
  created_at: string;
}

interface AIAnalysisProps {
  narrative?: { reasoning: string } | null;
  activities: OrchestratorThought[];
  nodeLogs?: NodeLog[];
  supervisionLevel?: string;
  className?: string;
}

const AIAnalysis: React.FC<AIAnalysisProps> = ({ narrative, activities, nodeLogs, supervisionLevel, className }) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [expandedReasoning, setExpandedReasoning] = useState<Set<number | string>>(new Set());
  const [expandedContent, setExpandedContent] = useState<Set<number | string>>(new Set());
  const [expandedData, setExpandedData] = useState<Set<number | string>>(new Set());

  if (!narrative && activities.length === 0) {
    if (supervisionLevel === 'none' || supervisionLevel === 'error_only') {
      return (
        <div className="p-4 bg-muted/20 border border-border/30 rounded-xl text-center">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest opacity-60">
            No Supervision Active for this Execution
          </p>
          <p className="text-[10px] text-muted-foreground/40 mt-1">
            {supervisionLevel === 'none' ? 'Supervision is disabled.' : 'Supervision only active on errors.'}
          </p>
        </div>
      );
    }
    return null;
  }

  // Group activities by node_id
  const nodeGroups: { nodeId: string; nodeName: string; thoughts: OrchestratorThought[]; nodeLog?: NodeLog }[] = [];
  let currentGroup: { nodeId: string; nodeName: string; thoughts: OrchestratorThought[]; nodeLog?: NodeLog } | null = null;

  activities.forEach(activity => {
    if (!currentGroup || currentGroup.nodeId !== activity.node_id) {
      const nodeLog = nodeLogs?.find(l => l.node_id === activity.node_id);
      currentGroup = {
        nodeId: activity.node_id,
        nodeName: activity.node_name || nodeLog?.node_name || activity.node_id,
        thoughts: [activity],
        nodeLog
      };
      nodeGroups.push(currentGroup);
    } else {
      currentGroup.thoughts.push(activity);
      // Update name if we get a better one from later thoughts
      if (activity.node_name && currentGroup.nodeName === currentGroup.nodeId) {
        currentGroup.nodeName = activity.node_name;
      }
    }
  });

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const toggleReasoning = (id: number | string) => {
    setExpandedReasoning(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleContent = (id: number | string) => {
    setExpandedContent(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleData = (id: number | string) => {
    setExpandedData(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'failed': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'running': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      default: return 'text-muted-foreground bg-muted/50 border-border/50';
    }
  };

  const getThoughtColor = (type: string) => {
    switch (type) {
      case 'thinking': return 'bg-amber-500';
      case 'thought': return 'bg-sky-500';
      case 'error': return 'bg-red-500';
      case 'status': return 'bg-slate-500';
      default: return 'bg-primary';
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* AI Narrative Section */}
      {narrative && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-500">
           <div className="p-5 bg-purple-500/10 border border-purple-500/30 rounded-xl shadow-lg backdrop-blur-sm relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.4)]" />
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Brain className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400 opacity-80">Final Synthesis</h4>
                  <h3 className="text-sm font-bold text-purple-100">AI Narrative Review</h3>
                </div>
              </div>
                <div className="prose prose-invert prose-sm max-w-none ai-chat-prose">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {narrative.reasoning}
                  </ReactMarkdown>
                </div>
           </div>
        </div>
      )}

      {/* Activity Logs (Unified Node Flow) */}
      {nodeGroups.length > 0 && (
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-4 px-1 opacity-70">
            <Activity className="w-3 h-3 text-blue-500" />
            Unified Execution Flow
          </h3>
          <div className="space-y-4">
            {nodeGroups.map((group, groupIdx) => {
              const isExpanded = expandedNodes.has(group.nodeId + groupIdx);
              const nodeLog = group.nodeLog;
              const hasThoughts = group.thoughts.length > 0;
              const statusColor = getStatusColor(nodeLog?.status);

              return (
                <div key={group.nodeId + groupIdx} className="bg-muted/10 rounded-xl border border-border/30 overflow-hidden transition-all shadow-sm">
                  {/* Node Header (Clickable for expansion) */}
                  <button 
                    onClick={() => toggleNode(group.nodeId + groupIdx)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={cn(
                        "p-2 rounded-lg border flex items-center justify-center shrink-0 transition-colors",
                        statusColor
                      )}>
                        {nodeLog?.status === 'completed' ? <Database className="w-4 h-4" /> : 
                         nodeLog?.status === 'failed' ? <Activity className="w-4 h-4" /> :
                         <Sparkles className="w-4 h-4 animate-pulse" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[13px] font-bold text-foreground">
                            {group.nodeName}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono opacity-50">
                            {nodeLog?.node_type || "orchestrator"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-medium">
                          <span className="tabular-nums">
                            {new Date(group.thoughts[0]?.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                          {nodeLog?.duration_ms && (
                            <span className="px-1.5 py-0.5 bg-muted/50 rounded font-mono">
                              {nodeLog.duration_ms}ms
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {hasThoughts && (
                        <span className="text-[10px] font-bold text-primary/60 bg-primary/5 px-2 py-1 rounded-md border border-primary/10">
                          {group.thoughts.length} Insight{group.thoughts.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {isExpanded ? <ChevronDown className="w-4 h-4 opacity-40" /> : <ChevronRight className="w-4 h-4 opacity-40" />}
                    </div>
                  </button>

                  {/* Expandable Content (AI Thoughts + Data) */}
                  {isExpanded && (
                    <div className="border-t border-border/20 bg-black/20 p-4 space-y-4 animate-in slide-in-from-top-2 duration-300">
                      {/* Internal Thinking Steps */}
                      <div className="space-y-3">
                        {group.thoughts.map(activity => {
                          const isAutoExpanded = activity.reasoning && (!activity.content || activity.content.length < 50);
                          const isReasoningExpanded = expandedReasoning.has(activity.id) || isAutoExpanded;
                          const isContentExpanded = expandedContent.has(activity.id);
                          const isLongContent = activity.content && activity.content.length > 300;
                          const thoughtColor = getThoughtColor(activity.thought_type);

                          return (
                            <div key={activity.id} className="relative pl-6 py-1 group/thought">
                              <div className={cn("absolute left-1.5 top-0 bottom-0 w-1 rounded-full transition-all", thoughtColor)} />
                              
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] text-muted-foreground/40 font-mono tabular-nums">
                                  {new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                                
                                <div className="flex items-center gap-2">
                                  {activity.model_name && (
                                    <span className="text-[9px] font-bold text-sky-400/60 bg-sky-400/5 px-1.5 py-0.5 rounded border border-sky-400/20 uppercase tracking-tighter">
                                      {activity.model_name}
                                    </span>
                                  )}
                                  <span className="text-[9px] font-bold text-muted-foreground/30 uppercase tracking-tighter">
                                    {activity.node_name || activity.node_id}
                                  </span>
                                  {activity.reasoning && (
                                     <button 
                                       onClick={() => toggleReasoning(activity.id)}
                                       className={cn(
                                         "text-[9px] font-black uppercase tracking-wider transition-colors px-2 py-0.5 rounded-md",
                                         isReasoningExpanded ? "bg-primary/20 text-primary" : "text-primary/40 hover:bg-primary/10 hover:text-primary"
                                       )}
                                     >
                                       {isReasoningExpanded ? "Hide Reasoning" : "Thinking"}
                                     </button>
                                  )}
                                </div>
                              </div>

                              <div className="relative ai-chat-prose">
                                <div className={cn(
                                  "text-[13px] text-foreground/90 leading-relaxed font-medium break-words",
                                  isLongContent && !isContentExpanded && "line-clamp-2"
                                )}>
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {activity.content}
                                  </ReactMarkdown>
                                </div>
                                {isLongContent && (
                                  <button 
                                    onClick={() => toggleContent(activity.id)}
                                    className="text-[10px] font-bold text-primary hover:underline mt-1"
                                  >
                                    {isContentExpanded ? "Show Less" : "Read More..."}
                                  </button>
                                )}
                              </div>

                              {activity.reasoning && isReasoningExpanded && (
                                <div className="mt-3 p-3 bg-black/40 rounded-lg border border-primary/10 animate-in fade-in slide-in-from-top-1 duration-300 shadow-inner">
                                   <div className="flex items-center gap-1.5 mb-2 text-primary/70">
                                      <Sparkles className="w-3 h-3" />
                                      <span className="text-[9px] font-black uppercase tracking-widest">Logic Analysis</span>
                                   </div>
                                   <div className="text-muted-foreground italic text-[12px] leading-relaxed border-l-2 border-primary/20 pl-4 ai-chat-prose">
                                     <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                       {activity.reasoning}
                                     </ReactMarkdown>
                                   </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Node Data Section */}
                      {nodeLog && (
                        <div className="pt-2 border-t border-border/10">
                          <button 
                            onClick={() => toggleData(group.nodeId + groupIdx)}
                            className={cn(
                              "flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors mb-3",
                              expandedData.has(group.nodeId + groupIdx) ? "text-emerald-400" : "text-emerald-400/50 hover:text-emerald-400"
                            )}
                          >
                            <Database className="w-3 h-3" />
                            Node Data (JSON)
                            {expandedData.has(group.nodeId + groupIdx) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          </button>

                          {expandedData.has(group.nodeId + groupIdx) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-1 duration-300">
                              <div className="space-y-1.5">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 ml-1">Input</span>
                                <div className="bg-black/60 rounded-lg p-3 border border-border/10 max-h-[200px] overflow-auto custom-scrollbar">
                                  <pre className="text-[10px] font-mono text-blue-400/70 leading-tight">
                                    {JSON.stringify(nodeLog.input_data, null, 2)}
                                  </pre>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500/40 ml-1">Output</span>
                                <div className="bg-black/60 rounded-lg p-3 border border-emerald-500/10 max-h-[200px] overflow-auto custom-scrollbar">
                                  <pre className="text-[10px] font-mono text-emerald-400/70 leading-tight">
                                    {JSON.stringify(nodeLog.output_data, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAnalysis;
