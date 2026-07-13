import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Circle,
  Loader2,
  X,
  Eye,
  EyeOff,
  HardDrive,
  Mail,
  Calendar,
  Table2,
  FileText,
  BookOpen,
  FolderOpen,
  Globe,
  Brain,
  GitBranch,
  Plug,
  ExternalLink,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Zap,
  Hash,
} from 'lucide-react';
import { toast } from 'sonner';
import { credentialsService, type CredentialType, type Credential, type CredentialFieldSchema } from '../api/credentials';
import { mcpService, type MCPServer } from '../api/mcp';
import { cn } from '../lib/utils';

// ---------------------------------------------------------------------------
// Connector display metadata — maps MCP server name → icon / category / copy
// ---------------------------------------------------------------------------

interface ConnectorMeta {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  darkBgColor: string;
  category: 'Google Workspace' | 'Communication' | 'Productivity' | 'Utilities';
  tagline: string;
  helpUrl?: string;
}

const CONNECTOR_META: Record<string, ConnectorMeta> = {
  'Google Drive': {
    icon: HardDrive,
    color: '#1a73e8',
    bgColor: '#e8f0fe',
    darkBgColor: 'rgba(26,115,232,0.12)',
    category: 'Google Workspace',
    tagline: 'Search, read, and manage files in your Drive',
    helpUrl: 'https://console.cloud.google.com/apis/credentials',
  },
  'Gmail': {
    icon: Mail,
    color: '#ea4335',
    bgColor: '#fce8e6',
    darkBgColor: 'rgba(234,67,53,0.12)',
    category: 'Google Workspace',
    tagline: 'Read, search, and send emails via Gmail',
    helpUrl: 'https://console.cloud.google.com/apis/credentials',
  },
  'Google Calendar': {
    icon: Calendar,
    color: '#0f9d58',
    bgColor: '#e6f4ea',
    darkBgColor: 'rgba(15,157,88,0.12)',
    category: 'Google Workspace',
    tagline: 'List, create, and update calendar events',
    helpUrl: 'https://console.cloud.google.com/apis/credentials',
  },
  'Google Sheets': {
    icon: Table2,
    color: '#0f9d58',
    bgColor: '#e6f4ea',
    darkBgColor: 'rgba(15,157,88,0.12)',
    category: 'Google Workspace',
    tagline: 'Read and write spreadsheet data',
    helpUrl: 'https://console.cloud.google.com/apis/credentials',
  },
  'Google Docs': {
    icon: FileText,
    color: '#1a73e8',
    bgColor: '#e8f0fe',
    darkBgColor: 'rgba(26,115,232,0.12)',
    category: 'Google Workspace',
    tagline: 'Read and edit documents',
    helpUrl: 'https://console.cloud.google.com/apis/credentials',
  },
  'Notion': {
    icon: BookOpen,
    color: '#000000',
    bgColor: '#f7f7f5',
    darkBgColor: 'rgba(255,255,255,0.08)',
    category: 'Productivity',
    tagline: 'Search and update pages and databases',
    helpUrl: 'https://www.notion.so/my-integrations',
  },
  'Slack': {
    icon: Hash,
    color: '#4A154B',
    bgColor: '#f4ede4',
    darkBgColor: 'rgba(74,21,75,0.15)',
    category: 'Communication',
    tagline: 'Read and post messages in Slack channels',
    helpUrl: 'https://api.slack.com/apps',
  },
  'Filesystem': {
    icon: FolderOpen,
    color: '#7c3aed',
    bgColor: '#f5f3ff',
    darkBgColor: 'rgba(124,58,237,0.12)',
    category: 'Utilities',
    tagline: 'Read and write local files — always available',
  },
  'Fetch': {
    icon: Globe,
    color: '#0ea5e9',
    bgColor: '#e0f2fe',
    darkBgColor: 'rgba(14,165,233,0.12)',
    category: 'Utilities',
    tagline: 'Fetch content from any public URL — always available',
  },
  'Memory': {
    icon: Brain,
    color: '#ec4899',
    bgColor: '#fce7f3',
    darkBgColor: 'rgba(236,72,153,0.12)',
    category: 'Utilities',
    tagline: 'Persistent key-value memory across sessions — always available',
  },
  'Sequential Thinking': {
    icon: GitBranch,
    color: '#f59e0b',
    bgColor: '#fef3c7',
    darkBgColor: 'rgba(245,158,11,0.12)',
    category: 'Utilities',
    tagline: 'Structured reasoning for complex problems — always available',
  },
};

const CATEGORY_ORDER: ConnectorMeta['category'][] = [
  'Google Workspace',
  'Communication',
  'Productivity',
  'Utilities',
];

const CATEGORY_DESCRIPTIONS: Record<ConnectorMeta['category'], string> = {
  'Google Workspace': 'Connect your Google account to give the AI access to Drive, Gmail, Calendar, Sheets, and Docs.',
  'Communication': 'Connect messaging platforms so the AI can read and post on your behalf.',
  'Productivity': 'Connect knowledge and task tools your team already uses.',
  'Utilities': 'Built-in tools that are always active — no setup needed.',
};

// ---------------------------------------------------------------------------
// Connect modal
// ---------------------------------------------------------------------------

interface ConnectModalProps {
  server: MCPServer;
  credType: CredentialType;
  onClose: () => void;
  onConnected: () => void;
  // If the user already has a cred for this type (shared across Google services)
  existingCredId?: number;
}

function ConnectModal({ server, credType, onClose, onConnected, existingCredId }: ConnectModalProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = CONNECTOR_META[server.name];
  const Icon = meta?.icon ?? Plug;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    for (const field of credType.fields_schema) {
      if (field.required && !formData[field.name]?.trim()) {
        setError(`"${field.label}" is required.`);
        return;
      }
    }

    try {
      setSaving(true);
      await credentialsService.create({
        name: `${server.name} — ${new Date().toLocaleDateString()}`,
        credential_type: credType.id,
        data: formData,
      });
      toast.success(`${server.name} connected`);
      onConnected();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to save credentials. Check your values and try again.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleShow = (name: string) =>
    setShowValues((prev) => ({ ...prev, [name]: !prev[name] }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center gap-4 p-6 border-b border-border/60">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: meta?.darkBgColor ?? 'rgba(255,255,255,0.08)' }}
          >
            <Icon style={{ color: meta?.color ?? 'currentColor' }} className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-lg text-foreground">Connect {server.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{meta?.tagline}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Already-shared credential note (Google services) */}
          {existingCredId && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm text-blue-400">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                Your Google account is already connected. Saving here will add an additional set of credentials.
              </span>
            </div>
          )}

          {credType.fields_schema.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No credentials are required for this connector. It is always active.
            </p>
          ) : (
            credType.fields_schema.map((field: CredentialFieldSchema) => (
              <div key={field.name}>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </label>
                <div className="relative">
                  <input
                    type={field.type === 'password' && !showValues[field.name] ? 'password' : 'text'}
                    value={formData[field.name] ?? ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, [field.name]: e.target.value }))
                    }
                    placeholder={field.placeholder ?? ''}
                    className="w-full px-4 py-2.5 bg-background border border-border/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-mono pr-10"
                    autoComplete="off"
                  />
                  {field.type === 'password' && (
                    <button
                      type="button"
                      onClick={() => toggleShow(field.name)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showValues[field.name] ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Help link */}
          {meta?.helpUrl && (
            <a
              href={meta.helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              Where do I find these credentials?
            </a>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border/60 text-sm font-semibold hover:bg-muted/50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || credType.fields_schema.length === 0}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Connect'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single connector card
// ---------------------------------------------------------------------------

type ConnectorStatus = 'active' | 'connected' | 'disconnected';

interface ConnectorCardProps {
  server: MCPServer;
  status: ConnectorStatus;
  userCred: Credential | null;
  onConnect: () => void;
  onDisconnect: () => void;
  disconnecting: boolean;
}

function ConnectorCard({
  server,
  status,
  userCred: _userCred,
  onConnect,
  onDisconnect,
  disconnecting,
}: ConnectorCardProps) {
  const meta = CONNECTOR_META[server.name];
  const Icon = meta?.icon ?? Plug;

  const statusConfig = {
    active: {
      label: 'Always Active',
      dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]',
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
    connected: {
      label: 'Connected',
      dot: 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]',
      badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    },
    disconnected: {
      label: 'Not connected',
      dot: 'bg-muted-foreground/30',
      badge: 'bg-muted/60 text-muted-foreground border-border/40',
    },
  }[status];

  return (
    <div
      className={cn(
        'group relative bg-card border rounded-2xl p-5 flex flex-col gap-4 transition-all duration-200',
        status === 'disconnected'
          ? 'border-border/50 hover:border-primary/30 hover:shadow-lg'
          : 'border-border/60',
      )}
    >
      {/* Icon + name row */}
      <div className="flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
          style={{ backgroundColor: meta?.darkBgColor ?? 'rgba(255,255,255,0.08)' }}
        >
          <Icon style={{ color: meta?.color ?? 'currentColor' }} className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-foreground leading-tight">{server.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{meta?.tagline}</p>
        </div>
      </div>

      {/* Status + action row */}
      <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/40">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border',
            statusConfig.badge,
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', statusConfig.dot)} />
          {statusConfig.label}
        </span>

        {status === 'active' ? (
          <span className="text-[10px] text-muted-foreground font-medium">No setup needed</span>
        ) : status === 'connected' ? (
          <button
            onClick={onDisconnect}
            disabled={disconnecting}
            className="text-[11px] font-semibold text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {disconnecting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              'Disconnect'
            )}
          </button>
        ) : (
          <button
            onClick={onConnect}
            className="text-[11px] font-bold text-primary hover:underline transition-colors flex items-center gap-1"
          >
            Connect
            <Zap className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category section with collapse toggle
// ---------------------------------------------------------------------------

function CategorySection({
  title,
  description,
  children,
  defaultOpen = true,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between group mb-4"
      >
        <div className="text-left">
          <h2 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
            {title}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {open && children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Connectors() {
  const queryClient = useQueryClient();
  const [connectingServer, setConnectingServer] = useState<MCPServer | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<number | null>(null);

  // Fetch all data in parallel
  const { data: serversData, isLoading: serversLoading } = useQuery({
    queryKey: ['mcpServers'],
    queryFn: () => mcpService.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: credsData, isLoading: credsLoading } = useQuery({
    queryKey: ['credentials'],
    queryFn: () => credentialsService.list(),
    staleTime: 60 * 1000,
  });

  const { data: typesData, isLoading: typesLoading } = useQuery({
    queryKey: ['credentialTypes'],
    queryFn: () => credentialsService.getTypes(),
    staleTime: 10 * 60 * 1000,
  });

  const isLoading = serversLoading || credsLoading || typesLoading;

  // Index lookups
  const credTypeBySlug = useMemo(() => {
    const map = new Map<string, CredentialType>();
    (typesData?.types ?? []).forEach((ct) => map.set(ct.slug, ct));
    return map;
  }, [typesData]);

  const userCredByTypeId = useMemo(() => {
    const map = new Map<number, Credential>();
    (credsData?.credentials ?? []).forEach((c) => {
      // Keep the most recently updated credential per type
      const existing = map.get(c.credential_type);
      if (!existing || new Date(c.updated_at) > new Date(existing.updated_at)) {
        map.set(c.credential_type, c);
      }
    });
    return map;
  }, [credsData]);

  // Only show system servers (user === null) — the curated set
  const systemServers = useMemo(
    () => (serversData?.servers ?? []).filter((s) => s.user === null),
    [serversData],
  );

  function getStatus(server: MCPServer): ConnectorStatus {
    if (!server.required_credential_types?.length) return 'active';
    const slug = server.required_credential_types[0];
    const ct = credTypeBySlug.get(slug);
    if (!ct) return 'disconnected';
    return userCredByTypeId.has(ct.id) ? 'connected' : 'disconnected';
  }

  function getCredType(server: MCPServer): CredentialType | null {
    const slug = server.required_credential_types?.[0];
    if (!slug) return null;
    return credTypeBySlug.get(slug) ?? null;
  }

  function getUserCred(server: MCPServer): Credential | null {
    const ct = getCredType(server);
    if (!ct) return null;
    return userCredByTypeId.get(ct.id) ?? null;
  }

  const disconnectMutation = useMutation({
    mutationFn: (credId: number) => credentialsService.delete(credId),
    onSuccess: (_data, credId) => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      toast.success('Disconnected');
      setDisconnectingId(null);
      // Figure out which server this was so we can name it in the toast
      void credId;
    },
    onError: () => {
      toast.error('Failed to disconnect. The credential may be used by an active workflow.');
      setDisconnectingId(null);
    },
  });

  const handleDisconnect = (server: MCPServer) => {
    const cred = getUserCred(server);
    if (!cred) return;
    setDisconnectingId(cred.id);
    disconnectMutation.mutate(cred.id);
  };

  // Group servers by category
  const serversByCategory = useMemo(() => {
    const map = new Map<ConnectorMeta['category'], MCPServer[]>();
    CATEGORY_ORDER.forEach((cat) => map.set(cat, []));
    systemServers.forEach((s) => {
      const cat = CONNECTOR_META[s.name]?.category ?? 'Utilities';
      map.get(cat)?.push(s);
    });
    return map;
  }, [systemServers]);

  const connectedCount = useMemo(
    () => systemServers.filter((s) => getStatus(s) === 'connected').length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [systemServers, userCredByTypeId, credTypeBySlug],
  );

  const connectingCredType = connectingServer ? getCredType(connectingServer) : null;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex-shrink-0 px-8 pt-8 pb-6 border-b border-border/40">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Connectors</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Connect your services and the AI will be able to use them on your behalf.
            </p>
          </div>
          {connectedCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pb-1">
              <CheckCircle2 className="w-4 h-4 text-blue-400" />
              <span>
                <span className="font-bold text-foreground">{connectedCount}</span> connected
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-8 space-y-10">
        {CATEGORY_ORDER.map((category) => {
          const servers = serversByCategory.get(category) ?? [];
          if (servers.length === 0) return null;
          return (
            <CategorySection
              key={category}
              title={category}
              description={CATEGORY_DESCRIPTIONS[category]}
              defaultOpen={category !== 'Utilities'}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {servers.map((server) => {
                  const status = getStatus(server);
                  const userCred = getUserCred(server);
                  return (
                    <ConnectorCard
                      key={server.id}
                      server={server}
                      status={status}
                      userCred={userCred}
                      onConnect={() => setConnectingServer(server)}
                      onDisconnect={() => handleDisconnect(server)}
                      disconnecting={disconnectingId === userCred?.id}
                    />
                  );
                })}
              </div>
            </CategorySection>
          );
        })}

        {systemServers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Circle className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-semibold text-foreground">No connectors available</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ask an administrator to set up system connectors.
            </p>
          </div>
        )}
      </div>

      {/* Connect modal */}
      {connectingServer && connectingCredType && (
        <ConnectModal
          server={connectingServer}
          credType={connectingCredType}
          existingCredId={getUserCred(connectingServer)?.id}
          onClose={() => setConnectingServer(null)}
          onConnected={() => {
            queryClient.invalidateQueries({ queryKey: ['credentials'] });
            setConnectingServer(null);
          }}
        />
      )}
    </div>
  );
}
