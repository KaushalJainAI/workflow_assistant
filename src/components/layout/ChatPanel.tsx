import { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  User, 
  Sparkles, 
  Copy, 
  Check,
  Loader2,
  Plus,
  Trash2,
  X,
  PlusCircle,
  Image as ImageIcon,
  FileText as FileIcon,
  Camera,
  History,
  ArrowRight,
  Lock,
  ChevronDown
} from 'lucide-react';
import { orchestratorService, type ChatMessage } from '../../api';
import { cn } from '../../lib/utils';
import { useAssistant } from '../../contexts/AssistantContext';
import { useAIModels } from '../../hooks/useAIModels';

interface ChatPanelProps {
  initialConversationId?: string;
  onClose?: () => void;
  isDocked?: boolean;
}



const examplePrompts = [
  "Build a data pipeline that syncs PostgreSQL to Google Sheets daily",
  "Create a workflow that monitors an RSS feed and sends new posts to Slack",
];

export default function ChatPanel({ initialConversationId, onClose, isDocked }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "Hello! I'm your AI assistant. Tell me what you'd like to automate, and I'll build it for you.",
      created_at: new Date().toISOString(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  
  const [conversations, setConversations] = useState<{conversation_id: string}[]>([]);
  
  const { hasCredentials, llmProvider, setLlmProvider, llmModel, setLlmModel } = useAssistant();
  const { providers: dynamicProviders } = useAIModels();
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Textarea Auto-Grow
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "0px";
    const scrollHeight = el.scrollHeight;

    if (scrollHeight <= 160) {
      el.style.height = scrollHeight + "px";
      el.style.overflowY = "hidden";
    } else {
      el.style.height = "160px";
      el.style.overflowY = "auto";
    }
  }, [input]);

  useEffect(() => {
    if (showHistory) {
      loadHistory();
    }
  }, [showHistory]);

  // Load conversation if initialConversationId changes
  useEffect(() => {
    if (initialConversationId) {
      loadConversation(initialConversationId);
    }
  }, [initialConversationId]);

  const loadHistory = async () => {
    try {
      const res = await orchestratorService.getMessages();
      if (res && res.conversations) {
        setConversations(res.conversations);
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }
  };

  const loadConversation = async (id: string) => {
    setIsLoading(true);
    try {
      const res = await orchestratorService.getMessages(id);
      if (res && res.messages) {
        setMessages(res.messages);
        setConversationId(id);
      }
    } catch (e) {
      console.error("Failed to load conversation", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    try {
      await orchestratorService.deleteConversation(id);
      setConversations(prev => prev.filter(c => c.conversation_id !== id));
      if (conversationId === id) {
        setMessages([messages[0]]);
        setConversationId(undefined);
      }
    } catch (e) {
      console.error("Failed to delete conversation", e);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await orchestratorService.sendMessage(
        input,
        undefined,
        conversationId
      );

      setConversationId(response.conversation_id);
      setMessages(prev => [...prev, response.ai_response]);
      // Refresh history list if new conversation
      if (!conversationId) loadHistory();
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Failed to get response'}`,
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExampleClick = (prompt: string) => {
    setInput(prompt);
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full flex relative">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0 relative z-30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-md transition-colors ${showHistory ? 'bg-muted text-foreground' : 'hover:bg-muted text-muted-foreground'}`}
              title="History"
            >
              <History className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold tracking-tight">
                {isDocked ? 'AI Assistant' : 'AI Workflow Builder'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={() => {
                setMessages([messages[0]]);
                setConversationId(undefined);
              }}
              className="p-2 text-muted-foreground hover:text-destructive hover:bg-muted rounded-md transition-colors"
              title="Clear Chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            {onClose && (
              <button 
                onClick={onClose}
                className="p-2 hover:bg-muted rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : ''}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className={`max-w-[85%] ${message.role === 'user' ? 'order-1' : ''}`}>
                  <div
                    className={`p-4 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                        : 'bg-muted rounded-tl-sm'
                    }`}
                  >
                    <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                  </div>
                  
                  {/* Actions */}
                  <div className={`flex items-center gap-2 mt-2 ${message.role === 'user' ? 'justify-end' : ''}`}>
                    <button
                      onClick={() => copyToClipboard(message.content, `msg-${index}`)}
                      className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                    >
                      {copiedId === `msg-${index}` ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(message.created_at)}
                    </span>
                  </div>
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {(isLoading) && (
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="p-4 bg-muted rounded-2xl rounded-tl-sm">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Example Prompts - Only show on empty chat */}
        {messages.length === 1 && !conversationId && (
          <div className="px-4 pb-2">
            <div className="max-w-3xl mx-auto">
              <p className="text-sm text-muted-foreground mb-2">Try these examples:</p>
              <div className="flex flex-col gap-2">
                {examplePrompts.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => handleExampleClick(prompt)}
                    className="w-full p-3 bg-secondary/20 hover:bg-secondary/50 border border-border/50 hover:border-primary/20 rounded-xl text-sm transition-all text-left shadow-sm hover:shadow group relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                    <span className="relative z-10 text-foreground/80 group-hover:text-foreground">
                      {prompt}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className={`p-4 border-t border-border bg-card relative z-20 ${isDocked ? 'pb-20' : 'pb-4'}`}>
          <div className="max-w-3xl mx-auto flex flex-col gap-3 mb-2">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative bg-background border border-input rounded-2xl focus-within:ring-2 focus-within:ring-ring transition-all group shadow-sm flex items-end gap-2 p-2">
                
                {/* Media Button */}
                <div className="relative flex items-center justify-center w-10 h-10 rounded-xl shrink-0">
                  <button
                    onClick={() => hasCredentials !== false && setShowMediaMenu(!showMediaMenu)}
                    disabled={hasCredentials === false}
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                      showMediaMenu && "text-primary bg-primary/10 rotate-45"
                    )}
                  >
                    <PlusCircle className="w-6 h-6" />
                  </button>

                  {/* Media Menu (Upward) */}
                  {showMediaMenu && (
                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-card border border-border rounded-xl shadow-2xl p-2 z-50 animate-in slide-in-from-bottom-2 duration-200">
                      <button className="w-full flex items-center gap-3 p-2.5 hover:bg-muted rounded-lg text-xs font-semibold text-foreground/80 hover:text-primary transition-all">
                        <ImageIcon className="w-4 h-4" />
                        Upload Image
                      </button>
                      <button className="w-full flex items-center gap-3 p-2.5 hover:bg-muted rounded-lg text-xs font-semibold text-foreground/80 hover:text-primary transition-all">
                        <FileIcon className="w-4 h-4" />
                        Upload PDF
                      </button>
                      <button className="w-full flex items-center gap-3 p-2.5 hover:bg-muted rounded-lg text-xs font-semibold text-foreground/80 hover:text-primary transition-all">
                        <Camera className="w-4 h-4" />
                        Take Screenshot
                      </button>
                    </div>
                  )}
                </div>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={hasCredentials === false ? "Credential configuration required..." : "Ask me anything..."}
                  disabled={hasCredentials === false}
                  className={cn(
                    "w-full bg-transparent border-none focus:outline-none resize-none max-h-[160px] overflow-y-auto text-sm leading-relaxed py-2.5 scrollbar-thin scrollbar-thumb-border",
                    hasCredentials === false && "cursor-not-allowed opacity-50 bg-muted/20"
                  )}
                  rows={1}
                />

                {/* Send Button */}
                <div className="shrink-0 pb-1">
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading || hasCredentials === false}
                    className="w-8 h-8 bg-primary text-primary-foreground rounded-full shadow-lg shadow-primary/20 hover:bg-primary/90 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                  >
                    {isLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : hasCredentials === false ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Model Selector - Wide enough to accommodate text */}
          <div className="absolute bottom-4 left-4 right-36 z-[60] animate-in slide-in-from-bottom-2 duration-300">
              <div className="relative inline-block w-full">
                <button 
                  onClick={() => setIsModelOpen(!isModelOpen)}
                  className="flex items-center gap-3 px-3 py-2 bg-card/80 backdrop-blur-md border border-border/50 hover:bg-muted/50 rounded-xl shadow-sm transition-all active:scale-95 group text-left w-full justify-between"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0">
                      <span className="text-sm leading-none">
                        {dynamicProviders.find(p => p.slug === llmProvider)?.icon || '🤖'}
                      </span>
                    </div>
                    <div className="flex flex-col items-start leading-[1.1] min-w-0">
                      <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Model</span>
                      <span className="text-xs font-bold text-foreground truncate block max-w-[140px]">
                        {dynamicProviders.find(p => p.slug === llmProvider)?.models.find(m => m.value === llmModel)?.name || llmModel}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-300 shrink-0 ml-auto ${isModelOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu - Explicit width to avoid squashing */}
                {isModelOpen && (
                  <>
                    <div className="fixed inset-0 z-[55]" onClick={() => setIsModelOpen(false)} />
                    <div className="absolute bottom-[110%] left-0 w-[280px] bg-card border border-border rounded-xl shadow-xl z-[60] p-3 animate-in slide-in-from-bottom-2 duration-200">
                        <div className="space-y-4">
                          <div>
                              <label className="text-[10px] font-bold uppercase text-muted-foreground mb-2 block px-1">AI Provider</label>
                              <div className="grid grid-cols-3 gap-2">
                                {dynamicProviders.map(p => (
                                  <button
                                    key={p.slug}
                                    onClick={() => {
                                      setLlmProvider(p.slug);
                                    }}
                                      className={cn(
                                      "p-2 rounded-xl border text-sm transition-all flex flex-col items-center gap-1.5",
                                      llmProvider === p.slug 
                                        ? "bg-primary/10 border-primary text-primary shadow-sm ring-1 ring-primary/20" 
                                        : "border-border/50 hover:border-primary/30 hover:bg-muted/50",
                                      !p.has_credentials && p.slug !== 'ollama' && "opacity-50"
                                    )}
                                  >
                                    <span className="text-xl">{p.icon}</span>
                                    <span className="text-[9px] font-bold">{p.name}</span>
                                  </button>
                                ))}
                              </div>
                          </div>
                          <div>
                              <label className="text-[10px] font-bold uppercase text-muted-foreground mb-2 block px-1">Select Model</label>
                              <div className="px-1 mb-2">
                                <input
                                  type="text"
                                  placeholder="Search models..."
                                  value={modelSearchQuery}
                                  onChange={(e) => setModelSearchQuery(e.target.value)}
                                  className="w-full bg-muted/50 border border-border/50 px-3 py-1.5 rounded-lg text-[11px] focus:ring-1 focus:ring-primary/20 outline-none"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div className="space-y-1 max-h-[160px] overflow-y-auto scrollbar-thin scrollbar-thumb-border pr-1">
                                {dynamicProviders.find(p => p.slug === llmProvider)?.models
                                  .filter(m => {
                                    const q = modelSearchQuery.toLowerCase().trim();
                                    if (!q) return true;
                                    const matchesName = m.name.toLowerCase().includes(q) || m.value.toLowerCase().includes(q);
                                    if (matchesName) return true;
                                    if (q === 'free' && m.is_free === true) return true;
                                    if (q === 'paid' && m.is_free === false) return true;
                                    return false;
                                  })
                                  .map(m => (
                                  <button
                                    key={m.value}
                                    onClick={() => {
                                      setLlmModel(m.value);
                                      setIsModelOpen(false);
                                    }}
                                    className={cn(
                                      "w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-foreground",
                                      llmModel === m.value 
                                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                                    )}
                                  >
                                    {m.name}
                                  </button>
                                ))}
                                {(() => {
                                  const filtered = (dynamicProviders.find(p => p.slug === llmProvider)?.models || [])
                                    .filter(m => {
                                      const q = modelSearchQuery.toLowerCase().trim();
                                      if (!q) return true;
                                      const matchesName = m.name.toLowerCase().includes(q) || m.value.toLowerCase().includes(q);
                                      if (matchesName) return true;
                                      if (q === 'free' && m.is_free === true) return true;
                                      if (q === 'paid' && m.is_free === false) return true;
                                      return false;
                                    });
                                  return filtered.length === 0 ? (
                                    <div className="px-3 py-4 text-center text-[10px] text-muted-foreground italic">
                                      No models found matching "{modelSearchQuery}"
                                    </div>
                                  ) : null;
                                })()}
                              </div>
                          </div>
                        </div>
                    </div>
                  </>
                )}
              </div>
          </div>
        </div>
      </div>

      {/* Chat History Sidebar */}
      <div 
        className={cn(
          isDocked ? "absolute inset-0 z-50 w-full" : "w-72 border-l border-border",
          "bg-card flex flex-col shadow-xl transition-all duration-300 ease-in-out-back",
          showHistory 
            ? "translate-x-0 opacity-100" 
            : "translate-x-full opacity-0 pointer-events-none absolute right-0 top-0 bottom-0 z-0",
          !isDocked && !showHistory && "w-0 border-none"
        )}
      >
        <div className="p-4 border-b border-border flex justify-between items-center bg-card shrink-0">
           <span className="font-semibold text-sm">Past Conversations</span>
           <button 
             onClick={() => setShowHistory(false)} 
             className="p-1 hover:bg-muted rounded transition-colors"
           >
             <X className="w-4 h-4" />
           </button>
        </div>
        <div className="p-4 border-b border-border bg-card shrink-0">
          <button 
            onClick={() => {
              setMessages([messages[0]]);
              setConversationId(undefined);
              if (isDocked) setShowHistory(false);
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-card custom-scrollbar">
          {conversations.length === 0 ? (
             <div className="p-4 text-center text-sm text-muted-foreground italic">
               No history found
             </div>
          ) : (
            <div className="divide-y divide-border">
              {conversations.map((conv) => (
                <div
                  key={conv.conversation_id}
                  className={cn(
                    "w-full text-left p-4 hover:bg-muted/50 transition-all group relative cursor-pointer",
                    conversationId === conv.conversation_id && "bg-muted/80 ring-1 ring-inset ring-primary/20"
                  )}
                  onClick={() => {
                    loadConversation(conv.conversation_id);
                    if (isDocked) setShowHistory(false);
                  }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <History className="w-3 h-3 text-primary/60" />
                    <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 rounded">
                      {conv.conversation_id.slice(0, 8)}
                    </span>
                  </div>
                  <div className="text-sm truncate font-semibold text-foreground/90">Conversation</div>
                  
                  <button
                    onClick={(e) => handleDeleteConversation(e, conv.conversation_id)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-destructive hover:text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-sm"
                    title="Delete Conversation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
