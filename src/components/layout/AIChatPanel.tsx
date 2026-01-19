import { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  Copy, 
  Check,
  Loader2,
  X,
  ChevronDown,
  GitGraph,
  MessageSquare,
  Mic,
  MicOff
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const models = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic' },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic' },
  { id: 'gemini-pro', name: 'Gemini Pro', provider: 'Google' },
  { id: 'llama-3-70b', name: 'Llama 3 70B', provider: 'Meta' },
];

type ChatType = 'workflow' | 'normal';

export default function AIChatPanel({ isOpen, onClose }: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your AI assistant. How can I help you build your workflow today?",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(models[0]);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [chatType, setChatType] = useState<ChatType>('workflow');
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Update welcome message when chat type changes
  useEffect(() => {
    const welcomeMessage = chatType === 'workflow' 
      ? "Hi! I'm your AI assistant. How can I help you build your workflow today?"
      : "Hi! I'm your AI assistant. How can I help you today?";
    
    setMessages([{
      id: '1',
      role: 'assistant',
      content: welcomeMessage,
      timestamp: new Date(),
    }]);
  }, [chatType]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate AI response based on chat type
    setTimeout(() => {
      const response = chatType === 'workflow'
        ? `I can help you with that! Here's what I suggest:\n\n1. First, add a trigger node\n2. Then connect it to your desired action\n3. Configure the parameters\n\nWould you like me to explain any step in detail?`
        : `I understand! Let me help you with that.\n\nBased on your question, here's my response. Feel free to ask follow-up questions!`;
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1500);
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

  const toggleRecording = () => {
    if (isRecording) {
      // Stop recording - simulate transcription
      setIsRecording(false);
      setInput(prev => prev + (prev ? ' ' : '') + 'Voice input transcribed here...');
    } else {
      // Start recording
      setIsRecording(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 h-full border-l border-border bg-card flex flex-col shrink-0">
      {/* Header */}
      <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold">AI Builder</span>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 hover:bg-muted rounded-md transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3" onClick={() => setShowModelDropdown(false)}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : ''}`}
            >
              {message.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
              )}
              <div className={`max-w-[85%] ${message.role === 'user' ? 'order-1' : ''}`}>
                <div
                  className={`p-3 rounded-xl text-sm ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-muted rounded-tl-sm'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>
                
                {/* Actions */}
                <div className={`flex items-center gap-1 mt-1 ${message.role === 'user' ? 'justify-end' : ''}`}>
                  <button
                    onClick={() => copyToClipboard(message.content, message.id)}
                    className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                  >
                    {copiedId === message.id ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
              {message.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="p-3 bg-muted rounded-xl rounded-tl-sm">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Bottom Controls - Input Area with Model & Chat Type */}
      <div className="border-t border-border shrink-0">
        {/* Chat Type Toggle & Model Selector Row */}
        <div className="px-3 pt-3 flex gap-2">
          {/* Chat Type Toggle */}
          <div className="flex bg-muted rounded-lg p-0.5 flex-1">
            <button
              onClick={() => setChatType('workflow')}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                chatType === 'workflow'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <GitGraph className="w-3 h-3" />
              Workflow
            </button>
            <button
              onClick={() => setChatType('normal')}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                chatType === 'normal'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MessageSquare className="w-3 h-3" />
              Normal
            </button>
          </div>

          {/* Model Selector */}
          <div className="relative">
            <button
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="flex items-center gap-1 px-2 py-1 bg-background border border-input rounded-lg text-xs hover:bg-muted/50 transition-colors"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="font-medium">{selectedModel.name}</span>
              <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Model Dropdown - Opens upward */}
            {showModelDropdown && (
              <div className="absolute right-0 bottom-full mb-1 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden min-w-40">
                {models.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      setSelectedModel(model);
                      setShowModelDropdown(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-muted transition-colors ${
                      selectedModel.id === model.id ? 'bg-muted' : ''
                    }`}
                  >
                    <span className="font-medium">{model.name}</span>
                    <span className="text-muted-foreground">{model.provider}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="p-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={chatType === 'workflow' ? "Describe your workflow..." : "Ask AI anything..."}
                className="w-full p-3 pr-10 bg-background border border-input rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-ring text-sm min-h-[44px] max-h-24"
                rows={1}
              />
              {/* Voice button inside textarea */}
              <button
                onClick={toggleRecording}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${
                  isRecording 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
                title={isRecording ? "Stop recording" : "Voice input"}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
