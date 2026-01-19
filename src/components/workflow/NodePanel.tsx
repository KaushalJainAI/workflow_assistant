import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface NodeType {
  id: string;
  name: string;
  description: string;
  category: string;
  color: string;
  icon: string;
}

const nodeTypes: NodeType[] = [
  // ============= TRIGGERS =============
  { id: 'manual_trigger', name: 'Manual Trigger', description: 'Start workflow manually', category: 'Triggers', color: '#ff6d5a', icon: '▶️' },
  { id: 'schedule_trigger', name: 'Schedule Trigger', description: 'Run on a schedule', category: 'Triggers', color: '#ff6d5a', icon: '⏰' },
  { id: 'webhook', name: 'Webhook', description: 'Receive HTTP requests', category: 'Triggers', color: '#ff6d5a', icon: '🔗' },
  { id: 'email_trigger', name: 'Email Trigger', description: 'Trigger on new emails', category: 'Triggers', color: '#ff6d5a', icon: '📬' },
  { id: 'file_trigger', name: 'File Trigger', description: 'Watch for file changes', category: 'Triggers', color: '#ff6d5a', icon: '📂' },
  
  // ============= CORE =============
  { id: 'http_request', name: 'HTTP Request', description: 'Make HTTP requests', category: 'Core', color: '#7b68ee', icon: '🌐' },
  { id: 'code', name: 'Code', description: 'Run custom code', category: 'Core', color: '#7b68ee', icon: '💻' },
  { id: 'set', name: 'Set', description: 'Set or modify data', category: 'Core', color: '#20b2aa', icon: '📝' },
  { id: 'if', name: 'IF', description: 'Conditional branching', category: 'Core', color: '#ffa500', icon: '🔀' },
  { id: 'switch', name: 'Switch', description: 'Multiple branches', category: 'Core', color: '#ffa500', icon: '🎛️' },
  { id: 'merge', name: 'Merge', description: 'Combine multiple inputs', category: 'Core', color: '#20b2aa', icon: '🔗' },
  { id: 'split_in_batches', name: 'Split In Batches', description: 'Process in batches', category: 'Core', color: '#20b2aa', icon: '📦' },
  { id: 'filter', name: 'Filter', description: 'Filter items by condition', category: 'Core', color: '#20b2aa', icon: '🔍' },
  { id: 'loop', name: 'Loop', description: 'Iterate over items', category: 'Core', color: '#20b2aa', icon: '🔄' },
  
  // ============= DATA =============
  { id: 'function', name: 'Function', description: 'Transform data with JS', category: 'Data', color: '#9370db', icon: '⚡' },
  { id: 'item_lists', name: 'Item Lists', description: 'Manipulate item lists', category: 'Data', color: '#9370db', icon: '📋' },
  { id: 'date_time', name: 'Date & Time', description: 'Date/time operations', category: 'Data', color: '#9370db', icon: '📅' },
  { id: 'json', name: 'JSON', description: 'Parse/stringify JSON', category: 'Data', color: '#9370db', icon: '{ }' },
  { id: 'xml', name: 'XML', description: 'Parse XML data', category: 'Data', color: '#9370db', icon: '📄' },
  { id: 'html', name: 'HTML Extract', description: 'Extract data from HTML', category: 'Data', color: '#9370db', icon: '🌐' },
  { id: 'crypto', name: 'Crypto', description: 'Encrypt/decrypt data', category: 'Data', color: '#9370db', icon: '🔐' },
  
  // ============= AI =============
  { id: 'openai', name: 'OpenAI', description: 'GPT and AI models', category: 'AI', color: '#10a37f', icon: '🤖' },
  { id: 'anthropic', name: 'Anthropic Claude', description: 'Claude AI assistant', category: 'AI', color: '#6b4c9a', icon: '🧠' },
  { id: 'openai_assistant', name: 'OpenAI Assistant', description: 'Custom AI assistants', category: 'AI', color: '#10a37f', icon: '🤖' },
  { id: 'ai_agent', name: 'AI Agent', description: 'Autonomous AI agent', category: 'AI', color: '#ff6b35', icon: '🎯' },
  { id: 'vector_store', name: 'Vector Store', description: 'Vector embeddings DB', category: 'AI', color: '#764ba2', icon: '📊' },
  { id: 'embeddings', name: 'Embeddings', description: 'Create text embeddings', category: 'AI', color: '#764ba2', icon: '🔢' },
  { id: 'huggingface', name: 'Hugging Face', description: 'HF models & datasets', category: 'AI', color: '#ffb347', icon: '🤗' },
  { id: 'langchain', name: 'LangChain', description: 'LangChain tools', category: 'AI', color: '#1c3c3c', icon: '🔗' },
  
  // ============= APPS =============
  { id: 'gmail', name: 'Gmail', description: 'Send and receive emails', category: 'Apps', color: '#ea4335', icon: '📧' },
  { id: 'slack', name: 'Slack', description: 'Send Slack messages', category: 'Apps', color: '#4a154b', icon: '💬' },
  { id: 'google_sheets', name: 'Google Sheets', description: 'Read/write spreadsheets', category: 'Apps', color: '#0f9d58', icon: '📊' },
  { id: 'notion', name: 'Notion', description: 'Manage Notion pages', category: 'Apps', color: '#000000', icon: '📓' },
  { id: 'airtable', name: 'Airtable', description: 'Airtable database', category: 'Apps', color: '#18bfff', icon: '📊' },
  { id: 'google_calendar', name: 'Google Calendar', description: 'Manage calendar events', category: 'Apps', color: '#4285f4', icon: '📆' },
  { id: 'trello', name: 'Trello', description: 'Manage Trello boards', category: 'Apps', color: '#0079bf', icon: '📋' },
  { id: 'asana', name: 'Asana', description: 'Task management', category: 'Apps', color: '#f06a6a', icon: '✅' },
  { id: 'jira', name: 'Jira', description: 'Issue tracking', category: 'Apps', color: '#0052cc', icon: '🎫' },
  { id: 'linear', name: 'Linear', description: 'Project management', category: 'Apps', color: '#5e6ad2', icon: '📈' },
  
  // ============= COMMUNICATION =============
  { id: 'telegram', name: 'Telegram', description: 'Send Telegram messages', category: 'Communication', color: '#0088cc', icon: '📱' },
  { id: 'discord', name: 'Discord', description: 'Discord bot messages', category: 'Communication', color: '#5865f2', icon: '🎮' },
  { id: 'twilio', name: 'Twilio', description: 'SMS and voice calls', category: 'Communication', color: '#f22f46', icon: '📞' },
  { id: 'whatsapp', name: 'WhatsApp', description: 'WhatsApp messaging', category: 'Communication', color: '#25d366', icon: '📱' },
  { id: 'microsoft_teams', name: 'Microsoft Teams', description: 'Teams messages', category: 'Communication', color: '#6264a7', icon: '💼' },
  { id: 'sendgrid', name: 'SendGrid', description: 'Transactional emails', category: 'Communication', color: '#1a82e2', icon: '✉️' },
  
  // ============= MARKETING =============
  { id: 'mailchimp', name: 'Mailchimp', description: 'Email marketing', category: 'Marketing', color: '#ffe01b', icon: '🐵' },
  { id: 'hubspot', name: 'HubSpot', description: 'Marketing automation', category: 'Marketing', color: '#ff7a59', icon: '🧲' },
  { id: 'activecampaign', name: 'ActiveCampaign', description: 'Email automation', category: 'Marketing', color: '#356ae6', icon: '📧' },
  { id: 'convertkit', name: 'ConvertKit', description: 'Creator marketing', category: 'Marketing', color: '#fb6970', icon: '✍️' },
  { id: 'google_ads', name: 'Google Ads', description: 'Manage Google Ads', category: 'Marketing', color: '#4285f4', icon: '📢' },
  { id: 'facebook_ads', name: 'Facebook Ads', description: 'Facebook advertising', category: 'Marketing', color: '#1877f2', icon: '📘' },
  
  // ============= CRM =============
  { id: 'salesforce', name: 'Salesforce', description: 'Salesforce CRM', category: 'CRM', color: '#00a1e0', icon: '☁️' },
  { id: 'pipedrive', name: 'Pipedrive', description: 'Sales pipeline', category: 'CRM', color: '#017737', icon: '💼' },
  { id: 'zoho_crm', name: 'Zoho CRM', description: 'Zoho customer data', category: 'CRM', color: '#c8202b', icon: '📊' },
  { id: 'freshsales', name: 'Freshsales', description: 'Sales CRM', category: 'CRM', color: '#10a37f', icon: '🎯' },
  
  // ============= DEVOPS =============
  { id: 'github', name: 'GitHub', description: 'GitHub integration', category: 'DevOps', color: '#24292e', icon: '🐙' },
  { id: 'gitlab', name: 'GitLab', description: 'GitLab integration', category: 'DevOps', color: '#fc6d26', icon: '🦊' },
  { id: 'docker', name: 'Docker', description: 'Container operations', category: 'DevOps', color: '#2496ed', icon: '🐳' },
  { id: 'kubernetes', name: 'Kubernetes', description: 'K8s orchestration', category: 'DevOps', color: '#326ce5', icon: '☸️' },
  { id: 'jenkins', name: 'Jenkins', description: 'CI/CD pipelines', category: 'DevOps', color: '#d33833', icon: '🔧' },
  { id: 'terraform', name: 'Terraform', description: 'Infrastructure as code', category: 'DevOps', color: '#7b42bc', icon: '🏗️' },
  
  // ============= CLOUD =============
  { id: 'aws_s3', name: 'AWS S3', description: 'S3 file storage', category: 'Cloud', color: '#ff9900', icon: '📦' },
  { id: 'aws_lambda', name: 'AWS Lambda', description: 'Serverless functions', category: 'Cloud', color: '#ff9900', icon: '⚡' },
  { id: 'gcp', name: 'Google Cloud', description: 'GCP services', category: 'Cloud', color: '#4285f4', icon: '☁️' },
  { id: 'azure', name: 'Microsoft Azure', description: 'Azure services', category: 'Cloud', color: '#0089d6', icon: '☁️' },
  { id: 'cloudflare', name: 'Cloudflare', description: 'CDN and security', category: 'Cloud', color: '#f48120', icon: '🌐' },
  
  // ============= FILES =============
  { id: 'google_drive', name: 'Google Drive', description: 'Drive file storage', category: 'Files', color: '#4285f4', icon: '📁' },
  { id: 'dropbox', name: 'Dropbox', description: 'Dropbox files', category: 'Files', color: '#0061ff', icon: '📦' },
  { id: 'onedrive', name: 'OneDrive', description: 'Microsoft OneDrive', category: 'Files', color: '#0078d4', icon: '☁️' },
  { id: 'ftp', name: 'FTP', description: 'FTP file transfer', category: 'Files', color: '#666666', icon: '📁' },
  { id: 'sftp', name: 'SFTP', description: 'Secure file transfer', category: 'Files', color: '#666666', icon: '🔐' },
  
  // ============= DATABASES =============
  { id: 'postgres', name: 'PostgreSQL', description: 'Query PostgreSQL', category: 'Databases', color: '#336791', icon: '🐘' },
  { id: 'mysql', name: 'MySQL', description: 'Query MySQL', category: 'Databases', color: '#4479a1', icon: '🐬' },
  { id: 'mongodb', name: 'MongoDB', description: 'Query MongoDB', category: 'Databases', color: '#47a248', icon: '🍃' },
  { id: 'redis', name: 'Redis', description: 'Redis operations', category: 'Databases', color: '#dc382d', icon: '⚡' },
  { id: 'elasticsearch', name: 'Elasticsearch', description: 'Search and analytics', category: 'Databases', color: '#005571', icon: '🔍' },
  { id: 'supabase', name: 'Supabase', description: 'Supabase backend', category: 'Databases', color: '#3ecf8e', icon: '⚡' },
  { id: 'firebase', name: 'Firebase', description: 'Firebase services', category: 'Databases', color: '#ffca28', icon: '🔥' },
  
  // ============= UTILITIES =============
  { id: 'wait', name: 'Wait', description: 'Pause execution', category: 'Utilities', color: '#888888', icon: '⏸️' },
  { id: 'error_handler', name: 'Error Handler', description: 'Handle workflow errors', category: 'Utilities', color: '#dc3545', icon: '🚨' },
  { id: 'sub_workflow', name: 'Sub-Workflow', description: 'Run another workflow', category: 'Utilities', color: '#6c757d', icon: '🔄' },
  { id: 'write_file', name: 'Write File', description: 'Write to local file', category: 'Utilities', color: '#888888', icon: '✍️' },
  { id: 'read_file', name: 'Read File', description: 'Read local file', category: 'Utilities', color: '#888888', icon: '📖' },
  { id: 'execute_command', name: 'Execute Command', description: 'Run shell commands', category: 'Utilities', color: '#333333', icon: '💻' },
  { id: 'compression', name: 'Compression', description: 'Zip/unzip files', category: 'Utilities', color: '#888888', icon: '📦' },
];

interface NodePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAddNode: (nodeType: NodeType) => void;
}

export default function NodePanel({ isOpen, onClose, onAddNode }: NodePanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = Array.from(new Set(nodeTypes.map(n => n.category)));

  const filteredNodes = nodeTypes.filter(node => {
    const matchesSearch = node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          node.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || node.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedNodes = filteredNodes.reduce((acc, node) => {
    if (!acc[node.category]) {
      acc[node.category] = [];
    }
    acc[node.category].push(node);
    return acc;
  }, {} as Record<string, NodeType[]>);

  if (!isOpen) return null;

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-card border-l border-border shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Add Node</h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-muted rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 p-2 border-b border-border overflow-x-auto">
        <button
          onClick={() => setSelectedCategory(null)}
          className={cn(
            "px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors",
            !selectedCategory ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
          )}
        >
          All
        </button>
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={cn(
              "px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors",
              selectedCategory === category ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            )}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Node List */}
      <div className="flex-1 overflow-auto p-2">
        {Object.entries(groupedNodes).map(([category, nodes]) => (
          <div key={category} className="mb-4">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 mb-2">
              {category}
            </h4>
            <div className="space-y-1">
              {nodes.map(node => (
                <button
                  key={node.id}
                  onClick={() => onAddNode(node)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left group"
                >
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                    style={{ backgroundColor: `${node.color}20` }}
                  >
                    {node.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm group-hover:text-primary transition-colors truncate">
                      {node.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {node.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}

        {Object.keys(groupedNodes).length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Search className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No nodes found</p>
          </div>
        )}
      </div>
    </div>
  );
}
