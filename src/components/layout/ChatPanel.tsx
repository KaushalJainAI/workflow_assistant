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
  ChevronDown,
  RotateCcw,
  ArrowUpFromLine,
  Pencil,
  Globe2,
  Video,
  Play,
  Monitor
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { orchestratorService, type ChatMessage } from '../../api';
import { cn } from '../../lib/utils';
import { useAssistant } from '../../contexts/AssistantContext';
import { useCanvasAgentContext } from '../../contexts/CanvasAgentContext';
import { TextSelectionMenu } from '../chat/TextSelectionMenu';
import { useAIModels } from '../../hooks/useAIModels';
import { useBuddy } from '../../hooks/useBuddy';

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
  const [deletingMsgId, setDeletingMsgId] = useState<number | null>(null);
  const [expandedImagesMsgId, setExpandedImagesMsgId] = useState<number | null>(null);
  const [expandedVideosMsgId, setExpandedVideosMsgId] = useState<number | null>(null);
  const [thinkingTime, setThinkingTime] = useState(0);
  const [thinkingStatus, setThinkingStatus] = useState('Thinking...');

  // Text Selection State
  const [selectionPos, setSelectionPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const [activeReference, setActiveReference] = useState<{ messageId: number; textSnippet: string } | null>(null);
  
  const [conversations, setConversations] = useState<{conversation_id: string}[]>([]);
  
  const { hasCredentials, llmProvider, setLlmProvider, llmModel, setLlmModel } = useAssistant();
  const canvasAgent = useCanvasAgentContext();
  const { providers: dynamicProviders } = useAIModels();
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  
  // Buddy context integration
  const [screenContextEnabled, setScreenContextEnabled] = useState(true);
  const { isConnected: buddyConnected, captureContext, buddyAction } = useBuddy(screenContextEnabled);
  
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

  // Thinking Timer & Status cycling
  useEffect(() => {
    let timer: any;
    let statusInterval: any;
    
    if (isLoading) {
      setThinkingTime(0);
      setThinkingStatus('Thinking...');
      
      timer = setInterval(() => {
        setThinkingTime(prev => prev + 0.1);
      }, 100);

      const statuses = [
        'Analyzing workflow...',
        'Checking credentials...',
        'Orchestrating agent...',
        'Generating response...',
        'Polishing results...'
      ];
      let statusIdx = 0;
      statusInterval = setInterval(() => {
        statusIdx++;
        setThinkingStatus(statuses[statusIdx % statuses.length]);
      }, 2500);
    } else {
      setThinkingTime(0);
    }

    return () => {
      clearInterval(timer);
      clearInterval(statusInterval);
    };
  }, [isLoading]);

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

  useEffect(() => {
    if (!initialConversationId && !conversationId) {
      loadHistory().then(res => {
        if (res && res.conversations && res.conversations.length > 0) {
          loadConversation(res.conversations[0].conversation_id);
        }
      });
    }
  }, []);

  const loadHistory = async () => {
    try {
      const res = await orchestratorService.getMessages();
      if (res && res.conversations) {
        setConversations(res.conversations);
      }
      return res;
    } catch (e) {
      console.error("Failed to load history", e);
      return null;
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

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput ?? input;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: textToSend,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    if (!overrideInput) setInput('');
    setIsLoading(true);

    try {
      // If user explicitly asks Copilot or we're in the Workflow Editor, route to Platform Copilot
      const isCopilotMode = textToSend.startsWith('/copilot ');
      const copilotText = isCopilotMode ? textToSend.replace('/copilot ', '') : textToSend;

      // Use Copilot for Canvas/Platform actions if specifically requested
      if (canvasAgent && isCopilotMode) {
        const result = await canvasAgent.sendInstruction(copilotText);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: result ? result.message : 'No actions applied.',
          created_at: new Date().toISOString(),
        }]);
        return;
      }

      const reference = activeReference ? { message_id: activeReference.messageId, snippet: activeReference.textSnippet } : undefined;
      const screenContext = screenContextEnabled ? captureContext() : undefined;

      const response = await orchestratorService.sendMessage(
        textToSend,
        undefined,
        conversationId,
        llmProvider,
        llmModel,
        reference,
        screenContext
      );

      setActiveReference(null);

      setConversationId(response.conversation_id);
      setMessages(prev => {
        const newMsgs = [...prev];
        const userMsgIndex = newMsgs.findIndex(m => m.id === userMessage.id);
        if (userMsgIndex !== -1) {
          newMsgs[userMsgIndex] = { ...newMsgs[userMsgIndex], id: response.user_message.id };
        }
        return [...newMsgs, response.ai_response];
      });
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

  const handleDeleteMessage = async (messageId: number) => {
    if (!conversationId) return;
    try {
      setDeletingMsgId(messageId);
      await orchestratorService.deleteMessage(conversationId, messageId);
      setMessages(messages.filter(m => m.id !== messageId));
      toast.success('Message deleted');
    } catch (err) {
      toast.error('Failed to delete message');
    } finally {
      setDeletingMsgId(null);
    }
  };

  const handleRewriteMessage = async (messageId: number) => {
    if (!conversationId) return;
    try {
      setDeletingMsgId(messageId);
      
      const targetIndex = messages.findIndex(m => m.id === messageId);
      if (targetIndex === -1) return;

      let precedingUserMsgIndex = targetIndex - 1;
      while (precedingUserMsgIndex >= 0 && messages[precedingUserMsgIndex].role !== 'user') {
        precedingUserMsgIndex--;
      }

      if (precedingUserMsgIndex === -1 || !messages[precedingUserMsgIndex].id) {
        toast.error('Could not find the original prompt to rewrite');
        return;
      }

      const userMsg = messages[precedingUserMsgIndex];

      await orchestratorService.deleteMessage(conversationId, userMsg.id as number, true);
      
      setMessages(messages.slice(0, precedingUserMsgIndex));
      
      handleSend(userMsg.content);
      toast.success('Regenerating response...');
    } catch (err) {
      toast.error('Failed to rewrite message');
    } finally {
      setDeletingMsgId(null);
    }
  };

  const handleRewindAfterMessage = async (messageId: number) => {
    if (!conversationId) return;
    try {
      setDeletingMsgId(messageId);
      await orchestratorService.deleteMessage(conversationId, messageId, false, true);
      
      const targetIndex = messages.findIndex(m => m.id === messageId);
      if (targetIndex !== -1) {
        const targetMessage = messages[targetIndex];
        setMessages(messages.slice(0, targetIndex + 1));
        setInput(targetMessage.content);
        setTimeout(() => {
          textareaRef.current?.focus();
        }, 50);
      }
      toast.success('Message ready to edit');
    } catch (err) {
      toast.error('Failed to reverse context');
    } finally {
      setDeletingMsgId(null);
    }
  };

  const handleEditMessage = async (messageId: number, content: string) => {
    if (!conversationId) return;
    try {
      setDeletingMsgId(messageId);
      await orchestratorService.deleteMessage(conversationId, messageId, true);
      
      const targetIndex = messages.findIndex(m => m.id === messageId);
      if (targetIndex !== -1) {
        setMessages(messages.slice(0, targetIndex));
      }
      setInput(content);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
      toast.success('Message ready to edit');
    } catch (err) {
      toast.error('Failed to prepare message for editing');
    } finally {
      setDeletingMsgId(null);
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

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      if (selectionPos) setSelectionPos(null);
      return;
    }
    
    const text = selection.toString().trim();
    if (!text) {
      if (selectionPos) setSelectionPos(null);
      return;
    }

    let node = selection.anchorNode;
    let messageId = null;
    while (node && node !== document.body) {
      if (node.nodeType === 1 && (node as HTMLElement).hasAttribute('data-message-id')) {
        messageId = parseInt((node as HTMLElement).getAttribute('data-message-id') || '', 10);
        break;
      }
      node = node.parentNode;
    }

    if (messageId) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectionPos({
        x: rect.left + rect.width / 2,
        y: rect.top
      });
      setSelectedMessageId(messageId);
      setSelectedText(text);
    } else {
      setSelectionPos(null);
    }
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
              onClick={() => setScreenContextEnabled(!screenContextEnabled)}
              className={cn(
                "p-2 rounded-md transition-all relative",
                screenContextEnabled 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-muted"
              )}
              title={screenContextEnabled ? "Screen Context: On" : "Screen Context: Off"}
            >
              <Monitor className="w-4 h-4" />
              {screenContextEnabled && (
                <span className={cn(
                  "absolute top-1 right-1 w-1.5 h-1.5 rounded-full",
                  buddyConnected ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" : "bg-yellow-500 animate-pulse"
                )} />
              )}
            </button>
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
        <div 
          className="flex-1 overflow-auto p-4"
          onMouseUp={handleTextSelection}
          onKeyUp={handleTextSelection}
        >
          <div className="max-w-3xl mx-auto space-y-6 relative">
            
            <TextSelectionMenu 
              position={selectionPos}
              onClose={() => setSelectionPos(null)}
              onCopy={() => {
                navigator.clipboard.writeText(selectedText);
                toast.success('Text copied to clipboard');
                setSelectionPos(null);
                window.getSelection()?.removeAllRanges();
              }}
              onReference={() => {
                if (selectedMessageId) {
                  setActiveReference({ messageId: selectedMessageId, textSnippet: selectedText });
                  textareaRef.current?.focus();
                }
                setSelectionPos(null);
                window.getSelection()?.removeAllRanges();
              }}
            />

            {messages.map((message, index) => (
              <div
                key={index}
                data-message-id={message.id}
                className={`flex gap-4 group ${message.role === 'user' ? 'justify-end' : ''}`}
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
                    <div className="text-sm prose prose-sm dark:prose-invert max-w-none ai-chat-prose">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ href, children, ...props }) => {
                            if (href?.startsWith('citation:')) {
                              const citNum = parseInt(href.split(':')[1]);
                              const src = message.metadata?.sources?.[citNum - 1];
                              return (
                                <div className="relative inline-block group/cit z-20 mx-0.5 align-text-top">
                                  <a 
                                    href={src?.url || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => { if (!src?.url) e.preventDefault(); }}
                                    className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 text-[10px] font-black rounded border border-primary/30 no-underline cursor-pointer transition-all bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground shadow-sm"
                                  >
                                    {citNum}
                                  </a>
                                  {src && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[240px] p-2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl opacity-0 invisible group-hover/cit:opacity-100 group-hover/cit:visible transition-all duration-200 z-50 flex flex-col gap-1 pointer-events-none">
                                      <div className="flex items-center gap-1.5 text-zinc-400">
                                        <Globe2 className="w-3 h-3 shrink-0" />
                                        <span className="text-[9px] uppercase font-bold tracking-wider truncate">
                                          {(() => { try { return new URL(src.url).hostname; } catch { return 'Source'; } })()}
                                        </span>
                                      </div>
                                      <p className="text-[11px] font-medium text-zinc-100 leading-snug line-clamp-2">
                                        {src.title || src.url}
                                      </p>
                                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-0 h-0 border-l-4 border-r-4 border-t-[5px] border-l-transparent border-r-transparent border-t-zinc-800" />
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return (
                              <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium" {...props}>
                                {children}
                              </a>
                            );
                          }
                        }}
                      >
                        {message.content.replace(/\[(\d+)\]/g, '[$1](citation:$1)')}
                      </ReactMarkdown>
                    </div>

                    {/* Image Results — Expandable Sidebar Version */}
                    {message.role === 'assistant' && message.metadata?.images && message.metadata.images.length > 0 && (() => {
                      const imgs = message.metadata.images;
                      const isExpanded = expandedImagesMsgId === message.id;
                      return (
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center gap-2 px-1">
                            <ImageIcon className="w-3.5 h-3.5 text-emerald-500/80" />
                            <span className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground/90">Photos</span>
                            <span className="text-xs font-bold text-muted-foreground/60">{imgs.length} found</span>
                            <div className="h-px flex-1 bg-border/40" />
                          </div>
                          
                          {!isExpanded ? (
                            <button
                              onClick={() => setExpandedImagesMsgId(message.id as number)}
                              className="flex items-center gap-2 px-3 py-1.5 mt-1 text-xs font-bold text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-all shadow-sm"
                            >
                              View {imgs.length} Images
                            </button>
                          ) : (
                            <div className="space-y-2.5">
                              <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                {imgs.map((img: any, idx: number) => (
                                  <a
                                    key={idx}
                                    href={img.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group relative aspect-video bg-muted rounded-lg overflow-hidden border border-border block hover:border-emerald-500/50 transition-colors shadow-sm"
                                    title={img.title}
                                  >
                                    <img 
                                      src={img.image} 
                                      alt={img.title}
                                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                      loading="lazy"
                                      onError={(e) => {
                                         (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjOGI1Y2Y2IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHJlY3QgeD0iMyIgeT0iMyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiByeD0iMiIgcnk9IjIiPjwvcmVjdD48Y2lyY2xlIGN4PSI4LjUiIGN5PSI4LjUiIHI9IjEuNSI+PC9jaXJjbGU+PHBvbHlsaW5lIHBvaW50cz0iMjEgMTUgMTYgMTAgNSAyMSI+PC9wb2x5bGluZT48L3N2Zz4=';
                                      }}
                                    />
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 pt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <p className="text-[9px] text-white/90 font-medium truncate">{img.title}</p>
                                    </div>
                                  </a>
                                ))}
                              </div>
                              <button
                                onClick={() => setExpandedImagesMsgId(null)}
                                className="flex flex-row items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-muted-foreground bg-muted/50 hover:bg-muted border border-border/40 rounded-lg transition-all"
                              >
                                <ChevronDown className="w-2.5 h-2.5 rotate-180" /> Hide
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Video Results — Expandable Sidebar Version */}
                    {message.role === 'assistant' && message.metadata?.videos && message.metadata.videos.length > 0 && (() => {
                      const vids = message.metadata.videos;
                      const isExpanded = expandedVideosMsgId === message.id;
                      return (
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center gap-2 px-1">
                            <Video className="w-3.5 h-3.5 text-purple-500/80" />
                            <span className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground/90">Videos</span>
                            <span className="text-xs font-bold text-muted-foreground/60">{vids.length} found</span>
                            <div className="h-px flex-1 bg-border/40" />
                          </div>
                          
                          {!isExpanded ? (
                            <button
                              onClick={() => setExpandedVideosMsgId(message.id as number)}
                              className="flex items-center gap-2 px-3 py-1.5 mt-1 text-xs font-bold text-purple-600 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg transition-all shadow-sm"
                            >
                              View {vids.length} Videos
                            </button>
                          ) : (
                            <div className="space-y-2.5">
                              <div className="grid grid-cols-1 gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                {vids.map((vid: any, idx: number) => {
                                  // Extract YT video ID for thumbnail
                                  let thumbUrl = '';
                                  const ytMatch = vid.url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
                                  if (ytMatch && ytMatch[1]) {
                                    thumbUrl = `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`;
                                  }
                                  return (
                                    <a
                                      key={idx}
                                      href={vid.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="group flex gap-2.5 p-2 bg-card/60 rounded-lg border border-border/50 hover:border-purple-500/50 transition-colors shadow-sm"
                                    >
                                      <div className="relative shrink-0 w-24 aspect-video bg-muted rounded-md overflow-hidden flex items-center justify-center">
                                        {thumbUrl ? (
                                          <img src={thumbUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        ) : (
                                          <Video className="w-5 h-5 text-muted-foreground/30" />
                                        )}
                                        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                                        <div className="absolute flex items-center justify-center w-6 h-6 rounded-full bg-black/50 backdrop-blur-sm shadow-lg pointer-events-none group-hover:scale-110 transition-transform">
                                          <Play className="w-2.5 h-2.5 text-white ml-0.5" fill="currentColor" />
                                        </div>
                                        {vid.duration && (
                                          <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/80 rounded-[3px] block text-[8px] font-bold text-white tracking-wider">
                                            {vid.duration}
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex flex-col flex-1 min-w-0 py-0.5 justify-center">
                                        <h4 className="text-xs font-semibold text-foreground/90 line-clamp-2 leading-snug group-hover:text-purple-400 transition-colors">
                                          {vid.title}
                                        </h4>
                                      </div>
                                    </a>
                                  );
                                })}
                              </div>
                              <button
                                onClick={() => setExpandedVideosMsgId(null)}
                                className="flex flex-row items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-muted-foreground bg-muted/50 hover:bg-muted border border-border/40 rounded-lg transition-all"
                              >
                                <ChevronDown className="w-2.5 h-2.5 rotate-180" /> Hide
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  
                  {/* Actions */}
                  <div className={cn(
                    "flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200",
                    message.role === 'user' ? 'justify-end' : ''
                  )}>
                    <button
                      onClick={() => copyToClipboard(message.content, `msg-${index}`)}
                      className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                      title="Copy message"
                    >
                      {copiedId === `msg-${index}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {message.role !== 'user' && message.id && (
                      <button
                        onClick={() => handleRewriteMessage(message.id as number)}
                        disabled={deletingMsgId === message.id}
                        className="p-1 hover:bg-amber-500/10 rounded text-muted-foreground hover:text-amber-500 disabled:opacity-50"
                        title="Rewrite prompt (regenerates response without subsequent context)"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {message.role === 'user' && message.id && (
                      <button
                        onClick={() => handleRewindAfterMessage(message.id as number)}
                        disabled={deletingMsgId === message.id}
                        className="p-1 hover:bg-emerald-500/10 rounded text-muted-foreground hover:text-emerald-500 disabled:opacity-50"
                        title="Reverse context (keep this message, delete answers)"
                      >
                        <ArrowUpFromLine className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {message.role === 'user' && message.id && (
                      <button
                        onClick={() => handleEditMessage(message.id as number, message.content)}
                        disabled={deletingMsgId === message.id}
                        className="p-1 hover:bg-blue-500/10 rounded text-muted-foreground hover:text-blue-500 disabled:opacity-50"
                        title="Edit and resend message"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {message.id && (
                      <button
                        onClick={() => handleDeleteMessage(message.id as number)}
                        disabled={deletingMsgId === message.id}
                        className="p-1 hover:bg-red-500/10 rounded text-muted-foreground hover:text-red-500 disabled:opacity-50"
                        title="Delete message"
                      >
                        {deletingMsgId === message.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                    <span className="text-xs text-muted-foreground ml-1">
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

            {isLoading && (
              <div className="flex gap-4 animate-in fade-in duration-300">
                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                </div>
                <div className="flex flex-col gap-2 pt-1.5 flex-1 min-w-0">
                   <div className="flex items-center justify-between gap-2">
                     <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground truncate">
                       {buddyAction || thinkingStatus}
                     </span>
                     <span className="text-[10px] font-mono text-muted-foreground/40 shrink-0">
                       ({thinkingTime.toFixed(1)}s)
                     </span>
                   </div>
                   <div className="w-full max-w-[200px] h-0.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary/40 rounded-full animate-indeterminate-slide" />
                   </div>
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
        {buddyAction && (
          <div className="px-4 py-2 bg-blue-500/10 border-t border-blue-500/20 text-blue-500 text-xs flex items-center justify-center gap-2 font-medium">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Buddy: {buddyAction}
          </div>
        )}
        <div className={`p-4 border-t border-border bg-card relative z-20 ${isDocked ? 'pb-20' : 'pb-4'}`}>
          <div className="max-w-3xl mx-auto flex flex-col gap-3 mb-2">
            
            {/* Active Reference Pill */}
            {activeReference && (
              <div className="flex animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl max-w-full group">
                   <div className="flex items-center gap-1.5 min-w-0">
                     <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 shrink-0">Reference</span>
                     <div className="w-px h-3 bg-emerald-500/30 shrink-0" />
                     <span className="text-xs font-medium text-emerald-700/80 truncate italic">"{activeReference.textSnippet}"</span>
                   </div>
                   <button 
                     onClick={() => setActiveReference(null)}
                     className="p-1 hover:bg-emerald-500/20 rounded-md transition-colors shrink-0 text-emerald-600/60 hover:text-emerald-600"
                   >
                     <X className="w-3.5 h-3.5" />
                   </button>
                </div>
              </div>
            )}

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
                    onClick={() => handleSend()}
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
              {Array.isArray(conversations) && conversations.map((conv) => (
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
