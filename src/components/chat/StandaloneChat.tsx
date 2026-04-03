import { useState, useRef, useEffect } from 'react';
import { 
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
  Play,
  File as FileIcon,
  Mic,
  MessageSquare,
  Shield,
  ChevronDown,
  BrainCircuit,
  Lock,
  ArrowUp,
  Settings2,
  Sparkles,
  Zap,
  Wand2,
  Globe2,
  ExternalLink,
  Trash2,
  RotateCcw,
  ArrowUpFromLine,
  Pencil,
  MoreHorizontal,
  Code,
  Folder,
  Boxes,
  Square,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { credentialsService, chatService, type StandaloneChatMessage as ChatMessage, type ChatSession } from '../../api';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { TextSelectionMenu } from './TextSelectionMenu';
import { MediaPreview } from './MediaPreview';

import { useAIModels } from '../../hooks/useAIModels';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export default function StandaloneChat() {
  const navigate = useNavigate();
  
  // Helper to strip XML/HTML tags from tool call argument values
  const stripXmlTags = (val: any): string => {
    if (typeof val !== 'string') return String(val ?? '');
    return val.replace(/<\/?[a-zA-Z_][a-zA-Z0-9_:.-]*[^>]*>/g, '').trim();
  };
  
  // --- Chat State ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const queryClient = useQueryClient();
  const { data: conversations = [], refetch: loadHistory } = useQuery({
    queryKey: ['chatSessions'],
    queryFn: async () => {
      try {
        const res = await chatService.getSessions();
        return res || [];
      } catch (e) {
        console.error("Failed to load history", e);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  // --- Model Selection State ---
  const [llmProvider, setLlmProvider] = useState('openrouter');
  const [llmModel, setLlmModel] = useState('google/gemini-2.0-flash-exp:free');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // --- Agentic Features State ---
  const [isFollowUpsExpanded, setIsFollowUpsExpanded] = useState(true);
  const [activeIntent, setActiveIntent] = useState<'normal' | 'search' | 'image' | 'video' | 'research' | 'coding' | 'file_manipulation' | 'workflow'>('normal');
  const [showMoreIntents, setShowMoreIntents] = useState(false);
  const moreIntentsRef = useRef<HTMLDivElement>(null);
  const [deletingMsgId, setDeletingMsgId] = useState<number | null>(null);
  const [expandedSummaryMsgId, setExpandedSummaryMsgId] = useState<number | null>(null);
  const [expandedSourcesMsgId, setExpandedSourcesMsgId] = useState<number | null>(null);
  const [expandedImagesMsgId, setExpandedImagesMsgId] = useState<number | null>(null);
  const [expandedVideosMsgId, setExpandedVideosMsgId] = useState<number | null>(null);
  const [expandedActivityMsgId, setExpandedActivityMsgId] = useState<number | null>(null);
  const [expandedThinkingMsgId, setExpandedThinkingMsgId] = useState<number | null>(null);
  const [expandedCodeMsgId, setExpandedCodeMsgId] = useState<number | null>(null);
  
  // Text Selection State
  const [selectionPos, setSelectionPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const [activeReference, setActiveReference] = useState<{ messageId: number; textSnippet: string } | null>(null);

  const [hasCredentials, setHasCredentials] = useState<boolean | null>(null);
  const [isCheckingCredentials, setIsCheckingCredentials] = useState(true);
  const { providers: dynamicProviders } = useAIModels();
  const [modelSearchQuery, setModelSearchQuery] = useState('');

  // --- File Upload State ---
  const [isUploading, setIsUploading] = useState(false);

  // --- Live Streaming State (Perplexity-like) ---
  const [liveStatus, setLiveStatus] = useState<{ phase: string; message: string } | null>(null);
  const [liveActivity, setLiveActivity] = useState<Array<{ 
    type: 'tool' | 'thought'; 
    tool?: string; 
    args?: any; 
    iteration?: number; 
    thought?: string;
  }>>([]);
  const [liveSources, setLiveSources] = useState<Array<{ 
    title: string; 
    url: string; 
    snippet?: string;
    thumbnail?: string;
    favicon?: string;
  }>>([]);
  const [liveImages, setLiveImages] = useState<any[]>([]);
  const [liveVideos, setLiveVideos] = useState<any[]>([]);
  
  const [liveThinking, setLiveThinking] = useState('');
  const [liveContent, setLiveContent] = useState('');
  const [liveCodeExecutions, setLiveCodeExecutions] = useState<any[]>([]);
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);
  const [isLiveCodeExpanded, setIsLiveCodeExpanded] = useState(true);
  const [isLiveSourcesExpanded, setIsLiveSourcesExpanded] = useState(true);
  const [isLiveMediaExpanded, setIsLiveMediaExpanded] = useState(true);

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
      if (moreIntentsRef.current && !moreIntentsRef.current.contains(event.target as Node)) {
        setShowMoreIntents(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Validate and sync settings once dynamic providers load
  useEffect(() => {
    if (dynamicProviders.length > 0) {
      const currentProvider = dynamicProviders.find(p => p.slug === llmProvider);
      if (currentProvider) {
        // If the current model isn't in the provider's list, reset to default
        const modelExists = currentProvider.models.some(m => m.value === llmModel);
        if (!modelExists && currentProvider.models.length > 0) {
          const defaultModel = currentProvider.models[0].value;
          setLlmModel(defaultModel);
          localStorage.setItem('standalone_chat_llm_model', defaultModel);
          console.log(`StandaloneChat: Reset invalid model ${llmModel} to ${defaultModel} for provider ${llmProvider}`);
        }
      }
    }
  }, [dynamicProviders, llmProvider, llmModel]);





  const loadConversation = async (id: string) => {
    setIsLoading(true);
    try {
      const session = await chatService.getSession(id);
      if (session && session.messages) {
        setMessages(session.messages as unknown as ChatMessage[]);
        setConversationId(id);
        setCurrentSession(session);
        // Sync LLM settings
        setLlmProvider(session.llm_provider);
        setLlmModel(session.llm_model);
      }
    } catch (e) {
      console.error("Failed to load conversation", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (showHistory) loadHistory();
  }, [showHistory, loadHistory]);

  useEffect(() => {
    if (!conversationId) {
      // Small delay to let useQuery fetch initial data if empty
      setTimeout(() => {
        const sessions = queryClient.getQueryData<ChatSession[]>(['chatSessions']);
        if (sessions && sessions.length > 0) {
          loadConversation(sessions[0].id);
        }
      }, 100);
    }
  }, []);

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

  const processFile = async (file: File) => {
    if (!conversationId) {
      // Need a session first
      try {
        const newSession = await chatService.createSession({
          title: `File Upload: ${file.name}`,
          llm_provider: llmProvider,
          llm_model: llmModel,
          system_prompt: ""
        });
        setConversationId(newSession.id);
        uploadFileToSession(newSession.id, file);
      } catch (err) {
        toast.error("Failed to create session for upload");
      }
    } else {
      uploadFileToSession(conversationId, file);
    }
  };

  const handleDeleteMessage = async (msgId: number) => {
    if (!conversationId) return;
    
    // Safety: If it's a timestamp ID (> 10^12), it hasn't been synced yet
    // but in most cases our new SSE sync will handle this.
    // If it's STILL optimistic, we just remove it locally.
    if (msgId > 1000000000000) {
      setMessages(prev => prev.filter(m => m.id !== msgId));
      return;
    }

    setDeletingMsgId(msgId);
    try {
      await chatService.deleteMessage(conversationId, msgId);
      setMessages(prev => prev.filter(m => m.id !== msgId));
      toast.success("Message deleted");
    } catch (err) {
      toast.error("Failed to delete message");
    } finally {
      setDeletingMsgId(null);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    try {
      await chatService.deleteSession(id);
      queryClient.setQueryData<ChatSession[]>(['chatSessions'], (old = []) => old.filter(c => c.id !== id));
      if (conversationId === id) {
        setMessages([]);
        setConversationId(undefined);
      }
      toast.success("Conversation deleted");
    } catch (err) {
      console.error("Failed to delete conversation", err);
      toast.error("Failed to delete conversation");
    }
  };

  const uploadFileToSession = async (sessionId: string, file: File) => {
    setIsUploading(true);
    try {
      const response = await chatService.uploadFile(sessionId, file);
      toast.success(response.status || "File uploaded successfully");
      // Refresh messages to show the system message about the upload
      const sessionDetails = await chatService.getSession(sessionId);
      if (sessionDetails?.messages) {
        setMessages(sessionDetails.messages as unknown as ChatMessage[]);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRunWorkflow = async (workflowId: number) => {
    if (!conversationId) return;
    setIsLoading(true);
    try {
      const response = await chatService.runWorkflow(conversationId, workflowId);
      setMessages(prev => [...prev, response.ai_response as unknown as ChatMessage]);
      toast.success(`Workflow started: ${response.workflow_name}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to start workflow");
    } finally {
      setIsLoading(false);
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

      await chatService.deleteMessage(conversationId, userMsg.id as number, true);
      
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
    
    // Safety: If it's a timestamp ID, we can't rewind in the backend yet.
    // We just handle it locally.
    if (messageId > 1000000000000) {
      const targetIndex = messages.findIndex(m => m.id === messageId);
      if (targetIndex !== -1) {
        const targetMessage = messages[targetIndex];
        setMessages(messages.slice(0, targetIndex + 1));
        setInput(targetMessage.content);
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
      return;
    }

    try {
      setDeletingMsgId(messageId);
      await chatService.deleteMessage(conversationId, messageId, false, true);
      
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
      await chatService.deleteMessage(conversationId, messageId, true);
      
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

  // Determine if this session has a default intent (but don't lock it)
  const lockedIntent = currentSession?.intent;
  const isLocked = false; // "no lock thing" - removing lock functionality as requested

  useEffect(() => {
    if (lockedIntent && !['chat', 'search', 'normal'].includes(lockedIntent) && !conversationId) {
       setActiveIntent(lockedIntent as any);
    }
  }, [lockedIntent, conversationId]);

  const toggleIntent = (intent: any) => {
    setActiveIntent(prev => {
      const next = prev === intent ? 'normal' : intent;
      
      // Recommendation for media generation
      if (['image', 'video', 'audio'].includes(next)) {
        toast.info("Recommended to use a new thread for media generation to avoid context pollution.", {
          icon: '✨',
          duration: 5000
        });
      }
      
      return next;
    });
    textareaRef.current?.focus();
    setShowMoreIntents(false);
  };

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput ?? input;
    if (!textToSend.trim() || isLoading || !hasCredentials) return;

    const intentToSend = activeIntent;
    
    // Create new AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userMessage: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: textToSend,
      metadata: { intent: intentToSend },
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    
    // Intent is now sticky: we DON'T reset activeIntent here.
    // If it was the session default (lockedIntent), it stays selected.
    // If the user manually toggled it to 'normal', it stays normal.
    
    setIsLoading(true);
    // Reset live streaming state
    setLiveStatus(null);
    setLiveActivity([]);
    setLiveSources([]);
    setLiveImages([]);
    setLiveVideos([]);
    setLiveThinking('');
    setLiveContent('');
    setLiveCodeExecutions([]);
    setIsReasoningExpanded(false);
    setIsLiveCodeExpanded(true);
    setIsLiveSourcesExpanded(true);
    setIsLiveMediaExpanded(true);

    try {
      let currentSessionId = conversationId;
      if (!currentSessionId) {
        const newSession = await chatService.createSession({
          title: textToSend.slice(0, 30) + '...',
          llm_provider: llmProvider,
          llm_model: llmModel,
          system_prompt: ""
        });
        currentSessionId = newSession.id;
        setConversationId(newSession.id);
        setCurrentSession(newSession);
        queryClient.setQueryData<ChatSession[]>(['chatSessions'], (old = []) => [newSession, ...old]);
        if (showHistory) loadHistory();
      }

      // Pass the activeReference if present
      const reference = activeReference ? { message_id: activeReference.messageId, snippet: activeReference.textSnippet } : undefined;

      // Use SSE streaming endpoint
      await chatService.sendMessageStream(
        currentSessionId,
        textToSend,
        intentToSend,
        (event) => {
          switch (event.type) {
            case 'status':
              setLiveStatus({ phase: event.phase, message: event.message });
              if (event.user_message_id) {
                setMessages(prev => {
                  const newMsgs = [...prev];
                  const userMsgIndex = newMsgs.findIndex(m => m.id === userMessage.id);
                  if (userMsgIndex !== -1) {
                    newMsgs[userMsgIndex] = { ...newMsgs[userMsgIndex], id: event.user_message_id };
                  }
                  return newMsgs;
                });
              }
              break;
            case 'thinking_chunk':
              setLiveThinking(prev => prev + event.content);
              break;
            case 'content_chunk':
              setLiveContent(prev => prev + event.content);
              break;
            case 'tool_call':
              // Legacy support for older backend versions
              setLiveActivity(prev => [...prev, { type: 'tool', tool: event.tool, args: event.args, iteration: event.iteration }]);
              break;
            case 'agent_trace':
              if (event.sub_type === 'thought') {
                setLiveActivity(prev => {
                  const last = prev[prev.length - 1];
                  if (last?.type === 'thought') {
                    // Update last thought snippet to keep list clean
                    return [...prev.slice(0, -1), { ...last, thought: event.content }];
                  }
                  return [...prev, { type: 'thought', thought: event.content }];
                });
              } else {
                setLiveActivity(prev => [...prev, { 
                    type: 'tool', 
                    tool: event.tool, 
                    args: event.args, 
                    iteration: event.iteration,
                    thought: event.thought
                }]);
              }
              break;
            case 'sources_update':
              setLiveSources(event.sources || []);
              break;
            case 'images_update':
              setLiveImages(event.images || []);
              break;
            case 'code_execution':
              setLiveCodeExecutions(prev => [...prev, {
                code: event.code,
                output: event.output,
                result: event.result
              }]);
              break;
            case 'videos_update':
              setLiveVideos(event.videos || []);
              break;
            case 'done':
              setMessages(prev => {
                const newMsgs = [...prev];
                // Check if we still have the optimistic ID or if it was already updated
                const userMsgIndex = newMsgs.findIndex(m => m.id === userMessage.id || m.id === event.user_message.id);
                if (userMsgIndex !== -1) {
                  newMsgs[userMsgIndex] = { ...newMsgs[userMsgIndex], id: event.user_message.id };
                }
                return [...newMsgs, event.ai_response as unknown as ChatMessage];
              });
              setIsLoading(false);
              setLiveStatus(null);
              setLiveActivity([]);
              setLiveSources([]);
              setLiveImages([]);
              setLiveVideos([]);
              setLiveContent('');
              setLiveCodeExecutions([]);
              setActiveReference(null); // clear reference after successful response
              // Sync intent to session state if it was locked this turn
              if (currentSession && !['chat', 'search', 'normal'].includes(intentToSend) && currentSession.intent !== intentToSend) {
                setCurrentSession({ ...currentSession, intent: intentToSend });
              }
              break;
            case 'error':
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: `Error: ${event.message}`,
                created_at: new Date().toISOString(),
                metadata: {}
              } as ChatMessage]);
              setIsLoading(false);
              break;
          }
        },
        reference,
        controller.signal,
        llmProvider,
        llmModel
      );
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        console.log('Fetch aborted');
        return;
      }
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Failed to get response'}`,
        created_at: new Date().toISOString(),
        metadata: {}
      } as ChatMessage]);
    } finally {
      setIsLoading(false);
      setLiveStatus(null);
      abortControllerRef.current = null;
    }
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setLiveStatus(null);
      toast.info('Generation stopped');
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
            <ArrowUp className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-background overflow-hidden relative">
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
                setCurrentSession(null);
                setActiveIntent('normal');
                setShowHistory(false);
              }}
              className="w-full h-11 flex items-center gap-3 px-4 rounded-xl bg-primary/10 hover:bg-primary/20 text-sm font-semibold transition"
            >
              <Plus className="w-4 h-4" />
              New Conversation
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-2">
            {Array.isArray(conversations) && conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "w-full p-3 rounded-xl text-left transition flex items-center gap-3 text-xs group relative cursor-pointer",
                  conversationId === conv.id
                    ? "bg-primary/10 border border-primary/30"
                    : "hover:bg-muted/60"
                )}
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
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <MessageSquare className="w-4 h-4 opacity-60 shrink-0" />
                  <span className="truncate font-mono flex-1">
                    {conv.title || conv.id.slice(0, 18)}
                  </span>
                </div>
                <button
                  onClick={(e) => handleDeleteConversation(e, conv.id)}
                  className="p-1.5 hover:bg-destructive hover:text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-sm shrink-0 bg-background/50"
                  title="Delete Conversation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
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
        <div 
          className={cn(
            "flex-1 overflow-y-auto px-6 pt-8 pb-24 transition-all duration-1000 ease-in-out relative",
            isInitialState ? "flex items-center justify-center" : "py-10"
          )}
          onMouseUp={() => {
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
          }}
          onKeyUp={() => {
            // similar to mouse up
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) {
              if (selectionPos) setSelectionPos(null);
            }
          }}
        >
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

          <div className={cn(
            "max-w-6xl mx-auto w-full relative",
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
              </div>
            ) : (
              // Message List
              <div className="space-y-12">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    data-message-id={message.id}
                    className={cn(
                      "flex gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 group",
                      message.role === 'user' ? "flex-row-reverse" : ""
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-border/40 shadow-md",
                      message.role === 'assistant' 
                        ? "bg-primary text-primary-foreground shadow-primary/20" 
                        : message.role === 'system'
                        ? "bg-muted text-muted-foreground"
                        : "bg-card glass"
                    )}>
                      {message.role === 'assistant' ? <Bot className="w-6 h-6" /> : message.role === 'system' ? <Settings2 className="w-5 h-5"/> : <User className="w-6 h-6 text-muted-foreground" />}
                    </div>

                    <div className={cn(
                      "max-w-[85%] space-y-3",
                      message.role === 'user' ? "text-right" : ""
                    )}>

                      {/* Main Content Bubble */}
                      <div className={cn(
                        "text-[17px] leading-[1.8] tracking-[-0.01em] prose prose-base dark:prose-invert max-w-none ai-chat-prose",
                        message.role === 'user' 
                          ? "text-foreground font-semibold bg-primary/5 border border-primary/10 p-5 rounded-3xl rounded-tr-none shadow-sm inline-block text-left" 
                          : message.role === 'system'
                          ? "w-full"
                          : "text-foreground font-[450] bg-card/60 p-7 rounded-3xl rounded-tl-none shadow-sm glass border border-border/40 inline-block text-left"
                      )}>

                        {message.role === 'system' ? (
                          <div className="bg-muted/30 p-4 rounded-3xl shadow-sm border border-border/40 inline-flex flex-col gap-3 min-w-[300px] max-w-sm">
                            <div className="flex items-start gap-3">
                               <div className="w-10 h-10 rounded-xl bg-background border border-border/50 flex items-center justify-center shrink-0">
                                  {message.metadata?.file_type === 'image' ? <ImageIcon className="w-5 h-5 text-emerald-500" /> :
                                   message.metadata?.file_type === 'pdf' ? <FileIcon className="w-5 h-5 text-red-500" /> :
                                   message.metadata?.file_type === 'pptx' ? <FileIcon className="w-5 h-5 text-orange-500" /> :
                                   <FileIcon className="w-5 h-5 text-blue-500" />}
                               </div>
                               <div className="flex-1 min-w-0 pr-8 relative">
                                  <p className="text-sm font-bold text-foreground truncate max-w-[90%]">
                                    {message.content.match(/\*\*([^*]+)\*\*/)?.[1] || "Uploaded File"}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60 bg-background px-1.5 py-0.5 rounded">
                                      {message.metadata?.file_type || 'File'}
                                    </span>
                                    {message.metadata?.has_extracted_text && (
                                       <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                         Parsed
                                       </span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleDeleteMessage(message.id as number)}
                                    disabled={deletingMsgId === message.id}
                                    className="absolute right-0 top-0 p-1.5 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                                    title="Delete file"
                                  >
                                    {deletingMsgId === message.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleRewriteMessage(message.id as number)}
                                    disabled={deletingMsgId === message.id}
                                    className="absolute right-8 top-0 p-1.5 text-muted-foreground/40 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors disabled:opacity-50"
                                    title="Rewind conversation from here (deletes this and following)"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                               </div>
                            </div>
                            {/* Hide the raw extracted text preview from the user to keep UI clean, but keep the success indication */}
                            <div className="text-xs font-medium text-muted-foreground bg-background/50 p-2 rounded-lg border border-border/30">
                              Added to conversation context
                            </div>
                          </div>
                        ) : (
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              a: ({ href, children, ...props }) => {
                                // Inline citation button: [1], [2], etc.
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
                                            className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-[11px] font-black rounded border border-primary/30 no-underline cursor-pointer transition-all bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground shadow-sm"
                                          >
                                            {citNum}
                                          </a>
                                          {/* Hover Tooltip */}
                                          {src && (
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[280px] p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl opacity-0 invisible group-hover/cit:opacity-100 group-hover/cit:visible transition-all duration-200 z-50 flex flex-col gap-1.5 pointer-events-none">
                                              <div className="flex items-center gap-1.5 text-zinc-400">
                                                <Globe2 className="w-3 h-3 shrink-0" />
                                                <span className="text-[10px] uppercase font-bold tracking-wider truncate">
                                                  {(() => { try { return new URL(src.url).hostname; } catch { return 'Source'; } })()}
                                                </span>
                                              </div>
                                              <p className="text-[12px] font-medium text-zinc-100 leading-snug line-clamp-2">
                                                {src.title || src.url}
                                              </p>
                                              {/* Triangle pointer */}
                                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-0 h-0 border-l-4 border-r-4 border-t-[5px] border-l-transparent border-r-transparent border-t-zinc-800" />
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }
                                // Regular links: boxed style
                                return (
                                  <a 
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 mx-0.5 px-2 py-0.5 text-primary font-semibold bg-primary/5 border border-primary/20 rounded-lg no-underline hover:bg-primary/15 hover:border-primary/40 transition-all shadow-sm"
                                    {...props}
                                  >
                                    <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
                                    {children}
                                  </a>
                                );
                              },
                              code: ({ node, inline, className, children, ...props }: any) => {
                                const match = /language-(\w+)/.exec(className || '');
                                const lang = match ? match[1].toUpperCase() : '';
                                
                                if (!inline && match) {
                                  const codeContent = String(children).replace(/\n$/, '');
                                  return (
                                    <div className="relative group/code my-6 rounded-2xl overflow-hidden border border-border/40 bg-[#0d1117] shadow-xl">
                                      {/* Header */}
                                      <div className="flex items-center justify-between px-5 py-3.5 bg-zinc-900/80 border-b border-white/5 backdrop-blur-md">
                                        <div className="flex items-center gap-2.5">
                                          <div className="flex gap-1.5 mr-2">
                                            <div className="w-3 h-3 rounded-full bg-red-500/80" />
                                            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                                            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                                          </div>
                                          <span className="text-[11px] font-black tracking-[0.2em] text-zinc-500 uppercase">{lang || 'CODE'}</span>
                                        </div>
                                        <button
                                          onClick={() => {
                                            navigator.clipboard.writeText(codeContent);
                                            toast.success('Code copied to clipboard');
                                            // Handle local copy state if needed, but toast is enough for now
                                          }}
                                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all border border-white/5 hover:border-white/20 group/copybtn"
                                          title="Copy code"
                                        >
                                          <Copy className="w-3.5 h-3.5 group-hover/copybtn:scale-110 transition-transform" />
                                          <span className="text-[11px] font-bold uppercase tracking-wider">Copy</span>
                                        </button>
                                      </div>
                                      
                                      {/* Code Content */}
                                      <div className="relative">
                                        <pre className="p-6 overflow-x-auto text-[14px] leading-relaxed custom-scrollbar selection:bg-primary/20">
                                          <code className={cn(className, "block")} {...props}>
                                            {children}
                                          </code>
                                        </pre>
                                        
                                        {/* Subtle corner glow */}
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />
                                      </div>
                                    </div>
                                  );
                                }
                                
                                // Inline code style
                                return (
                                  <code className={cn("px-1.5 py-0.5 rounded-md bg-muted font-mono text-sm border border-border/40 text-primary/90", className)} {...props}>
                                    {children}
                                  </code>
                                );
                              }
                            }}
                          >
                            {message.content.replace(/\[(\d+)\]/g, '[$1](citation:$1)')}
                          </ReactMarkdown>
                        )}
                      </div>
                      {/* Quick Summary, Reasoning & Activity Row */}
                      {message.role === 'assistant' && (message.metadata?.summary || message.metadata?.thinking || (message.metadata?.tool_trace && message.metadata.tool_trace.length > 0) || message.metadata?.has_code_execution) && (
                        <div className="flex flex-wrap gap-2 mt-4 mb-2">
                          {message.metadata?.summary && (
                            <div className="flex-1 min-w-[140px] group/summary animate-in fade-in slide-in-from-top-2 duration-500">
                              <button
                                onClick={() => setExpandedSummaryMsgId(expandedSummaryMsgId === message.id ? null : message.id as number)}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-2 rounded-xl transition-all border w-full",
                                  expandedSummaryMsgId === message.id
                                    ? "bg-primary/10 border-primary/30 text-primary shadow-sm" 
                                    : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50 hover:border-border/60 hover:text-foreground"
                                )}
                              >
                                <Sparkles className={cn("w-4 h-4", expandedSummaryMsgId === message.id ? "text-primary" : "text-muted-foreground/70")} />
                                <span className="text-[12px] font-bold tracking-tight">Summary</span>
                                <div className="flex-1" />
                                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300", expandedSummaryMsgId === message.id && "rotate-180")} />
                              </button>
                            </div>
                          )}

                          {message.metadata?.thinking && (
                            <div className="flex-1 min-w-[140px] group/thinking animate-in fade-in slide-in-from-top-2 duration-500">
                              <button
                                onClick={() => setExpandedThinkingMsgId(expandedThinkingMsgId === message.id ? null : message.id as number)}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-2 rounded-xl transition-all border w-full",
                                  expandedThinkingMsgId === message.id
                                    ? "bg-primary/10 border-primary/30 text-primary shadow-sm" 
                                    : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50 hover:border-border/60 hover:text-foreground"
                                )}
                              >
                                <BrainCircuit className={cn("w-4 h-4", expandedThinkingMsgId === message.id ? "text-primary" : "text-muted-foreground/70")} />
                                <span className="text-[12px] font-bold tracking-tight">Reasoning</span>
                                <div className="flex-1" />
                                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300", expandedThinkingMsgId === message.id && "rotate-180")} />
                              </button>
                            </div>
                          )}
                          {message.metadata?.tool_trace && message.metadata.tool_trace.length > 0 && (
                            <div className="flex-1 min-w-[140px] group/activity animate-in fade-in slide-in-from-top-2 duration-500">
                              <button
                                onClick={() => setExpandedActivityMsgId(expandedActivityMsgId === message.id ? null : message.id as number)}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-2 rounded-xl transition-all border w-full",
                                  expandedActivityMsgId === message.id
                                    ? "bg-amber-500/10 border-amber-500/30 text-amber-600 shadow-sm" 
                                    : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50 hover:border-border/60 hover:text-foreground"
                                )}
                              >
                                <Zap className={cn("w-4 h-4", expandedActivityMsgId === message.id ? "text-amber-600" : "text-muted-foreground/70")} />
                                <span className="text-[12px] font-bold tracking-tight">Activity</span>
                                <div className="flex-1" />
                                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300", expandedActivityMsgId === message.id && "rotate-180")} />
                              </button>
                            </div>
                          )}

                          {message.metadata?.has_code_execution && message.metadata?.code_executions && message.metadata.code_executions.length > 0 && (
                            <div className="flex-1 min-w-[140px] group/code animate-in fade-in slide-in-from-top-2 duration-500">
                              <button
                                onClick={() => setExpandedCodeMsgId(expandedCodeMsgId === message.id ? null : message.id as number)}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-2 rounded-xl transition-all border w-full",
                                  expandedCodeMsgId === message.id
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 shadow-sm" 
                                    : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50 hover:border-border/60 hover:text-foreground"
                                )}
                              >
                                <Code className={cn("w-4 h-4", expandedCodeMsgId === message.id ? "text-emerald-600" : "text-muted-foreground/70")} />
                                <span className="text-[12px] font-bold tracking-tight">Code</span>
                                <div className="flex-1" />
                                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300", expandedCodeMsgId === message.id && "rotate-180")} />
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Expanded Summary Content */}
                      {message.role === 'assistant' && expandedSummaryMsgId === message.id && message.metadata?.summary && (
                        <div className="mt-2 p-5 bg-card/40 backdrop-blur-md border border-primary/20 rounded-2xl animate-in slide-in-from-top-2 duration-300 shadow-sm relative overflow-hidden group">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/40" />
                          <p className="text-[14px] font-medium text-foreground/90 leading-relaxed italic tracking-tight">
                            {message.metadata.summary}
                          </p>
                        </div>
                      )}

                      {/* Expanded Thinking Content */}
                      {message.role === 'assistant' && expandedThinkingMsgId === message.id && message.metadata?.thinking && (
                        <div className="mt-2 p-4 bg-muted/20 border border-border/30 rounded-2xl animate-in slide-in-from-top-2 duration-300">
                          <div className="prose prose-sm prose-invert max-w-none text-[14px] leading-relaxed text-muted-foreground italic select-text">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {message.metadata.thinking}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}

                      {/* Fallback reasoning indicator if not present */}
                      {message.role === 'assistant' && !message.metadata?.thinking && (!message.metadata?.tool_trace || message.metadata.tool_trace.length === 0) && (
                        <div className="mt-4 mb-2 flex flex-col gap-2.5 px-3 py-2 rounded-xl border border-dashed border-border/30 bg-muted/5 text-muted-foreground/40 cursor-default">
                          <div className="flex items-center gap-2">
                              <BrainCircuit className="w-4 h-4 opacity-30" />
                              <span className="text-[12px] font-medium italic">Model reasoning not fully captured</span>
                          </div>
                        </div>
                      )}

                      {/* Tool Activity Trace — shows which tools the agent called */}
                      {message.role === 'assistant' && expandedActivityMsgId === message.id && message.metadata?.tool_trace && message.metadata.tool_trace.length > 0 && (
                        <div className="mt-2 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl animate-in slide-in-from-top-2 duration-300">
                          <div className="flex items-center gap-3 px-1 mb-3">
                            <Zap className="w-3.5 h-3.5 text-amber-500/70" />
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-600/70">Agent Activity Log</span>
                            <div className="h-px flex-1 bg-amber-500/10" />
                          </div>
                          <div className="space-y-1">
                            {message.metadata.tool_trace.map((trace: any, i: number) => (
                              <div
                                key={i}
                                className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-left-2 py-2 group/trace border-b border-amber-500/5 last:border-0"
                                style={{ animationDelay: `${i * 30}ms` }}
                              >
                                <div className="flex items-center gap-3.5 text-[14px] text-muted-foreground">
                                  <span className="flex items-center justify-center w-6 h-6 rounded-md bg-amber-500/10 text-[10px] font-black text-amber-600 shrink-0 border border-amber-500/10">
                                    {trace.iteration || i + 1}
                                  </span>
                                  <span className="font-mono font-bold text-amber-600/80 text-[14px]">{trace.tool}</span>
                                  {trace.args?.query && (
                                    <span className="truncate max-w-[360px] text-foreground/60 italic text-[13px] pl-1">"{stripXmlTags(trace.args.query)}"</span>
                                  )}
                                  {trace.summary && !trace.args?.query && (
                                    <span className="truncate max-w-[360px] text-foreground/50 italic text-[12px] pl-1">{stripXmlTags(trace.summary)}</span>
                                  )}
                                </div>
                                {trace.thought && (
                                  <div className="pl-[38px] flex flex-col gap-1">
                                     <div className="text-[13px] text-muted-foreground/70 italic leading-relaxed border-l-2 border-amber-500/10 pl-3 ai-activity-markdown pb-1">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                          {trace.thought}
                                        </ReactMarkdown>
                                     </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Code Execution Log — shows sandbox results */}
                      {message.role === 'assistant' && expandedCodeMsgId === message.id && message.metadata?.code_executions && message.metadata.code_executions.length > 0 && (
                        <div className="mt-2 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl animate-in slide-in-from-top-2 duration-300">
                          <div className="flex items-center gap-3 px-1 mb-3">
                            <Code className="w-3.5 h-3.5 text-emerald-500/70" />
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600/70">Secure Sandbox Code</span>
                            <div className="h-px flex-1 bg-emerald-500/10" />
                          </div>
                          <div className="space-y-4">
                            {message.metadata.code_executions.map((exec: any, i: number) => (
                              <div key={i} className="space-y-2 border-b border-emerald-500/5 last:border-0 pb-4 last:pb-0">
                                <div className="flex items-center gap-2">
                                   <span className="text-[10px] font-black text-emerald-600/50">Execution #{exec.iteration || i+1}</span>
                                   <div className="h-px flex-1 bg-emerald-500/5" />
                                </div>
                                <div className="rounded-xl overflow-hidden border border-emerald-500/10 bg-zinc-950 shadow-sm">
                                   <div className="px-3 py-1.5 bg-zinc-900/50 flex items-center justify-between border-b border-white/5">
                                      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Input Code</span>
                                   </div>
                                   <pre className="p-4 text-[13px] overflow-x-auto text-zinc-300 font-mono leading-relaxed bg-zinc-950">
                                      <code>{exec.code}</code>
                                   </pre>
                                </div>
                                {(exec.output || exec.result) && (
                                   <div className="rounded-xl overflow-hidden border border-blue-500/10 bg-zinc-950/50 shadow-sm">
                                      <div className="px-3 py-1.5 bg-zinc-900/50 flex items-center justify-between border-b border-white/5">
                                         <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Execution Output</span>
                                      </div>
                                      <pre className="p-4 text-[12px] overflow-x-auto text-blue-400/90 font-mono leading-relaxed whitespace-pre-wrap bg-zinc-950/20">
                                         <code>{exec.output || exec.result}</code>
                                      </pre>
                                   </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}


                      {/* Discovered Media Row (Sources, Images, Videos on one line) */}
                      {message.role === 'assistant' && (message.metadata?.sources?.length > 0 || message.metadata?.images?.length > 0 || message.metadata?.videos?.length > 0) && (
                        <div className="mt-6 flex flex-wrap gap-2">
                          {message.metadata?.sources?.length > 0 && (
                            <button
                              onClick={() => setExpandedSourcesMsgId(expandedSourcesMsgId === message.id ? null : message.id as number)}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border group",
                                expandedSourcesMsgId === message.id ? "bg-primary/10 border-primary/30 text-primary shadow-sm" : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50"
                              )}
                            >
                              <Globe2 className={cn("w-3.5 h-3.5", expandedSourcesMsgId === message.id ? "text-primary" : "text-muted-foreground/60 group-hover:text-primary")} />
                              <span className="text-[12px] font-bold">{message.metadata.sources.length} Sources</span>
                            </button>
                          )}

                          {message.metadata?.images?.length > 0 && (
                            <button
                              onClick={() => setExpandedImagesMsgId(expandedImagesMsgId === message.id ? null : message.id as number)}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border group",
                                expandedImagesMsgId === message.id ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 shadow-sm" : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50"
                              )}
                            >
                              <ImageIcon className={cn("w-3.5 h-3.5", expandedImagesMsgId === message.id ? "text-emerald-600" : "text-muted-foreground/60 group-hover:text-emerald-500")} />
                              <span className="text-[12px] font-bold">{message.metadata.images.length} Images</span>
                            </button>
                          )}

                          {message.metadata?.videos?.length > 0 && (
                            <button
                              onClick={() => setExpandedVideosMsgId(expandedVideosMsgId === message.id ? null : message.id as number)}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border group",
                                expandedVideosMsgId === message.id ? "bg-purple-500/10 border-purple-500/30 text-purple-600 shadow-sm" : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50"
                              )}
                            >
                              <Video className={cn("w-3.5 h-3.5", expandedVideosMsgId === message.id ? "text-purple-600" : "text-muted-foreground/60 group-hover:text-purple-500")} />
                              <span className="text-[12px] font-bold">{message.metadata.videos.length} Videos</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Content areas below the row triggers */}
                      {message.role === 'assistant' && expandedSourcesMsgId === message.id && message.metadata?.sources?.length > 0 && (
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2 duration-300 px-1">
                          {message.metadata.sources.map((item: any, i: number) => (
                            <MediaPreview 
                              key={i}
                              url={item.url}
                              type="link"
                              title={item.title}
                              source={item.publisher || item.source}
                              thumbnail={item.thumbnail}
                              className="animate-in fade-in zoom-in-95 duration-500"
                            />
                          ))}
                        </div>
                      )}

                      {message.role === 'assistant' && expandedImagesMsgId === message.id && message.metadata?.images?.length > 0 && (
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2 duration-300 px-1">
                          {(message.metadata.images || []).map((item: any, i: number) => (
                            <MediaPreview 
                              key={i}
                              url={item.image || item.url}
                              type="image"
                              title={item.title}
                              source={item.source}
                              className="animate-in fade-in zoom-in-95 duration-500"
                            />
                          ))}
                        </div>
                      )}

                      {message.role === 'assistant' && expandedVideosMsgId === message.id && message.metadata?.videos?.length > 0 && (
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2 duration-300 px-1">
                          {(message.metadata.videos || []).map((item: any, i: number) => (
                            <MediaPreview 
                              key={i}
                              url={item.url}
                              type="video"
                              title={item.title}
                              source={item.publisher || item.source}
                              className="animate-in fade-in zoom-in-95 duration-500"
                            />
                          ))}
                        </div>
                      )}


                      {/* Workflow Suggestion Card */}
                      {message.metadata?.intent === 'workflow' && message.metadata?.workflow_id && (
                        <div className="mt-6 p-5 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl shadow-sm max-w-md animate-in fade-in zoom-in-95 duration-500">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                              <Wand2 className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-bold text-foreground leading-tight">{message.metadata.workflow_name}</h3>
                              <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-0.5">Workflow Suggestion</p>
                            </div>
                          </div>
                          <div className="flex gap-3 mt-5">
                            <button 
                              onClick={() => handleRunWorkflow(message.metadata.workflow_id)}
                              className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-bold shadow-md hover:scale-105 transition-all"
                            >
                              <Play className="w-4 h-4 fill-current" />
                              Approve & Run
                            </button>
                          </div>
                        </div>
                      )}

                      
                      {message.role !== 'system' && (
                        <div className={cn(
                          "flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 mt-1",
                          message.role === 'user' ? "justify-end mr-2" : "ml-2"
                        )}>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(message.content);
                              setCopiedId(`msg-${index}`);
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                            className="text-muted-foreground hover:text-primary transition-all p-1.5 hover:bg-primary/5 rounded-lg"
                            title="Copy message"
                          >
                            {copiedId === `msg-${index}` ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                          {message.role !== 'user' && (
                            <button
                              onClick={() => handleRewriteMessage(message.id as number)}
                              disabled={deletingMsgId === message.id}
                              className="text-muted-foreground hover:text-amber-500 transition-all p-1.5 hover:bg-amber-500/10 rounded-lg disabled:opacity-50"
                              title="Rewrite prompt (regenerates response without subsequent context)"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          {message.role === 'user' && (
                            <button
                              onClick={() => handleRewindAfterMessage(message.id as number)}
                              disabled={deletingMsgId === message.id}
                              className="text-muted-foreground hover:text-emerald-500 transition-all p-1.5 hover:bg-emerald-500/10 rounded-lg disabled:opacity-50"
                              title="Reverse context (keep this message, delete answers)"
                            >
                              <ArrowUpFromLine className="w-4 h-4" />
                            </button>
                          )}
                          {message.role === 'user' && (
                            <button
                              onClick={() => handleEditMessage(message.id as number, message.content)}
                              disabled={deletingMsgId === message.id}
                              className="text-muted-foreground hover:text-blue-500 transition-all p-1.5 hover:bg-blue-500/10 rounded-lg disabled:opacity-50"
                              title="Edit and resend message"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteMessage(message.id as number)}
                            disabled={deletingMsgId === message.id}
                            className="text-muted-foreground hover:text-red-500 transition-all p-1.5 hover:bg-red-500/10 rounded-lg disabled:opacity-50"
                            title="Delete message"
                          >
                            {deletingMsgId === message.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isUploading && (
              <div className="flex gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-border/40 shadow-md bg-muted text-muted-foreground">
                  <Settings2 className="w-5 h-5"/>
                </div>
                <div className="max-w-[85%] space-y-3">
                  <div className="bg-muted/30 p-4 rounded-3xl shadow-sm border border-border/40 inline-flex flex-col gap-3 min-w-[300px] max-w-sm w-full">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-background border border-border/50 flex items-center justify-center shrink-0">
                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold animate-pulse text-foreground/80">Uploading File...</h4>
                        <p className="text-xs text-muted-foreground font-medium mt-0.5">Processing document contents</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isLoading && (() => {
              const phaseIcons: Record<string, React.ReactNode> = {
                thinking: <Sparkles className="w-5 h-5 text-primary" />,
                searching: <Search className="w-5 h-5 text-blue-400" />,
                planning: <BrainCircuit className="w-5 h-5 text-purple-400" />,
                reading: <Globe2 className="w-5 h-5 text-emerald-400" />,
                analyzing: <Globe2 className="w-5 h-5 text-purple-400" />,
                generating: <Sparkles className="w-5 h-5 text-amber-400" />,
                visualizing: <Wand2 className="w-5 h-5 text-emerald-400" />,
                motion_generating: <Video className="w-5 h-5 text-amber-400" />,
              };

              const statusMessage = liveStatus?.message || 'Thinking...';
              const statusIcon = phaseIcons[liveStatus?.phase || 'thinking'] || phaseIcons.thinking;

              return (
                <div className="flex gap-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 shadow-inner">
                    <div className="animate-pulse">{statusIcon}</div>
                  </div>
                  <div className="flex-1 space-y-3 pt-1 max-w-[85%]">
                    {/* Live Status */}
                    <div className="flex items-center justify-between gap-2.5">
                      <span className="text-[15px] font-semibold text-foreground/80 animate-pulse">{statusMessage}</span>
                      {liveThinking && (
                        <button
                          onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-all text-[10px] font-black uppercase tracking-wider text-primary/60"
                        >
                          <BrainCircuit className="w-3 h-3" />
                          {isReasoningExpanded ? 'Hide Reasoning' : 'View Reasoning'}
                          <ChevronDown className={cn("w-3 h-3 transition-transform duration-300", isReasoningExpanded && "rotate-180")} />
                        </button>
                      )}
                    </div>

                    {/* Expandable Reasoning Process */}
                    {liveThinking && isReasoningExpanded && (
                      <div className="mt-2 p-4 rounded-2xl bg-muted/30 border border-border/40 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="w-3.5 h-3.5 text-primary/60" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Internal Processing</span>
                        </div>
                        <div className="prose prose-invert prose-sm max-w-none text-muted-foreground/80 italic font-medium leading-relaxed">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {liveThinking}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {/* Live Content Stream */}
                    {liveContent && (
                      <div className="prose prose-invert prose-sm max-w-none text-foreground/90 leading-relaxed animate-in fade-in duration-500">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {liveContent}
                        </ReactMarkdown>
                      </div>
                    )}

                    {/* Live Activity Timeline */}
                    {liveActivity.length > 0 && (
                      <div className="space-y-2 animate-in fade-in duration-300">
                        <div className="flex items-center gap-3 px-1 mb-2">
                          <BrainCircuit className="w-4 h-4 text-primary/60" />
                          <span className="text-sm font-black uppercase tracking-[0.15em] text-muted-foreground/90">Agent Timeline</span>
                          <div className="h-px flex-1 bg-border/30" />
                        </div>
                        <div className="space-y-2">
                           {liveActivity.map((activity, i) => {
                             const isThought = activity.type === 'thought';
                             const thought = activity.thought;
                             const isLongThought = thought && thought.length > 200;
                             
                             return (
                               <div 
                                  key={i}
                                  className="flex flex-col gap-2 animate-in fade-in slide-in-from-left-2 py-1 border-l-2 border-primary/5 pl-4 ml-3.5 last:border-0"
                               >
                                  <div className="flex items-start gap-3.5 -ml-[30px]">
                                    {isThought ? (
                                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 shadow-sm">
                                         <BrainCircuit className="w-3.5 h-3.5 text-primary/60" />
                                      </div>
                                    ) : (
                                      <span className="flex items-center justify-center w-7 h-7 rounded-md bg-amber-500/20 text-xs font-black text-amber-600 shrink-0 border border-amber-500/20 shadow-sm">
                                         {activity.iteration || '?'}
                                      </span>
                                    )}
                                    
                                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                                      {isThought ? (
                                        <div className="flex items-center gap-2 pt-1">
                                          <span className="text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground/50">Processing</span>
                                          <Loader2 className="w-2.5 h-2.5 animate-spin text-muted-foreground/20" />
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-3">
                                          <span className="font-mono font-bold text-primary text-[15px]">{activity.tool}</span>
                                          <Loader2 className="w-3 h-3 animate-spin text-primary/30" />
                                        </div>
                                      )}

                                      {!isThought && activity.args?.query && (
                                         <span className="truncate max-w-[340px] text-foreground/60 italic text-[13px] font-medium opacity-80">"{stripXmlTags(activity.args.query)}"</span>
                                      )}
                                      
                                      {thought && (
                                        <div className="mt-1.5 group/thought relative">
                                          <div className={cn(
                                            "text-[13.5px] text-muted-foreground/75 italic leading-relaxed border-l-2 border-primary/20 pl-3 transition-all duration-300 ai-activity-markdown pb-1",
                                            isLongThought && !expandedActivityMsgId && "max-h-[80px] overflow-hidden mask-fade-bottom"
                                          )}>
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                              {thought}
                                            </ReactMarkdown>
                                          </div>
                                          {isLongThought && (
                                            <button 
                                              onClick={() => setExpandedActivityMsgId(expandedActivityMsgId === -i - 1 ? null : -i - 1)}
                                              className="text-[10px] font-bold text-primary/40 hover:text-primary transition-colors flex items-center gap-1 mt-1"
                                            >
                                              {expandedActivityMsgId === -i - 1 ? 'Show less' : 'Read more reasoning...'}
                                            </button>
                                          )}
                                        </div>
                              )}
                                    </div>
                                  </div>
                               </div>
                             );
                           })}
                        </div>
                      </div>
                    )}

                    {/* Live Code Timeline */}
                    {liveCodeExecutions.length > 0 && (
                      <div className="space-y-3 animate-in fade-in duration-300 mt-4">
                        <button 
                          onClick={() => setIsLiveCodeExpanded(!isLiveCodeExpanded)}
                          className="flex items-center gap-3 px-1 mb-2 w-full group"
                        >
                          <Code className="w-4 h-4 text-emerald-500/60 group-hover:text-emerald-500 transition-colors" />
                          <span className="text-sm font-black uppercase tracking-[0.15em] text-muted-foreground/90">Code Sandbox</span>
                          <div className="h-px flex-1 bg-border/20" />
                          <ChevronDown className={cn("w-4 h-4 text-muted-foreground/40 transition-transform duration-300", isLiveCodeExpanded && "rotate-180")} />
                        </button>
                        
                        {isLiveCodeExpanded && (
                          <div className="space-y-3">
                            {liveCodeExecutions.map((exec, i) => (
                              <div key={i} className="rounded-2xl overflow-hidden border border-emerald-500/20 bg-emerald-500/5 animate-in slide-in-from-bottom-2 duration-300">
                                <div className="px-4 py-2 bg-emerald-500/10 flex items-center justify-between border-b border-emerald-500/10">
                                   <div className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Active Execution {i+1}</span>
                                   </div>
                                </div>
                                <div className="p-4 space-y-3">
                                   <pre className="text-[13px] text-foreground/80 font-mono bg-zinc-950/50 p-3 rounded-lg overflow-x-auto border border-white/5">
                                      <code>{exec.code}</code>
                                   </pre>
                                   {(exec.output || exec.result) && (
                                     <div className="space-y-1.5">
                                        <div className="flex items-center gap-2 px-1">
                                           <div className="h-px flex-1 bg-blue-500/10" />
                                           <span className="text-[9px] font-bold text-blue-500/60 uppercase">Console Output</span>
                                           <div className="h-px flex-1 bg-blue-500/10" />
                                        </div>
                                        <pre className="text-[12px] text-blue-400/80 font-mono bg-zinc-950/30 p-3 rounded-lg overflow-x-auto border border-blue-500/5 whitespace-pre-wrap">
                                           <code>{exec.output || exec.result}</code>
                                        </pre>
                                     </div>
                                   )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Media Generation Animation (Visualize/Motion) */}
                    {(liveStatus?.phase === 'visualizing' || liveStatus?.phase === 'motion_generating') && (
                      <div className="mt-4 relative overflow-hidden rounded-3xl border border-primary/20 bg-muted/20 aspect-video max-w-sm w-full group/media">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent animate-pulse" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-6">
                          <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-ping duration-[3000ms]" />
                            {liveStatus.phase === 'visualizing' ? (
                                <ImageIcon className="w-12 h-12 text-primary/40 animate-bounce duration-[2000ms]" />
                            ) : (
                                <Video className="w-12 h-12 text-primary/40 animate-bounce duration-[2000ms]" />
                            )}
                          </div>
                          <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-700">
                             <h4 className="text-sm font-black uppercase tracking-widest text-primary/60">
                                {liveStatus.phase === 'visualizing' ? 'Developing Vision' : 'Composing Motion'}
                             </h4>
                             <p className="text-xs text-muted-foreground/60 font-medium italic">
                                "{activeIntent === 'image' ? 'Infusing pixels with intelligence...' : 'Stitching frames through the latent space...'}"
                             </p>
                          </div>
                        </div>
                        {/* Scanning beam effect */}
                        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-transparent via-primary/10 to-transparent skew-x-12 -translate-x-[200%] animate-shimmer-fast" />
                      </div>
                    )}

                    {/* Live Discoveries Row — Sources and Media */}
                    {(liveSources.length > 0 || liveImages.length > 0 || liveVideos.length > 0) && (
                      <div className="mt-4 flex flex-wrap gap-2 animate-in fade-in duration-300">
                        {liveSources.length > 0 && (
                          <button
                            onClick={() => setIsLiveSourcesExpanded(!isLiveSourcesExpanded)}
                            className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border group",
                              isLiveSourcesExpanded ? "bg-primary/10 border-primary/30 text-primary shadow-sm" : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50"
                            )}
                          >
                            <Globe2 className={cn("w-3.5 h-3.5", isLiveSourcesExpanded ? "text-primary" : "text-muted-foreground/60 group-hover:text-primary")} />
                            <span className="text-[12px] font-bold">{liveSources.length} Sources</span>
                            <ChevronDown className={cn("w-3 h-3 transition-transform duration-300", isLiveSourcesExpanded && "rotate-180")} />
                          </button>
                        )}

                        {(liveImages.length > 0 || liveVideos.length > 0) && (
                          <button
                            onClick={() => setIsLiveMediaExpanded(!isLiveMediaExpanded)}
                            className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border group",
                              isLiveMediaExpanded ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 shadow-sm" : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50"
                            )}
                          >
                            <Sparkles className={cn("w-3.5 h-3.5", isLiveMediaExpanded ? "text-emerald-600" : "text-muted-foreground/60 group-hover:text-emerald-500")} />
                            <span className="text-[12px] font-bold">{liveImages.length + liveVideos.length} Media</span>
                            <ChevronDown className={cn("w-3 h-3 transition-transform duration-300", isLiveMediaExpanded && "rotate-180")} />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Live Expanded Areas */}
                    {liveSources.length > 0 && isLiveSourcesExpanded && (
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 px-1 animate-in slide-in-from-top-2 duration-300">
                        {liveSources.slice(0, 3).map((source, i) => (
                          <MediaPreview 
                            key={i}
                            url={source.url}
                            type="link"
                            title={source.title}
                            thumbnail={source.thumbnail}
                            className="opacity-80 hover:opacity-100 animate-in zoom-in-95 duration-300"
                          />
                        ))}
                        {liveSources.length > 3 && (
                          <div className="flex items-center justify-center rounded-xl border border-dashed border-border/40 bg-muted/20 text-[10px] font-bold text-muted-foreground/40 italic">
                             +{liveSources.length - 3} more...
                          </div>
                        )}
                      </div>
                    )}

                    {(liveImages.length > 0 || liveVideos.length > 0) && isLiveMediaExpanded && (
                       <div className="mt-3 flex gap-3 overflow-x-auto pb-2 scrollbar-hide px-1 animate-in slide-in-from-top-2 duration-300">
                         {liveImages.slice(0, 4).map((img, i) => (
                           <MediaPreview 
                             key={`img-${i}`}
                             url={img.image || img.url}
                             type="image"
                             className="w-32 h-20 shrink-0 shadow-sm"
                           />
                         ))}
                         {liveVideos.slice(0, 4).map((vid, i) => (
                           <MediaPreview 
                             key={`vid-${i}`}
                             url={vid.url}
                             type="video"
                             className="w-32 h-20 shrink-0 shadow-sm"
                           />
                         ))}
                         {(liveImages.length > 4 || liveVideos.length > 4) && (
                           <div className="w-24 h-20 shrink-0 flex items-center justify-center rounded-xl bg-muted/20 border border-dashed border-border/40 text-[9px] font-black text-muted-foreground/30 uppercase tracking-widest text-center px-2">
                              +{liveImages.length + liveVideos.length - 8} more
                           </div>
                         )}
                       </div>
                    )}

                    {/* Progress bar */}
                    {!liveActivity.length && (
                      <div className="w-48 h-1 bg-muted/30 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full animate-pulse" style={{ width: '60%' }} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Dynamic Navigation/Input Area */}
        <footer className={cn(
          "shrink-0 transition-all duration-1000 ease-in-out",
          isInitialState ? "pb-16" : "pb-6 px-4 pt-2"
        )}>
          <div className="max-w-5xl mx-auto space-y-4">
            
            <div className="relative group/input">

              {/* Continue Exploring — above the chatbox */}
              {!isInitialState && !isLoading && (() => {
                const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
                const followUps = lastAssistant?.metadata?.follow_ups;
                if (!followUps || followUps.length === 0) return null;
                return (
                  <div className="mb-3 animate-in fade-in slide-in-from-bottom-4 duration-500 bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl overflow-hidden glass">
                    <button 
                      onClick={() => setIsFollowUpsExpanded(!isFollowUpsExpanded)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500/50" />
                        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/60">Continue Exploring</span>
                      </div>
                      <ChevronDown className={cn(
                        "w-4 h-4 text-muted-foreground/50 transition-transform duration-300",
                        isFollowUpsExpanded ? "rotate-180" : ""
                      )} />
                    </button>
                    
                    <div className={cn(
                      "grid transition-all duration-300 ease-in-out",
                      isFollowUpsExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    )}>
                      <div className="overflow-hidden">
                        <div className="flex flex-wrap gap-2 p-3 pt-0">
                          {followUps.map((q: string, i: number) => (
                            <button
                              key={i}
                              onClick={() => handleSend(q)}
                              className="group flex flex-1 min-w-[200px] items-center gap-2.5 px-4 py-2.5 bg-background border border-border/50 hover:bg-primary/5 hover:border-primary/20 rounded-xl transition-all text-muted-foreground hover:text-foreground shadow-sm text-left"
                            >
                              <Zap className="w-3.5 h-3.5 shrink-0 opacity-30 group-hover:opacity-100 group-hover:text-primary transition-all" />
                              <span className="text-[13px] font-medium leading-snug">{q}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Input Capsule — bigger, with pills inside */}
              <div className="relative z-10">

                 {/* Active Reference Pill */}
                 {activeReference && (
                   <div className="flex animate-in fade-in slide-in-from-bottom-2 duration-300 absolute bottom-full mb-3 left-4">
                     <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl group backdrop-blur-md">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 shrink-0">Reference</span>
                          <div className="w-px h-3 bg-emerald-500/30 shrink-0" />
                          <span className="text-xs font-medium text-emerald-700/80 truncate max-w-[300px] italic">"{activeReference.textSnippet}"</span>
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


                <div className="absolute inset-x-0 inset-y-0 bg-primary/10 rounded-3xl blur-3xl opacity-0 group-focus-within/input:opacity-100 transition-opacity duration-700 pointer-events-none" />
                <div className="relative flex flex-col bg-card/80 border border-border/80 rounded-3xl glass shadow-2xl focus-within:border-primary/40 transition-all duration-300">
                  
                  {/* Textarea row */}
                  <div className="p-4 pb-0">
                    <textarea
                      id="chat-input-textarea"
                      name="chat-input"
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      onPaste={(e) => {
                        const items = e.clipboardData?.items;
                        if (!items) return;
                        for (let i = 0; i < items.length; i++) {
                          if (items[i].kind === 'file') {
                            const file = items[i].getAsFile();
                            if (file) {
                              e.preventDefault();
                              processFile(file);
                              return;
                            }
                          }
                        }
                      }}
                      placeholder={activeIntent !== 'normal' ? `Type your ${activeIntent} query...` : "Ask anything..."}
                      className="w-full min-h-[56px] max-h-[200px] px-2 py-2 bg-transparent border-none focus:ring-0 focus:outline-none resize-none text-[17px] font-medium placeholder:text-muted-foreground/25 scrollbar-none leading-[1.7] tracking-[-0.01em]"
                      rows={2}
                    />
                  </div>

                  {/* Bottom toolbar — pills + voice + model + send, all inside the chatbox */}
                  <div className="flex items-center justify-between px-3 pb-3 pt-1 gap-2">
                    {/* Left: intent pills */}
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pr-1">
                        {[
                          { key: 'search' as const, icon: <Search className="w-3.5 h-3.5" />, label: 'Search', color: 'blue' },
                          { key: 'research' as const, icon: <Globe2 className="w-3.5 h-3.5" />, label: 'Research', color: 'purple' },
                          { key: 'image' as const, icon: <ImageIcon className="w-3.5 h-3.5" />, label: 'Visualize', color: 'emerald' },
                          { key: 'coding' as const, icon: <Code className="w-3.5 h-3.5" />, label: 'Coding', color: 'blue' },
                        ].map(tool => (
                          <button
                            key={tool.key}
                            onClick={() => toggleIntent(tool.key)}
                            className={cn(
                              "flex items-center gap-1.5 h-8 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border shrink-0",
                              activeIntent === tool.key
                                ? tool.color === 'blue' ? 'bg-blue-500/15 border-blue-500/40 text-blue-500'
                                : tool.color === 'purple' ? 'bg-purple-500/15 border-purple-500/40 text-purple-500'
                                : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-500'
                              : "border-transparent text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40",
                              isLocked && tool.key === lockedIntent && activeIntent !== lockedIntent && "border-dashed border-muted-foreground/30 opacity-60"
                            )}
                          >
                            {tool.icon}
                            <span className="hidden sm:inline">
                               {tool.label}
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* MORE DROPDOWN (Outside scroll area to prevent clipping) */}
                      <div className="relative shrink-0" ref={moreIntentsRef}>
                        <button
                          onClick={() => setShowMoreIntents(!showMoreIntents)}
                          className={cn(
                            "flex items-center gap-1 h-8 px-2 rounded-lg text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40 transition-all border border-transparent",
                            ['coding', 'file_manipulation', 'workflow'].includes(activeIntent) && "text-foreground bg-muted/40 border-border/40"
                          )}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        
                        {showMoreIntents && (
                          <>
                            <div className="absolute bottom-[calc(100%+12px)] left-0 w-[180px] bg-card border border-border rounded-xl shadow-2xl z-[9999] backdrop-blur-2xl overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200 p-1">
                              {[
                                { key: 'file_manipulation' as const, icon: <Folder className="w-3.5 h-3.5" />, label: 'Files' },
                                { key: 'workflow' as const, icon: <Boxes className="w-3.5 h-3.5" />, label: 'Workflow' },
                              ].map(tool => (
                                <button
                                  key={tool.key}
                                  onClick={() => toggleIntent(tool.key)}
                                  className={cn(
                                    "w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-left transition-all text-[11px] font-bold uppercase tracking-wider",
                                    activeIntent === tool.key
                                      ? "bg-primary/10 text-primary"
                                      : "hover:bg-muted/50 text-foreground/70"
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    {tool.icon}
                                    <span>{tool.label}</span>
                                  </div>
                                  {isLocked && tool.key === lockedIntent && <Lock className="w-3 h-3 opacity-50" />}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right: model + voice + send */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Model selector */}
                      <div className="relative" ref={dropdownRef}>
                        <button 
                          onClick={() => setShowModelDropdown(!showModelDropdown)}
                          className={cn(
                            "flex items-center gap-2 h-8 px-3 rounded-lg transition-all text-[10px] font-bold uppercase tracking-wider border",
                            showModelDropdown 
                              ? "bg-primary/10 border-primary/30 text-primary"
                              : "border-transparent text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40"
                          )}
                        >
                          <span className="text-sm leading-none">
                            {dynamicProviders.find(p => p.slug === llmProvider)?.icon || '🤖'}
                          </span>
                          <span className="hidden sm:inline max-w-[120px] truncate">
                            {dynamicProviders.find(p => p.slug === llmProvider)?.models.find(m => m.value === llmModel)?.name || 'Select Model'}
                          </span>
                          <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", showModelDropdown && "rotate-180")} />
                        </button>

                        {showModelDropdown && (
                          <>
                            {/* Backdrop */}
                            <div className="fixed inset-0 z-[9998]" onClick={() => setShowModelDropdown(false)} />
                            
                            <div className="absolute bottom-[calc(100%+8px)] right-0 w-[300px] bg-card border border-border rounded-2xl shadow-2xl z-[9999] backdrop-blur-2xl overflow-hidden animate-in slide-in-from-bottom-3 fade-in duration-200">
                              
                              {/* Provider Grid */}
                              <div className="p-3 border-b border-border/30">
                                <label className="text-[9px] font-black uppercase text-muted-foreground/50 tracking-widest mb-2 block px-1">AI Provider</label>
                                <div className="grid grid-cols-4 gap-1.5">
                                  {dynamicProviders.map(p => (
                                    <button
                                      key={p.slug}
                                      onClick={() => {
                                        setLlmProvider(p.slug);
                                        if (p.models.length > 0 && llmProvider !== p.slug) {
                                          saveLLMSettings(p.slug, p.models[0].value);
                                        }
                                      }}
                                      className={cn(
                                        "flex flex-col items-center gap-1 p-2 rounded-xl border text-center transition-all",
                                        llmProvider === p.slug
                                          ? "bg-primary/10 border-primary/30 text-primary shadow-sm ring-1 ring-primary/10"
                                          : "border-transparent hover:bg-muted/50 text-muted-foreground hover:text-foreground",
                                        !p.has_credentials && p.slug !== 'ollama' && "opacity-40"
                                      )}
                                    >
                                      <span className="text-lg leading-none">{p.icon}</span>
                                      <span className="text-[8px] font-bold truncate w-full">{p.name}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Search */}
                              <div className="px-3 pt-2.5 pb-1.5">
                                <div className="relative">
                                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/30" />
                                  <input
                                    id="model-search-input"
                                    name="model-search"
                                    type="text"
                                    placeholder="Search models..."
                                    value={modelSearchQuery}
                                    onChange={(e) => setModelSearchQuery(e.target.value)}
                                    className="w-full bg-muted/30 border border-border/20 pl-7 pr-3 py-1.5 rounded-lg text-[11px] focus:ring-1 focus:ring-primary/30 outline-none placeholder:text-muted-foreground/30"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              </div>

                              {/* Model List */}
                              <div className="max-h-[220px] overflow-y-auto px-2 pb-2 space-y-0.5 scrollbar-thin scrollbar-thumb-border">
                                {dynamicProviders.find(p => p.slug === llmProvider)?.models
                                  .filter(m => {
                                    const q = modelSearchQuery.toLowerCase().trim();
                                    if (!q) return true;
                                    return m.name.toLowerCase().includes(q) || m.value.toLowerCase().includes(q) || (q === 'free' && m.is_free);
                                  })
                                  .map(m => (
                                    <button
                                      key={m.value}
                                      onClick={() => {
                                        saveLLMSettings(llmProvider, m.value);
                                        setShowModelDropdown(false);
                                      }}
                                      className={cn(
                                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all text-[12px]",
                                        llmModel === m.value
                                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 font-bold"
                                          : "hover:bg-muted/50 text-foreground/70 font-medium"
                                      )}
                                    >
                                      <span className="truncate flex-1">{m.name}</span>
                                      {m.is_free && (
                                        <span className={cn(
                                          "text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0",
                                          llmModel === m.value
                                            ? "bg-primary-foreground/20 text-primary-foreground"
                                            : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                        )}>Free</span>
                                      )}
                                    </button>
                                  ))}
                                {(() => {
                                  const filtered = (dynamicProviders.find(p => p.slug === llmProvider)?.models || [])
                                    .filter(m => {
                                      const q = modelSearchQuery.toLowerCase().trim();
                                      if (!q) return true;
                                      return m.name.toLowerCase().includes(q) || m.value.toLowerCase().includes(q) || (q === 'free' && m.is_free);
                                    });
                                  return filtered.length === 0 ? (
                                    <div className="py-6 text-center text-[10px] text-muted-foreground/40 font-medium italic">
                                      No models match "{modelSearchQuery}"
                                    </div>
                                  ) : null;
                                })()}
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Voice button */}
                      <button
                        className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 transition-all"
                        title="Voice input"
                      >
                        <Mic className="w-4 h-4" />
                      </button>

                      {/* Send button (platform style — round with ArrowUp) */}
                      <button
                        onClick={() => isLoading ? stopGeneration() : handleSend()}
                        disabled={(!input.trim() && !isLoading) || (!hasCredentials && !isLoading)}
                        className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg",
                          isLoading 
                            ? "bg-red-500 text-white shadow-red-500/20" 
                            : "bg-primary text-primary-foreground shadow-primary/20 disabled:opacity-20 disabled:scale-100"
                        )}
                        title={isLoading ? "Stop generating" : "Send message"}
                      >
                        {isLoading ? <Square className="w-3 h-3 fill-current" /> : <ArrowUp className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
