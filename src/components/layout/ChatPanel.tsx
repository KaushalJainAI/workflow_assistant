import { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  Copy, 
  Check,
  Loader2,
  Plus,
  Trash2,
  History,
  Wand2,
  X
} from 'lucide-react';
import { orchestratorService, type ChatMessage } from '../../api';

interface ChatPanelProps {
  initialConversationId?: string;
  onClose?: () => void;
  isDocked?: boolean;
}

const examplePrompts = [
  "Create a workflow that monitors an RSS feed and sends new posts to Slack",
  "Build a data pipeline that syncs PostgreSQL to Google Sheets daily",
  "Set up an email automation that responds to customer inquiries using AI",
  "Create a workflow to scrape a website and save data to a database",
];

export default function ChatPanel({ initialConversationId, onClose, isDocked }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "Hello! I'm your AI workflow assistant. Describe the automation you want to create, and I'll build it for you. For example, you can say:\n\n• \"Monitor my email and notify me on Slack when I get a message from my boss\"\n• \"Every morning, fetch weather data and send a summary to my phone\"\n• \"When a new row is added to Google Sheets, create a Notion page\"\n\nWhat would you like to automate?",
      created_at: new Date().toISOString(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [conversations, setConversations] = useState<{conversation_id: string}[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const handleGenerateWorkflow = async () => {
    if (!input.trim() || isGenerating) return;

    setIsGenerating(true);
    const userMessage: ChatMessage = {
      role: 'user',
      content: `Generate workflow: ${input}`,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      const result = await orchestratorService.generateWorkflow({
        description: input,
        save: true,
        conversation_id: conversationId,
      });

      if (result.conversation_id) {
        setConversationId(result.conversation_id);
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: `I've created a workflow for you!\n\n**${result.name}**\n\n${result.description}\n\nThe workflow has ${result.nodes?.length || 0} nodes and has been saved.\n\nWorkflow ID: ${result.workflow_id}\n\nYou can now open it in the editor to customize it further.`,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      // Refresh history list if new conversation
      if (!conversationId) loadHistory();
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error generating workflow: ${err instanceof Error ? err.message : 'Unknown error'}`,
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setIsGenerating(false);
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
        <div className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-md transition-colors ${showHistory ? 'bg-muted text-foreground' : 'hover:bg-muted text-muted-foreground'}`}
              title="History"
            >
              <History className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold">{isDocked ? 'AI Assistant' : 'AI Workflow Builder'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-white" />
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

            {(isLoading || isGenerating) && (
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
              <div className="flex flex-wrap gap-2">
                {examplePrompts.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => handleExampleClick(prompt)}
                    className="px-3 py-1.5 bg-muted hover:bg-muted/80 rounded-full text-sm transition-colors text-left"
                  >
                    {prompt.slice(0, 50)}...
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 border-t border-border bg-card">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe the workflow you want to create..."
                  className="w-full p-3 pr-10 bg-background border border-input rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-ring min-h-[50px] max-h-32 text-sm"
                  rows={1}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading || isGenerating}
                  className="absolute right-2 bottom-2 p-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                onClick={handleGenerateWorkflow}
                disabled={!input.trim() || isLoading || isGenerating}
                className="px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                title="Generate Workflow"
              >
                <Wand2 className="w-4 h-4" />
                {!isDocked && "Generate"}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              AI can make mistakes. Review workflows before deploying.
            </p>
          </div>
        </div>
      </div>

      {/* Chat History Sidebar */}
      {showHistory && (
        <div className={`${isDocked ? 'absolute inset-0 z-10 w-full' : 'w-72 border-l border-border'} bg-card flex flex-col slide-in-from-right-5 duration-200 shadow-xl`}>
          <div className="p-4 border-b border-border flex justify-between items-center bg-card">
             <span className="font-semibold text-sm">Past Conversations</span>
             {isDocked && (
               <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-muted rounded">
                 <X className="w-4 h-4" />
               </button>
             )}
          </div>
          <div className="p-4 border-b border-border bg-card">
            <button 
              onClick={() => {
                setMessages([messages[0]]);
                setConversationId(undefined);
                if (isDocked) setShowHistory(false);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Chat
            </button>
          </div>
          <div className="flex-1 overflow-auto bg-card">
            {conversations.length === 0 ? (
               <div className="p-4 text-center text-sm text-muted-foreground">
                 No history found
               </div>
            ) : (
              <div className="divide-y divide-border">
                {conversations.map((conv) => (
                  <div
                    key={conv.conversation_id}
                    className={`w-full text-left p-3 hover:bg-muted/50 transition-colors group relative ${conversationId === conv.conversation_id ? 'bg-muted' : ''}`}
                    onClick={() => {
                      loadConversation(conv.conversation_id);
                      if (isDocked) setShowHistory(false);
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Bot className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-mono">
                        {conv.conversation_id.slice(0, 8)}...
                      </span>
                    </div>
                    <div className="text-sm truncate font-medium">Conversation</div>
                    
                    <button
                      onClick={(e) => handleDeleteConversation(e, conv.conversation_id)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-destructive hover:text-white rounded-md opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete Conversation"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
