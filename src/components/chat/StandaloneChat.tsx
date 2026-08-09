import { useState, useRef, useEffect } from 'react';
import {
  RUN_STATUS_EVENT,
  abortChatRun,
  getChatRun,
  startChatRun,
  subscribeChatRun,
  useRunningChatKeys,
  type RunFrame,
  type RunMeta,
} from '../../lib/chatRuns';
import { usePersistedState } from '../../hooks/usePersistedState';
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
  File as FileIcon,
  Mic,
  MessageSquare,
  Shield,
  ChevronDown,
  BrainCircuit,
  ArrowUp,
  Settings2,
  Sparkles,
  Zap,
  Wand2,
  Globe2,
  Trash2,
  RotateCcw,
  ArrowUpFromLine,
  Pencil,
  Code,
  Square,
  Mail,
  FolderSearch,
  LifeBuoy,
  FileText,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { chatService, type StandaloneChatMessage as ChatMessage, type ChatSession } from '../../api';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { TextSelectionMenu } from './TextSelectionMenu';
import { MediaPreview } from './MediaPreview';
import HtmlArtifact from './HtmlArtifact';
import MarkdownMessage from './MarkdownMessage';
import type { HtmlArtifact as HtmlArtifactData } from '../../api/chat';

import { useAIModels } from '../../hooks/useAIModels';
import { useChatStream } from '../../hooks/useChatStream';
import { useMessagePanels } from '../../hooks/useMessagePanels';
import { useMessageSelection } from '../../hooks/useMessageSelection';
import { useChatModelSelection } from '../../hooks/useChatModelSelection';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import GuestBanner from './GuestBanner';

/** Rough size hint for a reasoning trace, so the toggle says what it will cost to open. */
function formatWordCount(text: string): string {
  const words = (text || '').trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return '';
  if (words < 1000) return `${words} words`;
  return `${(words / 1000).toFixed(1)}k words`;
}

export default function StandaloneChat() {
  const { isAuthenticated } = useAuth();
  const isGuest = !isAuthenticated;
  
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
  // Persisted so returning to the chat lands on the conversation the user
  // left, rather than on whichever session happens to be newest.
  const [conversationId, setConversationId] = usePersistedState<string | undefined>(
    'chat.lastSessionId',
    undefined,
  );
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /** Session ids whose turn is still streaming, including backgrounded ones. */
  const runningKeys = useRunningChatKeys();

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
    enabled: !isGuest,
  });

  // --- Model Selection State ---
  // Default to NVIDIA Nemotron 3 Super so the chat works out-of-the-box using
  // the server-side NVIDIA_API_KEY (no per-user credential required).
  const { providers: dynamicProviders } = useAIModels();

  const {
    provider: llmProvider,
    model: llmModel,
    setProvider: setLlmProvider,
    isDropdownOpen: showModelDropdown,
    setDropdownOpen: setShowModelDropdown,
    searchQuery: modelSearchQuery,
    setSearchQuery: setModelSearchQuery,
    dropdownRef,
    isChecking: isCheckingCredentials,
    select: selectModel,
    adopt: adoptSessionModel,
  } = useChatModelSelection({ isGuest, providers: dynamicProviders });

  // --- Agentic Features State ---
  const [isFollowUpsExpanded, setIsFollowUpsExpanded] = useState(true);
  const [activeIntent, setActiveIntent] = useState<'normal' | 'search' | 'image' | 'video' | 'research'>('normal');
  const [deletingMsgId, setDeletingMsgId] = useState<number | null>(null);
  const { toggle: togglePanel, isOpen: isPanelOpen, openIdFor: openPanelId } = useMessagePanels();
  
  // Text Selection State
  const {
    anchor: selectionPos,
    reference: activeReference,
    syncFromDocument: syncSelection,
    dismiss: dismissSelection,
    copySelection,
    referenceSelection,
    clearReference,
  } = useMessageSelection();



  // --- File Upload State ---
  const [isUploading, setIsUploading] = useState(false);

  // --- Live Streaming State (Perplexity-like) ---
  const {
    live,
    applyEvent: applyStreamEvent,
    reset: resetStream,
    clearStatus: clearStreamStatus,
    clearPendingToolCall,
    dismissBlockedAttachments,
  } = useChatStream();

  // Bound as consts so a `&&` guard narrows them inside event handlers too,
  // which a `live.x` property read does not.
  const { pendingToolCall, blockedAttachments } = live;

  const [showSessionSettings, setShowSessionSettings] = useState(false);
  const [systemPromptDraft, setSystemPromptDraft] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);
  const [isLiveCodeExpanded, setIsLiveCodeExpanded] = useState(true);
  const [isLiveSourcesExpanded, setIsLiveSourcesExpanded] = useState(true);
  const [isLiveMediaExpanded, setIsLiveMediaExpanded] = useState(true);
  const [thinkingTime, setThinkingTime] = useState(0);

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

  // Thinking Timer
  useEffect(() => {
    let timer: any;
    if (isLoading) {
      setThinkingTime(0);
      timer = setInterval(() => {
        setThinkingTime(prev => prev + 0.1);
      }, 100);
    } else {
      setThinkingTime(0);
    }
    return () => clearInterval(timer);
  }, [isLoading]);






  const loadConversation = async (id: string) => {
    setIsLoading(true);
    try {
      const session = await chatService.getSession(id);
      if (session && session.messages) {
        setMessages(session.messages as unknown as ChatMessage[]);
        setConversationId(id);
        setCurrentSession(session);
        adoptSessionModel(session.llm_provider, session.llm_model);
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

  // Reopen where the user left off: the persisted session if there is one,
  // otherwise the newest. Either way the transcript is refetched, so a turn
  // that finished in the background is present on arrival.
  useEffect(() => {
    if (isGuest) return; // Guests start with a fresh session each visit
    if (conversationId) {
      loadConversation(conversationId);
      return;
    }
    // Small delay to let useQuery fetch initial data if empty
    const timer = setTimeout(() => {
      const sessions = queryClient.getQueryData<ChatSession[]>(['chatSessions']);
      if (sessions && sessions.length > 0) {
        loadConversation(sessions[0].id);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const saveLLMSettings = async (provider: string, model: string) => {
    selectModel(provider, model);

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
        console.error('Failed to create session for upload', err);
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
      console.error('Failed to delete message', err);
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
      console.error('Failed to rewrite message', err);
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
      console.error('Failed to reverse context', err);
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
      console.error('Failed to prepare message for editing', err);
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
  };

  const handleApproveTool = async (callId: string) => {
    if (!conversationId || !pendingToolCall) return;
    
    clearPendingToolCall();
    setIsLoading(true);

    // Same background-run treatment as a normal send: approving a tool starts
    // another streamed turn, and it must survive leaving the page too.
    startChatRun(
      conversationId,
      (onEvent, signal) =>
        chatService.sendMessageStream(
          conversationId,
          "Approve",
          activeIntent,
          onEvent,
          undefined,
          signal,
          llmProvider,
          llmModel,
          callId
        ),
      { intent: activeIntent },
    );
  };

  const handleSaveSessionSettings = async (patch: Partial<ChatSession>) => {
    if (!conversationId || !currentSession) return;
    setIsSavingSettings(true);
    try {
      const updated = await chatService.updateSession(conversationId, patch);
      // Merge rather than replace: the PATCH response does not carry `messages`,
      // and swapping the whole object in would blank the transcript.
      setCurrentSession(prev => (prev ? { ...prev, ...updated } : updated));
      if ('memory_enabled' in patch) {
        toast.success(patch.memory_enabled ? 'Memory on' : 'Memory off for this chat');
      } else {
        toast.success('Settings saved');
        setShowSessionSettings(false);
      }
    } catch (err: any) {
      console.error('Failed to save chat settings', err);
      toast.error(err?.response?.data?.detail || 'Could not save chat settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  /**
   * Applies one SSE frame. Live turn state is folded by `useChatStream`; only
   * the effects that reach outside the turn are handled here.
   */
  const handleStreamEvent = (event: any, meta: RunMeta = {}, replayed = false) => {
    const { optimisticId, intentToSend } = { optimisticId: meta.optimisticId, intentToSend: meta.intent };
    applyStreamEvent(event);

    switch (event.type) {
      case 'status':
        // The optimistic user message gets its real database id here.
        if (optimisticId && event.user_message_id) {
          setMessages(prev => prev.map(m => (
            m.id === optimisticId ? { ...m, id: event.user_message_id } : m
          )));
        }
        break;

      case 'ask_permission':
        setIsLoading(false);
        break;

      case 'done':
        setMessages(prev => {
          // A replayed frame may be re-applied after the transcript was
          // reloaded from the server, which already contains this answer.
          if (event.ai_response?.id && prev.some(m => m.id === event.ai_response.id)) {
            return prev;
          }
          const reconciled = optimisticId && event.user_message
            ? prev.map(m => (
                m.id === optimisticId || m.id === event.user_message.id
                  ? { ...m, id: event.user_message.id }
                  : m
              ))
            : prev;
          return [...reconciled, event.ai_response as unknown as ChatMessage];
        });
        setIsLoading(false);
        clearReference();

        // Sync intent to session state if it was locked this turn
        if (intentToSend && currentSession && !['chat', 'search', 'normal'].includes(intentToSend) && currentSession.intent !== intentToSend) {
          setCurrentSession({ ...currentSession, intent: intentToSend });
        }
        break;

      case 'error':
        // Only the live delivery should raise a toast; replaying the frame
        // when the user comes back would re-announce an old failure.
        if (!replayed) toast.error(event.message);
        setIsLoading(false);
        break;
    }
  };

  // The subscription effect below must not re-subscribe on every render, so it
  // reads the handler through a ref that always holds the latest closure.
  const handleStreamEventRef = useRef(handleStreamEvent);
  handleStreamEventRef.current = handleStreamEvent;

  /**
   * Binds the view to the run for whichever conversation is open.
   *
   * Every buffered frame is replayed first, so a turn that streamed while the
   * user was elsewhere paints in full on return; `resetStream` before the
   * replay keeps the fold from being applied twice.
   */
  useEffect(() => {
    if (!conversationId) return;
    // No run: nothing to attach to. `isLoading` is left alone — a send that
    // is still creating its session has already set it, and clearing it here
    // would flicker the composer back to idle for a tick.
    const run = getChatRun(conversationId);
    if (!run) return;

    resetStream();
    setIsLoading(run.status === 'running');

    return subscribeChatRun(conversationId, (frame: RunFrame, replayed) => {
      if (frame.type === RUN_STATUS_EVENT) {
        setIsLoading(false);
        clearStreamStatus();
        if (!replayed && frame.status === 'error' && frame.error) {
          toast.error(frame.error);
        }
        return;
      }
      handleStreamEventRef.current(frame, run.meta, replayed);
    });
    // `runningKeys` is the signal that a run was created for this conversation
    // after the effect first ran (a brand-new session starts its run one tick
    // after `conversationId` is set).
  }, [conversationId, runningKeys, resetStream, clearStreamStatus]);

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput ?? input;
    if (!textToSend.trim() || isLoading) return;

    const intentToSend = activeIntent;

    const userMessage: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: textToSend,
      metadata: { intent: intentToSend },
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    resetStream();
    setIsReasoningExpanded(false);
    setIsLiveCodeExpanded(true);
    setIsLiveSourcesExpanded(true);
    setIsLiveMediaExpanded(true);

    const meta: RunMeta = { optimisticId: userMessage.id as number, intent: intentToSend };

    try {
      let currentSessionId = conversationId;

      if (isGuest) {
        if (!currentSessionId) {
          const newSession = await chatService.guest.createSession(textToSend.slice(0, 30) + '...');
          currentSessionId = newSession.id;
          setConversationId(newSession.id);
          setCurrentSession(newSession);
        }
        const sessionId = currentSessionId;
        startChatRun(
          sessionId,
          (onEvent, signal) =>
            chatService.guest.sendMessageStream(sessionId, textToSend, onEvent, signal),
          meta,
        );
      } else {
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

        const reference = activeReference ? { message_id: activeReference.messageId, snippet: activeReference.textSnippet } : undefined;
        const sessionId = currentSessionId;

        // Started, not awaited: the run owns the stream from here. Frames reach
        // this component through the subscription effect, which is also what
        // re-attaches after a page switch.
        startChatRun(
          sessionId,
          (onEvent, signal) =>
            chatService.sendMessageStream(
              sessionId,
              textToSend,
              intentToSend,
              onEvent,
              reference,
              signal,
              llmProvider,
              llmModel
            ),
          meta,
        );
      }
    } catch (err) {
      // Only session creation can throw here; stream failures surface as a
      // run status frame instead.
      setIsLoading(false);
      clearStreamStatus();
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Failed to start this chat'}`,
        created_at: new Date().toISOString(),
        metadata: {}
      } as ChatMessage]);
    }
  };

  const stopGeneration = () => {
    if (!conversationId) return;
    abortChatRun(conversationId);
    setIsLoading(false);
    clearStreamStatus();
    toast.info('Generation stopped');
  };

  const isInitialState = messages.length === 0;

  if (isCheckingCredentials) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Note: the previous "Access Restricted / Configure Credentials" gate was
  // removed — the server-wide NVIDIA env key now backs the chat for any user
  // who hasn't set up a per-user credential.

  return (
    <div className="flex h-full w-full bg-background overflow-hidden relative">
      {/* Premium Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(var(--primary-rgb),0.05),transparent_50%)] pointer-events-none" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/5 blur-[100px] rounded-full pointer-events-none" />

      {/* Guest banner — encourage login without blocking chat. On mobile it's a
          56px band that visually contains the floating hamburger (fixed top-3
          left-3, 44px tall), so they read as one top bar. */}
      {isGuest && <GuestBanner model={llmModel} />}

      {/* 1. History Sidebar — overlay drawer on mobile, in-flow on desktop */}
      {showHistory && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowHistory(false)}
        />
      )}
      <div
        className={cn(
          "h-full bg-card/80 backdrop-blur-xl border-r border-border/60 transition-all duration-300 ease-in-out flex flex-col shadow-2xl overflow-hidden",
          // Mobile: fixed overlay
          "fixed md:relative left-0 top-0 z-40 md:z-30 md:flex-shrink-0",
          showHistory
            ? "w-[85vw] max-w-[320px] md:w-[300px] translate-x-0"
            : "w-0 -translate-x-full md:translate-x-0 md:w-0 md:opacity-0 md:border-none"
        )}
      >
        <div className="w-[85vw] max-w-[320px] md:w-[300px] flex flex-col h-full">
          <div className="h-16 px-6 flex items-center justify-between border-b border-border/40 shrink-0">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-primary/70" />
              <h2 className="font-bold text-xs ">
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

          <div className="p-4 shrink-0">
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
              New conversation
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
                      adoptSessionModel(sessionDetails.llm_provider, sessionDetails.llm_model);
                      setShowHistory(false);
                    }
                  } finally {
                    setIsLoading(false);
                  }
                }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* A conversation still streaming in the background says so
                      here — otherwise leaving it looks like cancelling it. */}
                  {runningKeys.includes(conv.id) ? (
                    <Loader2 className="w-4 h-4 shrink-0 animate-spin text-primary" />
                  ) : (
                    <MessageSquare className="w-4 h-4 opacity-60 shrink-0" />
                  )}
                  <span className="truncate font-mono flex-1">
                    {conv.title || conv.id.slice(0, 18)}
                  </span>
                  {runningKeys.includes(conv.id) && conversationId !== conv.id && (
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-primary/80">
                      working
                    </span>
                  )}
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
      </div>

      {/* 2. Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative min-w-0 z-10 transition-all duration-300">
        
        {/* Transparent Header — leaves space on mobile for the global hamburger and guest banner */}
        <header className={cn(
          "h-16 shrink-0 flex items-center px-4 md:px-6 justify-between border-b border-border/40 backdrop-blur-md bg-background/50",
          // Guest: the banner band (56px on mobile, ~38px on desktop) overlays
          // the top — push the header below it instead of stretching it.
          isGuest && "mt-14 md:mt-10"
        )}>
          <div className={cn(
            "flex items-center gap-3 min-w-0",
            // The floating hamburger overlays the header only for authed users;
            // in guest mode it sits inside the banner band above.
            !isGuest && "pl-12 md:pl-0"
          )}>
            {!showHistory && (
              <button
                onClick={() => setShowHistory(true)}
                className="p-2.5 md:p-3 bg-card/40 border border-border/60 hover:bg-card/60 rounded-2xl transition-all text-muted-foreground group shrink-0"
                aria-label="Conversation history"
              >
                <History className="w-5 h-5 group-hover:text-primary transition-colors" />
              </button>
            )}
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded border border-border bg-secondary">
               <div className="w-1.5 h-1.5 rounded-full bg-success" />
               <span className="text-[11px] font-semibold text-muted-foreground">Assistant online</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
             {/* Memory state is shown in the header, not buried in the panel:
                 with it off the assistant behaves very differently, and a user
                 who forgot they switched it off reads that as the model being
                 broken. */}
             {currentSession && !currentSession.memory_enabled && (
               <button
                 onClick={() => setShowSessionSettings(true)}
                 title="Memory is off for this chat — click to change"
                 className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-500/40
                            bg-amber-500/10 text-[11px] font-semibold text-amber-500
                            transition-all duration-200 hover:bg-amber-500/20
                            animate-in fade-in slide-in-from-right-2"
               >
                 <BrainCircuit className="w-3.5 h-3.5" />
                 Memory off
               </button>
             )}
             <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                <Shield className="w-3.5 h-3.5" />
                Encrypted
             </div>
             {currentSession && (
               <button
                 onClick={() => {
                   setSystemPromptDraft(currentSession.system_prompt || '');
                   setShowSessionSettings(true);
                 }}
                 title="Chat settings"
                 className="p-1.5 rounded-lg text-muted-foreground transition-all duration-200
                            hover:bg-muted hover:text-foreground active:scale-95"
               >
                 <Settings2 className="w-4 h-4" />
               </button>
             )}
          </div>
        </header>

        {/* Per-chat settings: system prompt + memory. */}
        {showSessionSettings && currentSession && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm
                       animate-in fade-in duration-200"
            onClick={() => setShowSessionSettings(false)}
          >
            <div
              className="w-full max-w-lg mx-4 rounded-2xl border border-border bg-card shadow-2xl
                         animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300 ease-out"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                <h2 className="text-sm font-bold text-foreground">Chat settings</h2>
                <button
                  onClick={() => setShowSessionSettings(false)}
                  className="p-1 rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-5 px-5 py-5">
                <div>
                  <label htmlFor="system-prompt" className="block text-xs font-bold text-foreground">
                    System prompt
                  </label>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Standing instructions for this conversation. Applies to every message,
                    including ones already sent.
                  </p>
                  <textarea
                    id="system-prompt"
                    value={systemPromptDraft}
                    onChange={e => setSystemPromptDraft(e.target.value)}
                    rows={5}
                    placeholder="e.g. Answer concisely. Prefer tables over prose. Always cite sources."
                    className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-3 py-2
                               text-xs leading-relaxed text-foreground outline-none
                               transition-all duration-200 placeholder:text-muted-foreground/50
                               focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-muted/20 p-3.5">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-foreground">Memory</div>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      {currentSession.memory_enabled
                        ? 'The assistant sees recent turns and can search the rest of this conversation.'
                        : 'The assistant answers from your current message alone. Nothing is deleted — turning this back on restores the full history.'}
                    </p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={currentSession.memory_enabled}
                    aria-label="Toggle memory"
                    disabled={isSavingSettings}
                    onClick={() => handleSaveSessionSettings({ memory_enabled: !currentSession.memory_enabled })}
                    className={cn(
                      "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-300 ease-out",
                      "disabled:opacity-50",
                      currentSession.memory_enabled ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ease-out",
                        currentSession.memory_enabled ? "translate-x-[22px]" : "translate-x-0.5"
                      )}
                    />
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-border px-5 py-3.5">
                <button
                  onClick={() => setShowSessionSettings(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground
                             transition-colors hover:bg-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  disabled={isSavingSettings}
                  onClick={() => handleSaveSessionSettings({ system_prompt: systemPromptDraft })}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-bold
                             text-primary-foreground transition-all duration-200
                             hover:brightness-110 active:scale-95 disabled:opacity-50"
                >
                  {isSavingSettings && <Loader2 className="w-3 h-3 animate-spin" />}
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Transition Area */}
        <div 
          className={cn(
            "flex-1 overflow-y-auto px-4 md:px-6 transition-all duration-1000 ease-in-out relative",
            // Initial state: truly center the hero (no asymmetric padding that
            // shoves it upward and leaves a dead zone above the composer).
            // Transcript: only enough head room to clear the sticky header —
            // the previous pt-8 sat on top of the 3rem turn rhythm below and
            // read as an unexplained empty band above the first message.
            isInitialState ? "flex items-center justify-center py-4" : "pt-3 pb-24"
          )}
          onMouseUp={syncSelection}
          onKeyUp={syncSelection}
        >
          <TextSelectionMenu
            position={selectionPos}
            onClose={dismissSelection}
            onCopy={() => {
              copySelection();
              toast.success('Text copied to clipboard');
            }}
            onReference={() => {
              if (referenceSelection()) textareaRef.current?.focus();
            }}
          />

          <div className={cn(
            "max-w-6xl mx-auto w-full relative",
            isInitialState ? "flex flex-col items-center" : "space-y-6"
          )}>
            {isInitialState ? (
              <div className="text-center space-y-6 mb-4 md:mb-12 animate-in fade-in duration-150">
                <div className="w-12 h-12 bg-agent-subtle border border-agent-line rounded-lg flex items-center justify-center mx-auto">
                  <BrainCircuit className="w-6 h-6 text-agent" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
                    What should I take off your plate?
                  </h1>
                  <p className="text-muted-foreground text-base max-w-xl mx-auto leading-relaxed px-2">
                    Describe the job in plain words. I'll build the workflow, run it,
                    and check with you before anything leaves your account.
                  </p>
                </div>
                {/* Concrete starting points beat a blank box — each maps to a real
                    capability (scheduling, connectors, documents, triage). A fixed
                    grid keeps them from wrapping into a ragged pile. */}
                <div className="grid sm:grid-cols-2 gap-2 max-w-2xl mx-auto pt-2 text-left">
                  {[
                    { icon: Mail, label: 'Email me a digest of overdue invoices',
                      hint: 'Every Monday, 9am' },
                    { icon: FolderSearch, label: 'Find files nobody has opened in 3 years',
                      hint: 'Google Drive' },
                    { icon: FileText, label: 'Pull the line items out of this invoice',
                      hint: 'Upload a PDF' },
                    { icon: LifeBuoy, label: 'Draft first replies to support tickets',
                      hint: 'Needs your approval to send' },
                  ].map(({ icon: Icon, label, hint }) => (
                    <button
                      key={label}
                      onClick={() => setInput(label)}
                      className="flex items-start gap-3 px-3 py-2.5 bg-card hover:bg-accent border border-border rounded transition-colors"
                    >
                      <Icon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-[13px] text-foreground leading-snug">{label}</span>
                        <span className="block text-[12px] text-muted-foreground mt-0.5">{hint}</span>
                      </span>
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
                      "max-w-[92%] md:max-w-[85%] space-y-3",
                      message.role === 'user' ? "text-right" : ""
                    )}>

                      {/* Main Content Bubble */}
                      <div className={cn(
                        "text-[17px] leading-[1.8] tracking-[-0.01em] prose prose-base dark:prose-invert max-w-none ai-chat-prose",
                        message.role === 'user' 
                          ? "text-foreground font-semibold bg-primary/5 border border-primary/10 p-4 md:p-5 rounded-3xl rounded-tr-none shadow-sm inline-block text-left" 
                          : message.role === 'system'
                          ? "w-full"
                          : "text-foreground font-[450] bg-card/60 p-5 md:p-7 rounded-3xl rounded-tl-none shadow-sm glass border border-border/40 inline-block text-left"
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
                                    <span className="text-[10px]  font-bold text-muted-foreground/60 bg-background px-1.5 py-0.5 rounded">
                                      {message.metadata?.file_type || 'File'}
                                    </span>
                                    {message.metadata?.has_extracted_text && (
                                       <span className="text-[10px]  font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
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
                          <MarkdownMessage
                            content={message.content}
                            sources={message.metadata?.sources}
                          />
                        )}
                      </div>
                      {/* Quick Summary, Reasoning & Activity Row */}
                      {message.role === 'assistant' && (message.metadata?.summary || message.metadata?.thinking || (message.metadata?.tool_trace && message.metadata.tool_trace.length > 0) || message.metadata?.has_code_execution) && (
                        <div className="flex flex-wrap gap-2 mt-4 mb-2">
                          {message.metadata?.summary && (
                            <div className="flex-1 min-w-[140px] group/summary animate-in fade-in slide-in-from-top-2 duration-500">
                              <button
                                onClick={() => togglePanel('summary', message.id as number)}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-2 rounded-xl transition-all border w-full",
                                  isPanelOpen('summary', message.id)
                                    ? "bg-primary/10 border-primary/30 text-primary shadow-sm" 
                                    : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50 hover:border-border/60 hover:text-foreground"
                                )}
                              >
                                <Sparkles className={cn("w-4 h-4", isPanelOpen('summary', message.id) ? "text-primary" : "text-muted-foreground/70")} />
                                <span className="text-[12px] font-bold tracking-tight">Summary</span>
                                <div className="flex-1" />
                                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300", isPanelOpen('summary', message.id) && "rotate-180")} />
                              </button>
                            </div>
                          )}

                          {message.metadata?.thinking && (
                            <div className="flex-1 min-w-[140px] group/thinking animate-in fade-in slide-in-from-top-2 duration-500">
                              <button
                                onClick={() => togglePanel('thinking', message.id as number)}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-2 rounded-xl transition-all border w-full",
                                  isPanelOpen('thinking', message.id)
                                    ? "bg-primary/10 border-primary/30 text-primary shadow-sm" 
                                    : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50 hover:border-border/60 hover:text-foreground"
                                )}
                              >
                                <BrainCircuit className={cn("w-4 h-4", isPanelOpen('thinking', message.id) ? "text-primary" : "text-muted-foreground/70")} />
                                <span className="text-[12px] font-bold tracking-tight">Reasoning</span>
                                {/* Length hint: without it there is no way to
                                    tell a one-line thought from six paragraphs
                                    before committing to opening it. */}
                                <span className="text-[10px] font-medium tabular-nums opacity-50">
                                  {formatWordCount(message.metadata.thinking)}
                                </span>
                                <div className="flex-1" />
                                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300", isPanelOpen('thinking', message.id) && "rotate-180")} />
                              </button>
                            </div>
                          )}
                          {message.metadata?.tool_trace && message.metadata.tool_trace.length > 0 && (
                            <div className="flex-1 min-w-[140px] group/activity animate-in fade-in slide-in-from-top-2 duration-500">
                              <button
                                onClick={() => togglePanel('activity', message.id as number)}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-2 rounded-xl transition-all border w-full",
                                  isPanelOpen('activity', message.id)
                                    ? "bg-amber-500/10 border-amber-500/30 text-amber-600 shadow-sm" 
                                    : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50 hover:border-border/60 hover:text-foreground"
                                )}
                              >
                                <Zap className={cn("w-4 h-4", isPanelOpen('activity', message.id) ? "text-amber-600" : "text-muted-foreground/70")} />
                                <span className="text-[12px] font-bold tracking-tight">Activity</span>
                                <div className="flex-1" />
                                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300", isPanelOpen('activity', message.id) && "rotate-180")} />
                              </button>
                            </div>
                          )}

                          {message.metadata?.has_code_execution && message.metadata?.code_executions && message.metadata.code_executions.length > 0 && (
                            <div className="flex-1 min-w-[140px] group/code animate-in fade-in slide-in-from-top-2 duration-500">
                              <button
                                onClick={() => togglePanel('code', message.id as number)}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-2 rounded-xl transition-all border w-full",
                                  isPanelOpen('code', message.id)
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 shadow-sm" 
                                    : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50 hover:border-border/60 hover:text-foreground"
                                )}
                              >
                                <Code className={cn("w-4 h-4", isPanelOpen('code', message.id) ? "text-emerald-600" : "text-muted-foreground/70")} />
                                <span className="text-[12px] font-bold tracking-tight">Code</span>
                                <div className="flex-1" />
                                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300", isPanelOpen('code', message.id) && "rotate-180")} />
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Expanded Summary Content */}
                      {message.role === 'assistant' && isPanelOpen('summary', message.id) && message.metadata?.summary && (
                        <div className="mt-2 p-5 bg-card/40 backdrop-blur-md border border-primary/20 rounded-2xl animate-in slide-in-from-top-2 duration-300 shadow-sm relative overflow-hidden group">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/40" />
                          <p className="text-[14px] font-medium text-foreground/90 leading-relaxed italic tracking-tight">
                            {message.metadata.summary}
                          </p>
                        </div>
                      )}

                      {/* Expanded Thinking Content */}
                      {message.role === 'assistant' && isPanelOpen('thinking', message.id) && message.metadata?.thinking && (
                        <div className="mt-2 overflow-hidden rounded-2xl border border-primary/20 bg-muted/20
                                        animate-in fade-in slide-in-from-top-2 duration-300 ease-out">
                          <div className="flex items-center gap-2 border-b border-border/30 bg-primary/5 px-4 py-2">
                            <Sparkles className="h-3 w-3 text-primary/60" />
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                              How the assistant got here
                            </span>
                          </div>
                          {/* Capped and scrollable: an unbounded trace can run
                              longer than the answer it explains, pushing the
                              actual reply off screen. */}
                          <div className="max-h-[420px] overflow-y-auto p-4">
                            <div className="prose prose-sm prose-invert max-w-none text-[14px] leading-relaxed text-muted-foreground italic select-text">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {message.metadata.thinking}
                              </ReactMarkdown>
                            </div>
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
                      {message.role === 'assistant' && isPanelOpen('activity', message.id) && message.metadata?.tool_trace && message.metadata.tool_trace.length > 0 && (
                        <div className="mt-2 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl animate-in slide-in-from-top-2 duration-300">
                          <div className="flex items-center gap-3 px-1 mb-3">
                            <Zap className="w-3.5 h-3.5 text-amber-500/70" />
                            <span className="text-[11px] font-semibold  text-amber-600/70">Agent activity log</span>
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
                                  <span className="flex items-center justify-center w-6 h-6 rounded-md bg-amber-500/10 text-[10px] font-semibold text-amber-600 shrink-0 border border-amber-500/10">
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
                      {message.role === 'assistant' && isPanelOpen('code', message.id) && message.metadata?.code_executions && message.metadata.code_executions.length > 0 && (
                        <div className="mt-2 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl animate-in slide-in-from-top-2 duration-300">
                          <div className="flex items-center gap-3 px-1 mb-3">
                            <Code className="w-3.5 h-3.5 text-emerald-500/70" />
                            <span className="text-[11px] font-semibold  text-emerald-600/70">Secure sandbox code</span>
                            <div className="h-px flex-1 bg-emerald-500/10" />
                          </div>
                          <div className="space-y-4">
                            {message.metadata.code_executions.map((exec: any, i: number) => (
                              <div key={i} className="space-y-2 border-b border-emerald-500/5 last:border-0 pb-4 last:pb-0">
                                <div className="flex items-center gap-2">
                                   <span className="text-[10px] font-semibold text-emerald-600/50">Execution #{exec.iteration || i+1}</span>
                                   <div className="h-px flex-1 bg-emerald-500/5" />
                                </div>
                                <div className="rounded-xl overflow-hidden border border-emerald-500/10 bg-zinc-950 shadow-sm">
                                   <div className="px-3 py-1.5 bg-zinc-900/50 flex items-center justify-between border-b border-white/5">
                                      <span className="text-[9px] font-bold text-zinc-500 ">Input code</span>
                                   </div>
                                   <pre className="p-4 text-[13px] overflow-x-auto text-zinc-300 font-mono leading-relaxed bg-zinc-950">
                                      <code>{exec.code}</code>
                                   </pre>
                                </div>
                                {(exec.output || exec.result) && (
                                   <div className="rounded-xl overflow-hidden border border-blue-500/10 bg-zinc-950/50 shadow-sm">
                                      <div className="px-3 py-1.5 bg-zinc-900/50 flex items-center justify-between border-b border-white/5">
                                         <span className="text-[9px] font-bold text-zinc-500 ">Execution output</span>
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
                              onClick={() => togglePanel('sources', message.id as number)}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border group",
                                isPanelOpen('sources', message.id) ? "bg-primary/10 border-primary/30 text-primary shadow-sm" : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50"
                              )}
                            >
                              <Globe2 className={cn("w-3.5 h-3.5", isPanelOpen('sources', message.id) ? "text-primary" : "text-muted-foreground/60 group-hover:text-primary")} />
                              <span className="text-[12px] font-bold">{message.metadata.sources.length} Sources</span>
                            </button>
                          )}

                          {message.metadata?.images?.length > 0 && (
                            <button
                              onClick={() => togglePanel('images', message.id as number)}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border group",
                                isPanelOpen('images', message.id) ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 shadow-sm" : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50"
                              )}
                            >
                              <ImageIcon className={cn("w-3.5 h-3.5", isPanelOpen('images', message.id) ? "text-emerald-600" : "text-muted-foreground/60 group-hover:text-emerald-500")} />
                              <span className="text-[12px] font-bold">{message.metadata.images.length} Images</span>
                            </button>
                          )}

                          {message.metadata?.videos?.length > 0 && (
                            <button
                              onClick={() => togglePanel('videos', message.id as number)}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border group",
                                isPanelOpen('videos', message.id) ? "bg-purple-500/10 border-purple-500/30 text-purple-600 shadow-sm" : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50"
                              )}
                            >
                              <Video className={cn("w-3.5 h-3.5", isPanelOpen('videos', message.id) ? "text-purple-600" : "text-muted-foreground/60 group-hover:text-purple-500")} />
                              <span className="text-[12px] font-bold">{message.metadata.videos.length} Videos</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Content areas below the row triggers */}
                      {message.role === 'assistant' && isPanelOpen('sources', message.id) && message.metadata?.sources?.length > 0 && (
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

                      {message.role === 'assistant' && isPanelOpen('images', message.id) && message.metadata?.images?.length > 0 && (
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

                      {message.role === 'assistant' && isPanelOpen('videos', message.id) && message.metadata?.videos?.length > 0 && (
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


                      {/* Rendered HTML artifacts, replayed from stored history. */}
                      {Array.isArray(message.metadata?.html_artifacts) &&
                        message.metadata.html_artifacts.map((art: HtmlArtifactData, i: number) => (
                          <HtmlArtifact key={`${message.id}-art-${i}`} artifact={art} />
                        ))}

                      
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
                <div className="max-w-[92%] md:max-w-[85%] space-y-3">
                  <div className="bg-muted/30 p-4 rounded-3xl shadow-sm border border-border/40 inline-flex flex-col gap-3 min-w-[300px] max-w-sm w-full">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-background border border-border/50 flex items-center justify-center shrink-0">
                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold animate-pulse text-foreground/80">Uploading file...</h4>
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

              const statusMessage = live.status?.message || 'Thinking...';
              const statusIcon = phaseIcons[live.status?.phase || 'thinking'] || phaseIcons.thinking;

              return (
                <div className="flex gap-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 shadow-inner">
                    <div className="animate-pulse">{statusIcon}</div>
                  </div>
                  <div className="flex-1 space-y-3 pt-1 max-w-[92%] md:max-w-[85%]">
                    {/* Live Status */}
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-semibold text-foreground/80 animate-pulse">{statusMessage}</span>
                        <span className="text-[11px] font-mono text-muted-foreground/40 shrink-0">({thinkingTime.toFixed(1)}s)</span>
                      </div>
                      {live.thinking && (
                        <button
                          onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-all text-[10px] font-semibold  text-primary/60"
                        >
                          <BrainCircuit className="w-3 h-3" />
                          {isReasoningExpanded ? 'Hide reasoning' : 'View reasoning'}
                          <ChevronDown className={cn("w-3 h-3 transition-transform duration-300", isReasoningExpanded && "rotate-180")} />
                        </button>
                      )}
                    </div>

                    {/* Expandable Reasoning Process */}
                    {live.thinking && isReasoningExpanded && (
                      <div className="mt-2 p-4 rounded-2xl bg-muted/30 border border-border/40 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="w-3.5 h-3.5 text-primary/60" />
                          <span className="text-[10px] font-semibold  text-muted-foreground/60">Internal processing</span>
                        </div>
                        <div className="prose prose-invert prose-sm max-w-none text-muted-foreground/80 italic font-medium leading-relaxed">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {live.thinking}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {/* Live Content Stream */}
                    {live.content && (
                      <div className="prose prose-invert prose-sm max-w-none text-foreground/90 leading-relaxed animate-in fade-in duration-500">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {live.content}
                        </ReactMarkdown>
                      </div>
                    )}

                    {/* Artifacts as they arrive, before the turn is persisted. */}
                    {live.artifacts.map((art, i) => (
                      <HtmlArtifact key={`live-art-${i}`} artifact={art} />
                    ))}

                    {/* Live Activity Timeline */}
                    {live.activity.length > 0 && (
                      <div className="space-y-2 animate-in fade-in duration-300">
                        <div className="flex items-center gap-3 px-1 mb-2">
                          <BrainCircuit className="w-4 h-4 text-primary/60" />
                          <span className="text-sm font-semibold  text-muted-foreground/90">Agent timeline</span>
                          <div className="h-px flex-1 bg-border/30" />
                        </div>
                        <div className="space-y-2">
                           {live.activity.map((activity, i) => {
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
                                      <span className="flex items-center justify-center w-7 h-7 rounded-md bg-amber-500/20 text-xs font-semibold text-amber-600 shrink-0 border border-amber-500/20 shadow-sm">
                                         {activity.iteration || '?'}
                                      </span>
                                    )}
                                    
                                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                                      {isThought ? (
                                        <div className="flex items-center gap-2 pt-1">
                                          <span className="text-[11px] font-semibold  text-muted-foreground/50">Processing</span>
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
                                            isLongThought && openPanelId('activity') === null && "max-h-[80px] overflow-hidden mask-fade-bottom"
                                          )}>
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                              {thought}
                                            </ReactMarkdown>
                                          </div>
                                          {isLongThought && (
                                            <button 
                                              onClick={() => togglePanel('activity', -i - 1)}
                                              className="text-[10px] font-bold text-primary/40 hover:text-primary transition-colors flex items-center gap-1 mt-1"
                                            >
                                              {isPanelOpen('activity', -i - 1) ? 'Show less' : 'Read more reasoning...'}
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
                    {live.codeExecutions.length > 0 && (
                      <div className="space-y-3 animate-in fade-in duration-300 mt-4">
                        <button 
                          onClick={() => setIsLiveCodeExpanded(!isLiveCodeExpanded)}
                          className="flex items-center gap-3 px-1 mb-2 w-full group"
                        >
                          <Code className="w-4 h-4 text-emerald-500/60 group-hover:text-emerald-500 transition-colors" />
                          <span className="text-sm font-semibold  text-muted-foreground/90">Code sandbox</span>
                          <div className="h-px flex-1 bg-border/20" />
                          <ChevronDown className={cn("w-4 h-4 text-muted-foreground/40 transition-transform duration-300", isLiveCodeExpanded && "rotate-180")} />
                        </button>
                        
                        {isLiveCodeExpanded && (
                          <div className="space-y-3">
                            {live.codeExecutions.map((exec, i) => (
                              <div key={i} className="rounded-2xl overflow-hidden border border-emerald-500/20 bg-emerald-500/5 animate-in slide-in-from-bottom-2 duration-300">
                                <div className="px-4 py-2 bg-emerald-500/10 flex items-center justify-between border-b border-emerald-500/10">
                                   <div className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                      <span className="text-[10px] font-semibold text-emerald-600 ">Active Execution {i+1}</span>
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
                                           <span className="text-[9px] font-bold text-blue-500/60 uppercase">Console output</span>
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
                    {(live.status?.phase === 'visualizing' || live.status?.phase === 'motion_generating') && (
                      <div className="mt-4 relative overflow-hidden rounded-3xl border border-primary/20 bg-muted/20 aspect-video max-w-sm w-full group/media">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent animate-pulse" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-6">
                          <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-ping duration-[3000ms]" />
                            {live.status.phase === 'visualizing' ? (
                                <ImageIcon className="w-12 h-12 text-primary/40 animate-bounce duration-[2000ms]" />
                            ) : (
                                <Video className="w-12 h-12 text-primary/40 animate-bounce duration-[2000ms]" />
                            )}
                          </div>
                          <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-700">
                             <h4 className="text-sm font-semibold  text-primary/60">
                                {live.status.phase === 'visualizing' ? 'Developing vision' : 'Composing motion'}
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
                    {(live.sources.length > 0 || live.images.length > 0 || live.videos.length > 0) && (
                      <div className="mt-4 flex flex-wrap gap-2 animate-in fade-in duration-300">
                        {live.sources.length > 0 && (
                          <button
                            onClick={() => setIsLiveSourcesExpanded(!isLiveSourcesExpanded)}
                            className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border group",
                              isLiveSourcesExpanded ? "bg-primary/10 border-primary/30 text-primary shadow-sm" : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50"
                            )}
                          >
                            <Globe2 className={cn("w-3.5 h-3.5", isLiveSourcesExpanded ? "text-primary" : "text-muted-foreground/60 group-hover:text-primary")} />
                            <span className="text-[12px] font-bold">{live.sources.length} Sources</span>
                            <ChevronDown className={cn("w-3 h-3 transition-transform duration-300", isLiveSourcesExpanded && "rotate-180")} />
                          </button>
                        )}

                        {(live.images.length > 0 || live.videos.length > 0) && (
                          <button
                            onClick={() => setIsLiveMediaExpanded(!isLiveMediaExpanded)}
                            className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border group",
                              isLiveMediaExpanded ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 shadow-sm" : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50"
                            )}
                          >
                            <Sparkles className={cn("w-3.5 h-3.5", isLiveMediaExpanded ? "text-emerald-600" : "text-muted-foreground/60 group-hover:text-emerald-500")} />
                            <span className="text-[12px] font-bold">{live.images.length + live.videos.length} Media</span>
                            <ChevronDown className={cn("w-3 h-3 transition-transform duration-300", isLiveMediaExpanded && "rotate-180")} />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Live Expanded Areas */}
                    {live.sources.length > 0 && isLiveSourcesExpanded && (
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 px-1 animate-in slide-in-from-top-2 duration-300">
                        {live.sources.slice(0, 3).map((source, i) => (
                          <MediaPreview 
                            key={i}
                            url={source.url}
                            type="link"
                            title={source.title}
                            thumbnail={source.thumbnail}
                            className="opacity-80 hover:opacity-100 animate-in zoom-in-95 duration-300"
                          />
                        ))}
                        {live.sources.length > 3 && (
                          <div className="flex items-center justify-center rounded-xl border border-dashed border-border/40 bg-muted/20 text-[10px] font-bold text-muted-foreground/40 italic">
                             +{live.sources.length - 3} more...
                          </div>
                        )}
                      </div>
                    )}

                    {(live.images.length > 0 || live.videos.length > 0) && isLiveMediaExpanded && (
                       <div className="mt-3 flex gap-3 overflow-x-auto pb-2 scrollbar-hide px-1 animate-in slide-in-from-top-2 duration-300">
                         {live.images.slice(0, 4).map((img, i) => (
                           <MediaPreview 
                             key={`img-${i}`}
                             url={img.image || img.url}
                             type="image"
                             className="w-32 h-20 shrink-0 shadow-sm"
                           />
                         ))}
                         {live.videos.slice(0, 4).map((vid, i) => (
                           <MediaPreview 
                             key={`vid-${i}`}
                             url={vid.url}
                             type="video"
                             className="w-32 h-20 shrink-0 shadow-sm"
                           />
                         ))}
                         {(live.images.length > 4 || live.videos.length > 4) && (
                           <div className="w-24 h-20 shrink-0 flex items-center justify-center rounded-xl bg-muted/20 border border-dashed border-border/40 text-[9px] font-semibold text-muted-foreground/30  text-center px-2">
                              +{live.images.length + live.videos.length - 8} more
                           </div>
                         )}
                       </div>
                    )}

                    {/* Progress bar */}
                    {!live.activity.length && (
                      <div className="w-48 h-0.5 bg-muted/30 rounded-full overflow-hidden">
                        <div className="h-full bg-primary/40 rounded-full animate-indeterminate-slide" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Approval UI */}
            {pendingToolCall && (
              <div className="flex gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20 shadow-lg shadow-amber-500/20">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 space-y-4 max-w-[92%] md:max-w-[85%]">
                  <div className="bg-card/60 p-6 rounded-3xl rounded-tl-none shadow-sm glass border border-amber-500/30 space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold tracking-tight text-amber-600">Permission required</h3>
                      <p className="text-muted-foreground text-sm font-medium">The agent wants to execute a sensitive operation:</p>
                    </div>
                    
                    <div className="bg-muted/30 p-4 rounded-2xl border border-border/40 font-mono text-[13px] space-y-2 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-600 font-semibold  text-[10px]">Tool:</span>
                        <span className="font-bold text-foreground">{pendingToolCall.tool}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-amber-600 font-semibold  text-[10px]">Arguments:</span>
                        {pendingToolCall.tool === 'execute_shell' && typeof pendingToolCall.args?.command === 'string' && /[;&|>]/.test(pendingToolCall.args.command) ? (
                          <>
                            <div className="text-[10px] text-red-500 font-bold bg-red-500/10 px-2 py-1 rounded my-1 border border-red-500/20">
                              ⚠️ Warning: Command contains chaining/redirection (;, &, |, &gt;)
                            </div>
                            <pre className="text-xs text-red-400 overflow-x-auto custom-scrollbar pt-1">
                              {JSON.stringify(pendingToolCall.args, null, 2)}
                            </pre>
                          </>
                        ) : (
                          <pre className="text-xs text-muted-foreground/80 overflow-x-auto custom-scrollbar pt-1">
                            {JSON.stringify(pendingToolCall.args, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => handleApproveTool(pendingToolCall.call_id)}
                        className="flex-1 h-11 bg-primary text-primary-foreground font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 group"
                      >
                        <Check className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => clearPendingToolCall()}
                        className="flex-1 h-11 bg-muted text-muted-foreground font-semibold rounded-xl hover:bg-muted/80 transition-all flex items-center justify-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Deny
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Dynamic Navigation/Input Area */}
        <footer className={cn(
          // pb uses the safe-area inset so the composer toolbar clears the
          // phone gesture bar (needs viewport-fit=cover in index.html).
          "shrink-0 transition-all duration-1000 ease-in-out px-4",
          isInitialState
            ? "pb-[max(1.5rem,env(safe-area-inset-bottom))] md:pb-16"
            : "pb-[max(1.25rem,env(safe-area-inset-bottom))] md:pb-6 pt-2"
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
                        <span className="text-[10px] font-semibold  text-muted-foreground/60">Continue exploring</span>
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
                              // Staggered entrance: three chips appearing at once
                              // read as a block of UI to skip past, where a quick
                              // cascade reads as suggestions worth a glance.
                              style={{ animationDelay: `${i * 70}ms`, animationFillMode: 'backwards' }}
                              className="group flex flex-1 min-w-[200px] items-center gap-2.5 px-4 py-2.5 bg-background
                                         border border-border/50 rounded-xl shadow-sm text-left
                                         text-muted-foreground hover:text-foreground
                                         hover:bg-primary/5 hover:border-primary/20 hover:shadow-md
                                         transition-all duration-200 ease-out active:scale-[0.98]
                                         animate-in fade-in slide-in-from-bottom-2"
                            >
                              <Zap className="w-3.5 h-3.5 shrink-0 opacity-30 transition-all duration-200 group-hover:opacity-100 group-hover:text-primary group-hover:scale-110" />
                              <span className="text-[13px] font-medium leading-snug">{q}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* An upload the model could not read. Deliberately persistent
                  rather than a toast: the fix is to change model, and the user
                  needs the message to still be on screen while they do it. */}
              {blockedAttachments && (
                <div className="mb-2 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10
                                px-3.5 py-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <FileIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <p className="flex-1 text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">
                    {blockedAttachments.message}
                  </p>
                  <button
                    onClick={() => dismissBlockedAttachments()}
                    aria-label="Dismiss"
                    className="shrink-0 rounded p-0.5 text-amber-600/60 transition-colors hover:bg-amber-500/20 hover:text-amber-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Input Capsule — bigger, with pills inside */}
              <div className="relative z-10">

                 {/* Active Reference Pill */}
                 {activeReference && (
                   <div className="flex animate-in fade-in slide-in-from-bottom-2 duration-300 absolute bottom-full mb-3 left-4">
                     <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl group backdrop-blur-md">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px] font-semibold  text-emerald-600 shrink-0">Reference</span>
                          <div className="w-px h-3 bg-emerald-500/30 shrink-0" />
                          <span className="text-xs font-medium text-emerald-700/80 truncate max-w-[300px] italic">"{activeReference.textSnippet}"</span>
                        </div>
                        <button 
                          onClick={() => clearReference()}
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
                      className="w-full min-h-[56px] max-h-[200px] px-2 py-2 bg-transparent border-none focus:ring-0 focus:outline-none resize-none text-[17px] font-medium placeholder:text-muted-foreground/50 scrollbar-none leading-[1.7] tracking-[-0.01em]"
                      rows={2}
                    />
                  </div>

                  {/* Bottom toolbar — pills + voice + model + send, all inside the chatbox */}
                  <div className="flex items-center justify-between px-3 pb-3 pt-1 gap-2">
                    {/* Left: intent pills */}
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pr-1">
                        {[
                          // Coding / Files / Workflow removed along with the
                          // server-side tools that backed them. A pill that sets
                          // an intent the backend no longer honours is worse than
                          // no pill: it silently does nothing.
                          { key: 'search' as const, icon: <Search className="w-3.5 h-3.5" />, label: 'Search', color: 'blue' },
                          { key: 'research' as const, icon: <Globe2 className="w-3.5 h-3.5" />, label: 'Research', color: 'purple' },
                        ].map(tool => (
                          <button
                            key={tool.key}
                            onClick={() => toggleIntent(tool.key)}
                            className={cn(
                              "flex items-center gap-1.5 h-8 px-3 rounded-lg text-[10px] font-bold shrink-0 border",
                              "transition-all duration-200 ease-out active:scale-95",
                              activeIntent === tool.key
                                ? tool.color === 'blue' ? 'bg-blue-500/15 border-blue-500/40 text-blue-500'
                                : 'bg-purple-500/15 border-purple-500/40 text-purple-500'
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
                    </div>

                    {/* Right: model + voice + send */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Model selector */}
                      <div className="relative" ref={dropdownRef}>
                        <button 
                          onClick={() => setShowModelDropdown(!showModelDropdown)}
                          className={cn(
                            "flex items-center gap-2 h-8 px-3 rounded-lg transition-all text-[10px] font-bold  border",
                            showModelDropdown 
                              ? "bg-primary/10 border-primary/30 text-primary"
                              : "border-transparent text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40"
                          )}
                        >
                          <span className="text-sm leading-none">
                            {dynamicProviders.find(p => p.slug === llmProvider)?.icon || '🤖'}
                          </span>
                          <span className="hidden sm:inline max-w-[120px] truncate">
                            {dynamicProviders.find(p => p.slug === llmProvider)?.models.find(m => m.value === llmModel)?.name || 'Select model'}
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
                                <label className="text-[11px] font-semibold text-muted-foreground mb-2 block px-1">AI provider</label>
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
                                          "text-[7px] font-semibold  px-1.5 py-0.5 rounded shrink-0",
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
                        disabled={!input.trim() && !isLoading}
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
