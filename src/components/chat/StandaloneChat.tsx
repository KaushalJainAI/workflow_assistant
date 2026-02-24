import { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  Copy,
  Check,
  Loader2,
  Plus,
  History,
  X,
  Search,
  Image as ImageIcon,
  Video,

  MessageSquare,
  Shield,
  ChevronDown,
  Cpu,
  BrainCircuit,
  Lock,
  ArrowRight,
  Settings2,
  Sparkles,
  Zap,
  Wand2,
  Globe2
} from 'lucide-react';
import { credentialsService, chatService, type StandaloneChatMessage as ChatMessage, type ChatSession } from '../../api';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

import { useAIModels } from '../../hooks/useAIModels';

export default function StandaloneChat() {
  const navigate = useNavigate();
  
  // --- Chat State ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [conversations, setConversations] = useState<ChatSession[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // --- Model Selection State ---
  const [llmProvider, setLlmProvider] = useState('openrouter');
  const [llmModel, setLlmModel] = useState('google/gemini-2.0-flash-exp:free');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // --- Agentic Features State ---
  const [agentMode, setAgentMode] = useState(false);
  
  const [hasCredentials, setHasCredentials] = useState<boolean | null>(null);
  const [isCheckingCredentials, setIsCheckingCredentials] = useState(true);
  const { providers: dynamicProviders } = useAIModels();
  const [modelSearchQuery, setModelSearchQuery] = useState('');

  // --- Effects ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle auto-expanding textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  useEffect(() => {
    const checkAuthAndSettings = async () => {
      setIsCheckingCredentials(true);
      try {
        const { credentials } = await credentialsService.list();
        const hasAnyValid = credentials.some(c => c.is_valid);
        setHasCredentials(hasAnyValid);

        const savedProvider = localStorage.getItem('standalone_chat_llm_provider');
        const savedModel = localStorage.getItem('standalone_chat_llm_model');
        if (savedProvider) setLlmProvider(savedProvider);
        if (savedModel) setLlmModel(savedModel);
      } catch (err) {
        console.error("Failed to initialize chat:", err);
        setHasCredentials(false);
      } finally {
        setIsCheckingCredentials(false);
      }
    };

    checkAuthAndSettings();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadHistory = async () => {
    try {
      const res = await chatService.getSessions();
      if (res) setConversations(res);
    } catch (e) {
      console.error("Failed to load history", e);
    }
  };

  useEffect(() => {
    if (showHistory) loadHistory();
  }, [showHistory]);

  const saveLLMSettings = async (provider: string, model: string) => {
    localStorage.setItem('standalone_chat_llm_provider', provider);
    localStorage.setItem('standalone_chat_llm_model', model);
    setLlmProvider(provider);
    setLlmModel(model);
    setShowModelDropdown(false);
    
    if (conversationId) {
      try {
        await chatService.updateSession(conversationId, { llm_provider: provider, llm_model: model });
      } catch (err) {
         console.error('Failed to update session settings', err);
      }
    }
    
    toast.success(`Chat engine switched to ${model}`);
  };

  const handleSend = async (type: 'normal' | 'search' | 'image' | 'video' | 'research' = 'normal') => {
    if ((!input.trim() && type === 'normal') || isLoading || !hasCredentials) return;

    let content = input;
    if (type === 'search') content = `/search ${input}`;
    else if (type === 'image') content = `/image ${input}`;
    else if (type === 'video') content = `/video ${input}`;
    else if (type === 'research') content = `/research ${input}`;

    const userMessage: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: content || (type !== 'normal' ? `Initiating ${type}...` : ''),
      metadata: {},
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      let currentSessionId = conversationId;
      if (!currentSessionId) {
        const newSession = await chatService.createSession({
          title: content.slice(0, 30) + '...',
          llm_provider: llmProvider,
          llm_model: llmModel,
          system_prompt: ""
        });
        currentSessionId = newSession.id;
        setConversationId(newSession.id);
        
        // Also refresh the history so it shows up
        if (showHistory) loadHistory();
      }

      const response = await chatService.sendMessage(currentSessionId, content);
      
      setMessages(prev => [...prev, response.ai_response as unknown as ChatMessage]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Failed to get response'}`,
        created_at: new Date().toISOString(),
      } as ChatMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const isInitialState = messages.length === 0;

  if (isCheckingCredentials) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (hasCredentials === false) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full p-8 bg-card border border-border rounded-3xl shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-500 glass">
          <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
            <Lock className="w-8 h-8 text-amber-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-tight uppercase">Access Restricted</h2>
            <p className="text-muted-foreground text-sm font-medium">Configure a valid LLM credential to unlock Quantum Intelligence.</p>
          </div>
          <button 
            onClick={() => navigate('/credentials')}
            className="w-full h-12 bg-primary text-primary-foreground font-black rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 group"
          >
            Configure Credentials
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-background overflow-hidden relative font-inter">
      {/* Premium Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(var(--primary-rgb),0.05),transparent_50%)] pointer-events-none" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/5 blur-[100px] rounded-full pointer-events-none" />

      {/* 1. History Sidebar */}
      <>
        {/* Overlay */}
        {showHistory && (
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30"
            onClick={() => setShowHistory(false)}
          />
        )}

        <div
          className={cn(
            "fixed left-0 top-0 h-full w-[300px] bg-card/80 backdrop-blur-xl border-r border-border/60 transition-transform duration-400 ease-in-out flex flex-col z-40 shadow-2xl",
            showHistory ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="h-16 px-6 flex items-center justify-between border-b border-border/40">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-primary/70" />
              <h2 className="font-bold text-xs uppercase tracking-widest">
                Conversations
              </h2>
            </div>
            <button
              onClick={() => setShowHistory(false)}
              className="p-2 hover:bg-muted rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4">
            <button
              onClick={() => {
                setMessages([]);
                setConversationId(undefined);
                setShowHistory(false);
              }}
              className="w-full h-11 flex items-center gap-3 px-4 rounded-xl bg-primary/10 hover:bg-primary/20 text-sm font-semibold transition"
            >
              <Plus className="w-4 h-4" />
              New Conversation
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-2">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={async () => {
                  setIsLoading(true);
                  try {
                    const sessionDetails = await chatService.getSession(conv.id);
                    if (sessionDetails?.messages) {
                      setMessages(sessionDetails.messages as unknown as ChatMessage[]);
                      setConversationId(conv.id);
                      setLlmProvider(sessionDetails.llm_provider);
                      setLlmModel(sessionDetails.llm_model);
                      setShowHistory(false);
                    }
                  } finally {
                    setIsLoading(false);
                  }
                }}
                className={cn(
                  "w-full p-3 rounded-xl text-left transition flex items-center gap-3 text-xs",
                  conversationId === conv.id
                    ? "bg-primary/10 border border-primary/30"
                    : "hover:bg-muted/60"
                )}
              >
                <MessageSquare className="w-4 h-4 opacity-60" />
                <span className="truncate font-mono">
                  {conv.title || conv.id.slice(0, 18)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </>

      {/* 2. Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative min-w-0 z-10">
        
        {/* Transparent Header */}
        <header className="h-16 flex items-center px-6 justify-between border-b border-border/40 backdrop-blur-md bg-background/50">
          <div className="flex items-center gap-3">
            {!showHistory && (
              <button 
                onClick={() => setShowHistory(true)} 
                className="p-3 bg-card/40 border border-border/60 hover:bg-card/60 rounded-2xl transition-all text-muted-foreground group"
              >
                <History className="w-5 h-5 group-hover:text-primary transition-colors" />
              </button>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-card/40 border border-border/40 rounded-xl">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/60">Quantum Core Online</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl text-[10px] font-bold text-emerald-600 uppercase tracking-widest shadow-sm">
                <Shield className="w-3.5 h-3.5" />
                Encrypted Session
             </div>
          </div>
        </header>

        {/* Dynamic Transition Area */}
        <div className={cn(
          "flex-1 overflow-y-auto px-6 pt-8 pb-24 transition-all duration-1000 ease-in-out",
          isInitialState ? "flex items-center justify-center" : "py-10"
        )}>
          <div className={cn(
            "max-w-3xl mx-auto w-full",
            isInitialState ? "flex flex-col items-center" : "space-y-12"
          )}>
            {isInitialState ? (
              <div className="text-center space-y-8 mb-20 animate-in fade-in slide-in-from-bottom-8 duration-1000 scale-105">
                <div className="relative group">
                  <div className="absolute inset-0 bg-primary/20 rounded-[3rem] blur-2xl animate-pulse group-hover:bg-primary/30 transition-all" />
                  <div className="relative w-28 h-28 bg-card border border-primary/20 rounded-[3rem] flex items-center justify-center mx-auto shadow-2xl glass transition-transform group-hover:scale-110 duration-500 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
                    <BrainCircuit className="w-12 h-12 text-primary relative z-10" />
                  </div>
                </div>
                <div className="space-y-3">
                  <h1 className="text-5xl font-black tracking-tight text-foreground/90 uppercase drop-shadow-sm">AIAAS Assistant</h1>
                  <p className="text-muted-foreground font-medium text-xl max-w-lg mx-auto leading-relaxed">
                    Deploying Quantum Intelligence for your most complex inquiries and creative tasks.
                  </p>
                </div>

                {/* Agentic Tools - Home State */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-12 max-w-xl mx-auto">
                   {[
                     { icon: <Search className="w-7 h-7" />, label: "Web Search", type: 'search', color: 'blue' },
                     { icon: <Globe2 className="w-7 h-7" />, label: "Research", type: 'research', color: 'purple' },
                     { icon: <ImageIcon className="w-7 h-7" />, label: "Visual Gen", type: 'image', color: 'emerald' },
                     { icon: <Wand2 className="w-7 h-7" />, label: "Video Gen", type: 'video', color: 'amber' }
                   ].map((tool) => (
                     <button
                       key={tool.label}
                       onClick={() => handleSend(tool.type as 'search' | 'research' | 'image' | 'video')}
                       className={cn(
                         "p-6 rounded-[2.5rem] bg-card border border-border/60 hover:scale-105 transition-all shadow-sm flex flex-col items-center gap-4 group glass pb-5",
                         tool.color === 'blue' && "hover:border-blue-500/50 hover:bg-blue-500/5 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]",
                         tool.color === 'purple' && "hover:border-purple-500/50 hover:bg-purple-500/5 hover:shadow-[0_0_20px_rgba(168,85,247,0.1)]",
                         tool.color === 'emerald' && "hover:border-emerald-500/50 hover:bg-emerald-500/5 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]",
                         tool.color === 'amber' && "hover:border-amber-500/50 hover:bg-amber-500/5 hover:shadow-[0_0_20px_rgba(245,158,11,0.1)]"
                       )}
                     >
                       <div className={cn(
                         "p-4 rounded-2xl bg-muted/40 transition-all duration-500 group-hover:bg-transparent",
                         tool.color === 'blue' && "group-hover:text-blue-500",
                         tool.color === 'purple' && "group-hover:text-purple-500",
                         tool.color === 'emerald' && "group-hover:text-emerald-500",
                         tool.color === 'amber' && "group-hover:text-amber-500"
                       )}>
                         {tool.icon}
                       </div>
                       <span className="text-[11px] font-black uppercase tracking-[0.2em] opacity-40 group-hover:opacity-100 transition-opacity">{tool.label}</span>
                     </button>
                   ))}
                </div>
              </div>
            ) : (
              // Message List
              <div className="space-y-12">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500",
                      message.role === 'user' ? "flex-row-reverse" : ""
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-border/40 shadow-md",
                      message.role === 'assistant' 
                        ? "bg-primary text-primary-foreground shadow-primary/20" 
                        : "bg-card glass"
                    )}>
                      {message.role === 'assistant' ? <Bot className="w-6 h-6" /> : <User className="w-6 h-6 text-muted-foreground" />}
                    </div>

                    <div className={cn(
                      "max-w-[75%] space-y-3",
                      message.role === 'user' ? "text-right" : ""
                    )}>
                      <div className={cn(
                        "text-[15px] leading-relaxed tracking-tight",
                        message.role === 'user' 
                          ? "text-foreground font-semibold bg-primary/5 border border-primary/10 p-4 rounded-3xl rounded-tr-none shadow-sm" 
                          : "text-foreground font-medium bg-card/60 p-5 rounded-3xl rounded-tl-none shadow-sm glass border border-border/40"
                      )}>
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      </div>
                      
                      <div className={cn(
                        "flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                        message.role === 'user' ? "justify-end mr-2" : "ml-2"
                      )}>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(message.content);
                            setCopiedId(`msg-${index}`);
                            setTimeout(() => setCopiedId(null), 2000);
                          }}
                          className="text-muted-foreground hover:text-primary transition-all p-1.5 hover:bg-primary/5 rounded-lg"
                        >
                          {copiedId === `msg-${index}` ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isLoading && (
              <div className="flex gap-6 animate-pulse">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 shadow-inner">
                  <Sparkles className="w-5 h-5 text-primary/40" />
                </div>
                <div className="flex items-center gap-1.5 mt-3">
                  <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Dynamic Navigation/Input Area */}
        <footer className={cn(
          "shrink-0 transition-all duration-1000 ease-in-out font-inter",
          isInitialState ? "pb-20" : "pb-10 px-4 pt-4"
        )}>
          <div className="max-w-3xl mx-auto space-y-8">
            
            <div className="relative group/input">
              
              {/* Floating Tool Pulsars (Bottom State Only) */}
              {!isInitialState && !input.trim() && !isLoading && (
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-3 absolute -top-14 left-0 right-0 z-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                   <button onClick={() => handleSend('search')} className="group/btn h-9 px-4 rounded-full border border-border/80 bg-card/80 backdrop-blur-md hover:border-blue-500/50 hover:bg-blue-500/10 flex items-center gap-2.5 text-[10px] font-black uppercase tracking-widest transition-all text-muted-foreground hover:text-blue-500 shadow-xl">
                    <Search className="w-3.5 h-3.5" /> <span className="opacity-70 group-hover/btn:opacity-100 transition-opacity">Search</span>
                  </button>
                  <button onClick={() => handleSend('research')} className="group/btn h-9 px-4 rounded-full border border-border/80 bg-card/80 backdrop-blur-md hover:border-purple-500/50 hover:bg-purple-500/10 flex items-center gap-2.5 text-[10px] font-black uppercase tracking-widest transition-all text-muted-foreground hover:text-purple-500 shadow-xl">
                    <Zap className="w-3.5 h-3.5" /> <span className="opacity-70 group-hover/btn:opacity-100 transition-opacity">Research</span>
                  </button>
                  <button onClick={() => handleSend('image')} className="group/btn h-9 px-4 rounded-full border border-border/80 bg-card/80 backdrop-blur-md hover:border-emerald-500/50 hover:bg-emerald-500/10 flex items-center gap-2.5 text-[10px] font-black uppercase tracking-widest transition-all text-muted-foreground hover:text-emerald-500 shadow-xl">
                    <ImageIcon className="w-3.5 h-3.5" /> <span className="opacity-70 group-hover/btn:opacity-100 transition-opacity">Visualize</span>
                  </button>
                  <button onClick={() => handleSend('video')} className="group/btn h-9 px-4 rounded-full border border-border/80 bg-card/80 backdrop-blur-md hover:border-amber-500/50 hover:bg-amber-500/10 flex items-center gap-2.5 text-[10px] font-black uppercase tracking-widest transition-all text-muted-foreground hover:text-amber-500 shadow-xl">
                    <Video className="w-3.5 h-3.5" /> <span className="opacity-70 group-hover/btn:opacity-100 transition-opacity">Motion</span>
                  </button>
                </div>
              )}

              {/* Input Capsule Assembly */}
              <div className="relative z-10 transition-transform duration-500">
                <div className="absolute inset-x-0 inset-y-0 bg-primary/10 rounded-2xl blur-3xl opacity-0 group-focus-within/input:opacity-100 transition-opacity duration-700 pointer-events-none" />
                <div className="relative flex items-end gap-3 p-3 bg-card/80 border border-border/80 rounded-2xl glass shadow-2xl focus-within:border-primary/40 transition-all duration-300">
                  
                  {/* Agent Mode Toggle - Now Integrated Inside */}
                  <div className="pb-1.5 pl-1.5">
                      <button 
                        onClick={() => setAgentMode(!agentMode)}
                        title={agentMode ? "Agent Mode Active" : "Enable Agent Mode"}
                        className={cn(
                          "w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-500 border group/agent",
                          agentMode 
                            ? "bg-primary/20 border-primary/40 text-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]" 
                            : "bg-muted/40 border-border/60 text-muted-foreground/40 hover:bg-muted/60 hover:border-border"
                        )}
                      >
                        <Zap className={cn("w-5 h-5 transition-transform", agentMode ? "scale-110 fill-primary" : "scale-90 group-hover/agent:scale-100")} />
                      </button>
                  </div>

                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Deploying Quantum Protocol..."
                    className="flex-1 min-h-[44px] px-4 py-3 bg-transparent border-none focus:ring-0 focus:outline-none resize-none text-lg font-medium placeholder:text-muted-foreground/20 scrollbar-none"
                    rows={1}
                  />
                  <div className="pb-1 pr-1">
                    <button
                      onClick={() => handleSend()}
                      disabled={!input.trim() || isLoading}
                      className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-20 disabled:scale-100 shadow-xl shadow-primary/20 group/send"
                    >
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Integrated Model & Engine Selection Control (Beneath Input) */}
              <div className="flex flex-col items-center mt-6 animate-in fade-in slide-in-from-top-2 duration-700 delay-300">
                <div className="relative" ref={dropdownRef}>
                  <button 
                    onClick={() => setShowModelDropdown(!showModelDropdown)}
                    className="group flex items-center gap-3 px-6 py-2.5 rounded-2xl transition-all border border-border/60 bg-card/40 hover:bg-card hover:border-primary/30 text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground hover:text-foreground active:scale-95 glass shadow-sm"
                  >
                    <Settings2 className="w-3.5 h-3.5 opacity-60 group-hover:text-primary transition-colors" />
                    <span>ENGINE: <span className="text-primary/80">
                      {dynamicProviders.find(p => p.slug === llmProvider)?.models.find(m => m.value === llmModel)?.name || 'FLASH'}
                    </span></span>
                    <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300", showModelDropdown ? "rotate-180" : "opacity-40")} />
                  </button>

                  {showModelDropdown && (
                    <div className="absolute bottom-[calc(100%+16px)] left-1/2 -translate-x-1/2 w-[380px] bg-card/95 border border-border rounded-[2rem] shadow-2xl p-5 animate-in slide-in-from-bottom-4 fade-in zoom-in-95 duration-300 z-[100] glass backdrop-blur-2xl">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 h-4 border-b border-border/20">Provider</p>
                          <div className="max-h-[220px] overflow-y-auto scrollbar-none space-y-1.5 pr-2">
                            {dynamicProviders.map(p => (
                              <button
                                key={p.slug}
                                onClick={() => {
                                  if (p.models.length > 0) {
                                    saveLLMSettings(p.slug, p.models[0].value);
                                  } else {
                                    setLlmProvider(p.slug);
                                  }
                                }}
                                className={cn(
                                  "w-full flex items-center gap-4 p-3.5 rounded-2xl transition-all border text-left",
                                  llmProvider === p.slug 
                                    ? "bg-primary/5 border-primary/30 text-primary shadow-sm" 
                                    : "border-transparent hover:bg-muted/60"
                                )}
                              >
                                <span className="text-xl filter drop-shadow-sm">{p.icon}</span>
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-black leading-none">{p.name}</span>
                                  <span className="text-[9px] opacity-40 mt-1 uppercase tracking-tighter">
                                    {!p.has_credentials && p.slug !== 'ollama' ? 'Missing Credentials' : p.description}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 h-4 border-b border-border/20">Active Model</p>
                          <div className="px-1">
                            <input
                              type="text"
                              placeholder="Filter models..."
                              value={modelSearchQuery}
                              onChange={(e) => setModelSearchQuery(e.target.value)}
                              className="w-full bg-card/60 border border-border/40 px-3 py-2 rounded-xl text-[11px] focus:ring-1 focus:ring-primary/20 outline-none placeholder:text-muted-foreground/40"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div className="max-h-[220px] overflow-y-auto scrollbar-none space-y-1.5 pr-2">
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
                                onClick={() => saveLLMSettings(llmProvider, m.value)}
                                className={cn(
                                  "w-full flex items-center gap-3 p-3.5 rounded-2xl transition-all border text-left",
                                  llmModel === m.value 
                                    ? "bg-primary/5 border-primary/30 text-primary shadow-sm" 
                                    : "border-transparent hover:bg-muted/60"
                                )}
                              >
                                <Cpu className="w-4 h-4 opacity-40 shrink-0" />
                                <span className="text-[11px] font-bold leading-tight uppercase tracking-tight">{m.name}</span>
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
                                <div className="p-8 text-center text-[10px] text-muted-foreground/60 uppercase font-black tracking-widest italic">
                                  No matches found for "{modelSearchQuery}"
                                </div>
                              ) : null;
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Branding Monolith */}
                <div className="mt-8 flex items-center gap-4 opacity-20 pointer-events-none select-none">
                   <div className="h-px w-16 bg-gradient-to-r from-transparent to-foreground" />
                   <p className="text-[9px] font-black uppercase tracking-[0.8em] text-foreground">
                    Intelligence Engine v2.0
                  </p>
                  <div className="h-px w-16 bg-gradient-to-l from-transparent to-foreground" />
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
