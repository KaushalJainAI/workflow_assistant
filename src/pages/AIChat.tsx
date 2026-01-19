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
  History
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  workflowGenerated?: {
    name: string;
    nodeCount: number;
  };
}

interface ChatHistory {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

const examplePrompts = [
  "Create a workflow that monitors an RSS feed and sends new posts to Slack",
  "Build a data pipeline that syncs PostgreSQL to Google Sheets daily",
  "Set up an email automation that responds to customer inquiries using AI",
  "Create a workflow to scrape a website and save data to a database",
];

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your AI workflow assistant. Describe the automation you want to create, and I'll build it for you. For example, you can say:\n\n• \"Monitor my email and notify me on Slack when I get a message from my boss\"\n• \"Every morning, fetch weather data and send a summary to my phone\"\n• \"When a new row is added to Google Sheets, create a Notion page\"\n\nWhat would you like to automate?",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatHistories: ChatHistory[] = [
    {
      id: '1',
      title: 'Email to Slack notification',
      messages: [],
      createdAt: new Date('2024-01-14'),
    },
    {
      id: '2',
      title: 'Database sync workflow',
      messages: [],
      createdAt: new Date('2024-01-13'),
    },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

    // Simulate AI response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I've analyzed your request and created a workflow for you!\n\n**Workflow: ${input.slice(0, 30)}...**\n\nHere's what I've set up:\n\n1. **Trigger**: Schedule Trigger (runs every hour)\n2. **HTTP Request**: Fetches data from the source\n3. **Function**: Transforms and filters the data\n4. **Conditional**: Checks if criteria are met\n5. **Slack**: Sends notification to your channel\n\nThe workflow is ready in the editor. Would you like me to:\n- Add more nodes?\n- Modify any configurations?\n- Explain how any part works?`,
        timestamp: new Date(),
        workflowGenerated: {
          name: input.slice(0, 30) + '...',
          nodeCount: 5,
        }
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 2000);
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

  return (
    <div className="h-full flex">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 hover:bg-muted rounded-md"
            >
              <History className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold">AI Workflow Builder</span>
            </div>
          </div>
          <button 
            onClick={() => setMessages([messages[0]])}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-input rounded-md hover:bg-muted"
          >
            <Trash2 className="w-4 h-4" />
            Clear Chat
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : ''}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className={`max-w-[80%] ${message.role === 'user' ? 'order-1' : ''}`}>
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

                  {/* Workflow Generated Card */}
                  {message.workflowGenerated && (
                    <div className="mt-3 p-4 bg-card border border-border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Workflow Created</span>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          {message.workflowGenerated.nodeCount} nodes
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{message.workflowGenerated.name}</p>
                      <div className="flex gap-2">
                        <button className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90">
                          Open in Editor
                        </button>
                        <button className="px-3 py-2 border border-input rounded-md text-sm hover:bg-muted">
                          Deploy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
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

        {/* Example Prompts */}
        {messages.length === 1 && (
          <div className="px-4 pb-2">
            <div className="max-w-3xl mx-auto">
              <p className="text-sm text-muted-foreground mb-2">Try these examples:</p>
              <div className="flex flex-wrap gap-2">
                {examplePrompts.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => handleExampleClick(prompt)}
                    className="px-3 py-1.5 bg-muted hover:bg-muted/80 rounded-full text-sm transition-colors"
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
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe the workflow you want to create..."
                  className="w-full p-4 pr-12 bg-background border border-input rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-ring min-h-[56px] max-h-32"
                  rows={1}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 bottom-2 p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              AI can make mistakes. Review workflows before deploying.
            </p>
          </div>
        </div>
      </div>

      {/* Chat History Sidebar - Right Side */}
      {showHistory && (
        <div className="w-64 border-l border-border bg-card flex flex-col">
          <div className="p-4 border-b border-border">
            <button 
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
              New Chat
            </button>
          </div>
          <div className="flex-1 overflow-auto p-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider px-2 mb-2">Recent</p>
            {chatHistories.map((chat) => (
              <button
                key={chat.id}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors mb-1"
              >
                <p className="text-sm font-medium truncate">{chat.title}</p>
                <p className="text-xs text-muted-foreground">
                  {chat.createdAt.toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
