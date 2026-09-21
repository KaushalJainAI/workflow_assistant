import { useState, useRef, useEffect, useCallback, useDeferredValue } from 'react';
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
import ThinkingTimer from './ThinkingTimer';
import { 
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
  Coins,
  ChevronDown,
  BrainCircuit,
  Settings2,
  Lightbulb,
  Zap,
  Wand2,
  Globe2,
  Trash2,
  RotateCcw,
  ArrowUpFromLine,
  Pencil,
  Code,
  Mail,
  FolderSearch,
  LifeBuoy,
  FileText,
  ChevronRight,
  Bot,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { chatService, type StandaloneChatMessage as ChatMessage, type ChatSession } from '../../api';
import {
  costQualifier, describeConversationCost, describeCost, formatCost,
} from '../../lib/cost';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { TextSelectionMenu } from './TextSelectionMenu';
import { CollapsiblePanel } from './CollapsiblePanel';
import { MediaPreview } from './MediaPreview';
import HtmlArtifact from './HtmlArtifact';
import ChartArtifact from './ChartArtifact';
import TodoPanel from './TodoPanel';
import FileCards from '../files/FileCards';
import FilePreviewProvider from '../files/FilePreviewProvider';
import MarkdownMessage from './MarkdownMessage';
import TranscriptSkeleton from './TranscriptSkeleton';
import { forgetTranscript, readTranscript, writeTranscript } from '../../lib/transcriptCache';
import type { ChartSpec, TodoItem, HtmlArtifact as HtmlArtifactData, ChatSessionSummary } from '../../api/chat';

import { useAIModels } from '../../hooks/useAIModels';
import { useChatStream, type StreamEvent } from '../../hooks/useChatStream';
import { useMessagePanels } from '../../hooks/useMessagePanels';
import { useMessageSelection } from '../../hooks/useMessageSelection';
import { useChatModelSelection } from '../../hooks/useChatModelSelection';
import { useEffortSelection, EFFORT_LABELS } from '../../hooks/useEffortSelection';
import { EffortPicker } from './EffortPicker';
import { prettyModel } from '../../lib/modelNames';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/authState';
import GuestBanner from './GuestBanner';
import FeedbackControl from '../runs/FeedbackControl';
import { SendButton } from '../ui/SendButton';
import { apiErrorMessage } from '../../lib/apiError';
import { nextChatMode, toChatMode } from '../../lib/chatMode';
import CommandPalette from './CommandPalette';
import CommandCard from './CommandCard';
import { useCommands } from '../../hooks/useCommands';
import commandsService from '../../api/commands';
import {
  buildCommandPayload,
  findCommand,
  splitCommandLine,
  type CommandChip as CommandChipData,
  type CommandDef,
} from '../../lib/commands';

/** Rough size hint for a reasoning trace, so the toggle says what it will cost to open. */
function formatWordCount(text: string): string {
  const words = (text || '').trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return '';
  if (words < 1000) return `${words} words`;
  return `${(words / 1000).toFixed(1)}k words`;
}

/**
 * What the composer is set to do with the next message. Named because it is the
 * state's type, a cast target, and a parameter — three places that were
 * previously three different spellings, two of them `any`.
 */
export type ChatIntent = 'normal' | 'search' | 'image' | 'video' | 'research';

/**
 * A tool-argument field as text. `StreamActivity.args` is `Record<string,
 * unknown>` because the wire carries no schema for it, so anything rendered
 * out of it has to be narrowed rather than trusted.
 */
const argText = (value: unknown): string => (typeof value === 'string' ? value : '');

export default function StandaloneChat() {
  const { isAuthenticated } = useAuth();
  const isGuest = !isAuthenticated;
  
  // Helper to strip XML/HTML tags from tool call argument values
  const stripXmlTags = (val: unknown): string => {
    if (typeof val !== 'string') return String(val ?? '');
    return val.replace(/<\/?[a-zA-Z_][a-zA-Z0-9_:.-]*[^>]*>/g, '').trim();
  };
  
  // --- Chat State ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  // `isLoading` means *the agent is working on a turn*, and nothing else. It
  // drives the live block, so fetching a transcript must never set it — doing
  // that is what made arriving on the page claim the model was thinking.
  const [isLoading, setIsLoading] = useState(false);
  //: Steers waiting for the running turn to reach its next tool boundary, and
  //: any the mailbox had to drop. Both are reported by the steer endpoint.
  const [queuedSteers, setQueuedSteers] = useState(0);
  const [droppedSteers, setDroppedSteers] = useState(0);
  // Fetching an existing transcript. Distinct from `isLoading` above.
  const [isRestoring, setIsRestoring] = useState(false);
  // The answer that just finished streaming. It is already on screen, so it
  // mounts without the entrance animation every other message gets.
  const [settledId, setSettledId] = useState<number | string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  // Auth and guest conversations are independent: a guest reusing an auth
  // session id (or vice versa) hits a 404 because the lookup is user-scoped,
  // and a DB wipe leaves any persisted id stale. Two keys keep the namespaces
  // separate so a stale or cross-owner id is never sent to the wrong endpoint.
  const [authConversationId, setAuthConversationId] = usePersistedState<string | undefined>(
    'chat.lastSessionId',
    undefined,
  );
  const [guestConversationId, setGuestConversationId] = usePersistedState<string | undefined>(
    'chat.lastGuestSessionId',
    undefined,
  );
  const conversationId = isGuest ? guestConversationId : authConversationId;
  const setConversationId = isGuest ? setGuestConversationId : setAuthConversationId;
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /** Session ids whose turn is still streaming, including backgrounded ones. */
  const runningKeys = useRunningChatKeys();

  // --- Slash commands (P10, §18) ---
  // The palette opens on a leading `/`; chips carry resolved ids so the
  // request never re-resolves a name already chosen. Client-kind commands
  // run in the browser, action-kind through `/commands/run/`, turn-kind as
  // a normal streamed turn with `command` attached.
  const { commands, refetch: refetchCommands } = useCommands({ enabled: !isGuest });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pickedCommand, setPickedCommand] = useState<CommandDef | null>(null);
  const [commandChips, setCommandChips] = useState<CommandChipData[]>([]);
  const [commandArgText, setCommandArgText] = useState('');
  const [commandError, setCommandError] = useState<string | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  void refetchCommands;

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
    select: selectModel,
    adopt: adoptSessionModel,
  } = useChatModelSelection({ isGuest, providers: dynamicProviders });

  // Which rungs are on offer depends on the model chosen just above, so this
  // reads that selection rather than owning it. See `useEffortSelection` for
  // why a stale level is dropped rather than sent.
  const {
    effective: llmEffort,
    effortToSend,
    available: effortLevels,
    supported: effortSupported,
    choose: chooseEffort,
    adopt: adoptSessionEffort,
  } = useEffortSelection({
    providers: dynamicProviders, provider: llmProvider, model: llmModel, isGuest,
  });

  // --- Agentic Features State ---
  const [isFollowUpsExpanded, setIsFollowUpsExpanded] = useState(true);
  const [activeIntent, setActiveIntent] = useState<ChatIntent>('normal');
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
  // The answer being streamed re-parses its whole markdown on every update.
  // Deferred, so that work yields to typing in the composer rather than
  // making the box lag behind the keys while an answer is arriving.
  const streamedContent = useDeferredValue(live.content);

  const [showSessionSettings, setShowSessionSettings] = useState(false);
  const [systemPromptDraft, setSystemPromptDraft] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
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

  // The thinking clock lives in <ThinkingTimer/>, which owns its own interval.
  // Ticking it here re-rendered the whole transcript ten times a second.






  /** Paints a fetched or cached session. The two must land identically. */
  const applySession = (session: ChatSession) => {
    setMessages(session.messages as unknown as ChatMessage[]);
    setConversationId(session.id);
    setCurrentSession(session);
    adoptSessionModel(session.llm_provider, session.llm_model);
    adoptSessionEffort(session.llm_effort ?? '');
  };

  /**
   * Opens a conversation, cache first.
   *
   * The transcript is fetched imperatively rather than through react-query, so
   * a cache hit has to be read by hand: in-memory for a return trip within the
   * session, localStorage for a reload. Either way the conversation is on
   * screen before the request goes out, and the response reconciles behind it.
   * A miss falls through to the skeleton, never to the thinking indicator —
   * this is a GET, and saying otherwise reports work nobody is doing.
   */
  const loadConversation = async (id: string) => {
    const cached =
      queryClient.getQueryData<ChatSession>(['chatSession', id]) ?? readTranscript(id);
    if (cached?.messages) applySession(cached);

    setIsRestoring(true);
    try {
      const session = await chatService.getSession(id);
      if (session && session.messages) {
        applySession(session);
        queryClient.setQueryData(['chatSession', id], session);
      }
    } catch (e) {
      console.error("Failed to load conversation", e);
    } finally {
      setIsRestoring(false);
      // A turn still running for this conversation owns the loading state:
      // the transcript arriving does not mean the answer is in. Clearing it
      // unconditionally here would drop the pending state of a turn adopted
      // moments earlier, whichever of the two happened to settle last.
      setIsLoading(getChatRun(id)?.status === 'running');
    }
  };

  /**
   * Re-attach to turns the server is still running.
   *
   * A turn now outlives the request that started it, so a reload mid-answer
   * leaves work in flight that this page knows nothing about. Adopting every
   * active run replays the partial answer into the open conversation and
   * lights up the "still working" marker for the others.
   */
  useEffect(() => {
    if (isGuest) return;
    let cancelled = false;

    (async () => {
      try {
        const active = await chatService.getActiveRuns();
        if (cancelled) return;
        for (const id of active) {
          if (getChatRun(id)?.status === 'running') continue; // already ours
          startChatRun(
            id,
            (onEvent, signal) => chatService.attachStream(id, onEvent, signal),
          );
        }
      } catch {
        // Re-attaching is recovery, not a precondition for chatting.
      }
    })();

    return () => { cancelled = true; };
  }, [isGuest]);

  useEffect(() => {
    if (showHistory) loadHistory();
  }, [showHistory, loadHistory]);

  // Reopen where the user left off, and only there. A first login (or any
  // arrival with no persisted session) stays on a fresh Ask hero with the
  // composer front and centre — auto-opening the newest thread made a new
  // user land mid-way through an old conversation instead of a new chat.
  // The transcript is refetched, so a turn that finished in the background
  // is present on arrival.
  useEffect(() => {
    if (isGuest) return; // Guests start with a fresh session each visit
    if (conversationId) {
      loadConversation(conversationId);
    }
    // Mount only, deliberately. This restores the session the user left open;
    // re-running it when `conversationId` changes would re-load the transcript
    // every time they switch conversations, fighting the explicit
    // `loadConversation` calls that do the switching.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Keeps the reload cache current.
   *
   * Writing it only on load would cache the transcript as it was on arrival and
   * leave every answer since out of it — the reload after a long conversation,
   * which is exactly when the head start is worth most, would paint the
   * staleest possible version. Guests are skipped: their thread does not
   * outlive the tab, so there is nothing to restore it into.
   */
  useEffect(() => {
    if (isGuest || !conversationId || !currentSession || messages.length === 0) return;
    writeTranscript({
      ...currentSession,
      id: conversationId,
      // Same widening the read side does: `StandaloneChatMessage` carries the
      // metadata this page renders, `ChatSession.messages` is the narrower API
      // shape, and the cache round-trips whichever it was handed.
      messages: messages as unknown as ChatSession['messages'],
    });
  }, [isGuest, conversationId, currentSession, messages]);

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

  /**
   * Persist an effort choice the same way a model choice is persisted.
   *
   * Separate from `saveLLMSettings` rather than folded into it because the two
   * are chosen independently: switching model must not silently reset the
   * effort, and changing effort must not re-announce the model with a toast.
   */
  const saveEffort = async (next: string) => {
    chooseEffort(next);

    if (conversationId) {
      try {
        await chatService.updateSession(conversationId, { llm_effort: next });
      } catch (err) {
        console.error('Failed to update reasoning effort', err);
      }
    }
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

  /**
   * Clears the view back to an empty conversation.
   *
   * The live stream state has to go with it. A run belongs to a conversation,
   * not to this component, so a turn still streaming in the old thread keeps
   * pushing frames after the switch — without this reset its status line
   * ("Reasoning (step 4)...") and partial answer stay painted over the new,
   * empty chat. The subscription effect cannot do it: with no conversation
   * open there is nothing for it to attach to and it returns early.
   */
  const startNewConversation = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
    setCurrentSession(null);
    setActiveIntent('normal');
    setIsLoading(false);
    setIsRestoring(false);
    setSettledId(null);
    resetStream();
    // `setConversationId` comes from `usePersistedState`, which returns a plain
    // `useState` setter — stable, but the linter cannot see that through the
    // custom hook's tuple, so it is listed rather than suppressed.
  }, [resetStream, setConversationId]);

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    try {
      await chatService.deleteSession(id);
      queryClient.setQueryData<ChatSessionSummary[]>(['chatSessions'], (old = []) => old.filter(c => c.id !== id));
      // Both caches too, or the deleted thread paints again on the next reload.
      queryClient.removeQueries({ queryKey: ['chatSession', id] });
      forgetTranscript(id);
      if (conversationId === id) {
        startNewConversation();
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
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Failed to upload file'));
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
       setActiveIntent(lockedIntent as ChatIntent);
    }
  }, [lockedIntent, conversationId]);

  const toggleIntent = (intent: ChatIntent) => {
    setActiveIntent(prev => {
      const next = prev === intent ? 'normal' : intent;
      
      // Recommendation for media generation
      if (['image', 'video', 'audio'].includes(next)) {
        toast.info("Recommended to use a new thread for media generation to avoid context pollution.", {
          duration: 5000
        });
      }
      
      return next;
    });
    textareaRef.current?.focus();
  };

  /**
   * How much this conversation asks before acting: Ask (approve side
   * effects) · Auto (the reviewer may allow clear matches) · Plan (look,
   * don't touch). Stored on the session, so it survives reloads; switching
   * mid-turn rides the steer mailbox and stands for the rest of the run.
   * Auto looks visibly different so nobody is in it without knowing.
   */
  type ChatMode = 'ask' | 'auto' | 'plan';
  const [autonomy, setAutonomy] = useState<ChatMode>('ask');

  useEffect(() => {
    setAutonomy(toChatMode(currentSession?.autonomy));
  }, [currentSession?.autonomy, conversationId]);

  const setMode = async (next: ChatMode) => {
    setAutonomy(next);
    if (conversationId) {
      try {
        const updated = await chatService.updateSession(conversationId, { autonomy: next });
        setCurrentSession(prev => (prev ? { ...prev, ...updated } : updated));
      } catch (err) {
        console.error('Failed to update chat mode', err);
      }
      if (isLoading) {
        // A turn is going: the session value applies next turn, so also
        // switch this one mid-run. Plan cannot switch mid-run (the toolbox
        // is already built) — the session value still applies next turn.
        try {
          if (next !== 'plan') await chatService.setAutonomy(conversationId, next);
        } catch (err) {
          console.error('Failed to switch mode mid-run', err);
        }
      }
    }
    textareaRef.current?.focus();
  };

  const cycleMode = () => {
    void setMode(nextChatMode(autonomy));
  };

  /**
   * `scope` says how long the allowance lasts, and the middle rung is the
   * point of having three. An approval a user clicks through without reading
   * launders consent rather than granting it, so the way to keep the remaining
   * prompts meaningful is to stop re-asking the ones already answered — but
   * someone who only wants to stop being asked for the rest of *this*
   * conversation should not have to grant a standing allowance over their own
   * mailbox to get there. The backend has taken `once | session | always`
   * since approvals were reworked; this screen was still sending a boolean.
   */
  const handleApproveTool = async (
    callId: string, scope: 'once' | 'session' | 'always' = 'once',
  ) => {
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
          callId,
          scope === 'always',
          effortToSend,
          { approvalScope: scope },
        ),
      { intent: activeIntent },
    );
  };

  /**
   * Declining has to reach the server, which it did not.
   *
   * The button called `clearPendingToolCall()` and stopped: the card went
   * away, the graph stayed parked on its `interrupt()`, and the model was
   * never told it had been refused. `reject_tool_call` has existed since agent
   * runs got the same asymmetry fixed — chat simply never called it.
   *
   * It resumes the turn like an approval does, because that is what a refusal
   * is for: the model is told what it may not do and carries on with what it
   * can. So it goes through `startChatRun` too, or a denial on a tab that gets
   * closed leaves the turn dangling.
   */
  const handleDenyTool = async (callId: string) => {
    if (!conversationId || !pendingToolCall) return;

    clearPendingToolCall();
    setIsLoading(true);

    startChatRun(
      conversationId,
      (onEvent, signal) =>
        chatService.sendMessageStream(
          conversationId,
          "Deny",
          activeIntent,
          onEvent,
          undefined,
          signal,
          llmProvider,
          llmModel,
          undefined,
          undefined,
          effortToSend,
          { rejectToolCall: callId },
        ),
      { intent: activeIntent },
    );
  };

  const handleSaveSessionSettings = async (patch: Partial<ChatSession>) => {
    if (!conversationId || !currentSession) return;
    if (isGuest && 'memory_enabled' in patch) {
      toast.error('Log in to use conversation memory.');
      return;
    }
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
    } catch (err: unknown) {
      console.error('Failed to save chat settings', err);
      toast.error(apiErrorMessage(err, 'Could not save chat settings'));
    } finally {
      setIsSavingSettings(false);
    }
  };

  /**
   * Applies one SSE frame. Live turn state is folded by `useChatStream`; only
   * the effects that reach outside the turn are handled here.
   */
  const handleStreamEvent = (event: StreamEvent, meta: RunMeta = {}, replayed = false) => {
    const { optimisticId, intentToSend } = { optimisticId: meta.optimisticId, intentToSend: meta.intent };
    applyStreamEvent(event);

    switch (event.type) {
      case 'status': {
        // The optimistic user message gets its real database id here.
        const realId = typeof event.user_message_id === 'number'
          ? event.user_message_id
          : null;
        if (optimisticId && realId !== null) {
          setMessages(prev => prev.map(m => (
            m.id === optimisticId ? { ...m, id: realId } : m
          )));
        }
        break;
      }

      case 'ask_permission':
        setIsLoading(false);
        break;

      case 'steers_returned': {
        // Messages sent while the agent was writing its final answer: the run
        // ended before it reached a point where it reads them. They go back in
        // the box — the same place a too-late steer already lands — so nothing
        // the user typed is lost and nothing is sent without them seeing it.
        // Not on replay: a re-attached stream would put the text back again.
        const returned = Array.isArray(event.messages)
          ? event.messages.filter((m): m is string => typeof m === 'string' && m.trim() !== '')
          : [];
        if (replayed || returned.length === 0) break;
        const text = returned.join('\n');
        setInput(prev => (prev.trim() ? `${text}\n${prev}` : text));
        setQueuedSteers(0);
        toast.info(
          returned.length === 1
            ? 'The agent finished before reading your message. It is back in the box.'
            : `The agent finished before reading ${returned.length} messages. They are back in the box.`,
        );
        break;
      }

      case 'done': {
        // The `done` frame carries whole persisted messages. `StreamEvent`
        // fields are `unknown` by design, so the assertion happens once, here,
        // rather than at each of the six reads below.
        const aiResponse = event.ai_response as ChatMessage | undefined;
        const userMessage = event.user_message as ChatMessage | undefined;

        // Batched with the append below, so the settled answer mounts already
        // exempt from the entrance animation — the text has been on screen for
        // the length of the stream and must not fade in over itself.
        setSettledId(aiResponse?.id ?? null);
        setMessages(prev => {
          // A stop before any text was streamed closes the turn with no
          // answer to show; the question stands on its own.
          if (!aiResponse) return prev;
          // A replayed frame may be re-applied after the transcript was
          // reloaded from the server, which already contains this answer.
          if (aiResponse.id && prev.some(m => m.id === aiResponse.id)) {
            return prev;
          }
          const reconciled = optimisticId && userMessage
            ? prev.map(m => (
                m.id === optimisticId || m.id === userMessage.id
                  ? { ...m, id: userMessage.id }
                  : m
              ))
            : prev;
          return [...reconciled, aiResponse];
        });
        setIsLoading(false);
        clearReference();

        // Sync intent to session state if it was locked this turn
        if (intentToSend && currentSession && !['chat', 'search', 'normal'].includes(intentToSend) && currentSession.intent !== intentToSend) {
          setCurrentSession({ ...currentSession, intent: intentToSend });
        }
        break;
      }

      case 'error':
        // Only the live delivery should raise a toast; replaying the frame
        // when the user comes back would re-announce an old failure.
        //
        // Held longer than a default toast because these are the failures that
        // tell the user what to change — no credential, no credit, a model the
        // provider retired — and each is a sentence or two, not a word.
        if (!replayed && typeof event.message === 'string') {
          toast.error(event.message, { duration: 12000 });
        }
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
        // `RunFrame` is a union with `SseEvent`, whose fields are `unknown`,
        // so the status frame's own `error?: string` has to be re-narrowed
        // here rather than assumed.
        if (!replayed && frame.status === 'error' && typeof frame.error === 'string') {
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

  /**
   * Send a message to a turn that is already running, instead of dropping it.
   *
   * Sending while busy used to be a no-op — `handleSend` returned early and the
   * text sat in the box doing nothing. The backend has had a steer mailbox for
   * a while, and it is a queue, so several follow-ups sent while the agent
   * works all arrive in order at its next tool boundary. This is the only path
   * that reaches it.
   */
  useEffect(() => {
    // The counters describe one run's mailbox, so they go when the run does.
    if (!isLoading) {
      setQueuedSteers(0);
      setDroppedSteers(0);
    }
  }, [isLoading]);

  const steerRunningTurn = async (text: string) => {
    if (!conversationId) return;
    setInput('');
    try {
      const result = await chatService.steer(conversationId, text);
      setQueuedSteers(result.queued);
      // Only ever non-zero when the mailbox overflowed. Surfaced because an
      // instruction the user believes was accepted and that vanished is
      // exactly what the queue exists to prevent.
      if (result.dropped) setDroppedSteers(result.dropped);
    } catch {
      // The turn finished between the keypress and the request — put the text
      // back so it can be sent as an ordinary message rather than lost.
      setInput(text);
      setQueuedSteers(0);
    }
  };

  /**
   * Client-kind commands run in the browser: settings, panels, navigation.
   * No model call. Each is one branch here rather than a second registry,
   * because the behaviour is UI affordances the server cannot perform — and
   * the *listing* still comes from the server, so `/help` stays complete.
   */
  const runClientCommand = async (command: CommandDef, rest: string) => {
    const arg = rest.trim();
    switch (command.name) {
      case 'new':
      case 'clear':
        startNewConversation();
        setInput('');
        break;
      case 'mode': {
        const level = arg.toLowerCase();
        if (level === 'ask' || level === 'auto' || level === 'plan') {
          await setMode(level);
        } else {
          // Bare `/mode`: cycle like Shift+Tab rather than refusing.
          cycleMode();
        }
        setInput('');
        break;
      }
      case 'model':
        setShowModelDropdown(true);
        textareaRef.current?.focus();
        break;
      case 'effort':
        setShowModelDropdown(true);
        textareaRef.current?.focus();
        break;
      case 'file':
        // `/file <path>` attaches by path: the chip, not an upload.
        if (arg) {
          toast.info(`Attaching ${arg} — send a message to use it.`);
        }
        setInput('');
        break;
      case 'code': {
        const label = commandChips[0]?.label ?? arg;
        window.location.href = label ? `/code?project=${encodeURIComponent(label)}` : '/code';
        break;
      }
      case 'approvals':
        window.location.href = '/overview';
        break;
      case 'connect': {
        const label = commandChips[0]?.label ?? arg;
        window.location.href = label ? `/connections?open=${encodeURIComponent(label)}` : '/connections';
        break;
      }
      case 'help':
        toast.info('Every command is listed in the panel below.', { duration: 4000 });
        setInput('/help ');
        break;
      default:
        // Unknown client command: the server listing is the authority, so a
        // branch missing here is a client behind the server — fall through to
        // a normal send rather than dropping the text.
        await handleSend(arg ? `/${command.name} ${arg}` : `/${command.name}`);
        return;
    }
    setPickedCommand(null);
    setCommandChips([]);
    setCommandArgText('');
    setPaletteOpen(false);
  };

  /**
   * Confirm-sheet decisions: mission start, schedule arm, memory forget,
   * publish. Pressing the primary button is the approval — the typed command
   * covered nothing after the sheet.
   */
  const runCommandConfirm = async (
    name: string,
    baseArgs: Record<string, unknown>,
    confirm: Record<string, unknown>,
  ) => {
    setConfirmBusy(true);
    try {
      if (confirm.__forget) {
        await commandsService.confirm('memory_forget', {}, { memory_id: confirm.memory_id });
        toast.success('Forgotten.');
        return;
      }
      if (confirm.__preview) {
        const preview = await commandsService.run(
          'schedule',
          { ...baseArgs, cron: confirm.cron },
          {},
          {},
        );
        const card = (preview.card ?? {}) as { preview?: { description?: string; error?: string } };
        toast.info(card.preview?.description ?? card.preview?.error ?? 'Schedule previewed.');
        return;
      }
      const result = await commandsService.confirm(name, baseArgs, confirm);
      if (name === 'goal' && result.mission_id) {
        toast.success(`Mission #${String(result.mission_id)} started.`);
      } else if (name === 'schedule') {
        toast.success('Schedule armed.');
      } else {
        toast.success('Done.');
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not confirm.'));
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput ?? input;
    if (!textToSend.trim()) return;
    if (isLoading) {
      await steerRunningTurn(textToSend.trim());
      return;
    }

    const intentToSend = activeIntent;

    // A command typed out in full and sent without the palette is parsed by
    // the backend. Client-kind commands never reach the turn: they run here.
    const parsed = !isGuest ? splitCommandLine(textToSend) : null;
    const typedCommand = parsed ? findCommand(parsed.name, commands) : null;
    if (parsed && !typedCommand) {
      // Unknown `/word`: a 400-quality message under the input, text left in
      // place — never sent to the model as plain text.
      setCommandError(`No command called '/${parsed.name}'. Try /help.`);
      return;
    }
    if (typedCommand && typedCommand.kind === 'client') {
      setCommandError(null);
      await runClientCommand(typedCommand, parsed!.rest);
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: textToSend,
      metadata: { intent: intentToSend },
      created_at: new Date().toISOString(),
      // A user message costs nothing, which `ChatMessage` spells as zeroes and
      // a blank `cost_source` — the cost strip renders nothing at all for it.
      // Written out rather than left off: the optimistic row is the same type
      // the server's row is, and a partial one would only differ until reload.
      model_id: '',
      input_tokens: 0,
      output_tokens: 0,
      cached_read_tokens: 0,
      cached_write_tokens: 0,
      cost_usd: '0',
      cost_source: '',
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
        if (currentSessionId) {
          try {
            const existing = await chatService.guest.getSession(currentSessionId);
            setCurrentSession(existing);
          } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            const msg = err instanceof Error ? err.message : String(err);
            if (status === 404 || msg.includes('404') || msg.toLowerCase().includes('not found')) {
              currentSessionId = undefined;
              setConversationId(undefined);
              setCurrentSession(null);
            } else {
              throw err;
            }
          }
        }
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
        if (currentSessionId) {
          try {
            const existing = await chatService.getSession(currentSessionId);
            setCurrentSession(existing);
          } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            const msg = err instanceof Error ? err.message : String(err);
            if (status === 404 || msg.includes('404') || msg.toLowerCase().includes('not found')) {
              currentSessionId = undefined;
              setConversationId(undefined);
              setCurrentSession(null);
            } else {
              throw err;
            }
          }
        }
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
          queryClient.setQueryData<ChatSessionSummary[]>(['chatSessions'], (old = []) => [newSession, ...old]);
          if (showHistory) loadHistory();
        }

        const reference = activeReference ? { message_id: activeReference.messageId, snippet: activeReference.textSnippet } : undefined;
        const sessionId = currentSessionId;

        // A picked or typed turn/action command rides as structured input —
        // the backend resolves it (chips carry ids, so a chosen name is never
        // re-parsed). Client commands were handled above and never reach here.
        const commandPayload = pickedCommand
          ? buildCommandPayload(pickedCommand, commandChips, commandArgText || textToSend)
          : typedCommand
            ? { name: typedCommand.name, args: {}, text: parsed!.rest }
            : undefined;

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
              llmModel,
              undefined,
              undefined,
              effortToSend,
              commandPayload ? { command: commandPayload } : undefined
            ),
          meta,
        );
        // A sent command is consumed: the transcript chip comes from the
        // server's `metadata.command`, not from composer state.
        setPickedCommand(null);
        setCommandChips([]);
        setCommandArgText('');
        setPaletteOpen(false);
        setCommandError(null);
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

  /**
   * Stops the turn. The server owns the work now, so this has to ask it to
   * cancel — closing the stream locally would leave the agent running. The
   * closing `done` frame carries whatever was written, saved as a partial
   * answer, so the stream ends itself and the transcript keeps the text.
   */
  const stopGeneration = async () => {
    if (!conversationId) return;
    setIsLoading(false);
    clearStreamStatus();
    try {
      await chatService.stopStream(conversationId);
      toast.info('Generation stopped');
    } catch (err) {
      // Nothing running server-side (or it is unreachable) — drop the local
      // reader so the UI does not sit on a stream that will never finish.
      abortChatRun(conversationId);
      console.error('Failed to stop generation', err);
    }
  };

  // The empty-state hero, and only the hero. It used to be "no messages yet",
  // which was also true while a transcript was being fetched and while the
  // first answer was streaming, so the hero rendered underneath both.
  const isInitialState = messages.length === 0 && !isLoading && !isRestoring;
  // Cold cache: nothing to paint but the request is out. With a cache hit the
  // transcript is already up and this never renders.
  // A turn already running is better news than a placeholder, so it wins.
  const showSkeleton = isRestoring && messages.length === 0 && !isLoading;

  // Note: the previous "Access Restricted / Configure Credentials" gate was
  // removed — the server-wide NVIDIA env key now backs the chat for any user
  // who hasn't set up a per-user credential.

  // Fresh chat puts the caret in the composer on devices with a fine pointer.
  // On a phone that would pop the keyboard over the hero, so it stays put.
  useEffect(() => {
    if (!isInitialState) return;
    if (typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches) return;
    textareaRef.current?.focus();
  }, [isInitialState]);

  return (
    <FilePreviewProvider>
    <div className="flex h-full w-full bg-background overflow-hidden relative">
      {/* No decorative wash. The three blurred orbs that used to sit here were
          off-palette (raw `purple-500`, not the `--agent` violet) and pushed a
         morphic look the Fluent tokens do not have. An answer surface
          reads better on a flat canvas — the content is the ornament. */}

      {/* Guest banner — encourage login without blocking chat. On mobile it's a
          56px band that visually contains the floating hamburger (fixed top-3
          left-3, 44px tall), so they read as one top bar. */}
      {isGuest && <GuestBanner model={llmModel} />}

      {/* 1. History Sidebar — overlay drawer on mobile, in-flow on desktop */}
      {showHistory && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50 animate-in fade-in duration-200"
          onClick={() => setShowHistory(false)}
        />
      )}
      <div
        className={cn(
          "h-full bg-card border-r border-border transition-colors duration-300 ease-in-out flex flex-col overflow-hidden",
          // Mobile: fixed overlay
          "fixed md:relative left-0 top-0 z-40 md:z-30 md:flex-shrink-0",
          showHistory
            ? "w-[85vw] max-w-[320px] md:w-[300px] translate-x-0"
            : "w-0 -translate-x-full md:translate-x-0 md:w-0 md:opacity-0 md:border-none"
        )}
      >
        <div className="w-[85vw] max-w-[320px] md:w-[300px] flex flex-col h-full">
          <div className="h-14 px-4 flex items-center justify-between border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-[13px] font-semibold tracking-tight">
                Conversations
              </h2>
            </div>
            <button
              onClick={() => setShowHistory(false)}
              aria-label="Close conversation history"
              className="p-1.5 hover:bg-secondary rounded-md transition text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 shrink-0">
            <button
              onClick={() => {
                startNewConversation();
                setShowHistory(false);
              }}
              className="w-full h-9 flex items-center gap-2 px-3 rounded-lg bg-muted/60 hover:bg-accent text-[13px] font-medium transition"
            >
              <Plus className="w-4 h-4 text-muted-foreground" />
              New conversation
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5 custom-scrollbar">
            {Array.isArray(conversations) && conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "w-full px-3 py-2 rounded-lg text-left transition flex items-center gap-2.5 group relative cursor-pointer border",
                  conversationId === conv.id
                    ? "bg-primary-subtle border-primary-line"
                    : "border-transparent hover:bg-secondary"
                )}
                // `loadConversation`, not a second copy of it. This handler
                // used to inline the same fetch, minus `setCurrentSession` and
                // plus the same misuse of `isLoading` — so picking a thread
                // from history claimed the agent was thinking, and the session
                // settings panel opened against the previous conversation.
                onClick={() => {
                  setShowHistory(false);
                  loadConversation(conv.id);
                }}
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  {/* A conversation still streaming in the background says so
                      here — otherwise leaving it looks like cancelling it. */}
                  {runningKeys.includes(conv.id) ? (
                    <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-primary" />
                  ) : (
                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span
                    className="truncate flex-1 text-[13px] font-normal text-foreground"
                    title={conv.title || conv.id.slice(0, 18)}
                  >
                    {conv.title || conv.id.slice(0, 18)}
                  </span>
                  {runningKeys.includes(conv.id) && conversationId !== conv.id && (
                    <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-primary">
                      working
                    </span>
                  )}
                  {/* Only where there is a real figure. An unpriced or
                      unanswered conversation shows nothing rather than a dash,
                      because a column of dashes in a sidebar is clutter that
                      tells the reader less than blank space does. */}
                  {conv.cost_source && conv.cost_source !== 'unpriced' && (
                    <span
                      className="shrink-0 text-[11px] text-muted-foreground tabular-nums"
                      title={describeCost(conv.total_cost_usd, conv.cost_source)}
                    >
                      {formatCost(conv.total_cost_usd, conv.cost_source)}
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => handleDeleteConversation(e, conv.id)}
                  aria-label="Delete conversation"
                  className="p-1 hover:bg-destructive-subtle hover:text-destructive rounded-md opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-colors shrink-0 text-muted-foreground"
                  title="Delete conversation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative min-w-0 z-10 transition-colors duration-300">
        
        {/* Transparent Header — leaves space on mobile for the global hamburger and guest banner */}
        <header className={cn(
          "h-16 shrink-0 flex items-center px-4 md:px-6 justify-between border-b border-border/40 bg-background/50",
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
                className="p-2.5 md:p-3 bg-card/40 border border-border/60 hover:bg-card/60 rounded-lg transition-colors text-muted-foreground group shrink-0"
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

          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
             {/* Memory state is shown in the header, not buried in the panel:
                 with it off the assistant behaves very differently, and a user
                 who forgot they switched it off reads that as the model being
                 broken. */}
             {!isGuest && currentSession && !currentSession.memory_enabled && (
               <button
                 onClick={() => setShowSessionSettings(true)}
                 title="Memory is off for this chat — click to change"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-500/40
                             bg-warning-subtle text-[11px] font-semibold text-amber-500
                             transition-colors duration-200 hover:bg-amber-500/20
                             animate-in fade-in slide-in-from-right-2 shrink-0"
               >
                 <BrainCircuit className="w-3.5 h-3.5" />
                 Memory off
               </button>
             )}
             {/* What this conversation has cost so far. Shown in the header
                 rather than in the settings panel because the point of the
                 number is to be noticed while the conversation is still
                 growing — inside a panel nobody opens, it is an audit trail
                 rather than a signal. Hidden entirely until there is a figure
                 to show: a chip reading "—" on every new chat would be noise. */}
             {currentSession && currentSession.cost_source
               && currentSession.cost_source !== 'unpriced' && (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-muted-foreground tabular-nums shrink-0"
                  title={describeConversationCost(
                    currentSession.total_cost_usd, currentSession.cost_source,
                    currentSession.total_tokens_used ?? 0,
                    currentSession.paid_by ?? '',
                  )}
                >
                  <Coins className="w-3.5 h-3.5" />
                  {formatCost(currentSession.total_cost_usd, currentSession.cost_source)}
                  {/* Never a bare figure: whether it was charged or estimated
                      is half of what the number means. The qualifier hides on
                      phones where the header is crowded; the icon + figure —
                      the part that moves — always shows. */}
                  <span className="hidden sm:inline font-normal opacity-80">
                    {costQualifier(currentSession.cost_source)}
                  </span>
                </div>
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
                 className="p-1.5 rounded-lg text-muted-foreground transition-colors duration-200
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
              className="w-full max-w-lg mx-4 rounded-lg border border-border bg-card shadow-lg
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
                    className="mt-2 w-full resize-y rounded-lg border border-border bg-background px-3 py-2
                               text-xs leading-relaxed text-foreground outline-none
                               transition-colors duration-200 placeholder:text-muted-foreground/50
                               focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {!isGuest ? (
                  <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/20 p-3.5">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-foreground">Memory</div>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        {currentSession.memory_enabled
                          ? 'The assistant sees recent turns and can search the rest of this conversation.'
                          : 'The assistant answers from your current message alone. Nothing is deleted – turning this back on restores the full history.'}
                      </p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={currentSession.memory_enabled}
                      aria-label="Toggle memory"
                      disabled={isSavingSettings}
                      onClick={() => handleSaveSessionSettings({ memory_enabled: !currentSession.memory_enabled })}
                      className={cn(
                        "mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5",
                        "transition-colors duration-300 ease-out",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        "focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                        "disabled:opacity-50",
                        currentSession.memory_enabled ? "bg-primary" : "bg-muted-foreground/30"
                      )}
                    >
                      <span
                        className={cn(
                          "h-5 w-5 shrink-0 rounded-full bg-white shadow-sm transition-transform duration-300 ease-out",
                          currentSession.memory_enabled ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-warning-subtle p-3.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <span>Memory</span>
                        <span className="rounded border border-border bg-card px-1.5 py-0.5 micro-label">Login required</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        Conversation memory is only available to logged-in users. Log in to let the assistant remember previous turns.
                      </p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={false}
                      aria-label="Memory requires login"
                      disabled
                      title="Log in to use memory"
                      className="mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 bg-muted-foreground/20 opacity-50 cursor-not-allowed"
                    >
                      <span className="h-5 w-5 shrink-0 rounded-full bg-white shadow-sm translate-x-0" />
                    </button>
                  </div>
                )}
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
                             text-primary-foreground transition-colors duration-200
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
            "flex-1 overflow-y-auto px-4 md:px-6 transition-colors duration-1000 ease-in-out relative",
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
            "max-w-4xl mx-auto w-full relative",
            isInitialState ? "flex flex-col items-center" : "space-y-6"
          )}>
            {showSkeleton ? (
              <TranscriptSkeleton />
            ) : isInitialState ? (
              <div className="text-center space-y-6 mb-4 md:mb-12 animate-in fade-in duration-150">
                <div className="w-12 h-12 bg-agent-subtle border border-agent-line rounded-lg flex items-center justify-center mx-auto">
                  <BrainCircuit className="w-6 h-6 text-agent" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
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
              // Message List. One continuous thread: 24px on phones, 32px on
              // desktop. The old 48px rhythm plus the 40px separator padding
              // below stacked to ~88px of white between an answer's footer
              // and the next question, which read as separate pages.
              <div className="space-y-6 md:space-y-8">
                {messages.map((message, index) => (
                  /* Perplexity turn: the question is a heading, the answer is
                     the page under it. No avatars, no bubbles, no alternating
                     sides — an answer you are meant to read is not a chat
                     bubble. The rule between turns is what separates them. */
                  <div
                    /* Keyed by id, not index: rewind, edit and delete all
                       splice `messages`, and index keys re-mount the whole tail
                       — replaying the entrance animation on messages nobody
                       touched. Optimistic rows fall back to the index until
                       the `status` frame hands them their database id. */
                    key={String(message.id ?? `pending-${index}`)}
                    data-message-id={message.id}
                    className={cn(
                      "group",
                      message.id !== settledId && "animate-in fade-in slide-in-from-bottom-2 duration-300",
                      // The rule is the separator; the padding is breathing
                      // room for it. 20px on phones, 24px on desktop — the old
                      // 40px stacked with the list rhythm into the ~88px gap.
                      message.role === 'user' && index > 0 && "border-t border-border/70 pt-5 md:pt-6"
                    )}
                  >
                    {/* Section label. Violet for the agent, per the token rule
                        that colour encodes agency; the user's own question does
                        not need one because it reads as the heading. */}
                    {message.role === 'assistant' && (
                      <div className="flex items-center gap-2 mb-3">
                        <BrainCircuit className="w-4 h-4 text-agent" />
                        <span className="text-[13px] font-semibold text-foreground">Answer</span>
                      </div>
                    )}

                    <div className="w-full min-w-0 space-y-3">

                      {/* A resolved command: the chip, not expanded text. */}
                      {(message.metadata as { command?: { name?: string; args?: Record<string, unknown> } })?.command?.name && (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex min-h-[28px] items-center rounded-md bg-primary/10 px-2 py-1 font-mono text-[12px] font-bold text-primary">
                            /{String((message.metadata as { command?: { name?: string } }).command!.name)}
                          </span>
                        </div>
                      )}

                      {/* Query as heading / answer as body. break-words so a
                          long URL or token wraps instead of pushing the column
                          past the viewport on a phone. */}
                      <div className={cn(
                        "prose prose-base dark:prose-invert max-w-none ai-chat-prose break-words min-w-0",
                        message.role === 'user'
                          ? "text-[17px] md:text-[19px] leading-[1.45] font-semibold tracking-[-0.01em] text-foreground"
                          : message.role === 'system'
                          ? "w-full"
                          : "text-[16px] leading-[1.75] text-foreground"
                      )}>

                        {message.role === 'system' ? (
                          <div className="bg-muted p-4 rounded-lg shadow-sm border border-border inline-flex flex-col gap-3 min-w-0 w-full max-w-sm sm:min-w-[300px]">
                            <div className="flex items-start gap-3">
                               <div className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
                                  {message.metadata?.file_type === 'image' ? <ImageIcon className="w-5 h-5 text-success" /> :
                                   message.metadata?.file_type === 'pdf' ? <FileIcon className="w-5 h-5 text-destructive" /> :
                                   message.metadata?.file_type === 'pptx' ? <FileIcon className="w-5 h-5 text-warning" /> :
                                   <FileIcon className="w-5 h-5 text-primary" />}
                               </div>
                               <div className="flex-1 min-w-0 pr-8 relative">
                                  <p className="text-sm font-semibold text-foreground truncate max-w-[90%]">
                                    {message.content.match(/\*\*([^*]+)\*\*/)?.[1] || "Uploaded File"}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="micro-label bg-card px-1.5 py-0.5 rounded border border-border">
                                      {message.metadata?.file_type || 'File'}
                                    </span>
                                    {message.metadata?.has_extracted_text && (
                                       <span className="text-[11px] font-semibold text-success bg-success-subtle px-1.5 py-0.5 rounded border border-border">
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
                                    className="absolute right-8 top-0 p-1.5 text-muted-foreground/40 hover:text-amber-500 hover:bg-warning-subtle rounded-lg transition-colors disabled:opacity-50"
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
                      {/* Quick Summary, Reasoning & Activity Row. Two columns on
                          phones (a 140px minimum in a flex row made the third
                          chip stretch and collide), a wrapping row on desktop. */}
                      {message.role === 'assistant' && (message.metadata?.summary || message.metadata?.thinking || (message.metadata?.tool_trace && (message.metadata?.tool_trace?.length ?? 0) > 0) || message.metadata?.has_code_execution) && (
                        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mt-4 mb-2">
                          {message.metadata?.summary && (
                            <div className="min-w-0 sm:flex-1 sm:min-w-[140px] group/summary animate-in fade-in slide-in-from-top-2 duration-500">
                              <button
                                onClick={() => togglePanel('summary', message.id as number)}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors border w-full",
                                  isPanelOpen('summary', message.id)
                                    ? "bg-primary/10 border-primary/30 text-primary shadow-sm" 
                                    : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50 hover:border-border/60 hover:text-foreground"
                                )}
                              >
                                <FileText className={cn("w-4 h-4", isPanelOpen('summary', message.id) ? "text-primary" : "text-muted-foreground/70")} />
                                <span className="text-[12px] font-bold">Summary</span>
                                <div className="flex-1" />
                                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300", isPanelOpen('summary', message.id) && "rotate-180")} />
                              </button>
                            </div>
                          )}

                          {message.metadata?.thinking && (
                            <div className="min-w-0 sm:flex-1 sm:min-w-[140px] group/thinking animate-in fade-in slide-in-from-top-2 duration-500">
                              <button
                                onClick={() => togglePanel('thinking', message.id as number)}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors border w-full",
                                  isPanelOpen('thinking', message.id)
                                    ? "bg-primary/10 border-primary/30 text-primary shadow-sm" 
                                    : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50 hover:border-border/60 hover:text-foreground"
                                )}
                              >
                                <BrainCircuit className={cn("w-4 h-4", isPanelOpen('thinking', message.id) ? "text-primary" : "text-muted-foreground/70")} />
                                <span className="text-[12px] font-bold">Reasoning</span>
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
                          {message.metadata?.tool_trace && (message.metadata?.tool_trace?.length ?? 0) > 0 && (
                            <div className="min-w-0 sm:flex-1 sm:min-w-[140px] group/activity animate-in fade-in slide-in-from-top-2 duration-500">
                              <button
                                onClick={() => togglePanel('activity', message.id as number)}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors border w-full",
                                  isPanelOpen('activity', message.id)
                                    ? "bg-warning-subtle border-border text-amber-600 shadow-sm" 
                                    : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50 hover:border-border/60 hover:text-foreground"
                                )}
                              >
                                <Zap className={cn("w-4 h-4", isPanelOpen('activity', message.id) ? "text-amber-600" : "text-muted-foreground/70")} />
                                <span className="text-[12px] font-bold">Activity</span>
                                <div className="flex-1" />
                                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300", isPanelOpen('activity', message.id) && "rotate-180")} />
                              </button>
                            </div>
                          )}

                          {message.metadata?.has_code_execution && message.metadata?.code_executions && (message.metadata?.code_executions?.length ?? 0) > 0 && (
                            <div className="min-w-0 sm:flex-1 sm:min-w-[140px] group/code animate-in fade-in slide-in-from-top-2 duration-500">
                              <button
                                onClick={() => togglePanel('code', message.id as number)}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors border w-full",
                                  isPanelOpen('code', message.id)
                                    ? "bg-success-subtle border-emerald-500/30 text-emerald-600 shadow-sm" 
                                    : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50 hover:border-border/60 hover:text-foreground"
                                )}
                              >
                                <Code className={cn("w-4 h-4", isPanelOpen('code', message.id) ? "text-emerald-600" : "text-muted-foreground/70")} />
                                <span className="text-[12px] font-bold">Code</span>
                                <div className="flex-1" />
                                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300", isPanelOpen('code', message.id) && "rotate-180")} />
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Expanded Summary Content */}
                      {message.role === 'assistant' && message.metadata?.summary && (
                        <CollapsiblePanel open={isPanelOpen('summary', message.id)}>
                        <div className="mt-2 p-4 bg-card border border-border rounded-lg shadow-sm relative overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                          {/* Model-written summary — markdown via the shared renderer. */}
                          <div className="text-[14px] text-foreground leading-relaxed italic">
                            <MarkdownMessage content={message.metadata.summary} variant="compact" />
                          </div>
                        </div>
                        </CollapsiblePanel>
                      )}

                      {/* Expanded Thinking Content */}
                      {message.role === 'assistant' && message.metadata?.thinking && (
                        <CollapsiblePanel open={isPanelOpen('thinking', message.id)}>
                        <div className="mt-2 overflow-hidden rounded-lg border border-border bg-card">
                          <div className="flex items-center gap-2 border-b border-border bg-muted px-4 py-2">
                            <BrainCircuit className="h-3 w-3 text-muted-foreground" />
                            <span className="micro-label">
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
                        </CollapsiblePanel>
                      )}

                      {/* No placeholder when reasoning is absent. A greeting has
                          no chain of thought to show, so a dashed "not fully
                          captured" box was reporting a fault on every trivial
                          reply and taking up a row under it. Reasoning that does
                          arrive gets its own toggle above; silence here is the
                          honest rendering of nothing to report. */}

                      {/* Tool Activity Trace — shows which tools the agent called */}
                      {message.role === 'assistant' && message.metadata?.tool_trace && (message.metadata?.tool_trace?.length ?? 0) > 0 && (
                        <CollapsiblePanel open={isPanelOpen('activity', message.id)}>
                        <div className="mt-2 p-4 bg-warning-subtle border border-border rounded-lg">
                          <div className="flex items-center gap-3 px-1 mb-3">
                            <Zap className="w-3.5 h-3.5 text-warning" />
                            <span className="micro-label">Agent activity log</span>
                            <div className="h-px flex-1 bg-border" />
                          </div>
                          <div className="space-y-1">
                            {(message.metadata?.tool_trace ?? []).map((trace, i) => (
                              <div
                                key={i}
                                className="flex flex-col gap-1.5 py-2 border-b border-border last:border-0"
                              >
                                <div className="flex items-center gap-3 text-[14px] text-muted-foreground">
                                  <span className="flex items-center justify-center w-6 h-6 rounded-md bg-muted text-[11px] font-semibold text-muted-foreground shrink-0 border border-border">
                                    {trace.iteration || i + 1}
                                  </span>
                                  <span className="font-mono font-semibold text-foreground text-[13px]">{trace.tool}</span>
                                  {(trace.args?.query || trace.args?.question) && (
                                    <span className="truncate max-w-[40vw] sm:max-w-[360px] text-foreground/60 italic text-[13px] pl-1">"{stripXmlTags(trace.args.query || trace.args.question)}"</span>
                                  )}
                                  {trace.summary && !trace.args?.query && !trace.args?.question && (
                                    <span className="truncate max-w-[40vw] sm:max-w-[360px] text-foreground/50 italic text-[12px] pl-1">{stripXmlTags(trace.summary)}</span>
                                  )}
                                </div>
                                {trace.thought && (
                                  <div className="pl-[38px] flex flex-col gap-1">
                                     <div className="text-[13px] text-muted-foreground italic leading-relaxed border-l-2 border-border pl-3 pb-1">
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
                        </CollapsiblePanel>
                      )}

                      {/* Code Execution Log — shows sandbox results */}
                      {message.role === 'assistant' && message.metadata?.code_executions && (message.metadata?.code_executions?.length ?? 0) > 0 && (
                        <CollapsiblePanel open={isPanelOpen('code', message.id)}>
                        <div className="mt-2 p-4 bg-card border border-border rounded-lg">
                          <div className="flex items-center gap-3 px-1 mb-3">
                            <Code className="w-3.5 h-3.5 text-success" />
                            <span className="micro-label">Secure sandbox code</span>
                            <div className="h-px flex-1 bg-border" />
                          </div>
                          <div className="space-y-4">
                            {(message.metadata?.code_executions ?? []).map((exec, i) => (
                              <div key={i} className="space-y-2 border-b border-border last:border-0 pb-4 last:pb-0">
                                <div className="flex items-center gap-2">
                                   <span className="micro-label">Execution #{exec.iteration || i+1}</span>
                                   <div className="h-px flex-1 bg-border" />
                                </div>
                                <div className="rounded-lg overflow-hidden border border-border bg-muted shadow-sm">
                                   <div className="px-3 py-1.5 bg-muted flex items-center justify-between border-b border-border">
                                      <span className="micro-label">Input code</span>
                                   </div>
                                   <pre className="p-4 text-[13px] overflow-x-auto text-zinc-300 font-mono leading-relaxed bg-zinc-950">
                                      <code>{exec.code}</code>
                                   </pre>
                                </div>
                                {(exec.output || exec.result) && (
                                   <div className="rounded-lg overflow-hidden border border-border bg-card shadow-sm">
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
                        </CollapsiblePanel>
                      )}


                      {/* Discovered Media Row (Sources, Images, Videos on one line) */}
                      {message.role === 'assistant' && ((message.metadata?.sources?.length ?? 0) > 0 || (message.metadata?.images?.length ?? 0) > 0 || (message.metadata?.videos?.length ?? 0) > 0) && (
                        <div className="mt-4 md:mt-5 flex flex-wrap gap-2">
                          {(message.metadata?.sources?.length ?? 0) > 0 && (
                            <button
                              onClick={() => togglePanel('sources', message.id as number)}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors border group",
                                isPanelOpen('sources', message.id) ? "bg-primary-subtle border-primary-line text-primary" : "bg-secondary border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                              )}
                            >
                              <Globe2 className="w-3.5 h-3.5" />
                              <span className="text-[12px] font-medium">{(message.metadata?.sources?.length ?? 0)} Sources</span>
                            </button>
                          )}

                          {(message.metadata?.images?.length ?? 0) > 0 && (
                            <button
                              onClick={() => togglePanel('images', message.id as number)}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors border group",
                                isPanelOpen('images', message.id) ? "bg-primary-subtle border-primary-line text-primary" : "bg-secondary border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                              )}
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span className="text-[12px] font-medium">{(message.metadata?.images?.length ?? 0)} Images</span>
                            </button>
                          )}

                          {(message.metadata?.videos?.length ?? 0) > 0 && (
                            <button
                              onClick={() => togglePanel('videos', message.id as number)}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors border group",
                                isPanelOpen('videos', message.id) ? "bg-primary-subtle border-primary-line text-primary" : "bg-secondary border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                              )}
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span className="text-[12px] font-medium">{(message.metadata?.videos?.length ?? 0)} Videos</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Content areas below the row triggers */}
                      {message.role === 'assistant' && (message.metadata?.sources?.length ?? 0) > 0 && (
                        <CollapsiblePanel open={isPanelOpen('sources', message.id)}>
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 animate-in fade-in slide-in-from-top-2 duration-300 md:px-1">
                          {(message.metadata?.sources ?? []).map((item, i) => (
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
                        </CollapsiblePanel>
                      )}

                      {message.role === 'assistant' && (message.metadata?.images?.length ?? 0) > 0 && (
                        <CollapsiblePanel open={isPanelOpen('images', message.id)}>
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 animate-in fade-in slide-in-from-top-2 duration-300 md:px-1">
                          {(message.metadata?.images ?? []).flatMap((item, i) => {
                            // No url, no tile. `any` used to let `undefined`
                            // through to MediaPreview's required `url` prop.
                            const url = item.image || item.url;
                            return url ? [(
                              <MediaPreview
                                key={i}
                                url={url}
                                type="image"
                                title={item.title}
                                source={item.source}
                                className="animate-in fade-in zoom-in-95 duration-500"
                              />
                            )] : [];
                          })}
                        </div>
                        </CollapsiblePanel>
                      )}

                      {message.role === 'assistant' && (message.metadata?.videos?.length ?? 0) > 0 && (
                        <CollapsiblePanel open={isPanelOpen('videos', message.id)}>
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 animate-in fade-in slide-in-from-top-2 duration-300 md:px-1">
                          {(message.metadata?.videos ?? []).flatMap((item, i) => (
                            item.url ? [(
                              <MediaPreview
                                key={i}
                                url={item.url}
                                type="video"
                                title={item.title}
                                source={item.publisher || item.source}
                                className="animate-in fade-in zoom-in-95 duration-500"
                              />
                            )] : []
                          ))}
                        </div>
                        </CollapsiblePanel>
                      )}


                      {/* The plan the turn worked to, kept as a record of what
                          it set out to do and what it could not finish. */}
                      {Array.isArray(message.metadata?.todos) &&
                        (message.metadata?.todos ?? []).length > 0 && (
                          <TodoPanel todos={message.metadata?.todos as TodoItem[]} />
                        )}

                      {/* Files the turn saved, linked by id rather than by
                          whatever path the prose happened to mention. */}
                      <FileCards files={message.metadata?.files} />

                      {/* Rendered HTML artifacts, replayed from stored history. */}
                      {Array.isArray(message.metadata?.html_artifacts) &&
                        (message.metadata?.html_artifacts ?? []).map((art: HtmlArtifactData, i: number) => (
                          <HtmlArtifact key={`${message.id}-art-${i}`} artifact={art} />
                        ))}

                      {/* Charts, redrawn from the stored spec rather than from
                          a stored picture — so a reopened conversation gets
                          today's palette and today's accessibility fixes. */}
                      {Array.isArray(message.metadata?.charts) &&
                        (message.metadata?.charts ?? []).map((chart: ChartSpec, i: number) => (
                          <ChartArtifact key={`${message.id}-chart-${i}`} chart={chart} />
                        ))}

                      {/* Command cards: mission, status, cost, memory,
                          findings, confirm sheets. Stored on the message so
                          a reopened conversation replays them. */}
                      {(message.metadata as { command_card?: { type?: string } & Record<string, unknown> })?.command_card?.type && (
                        <CommandCard
                          card={(message.metadata as { command_card: { type: string } & Record<string, unknown> }).command_card}
                          busy={confirmBusy}
                          onConfirm={(confirm) => {
                            const cmd = (message.metadata as { command?: { name?: string; args?: Record<string, unknown> } }).command;
                            if (cmd?.name) void runCommandConfirm(cmd.name, cmd.args ?? {}, confirm);
                          }}
                          onNavigate={(path) => { window.location.href = path; }}
                        />
                      )}

                      {/* The delegated run's card, persisted on the message. */}
                      {(message.metadata as { agent_run?: { agent_name?: string; execution_id?: string; status?: string } })?.agent_run?.execution_id && (
                        <CommandCard
                          card={{
                            type: 'agent_run',
                            agent_name: (message.metadata as { agent_run?: { agent_name?: string } }).agent_run?.agent_name ?? 'Agent',
                            execution_id: (message.metadata as { agent_run?: { execution_id?: string } }).agent_run?.execution_id ?? '',
                            status: (message.metadata as { agent_run?: { status?: string } }).agent_run?.status ?? 'running',
                          }}
                          onNavigate={(path) => { window.location.href = path; }}
                        />
                      )}

                      
                      {/* Both roles now start at the same left edge, so the
                          actions do too. The old `justify-end` belonged to the
                          right-aligned user bubble and would strand these
                          controls on the far side of the column. */}
                      {message.role !== 'system' && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-1 -ml-1.5">
                        {/* Always visible on touch (no hover there); larger
                            hit targets on phones. Without this the row was an
                            invisible strip of touch targets beside the model
                            label on mobile. */}
                        <div className="flex items-center gap-1 sm:gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity duration-300">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(message.content);
                              setCopiedId(`msg-${index}`);
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                            className="text-muted-foreground hover:text-primary transition-colors p-2 md:p-1.5 hover:bg-primary/5 rounded-lg"
                            title="Copy message"
                          >
                            {copiedId === `msg-${index}` ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                          {message.role !== 'user' && (
                            <button
                              onClick={() => handleRewriteMessage(message.id as number)}
                              disabled={deletingMsgId === message.id}
                              className="text-muted-foreground hover:text-amber-500 transition-colors p-2 md:p-1.5 hover:bg-warning-subtle rounded-lg disabled:opacity-50"
                              title="Rewrite prompt (regenerates response without subsequent context)"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          {message.role === 'assistant' && typeof message.id === 'number' && (
                            <FeedbackControl
                              target="message"
                              id={message.id}
                              initial={(message as { feedback?: { rating: number; reason: string; comment: string } | null }).feedback ?? null}
                            />
                          )}
                          {message.role === 'user' && (
                            <button
                              onClick={() => handleRewindAfterMessage(message.id as number)}
                              disabled={deletingMsgId === message.id}
                              className="text-muted-foreground hover:text-emerald-500 transition-colors p-2 md:p-1.5 hover:bg-success-subtle rounded-lg disabled:opacity-50"
                              title="Reverse context (keep this message, delete answers)"
                            >
                              <ArrowUpFromLine className="w-4 h-4" />
                            </button>
                          )}
                          {message.role === 'user' && (
                            <button
                              onClick={() => handleEditMessage(message.id as number, message.content)}
                              disabled={deletingMsgId === message.id}
                              className="text-muted-foreground hover:text-blue-500 transition-colors p-2 md:p-1.5 hover:bg-blue-500/10 rounded-lg disabled:opacity-50"
                              title="Edit and resend message"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteMessage(message.id as number)}
                            disabled={deletingMsgId === message.id}
                            className="text-muted-foreground hover:text-red-500 transition-colors p-2 md:p-1.5 hover:bg-red-500/10 rounded-lg disabled:opacity-50"
                            title="Delete message"
                          >
                            {deletingMsgId === message.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        {/* Which model wrote this answer. Attribution belongs to
                            the answer, not to the picker in the composer: the
                            model can be switched mid-thread, so reading it off
                            the current selection would relabel old answers.
                            Always visible — unlike the actions, this is
                            information, and hiding it until hover means nobody
                            finds it. */}
                        {message.role === 'assistant' && message.metadata?.model && (
                          <span className="ml-auto min-w-0 max-w-[50vw] sm:max-w-none truncate text-[11px] text-muted-foreground/70 whitespace-nowrap">
                            Prepared with{' '}
                            <span className="text-muted-foreground">
                              {prettyModel(message.metadata.model)}
                            </span>
                          </span>
                        )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isLoading && (() => {
                  /* One colour, not six. Every phase here is the agent working
                     unattended, and the token rule says that is violet — a
                     different hue per phase was decoration that implied a
                     distinction the states do not have. The icon shape already
                     says which phase it is. Sized to match the settled
                     "Answer" label so the row does not resize mid-stream. */
                  const phaseIcons: Record<string, React.ReactNode> = {
                    thinking: <BrainCircuit className="w-4 h-4 text-agent" />,
                    searching: <Search className="w-4 h-4 text-agent" />,
                    planning: <BrainCircuit className="w-4 h-4 text-agent" />,
                    reading: <Globe2 className="w-4 h-4 text-agent" />,
                    analyzing: <Globe2 className="w-4 h-4 text-agent" />,
                    generating: <Wand2 className="w-4 h-4 text-agent" />,
                    visualizing: <Wand2 className="w-4 h-4 text-agent" />,
                    motion_generating: <Video className="w-4 h-4 text-agent" />,
                  };

                  const statusMessage = live.status?.message || 'Thinking...';
                  /* Once the answer is coming out, the header is the answer's
                     header — same icon, no pulse — so it survives the settle
                     untouched. The phase icon is only useful while the phase is
                     still the thing happening. */
                  const answering = Boolean(live.content);
                  const statusIcon = answering
                    ? <BrainCircuit className="w-4 h-4 text-agent" />
                    : phaseIcons[live.status?.phase || 'thinking'] || phaseIcons.thinking;

                  /* Hoisted because it renders in one of two slots — above the
                     answer before any text arrives, below it afterwards. */
                  const statusPanel = (
                    <>
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-semibold text-foreground/80 animate-pulse">{statusMessage}</span>
                          <ThinkingTimer active={isLoading} />
                        </div>
                        {live.thinking && (
                          <button
                            onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors text-[10px] font-semibold  text-primary/60"
                          >
                            <BrainCircuit className="w-3 h-3" />
                            {isReasoningExpanded ? 'Hide reasoning' : 'View reasoning'}
                            <ChevronDown className={cn("w-3 h-3 transition-transform duration-300", isReasoningExpanded && "rotate-180")} />
                          </button>
                        )}
                      </div>

                      {live.thinking && isReasoningExpanded && (
                        <div className="mt-2 p-4 rounded-lg bg-muted/30 border border-border/40 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="flex items-center gap-2 mb-3">
                            <BrainCircuit className="w-3.5 h-3.5 text-primary/60" />
                            <span className="text-[10px] font-semibold  text-muted-foreground/60">Internal processing</span>
                          </div>
                          <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground/80 italic font-medium leading-relaxed">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {live.thinking}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </>
                  );

                  return (
                    /* Rendered as the last child of the message list, not as
                       a sibling of it: the list carries the 3rem turn rhythm, so
                       a block outside it sat 24px closer and the answer visibly
                       rose as it settled. Same "Answer" label, same left edge,
                       no avatar — the in-flight turn now occupies exactly the
                       slot the settled one will take. */
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={cn("flex items-center", !answering && "animate-pulse")}>{statusIcon}</span>
                        <span className="text-[13px] font-semibold text-foreground">Answer</span>
                      </div>
                      <div className="w-full space-y-3">
                        {/* Progress belongs above the answer only while there is
                            no answer yet. Once text is streaming it moves below,
                            so the first line of the reply sits directly under the
                            "Answer" label in both states — left above, it took
                            ~36px that vanished at settle and dropped the whole
                            answer upward at the exact moment it stopped moving. */}
                        {!live.content && statusPanel}

                        {/* Live Content Stream.

                            Same component and same wrapper classes as a settled
                            answer, deliberately. This was a bare <ReactMarkdown>
                            under different prose classes, so the instant a turn
                            finished the text it had spent the whole stream
                            rendering changed size, colour and leading, and bare
                            [1] refs turned into citation pills. Two renderers
                            for one string can only ever agree by coincidence.
                            No entrance animation either: this content persists
                            across the handoff, it does not arrive at it. */}
                        {live.content && (
                          <div className="prose prose-base dark:prose-invert max-w-none ai-chat-prose break-words min-w-0 text-[16px] leading-[1.75] text-foreground">
                            <MarkdownMessage content={streamedContent} sources={live.sources} />
                          </div>
                        )}

                        {live.content && statusPanel}

                        {/* The plan, updated live — this is what turns forty
                            tool calls into something a person can follow. */}
                        {live.todos.length > 0 && <TodoPanel todos={live.todos} live />}

                        <FileCards files={live.files} />

                        {/* Artifacts as they arrive, before the turn is persisted. */}
                        {live.artifacts.map((art, i) => (
                          <HtmlArtifact key={`live-art-${i}`} artifact={art} />
                        ))}

                        {live.charts.map((chart, i) => (
                          <ChartArtifact key={`live-chart-${i}`} chart={chart} />
                        ))}

                        {/* The delegated run's card + command cards, live. */}
                        {live.agentRun?.execution_id && (
                          <CommandCard
                            card={{
                              type: 'agent_run',
                              agent_name: live.agentRun.agent_name,
                              execution_id: live.agentRun.execution_id,
                              status: live.agentRun.status,
                            }}
                            onNavigate={(path) => { window.location.href = path; }}
                          />
                        )}
                        {live.commandCard?.type && (
                          <CommandCard
                            card={live.commandCard}
                            busy={confirmBusy}
                            onConfirm={(confirm) => {
                              const cmd = pickedCommand;
                              if (cmd) void runCommandConfirm(cmd.name, {}, confirm);
                            }}
                            onNavigate={(path) => { window.location.href = path; }}
                          />
                        )}

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
                                          <span className="flex items-center justify-center w-7 h-7 rounded-md bg-amber-500/20 text-xs font-semibold text-amber-600 shrink-0 border border-border shadow-sm">
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

                                          {/* `question` is ask_vision: the agent interrogating a vision
                                              model about an image it cannot see. Showing the question it
                                              asked is legible in a way "calling ask_vision..." is not. */}
                                          {!isThought && (argText(activity.args?.query) || argText(activity.args?.question)) && (
                                             <span className="truncate max-w-[40vw] sm:max-w-[340px] text-foreground/60 italic text-[13px] font-medium opacity-80">"{stripXmlTags(argText(activity.args?.query) || argText(activity.args?.question))}"</span>
                                          )}
                                      
                                          {thought && (
                                            <div className="mt-1.5 group/thought relative">
                                              <div className={cn(
                                                "text-[13.5px] text-muted-foreground/75 italic leading-relaxed border-l-2 border-primary/20 pl-3 transition-colors duration-300 ai-activity-markdown pb-1",
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
                                  <div key={i} className="rounded-lg overflow-hidden border border-border bg-success-subtle animate-in slide-in-from-bottom-2 duration-300">
                                    <div className="px-4 py-2 bg-success-subtle flex items-center justify-between border-b border-emerald-500/10">
                                       <div className="flex items-center gap-2">
                                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                          <span className="text-[10px] font-semibold text-emerald-600 ">Active Execution {i+1}</span>
                                       </div>
                                    </div>
                                    <div className="p-4 space-y-3">
                                       <pre className="text-[13px] text-foreground/80 font-mono bg-card p-3 rounded-lg overflow-x-auto border border-white/5">
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

                        {/* Media Generation status (Visualize/Motion) */}
                        {(live.status?.phase === 'visualizing' || live.status?.phase === 'motion_generating') && (
                          <div className="mt-4 rounded-lg border border-border bg-muted aspect-video max-w-sm w-full flex flex-col items-center justify-center gap-3 text-center p-6">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              {live.status.phase === 'visualizing' ? (
                                  <ImageIcon className="w-6 h-6" />
                              ) : (
                                  <Video className="w-6 h-6" />
                              )}
                              <span className="text-sm font-semibold text-foreground">
                                  {live.status.phase === 'visualizing' ? 'Generating image' : 'Generating video'}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Working on your media — this stays here when done.
                            </p>
                          </div>
                        )}

                        {/* Live Discoveries Row — Sources and Media */}
                        {(live.sources.length > 0 || live.images.length > 0 || live.videos.length > 0) && (
                          <div className="mt-4 flex flex-wrap gap-2 animate-in fade-in duration-300">
                            {live.sources.length > 0 && (
                              <button
                                onClick={() => setIsLiveSourcesExpanded(!isLiveSourcesExpanded)}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors border group",
                                  isLiveSourcesExpanded ? "bg-primary-subtle border-primary-line text-primary" : "bg-secondary border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                                )}
                              >
                                <Globe2 className="w-3.5 h-3.5" />
                                <span className="text-[12px] font-medium">{live.sources.length} Sources</span>
                                <ChevronDown className={cn("w-3 h-3 transition-transform duration-300", isLiveSourcesExpanded && "rotate-180")} />
                              </button>
                            )}

                            {(live.images.length > 0 || live.videos.length > 0) && (
                              <button
                                onClick={() => setIsLiveMediaExpanded(!isLiveMediaExpanded)}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors border group",
                                  isLiveMediaExpanded ? "bg-success-subtle border-emerald-500/30 text-emerald-600 shadow-sm" : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50"
                                )}
                              >
                                <ImageIcon className={cn("w-3.5 h-3.5", isLiveMediaExpanded ? "text-emerald-600" : "text-muted-foreground/60 group-hover:text-emerald-500")} />
                                <span className="text-[12px] font-medium">{live.images.length + live.videos.length} Media</span>
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
                              <div className="flex items-center justify-center rounded-lg border border-dashed border-border/40 bg-muted/20 text-[10px] font-bold text-muted-foreground/40 italic">
                                 +{live.sources.length - 3} more...
                              </div>
                            )}
                          </div>
                        )}

                        {(live.images.length > 0 || live.videos.length > 0) && isLiveMediaExpanded && (
                           <div className="mt-3 flex gap-3 overflow-x-auto pb-2 scrollbar-hide px-1 animate-in slide-in-from-top-2 duration-300">
                             {live.images.slice(0, 4).flatMap((img, i) => {
                               const url = img.image || img.url;
                               return url ? [(
                                 <MediaPreview
                                   key={`img-${i}`}
                                   url={url}
                                   type="image"
                                   className="w-32 h-20 shrink-0 shadow-sm"
                                 />
                               )] : [];
                             })}
                             {live.videos.slice(0, 4).flatMap((vid, i) => (
                               vid.url ? [(
                                 <MediaPreview
                                   key={`vid-${i}`}
                                   url={vid.url}
                                   type="video"
                                   className="w-32 h-20 shrink-0 shadow-sm"
                                 />
                               )] : []
                             ))}
                             {(live.images.length > 4 || live.videos.length > 4) && (
                               <div className="w-24 h-20 shrink-0 flex items-center justify-center rounded-lg bg-muted/20 border border-dashed border-border/40 text-[9px] font-semibold text-muted-foreground/30  text-center px-2">
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
              </div>
            )}

            {isUploading && (
              <div className="flex gap-3 md:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border border-border/40 shadow-md bg-muted text-muted-foreground">
                  <Settings2 className="w-5 h-5"/>
                </div>
                <div className="min-w-0 flex-1 max-w-[92%] md:max-w-[85%] space-y-3">
                  <div className="bg-muted/30 p-4 rounded-lg shadow-sm border border-border/40 inline-flex flex-col gap-3 min-w-[300px] max-w-sm w-full">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-background border border-border/50 flex items-center justify-center shrink-0">
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

            {/* Approval UI */}
            {pendingToolCall && (
              <div className="flex gap-3 md:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center shrink-0 border border-border shadow-lg shadow-amber-500/20">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0 flex-1 space-y-4 max-w-[92%] md:max-w-[85%]">
                  <div className="bg-card/60 p-6 rounded-lg rounded-tl-none shadow-sm border border-border space-y-4">
                    {/* The heading is what is about to happen, not the word
                        "Permission". A card that leads with the demand and
                        buries the act behind `JSON.stringify` teaches people
                        to approve without reading, which is the one outcome
                        an approval screen must not produce. */}
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-foreground">
                        {pendingToolCall.detail?.title ?? 'Permission required'}
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        {pendingToolCall.detail?.sentence
                          ?? `The assistant wants to run ${pendingToolCall.tool}.`}
                        {' '}Nothing has happened yet.
                      </p>
                    </div>

                    {pendingToolCall.detail?.fields?.length ? (
                      <dl className="rounded-lg border border-border/40 overflow-hidden divide-y divide-border/40">
                        {pendingToolCall.detail.fields.map((field) => (
                          <div key={field.label} className="flex gap-3 px-4 py-2.5 bg-muted/20">
                            <dt className="text-[12px] font-medium text-muted-foreground w-24 shrink-0">
                              {field.label}
                            </dt>
                            {/* Third-party text: rendered as a plain string,
                                never as markdown. */}
                            <dd className="text-[13px] text-foreground min-w-0 break-words">
                              {field.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}

                    {/* Kept, and closed. The raw view is what an engineer
                        needs when the sentence above is wrong; it is not what
                        the person deciding needs to read first. */}
                    <details className="group/raw">
                      <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors list-none flex items-center gap-1.5">
                        <ChevronRight className="w-3 h-3 transition-transform group-open/raw:rotate-90" />
                        Show raw arguments
                      </summary>
                      <div className="mt-2 bg-muted/30 p-3 rounded-lg border border-border/40 space-y-2 overflow-hidden">
                        <div className="font-mono text-[11px] text-muted-foreground break-all">
                          {pendingToolCall.tool}
                        </div>
                        <pre className="text-[11px] font-mono text-muted-foreground/80 overflow-x-auto custom-scrollbar">
                          {JSON.stringify(pendingToolCall.args, null, 2)}
                        </pre>
                      </div>
                    </details>

                    <div className="space-y-2">
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleApproveTool(pendingToolCall.call_id, 'once')}
                          className="flex-1 h-11 bg-primary text-primary-foreground font-semibold rounded-lg hover:shadow-lg transition-colors flex items-center justify-center gap-2 group"
                        >
                          <Check className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleDenyTool(pendingToolCall.call_id)}
                          className="flex-1 h-11 bg-muted text-muted-foreground font-semibold rounded-lg hover:bg-muted/80 transition-colors flex items-center justify-center gap-2"
                        >
                          <X className="w-4 h-4" />
                          Deny
                        </button>
                      </div>
                      {/* Three answers, quieter as they get longer-lived. The
                          middle rung is the one people actually want: without
                          it, someone who just wants to stop being asked for
                          the rest of the afternoon says "always" and grants a
                          standing allowance over their own mailbox. */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveTool(pendingToolCall.call_id, 'session')}
                          className="flex-1 h-9 text-xs font-medium text-muted-foreground rounded-lg border border-border/50 hover:bg-muted/50 hover:text-foreground transition-colors"
                        >
                          Allow for this chat
                        </button>
                        <button
                          onClick={() => handleApproveTool(pendingToolCall.call_id, 'always')}
                          className="flex-1 h-9 text-xs font-medium text-muted-foreground/70 rounded-lg border border-border/40 hover:bg-muted/50 hover:text-foreground transition-colors"
                        >
                          Always allow
                        </button>
                      </div>
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
          "shrink-0 transition-colors duration-1000 ease-in-out px-4",
          isInitialState
            ? "pb-[max(1.5rem,env(safe-area-inset-bottom))] md:pb-16"
            : "pb-[max(1.25rem,env(safe-area-inset-bottom))] md:pb-6 pt-2"
        )}>
          <div className="max-w-4xl mx-auto space-y-4">
            
            <div className="relative group/input">

              {/* Continue Exploring — above the chatbox */}
              {!isInitialState && !isLoading && (() => {
                const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
                const followUps = lastAssistant?.metadata?.follow_ups;
                if (!followUps || followUps.length === 0) return null;
                return (
                  <div className="mb-3 animate-in fade-in slide-in-from-bottom-4 duration-500 bg-card/60 border border-border/50 rounded-lg overflow-hidden">
                    <button 
                      onClick={() => setIsFollowUpsExpanded(!isFollowUpsExpanded)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-500/50" />
                        <span className="text-[10px] font-semibold  text-muted-foreground/60">Continue exploring</span>
                      </div>
                      <ChevronDown className={cn(
                        "w-4 h-4 text-muted-foreground/50 transition-transform duration-300",
                        isFollowUpsExpanded ? "rotate-180" : ""
                      )} />
                    </button>
                    
                    <div className={cn(
                      "grid transition-colors duration-300 ease-in-out",
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
                                         border border-border/50 rounded-lg shadow-sm text-left
                                         text-muted-foreground hover:text-foreground
                                         hover:bg-primary/5 hover:border-primary/20 hover:shadow-md
                                         transition-colors duration-200 ease-out active:scale-[0.98]
                                         animate-in fade-in slide-in-from-bottom-2"
                            >
                              <Zap className="w-3.5 h-3.5 shrink-0 opacity-30 transition-colors duration-200 group-hover:opacity-100 group-hover:text-primary group-hover:scale-110" />
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
                <div className="mb-2 flex items-start gap-2.5 rounded-lg border border-border bg-warning-subtle
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
                     <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-success-subtle border border-border rounded-lg group">
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


                {/* Flat card, not a glowing capsule. The blurred primary wash
                    that used to bloom behind this on focus was the loudest
                    thing on the page; a border that turns primary plus the
                    standard focus ring says "focused" in the same language as
                    every other input in the app. */}
                <div className="relative flex flex-col bg-card border border-border rounded-lg shadow-sm transition-colors duration-150 focus-within:border-primary focus-within:ring-1 focus-within:ring-ring">
                  {/* The `/` palette: fuzzy match, ↑/↓, Enter/Tab, Esc. */}
                  {!isGuest && (
                    <CommandPalette
                      open={paletteOpen && !isLoading}
                      commands={commands}
                      query={(splitCommandLine(input)?.name ?? '').replace(/^\//, '') || (input.replace(/^\s+/, '').startsWith('/') ? input.replace(/^\s+\//, '').replace(/^\//, '').split(/\s/)[0] ?? '' : '')}
                      onPick={(command) => {
                        setPickedCommand(command);
                        setCommandChips([]);
                        setCommandArgText('');
                        // Leave the task text in the box after the name; the
                        // payload carries the structured command, the text
                        // carries what the user typed to say.
                        const rest = splitCommandLine(input)?.rest ?? '';
                        setInput(rest ? `/${command.name} ${rest}` : `/${command.name} `);
                        setPaletteOpen(false);
                        textareaRef.current?.focus();
                      }}
                      onClose={() => setPaletteOpen(false)}
                    />
                  )}
                  {/* Mode picker — Ask · Auto · Plan. Auto is amber on purpose:
                      a mode that acts without asking must not look like the
                      default. Hidden for guests, who run one pinned mode. */}
                  {!isGuest && (
                    <div className="flex items-center gap-1 px-4 pt-2.5" role="group" aria-label="Chat mode">
                      {([
                        { key: 'ask' as const, label: 'Ask', hint: 'Approve side effects (Shift+Tab to cycle)' },
                        { key: 'auto' as const, label: 'Auto', hint: 'Clear matches run; the rest still ask' },
                        { key: 'plan' as const, label: 'Plan', hint: 'Look, don’t touch — no mutating tools' },
                      ]).map(m => (
                        <button
                          key={m.key}
                          onClick={() => void setMode(m.key)}
                          title={m.hint}
                          className={cn(
                            "flex items-center gap-1 h-6 px-2.5 rounded-md text-[10px] font-bold border",
                            "transition-colors duration-200 ease-out active:scale-95",
                            autonomy === m.key
                              ? m.key === 'auto'
                                ? 'bg-amber-500/15 border-amber-500/50 text-amber-600 dark:text-amber-400'
                                : m.key === 'plan'
                                  ? 'bg-purple-500/15 border-purple-500/40 text-purple-500'
                                  : 'bg-primary/10 border-primary/30 text-primary'
                              : "border-transparent text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40",
                          )}
                        >
                          {m.key === 'ask' && <Shield className="w-3 h-3" />}
                          {m.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Textarea row */}
                  <div className="p-4 pb-0">
                    {/* Picked command + chips: the structured input, shown as
                        chips carrying ids — never re-resolved names. */}
                    {pickedCommand && (
                      <div className="mb-2 flex flex-wrap items-center gap-1.5 px-2">
                        <span className="inline-flex min-h-[28px] items-center rounded-md bg-primary/10 px-2 py-1 font-mono text-[12px] font-bold text-primary">
                          /{pickedCommand.name}
                        </span>
                        {commandChips.map((chip) => (
                          <span
                            key={`${chip.arg}:${chip.id}`}
                            className="inline-flex min-h-[28px] items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-[12px] font-medium text-foreground"
                          >
                            {chip.label}
                            <button
                              onClick={() => setCommandChips((prev) => prev.filter((c) => c !== chip))}
                              aria-label={`Remove ${chip.label}`}
                              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                        <button
                          onClick={() => {
                            setPickedCommand(null);
                            setCommandChips([]);
                            setCommandArgText('');
                            setPaletteOpen(false);
                          }}
                          aria-label="Clear command"
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    {/* A typed command that failed to parse: 400 under the
                        input, text left in place — never a model turn. */}
                    {commandError && (
                      <div className="mb-2 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">
                        <p className="flex-1 text-[12px] text-destructive">{commandError}</p>
                        <button
                          onClick={() => setCommandError(null)}
                          aria-label="Dismiss"
                          className="shrink-0 rounded p-0.5 text-destructive/60 hover:bg-destructive/10"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    <textarea
                      id="chat-input-textarea"
                      name="chat-input"
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => {
                        const next = e.target.value;
                        setInput(next);
                        // `/` at the start opens the palette; anywhere else
                        // is plain text (a path mid-sentence never triggers).
                        if (!isGuest && !isLoading) {
                          const atStart = next.replace(/^\s+/, '').startsWith('/');
                          setPaletteOpen(atStart && !pickedCommand);
                          if (atStart) setCommandError(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          // With the palette open, Enter picks the command.
                          if (paletteOpen) return;
                          e.preventDefault();
                          handleSend();
                        }
                        // Shift+Tab cycles Ask → Auto → Plan without leaving the keyboard.
                        if (e.key === 'Tab' && e.shiftKey && !isGuest) {
                          e.preventDefault();
                          cycleMode();
                        }
                        if (e.key === 'Escape' && paletteOpen) {
                          e.preventDefault();
                          setPaletteOpen(false);
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
                  <div className="flex items-center justify-between px-2 sm:px-3 pb-3 pt-1 gap-1.5 sm:gap-2">
                    {/* Left: intent pills */}
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 basis-0">
                      <div className="flex items-center gap-1.5 min-w-0 max-w-full overflow-x-auto scrollbar-none scroll-rail pr-1">
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
                              "transition-colors duration-200 ease-out active:scale-95",
                              activeIntent === tool.key
                                ? tool.color === 'blue' ? 'bg-blue-500/15 border-blue-500/40 text-blue-500'
                                : 'bg-purple-500/15 border-purple-500/40 text-purple-500'
                              : "border-transparent text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40",
                              isLocked && tool.key === lockedIntent && activeIntent !== lockedIntent && "border-dashed border-muted-foreground/30 opacity-60"
                            )}
                          >
                            {tool.icon}
                            {/* Labels stay on phones too: two pills fit, and
                                an icon alone says nothing about what tapping
                                it changes. The row scrolls if a third returns. */}
                            <span className="inline">
                               {tool.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Right: model + voice + send. shrink-0 so the send
                        button is never squeezed off screen; min-w-0 plus the
                        viewport caps below so queued/dropped badges and the
                        model label truncate instead of colliding on phones. */}
                    <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 shrink-0">
                      {/* Model selector. Guests have nothing to select: the
                          backend serves them one pinned model and ignores any
                          model a client names, so they get a label rather than
                          a dropdown whose choices would change nothing. */}
                      {isGuest ? (
                        <div
                          className="flex items-center gap-2 h-8 px-3 rounded-lg border border-transparent text-[10px] font-bold text-muted-foreground/50"
                          title="Guest mode runs on NVIDIA NIM — log in to choose a model"
                        >
                          <Zap size={14} className="text-muted-foreground/50 shrink-0" />
                          <span className="inline max-w-[22vw] sm:max-w-[140px] truncate">
                            {prettyModel(llmModel)}
                          </span>
                        </div>
                      ) : (
                      <div className="relative min-w-0" ref={dropdownRef}>
                        <button
                          onClick={() => setShowModelDropdown(!showModelDropdown)}
                          className={cn(
                            "flex items-center gap-1.5 sm:gap-2 h-8 px-2 sm:px-3 rounded-lg transition-colors text-[10px] font-bold border min-w-0 max-w-[38vw] sm:max-w-none",
                            showModelDropdown
                              ? "bg-primary/10 border-primary/30 text-primary"
                              : "border-transparent text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40"
                          )}
                        >
                          <span className="text-sm leading-none flex items-center">
                            {dynamicProviders.find(p => p.slug === llmProvider)?.icon ? (
                              <span>{dynamicProviders.find(p => p.slug === llmProvider)?.icon}</span>
                            ) : (
                              <Bot size={14} className="shrink-0" />
                            )}
                          </span>
                          <span className="inline max-w-[22vw] sm:max-w-[120px] truncate">
                            {dynamicProviders.find(p => p.slug === llmProvider)?.models.find(m => m.value === llmModel)?.name || 'Select model'}
                          </span>
                          {/* Only when it is doing something. A badge reading
                              "Default" on every model would be noise, and one
                              shown for a model with no effort control would be
                              a claim about a setting that is not applied. */}
                          {effortSupported && llmEffort && (
                            <span className="inline px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary shrink-0">
                              {EFFORT_LABELS[llmEffort] ?? llmEffort}
                            </span>
                          )}
                          <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", showModelDropdown && "rotate-180")} />
                        </button>

                        {showModelDropdown && (
                          <>
                            {/* Backdrop */}
                            <div className="fixed inset-0 z-[9998]" onClick={() => setShowModelDropdown(false)} />
                            
                            <div className="absolute bottom-[calc(100%+8px)] right-0 w-[300px] max-w-[calc(100vw-2rem)] bg-card border border-border rounded-lg shadow-lg z-[9999] backdrop-blur-2xl overflow-hidden animate-in slide-in-from-bottom-3 fade-in duration-200">
                              
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
                                        "flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-colors",
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
                                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors text-[12px]",
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
                                            : "bg-success-subtle text-emerald-500 border border-border"
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

                              {/* Renders nothing when this model has no effort
                                  control, which is most of the catalogue. */}
                              <EffortPicker
                                available={effortLevels}
                                value={llmEffort}
                                onChange={saveEffort}
                              />
                            </div>
                          </>
                        )}
                      </div>
                      )}

                      {/* What is waiting for the running turn. Shown next to
                          the button that queued it, because the message has
                          left the composer and the user needs to see it went
                          somewhere. `dropped` appears only on overflow — a
                          steer someone believes was accepted and that vanished
                          is the failure the mailbox exists to prevent. */}
                      {queuedSteers > 0 && (
                        <span
                          className="mr-1 shrink-0 max-w-[24vw] truncate rounded-full bg-primary/10 px-2 py-0.5 text-[11px]
                                     font-medium tabular-nums text-primary"
                          title="Delivered at the agent's next tool boundary"
                        >
                          {queuedSteers} queued
                        </span>
                      )}
                      {droppedSteers > 0 && (
                        <span
                          className="mr-1 shrink-0 max-w-[24vw] truncate rounded-full bg-warning-subtle px-2 py-0.5 text-[11px]
                                     font-medium tabular-nums text-amber-600 dark:text-amber-400"
                          title="The mailbox was full; the oldest messages were dropped"
                        >
                          {droppedSteers} dropped
                        </span>
                      )}

                      {/* Voice button. Hidden on very narrow phones where it
                          collides with the model picker and send button. */}
                      <button
                        className="hidden min-[380px]:flex w-8 h-8 rounded-full items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
                        title="Voice input"
                      >
                        <Mic className="w-4 h-4" />
                      </button>

                      {/* While a turn runs the button means two different
                          things, decided by whether there is text to send:
                          with text it queues a steer, empty it stops the run.
                          Expressed here rather than as a new SendButton state
                          because four other call sites share that component
                          and none of them can steer. */}
                      <SendButton
                        onClick={() => handleSend()}
                        onStop={input.trim() ? undefined : stopGeneration}
                        busy={isLoading && !input.trim()}
                        disabled={!input.trim()}
                        title={
                          isLoading && input.trim()
                            ? 'Send to the running turn'
                            : undefined
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </footer>
      </div>
    </div>
    </FilePreviewProvider>
  );
}
