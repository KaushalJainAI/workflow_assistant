import { useState, useEffect } from 'react';
import { 
  X, 
  Cpu, 
  Terminal, 
  Globe, 
  Save, 
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Info
} from 'lucide-react';
import { mcpService, type MCPServer, type MCPServerType, type CreateMCPServerData } from '../../api/mcp';
import { credentialsService, type CredentialType } from '../../api/credentials';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

interface MCPServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (server: MCPServer) => void;
  initialData?: MCPServer | null;
}

export default function MCPServerModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: MCPServerModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<MCPServerType>('stdio');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState<string>('[]');
  const [url, setUrl] = useState('');
  const [env, setEnv] = useState<string>('{}');
  const [credEnvMap, setCredEnvMap] = useState<string>('{}');
  const [credHeaderMap, setCredHeaderMap] = useState<string>('{}');
  const [requiredCreds, setRequiredCreds] = useState<string[]>([]);
  const [setupNotes, setSetupNotes] = useState('');
  const [enabled, setEnabled] = useState(true);
  
  const [credentialTypes, setCredentialTypes] = useState<CredentialType[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCredTypes = async () => {
      try {
        const res = await credentialsService.getTypes();
        setCredentialTypes(res.types);
      } catch (err) {
        console.error('Failed to fetch credential types', err);
      }
    };
    if (isOpen) {
      fetchCredTypes();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (initialData) {
        setName(initialData.name);
        setType(initialData.type);
        setCommand(initialData.command || '');
        setArgs(JSON.stringify(initialData.args || [], null, 2));
        setUrl(initialData.url || '');
        setEnv(JSON.stringify(initialData.env || {}, null, 2));
        setCredEnvMap(JSON.stringify(initialData.credential_env_map || {}, null, 2));
        setCredHeaderMap(JSON.stringify(initialData.credential_header_map || {}, null, 2));
        setRequiredCreds(initialData.required_credential_types || []);
        setSetupNotes(initialData.setup_notes || '');
        setEnabled(initialData.enabled);
      } else {
        setName('');
        setType('stdio');
        setCommand('');
        setArgs('[]');
        setUrl('');
        setEnv('{}');
        setCredEnvMap('{}');
        setCredHeaderMap('{}');
        setRequiredCreds([]);
        setSetupNotes('');
        setEnabled(true);
      }
    }
  }, [isOpen, initialData]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Validate JSON fields
      let parsedArgs = [];
      let parsedEnv = {};
      let parsedCredEnvMap = {};
      let parsedCredHeaderMap = {};

      try {
        parsedArgs = JSON.parse(args);
        if (!Array.isArray(parsedArgs)) throw new Error('Args must be an array');
      } catch (e) {
        setError('Invalid JSON in Args: must be an array of strings');
        setSaving(false);
        return;
      }

      try {
        parsedEnv = JSON.parse(env);
        if (typeof parsedEnv !== 'object' || Array.isArray(parsedEnv)) throw new Error('Env must be an object');
      } catch (e) {
        setError('Invalid JSON in Env: must be an object');
        setSaving(false);
        return;
      }

      try {
        parsedCredEnvMap = JSON.parse(credEnvMap);
        if (typeof parsedCredEnvMap !== 'object' || Array.isArray(parsedCredEnvMap)) throw new Error('Cred Env Map must be an object');
      } catch (e) {
        setError('Invalid JSON in Credential Env Map');
        setSaving(false);
        return;
      }

      try {
        parsedCredHeaderMap = JSON.parse(credHeaderMap);
        if (typeof parsedCredHeaderMap !== 'object' || Array.isArray(parsedCredHeaderMap)) throw new Error('Cred Header Map must be an object');
      } catch (e) {
        setError('Invalid JSON in Credential Header Map');
        setSaving(false);
        return;
      }

      const serverData: CreateMCPServerData = {
        name,
        type,
        command: type === 'stdio' ? command : undefined,
        args: type === 'stdio' ? parsedArgs : undefined,
        url: type === 'sse' ? url : undefined,
        env: parsedEnv as Record<string, string>,
        required_credential_types: requiredCreds,
        credential_env_map: type === 'stdio' ? (parsedCredEnvMap as Record<string, string>) : undefined,
        credential_header_map: type === 'sse' ? (parsedCredHeaderMap as Record<string, string>) : undefined,
        setup_notes: setupNotes,
        enabled,
      };

      let result: MCPServer;
      if (initialData) {
        result = await mcpService.update(initialData.id, serverData);
        toast.success('MCP Server updated');
      } else {
        result = await mcpService.create(serverData);
        toast.success('MCP Server registered');
      }

      if (onSave) onSave(result);
      onClose();
    } catch (err: any) {
      console.error('Save failed', err);
      const msg = err.response?.data?.error || err.message || 'Failed to save MCP server';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleCred = (slug: string) => {
    if (requiredCreds.includes(slug)) {
      setRequiredCreds(requiredCreds.filter(s => s !== slug));
    } else {
      setRequiredCreds([...requiredCreds, slug]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
      <div className="bg-card border border-border/60 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-border/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                {initialData ? 'Edit MCP Server' : 'Register MCP Server'}
              </h2>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
                Model Context Protocol Configuration
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
          {error && (
            <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="font-medium">{error}</div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-bold mb-2">Server Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. GitHub MCP"
                  className="w-full px-4 py-2.5 bg-background border border-border/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                />
              </div>

              {/* Type Selection */}
              <div>
                <label className="block text-sm font-bold mb-3">Connection Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setType('stdio')}
                    className={cn(
                      "flex items-center justify-center gap-2 p-3 border rounded-xl transition-all font-semibold text-sm",
                      type === 'stdio' 
                        ? "bg-primary/10 border-primary text-primary" 
                        : "border-border/60 hover:border-border hover:bg-muted/50"
                    )}
                  >
                    <Terminal className="w-4 h-4" />
                    Stdio
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('sse')}
                    className={cn(
                      "flex items-center justify-center gap-2 p-3 border rounded-xl transition-all font-semibold text-sm",
                      type === 'sse' 
                        ? "bg-primary/10 border-primary text-primary" 
                        : "border-border/60 hover:border-border hover:bg-muted/50"
                    )}
                  >
                    <Globe className="w-4 h-4" />
                    SSE
                  </button>
                </div>
              </div>

              {/* Server Specific Config */}
              {type === 'stdio' ? (
                <>
                  <div>
                    <label className="block text-sm font-bold mb-2">Command</label>
                    <input
                      type="text"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      placeholder="e.g. npx, python, node"
                      className="w-full px-4 py-2.5 bg-background border border-border/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2 flex items-center justify-between">
                      Arguments
                      <span className="text-[10px] text-muted-foreground uppercase">JSON Array</span>
                    </label>
                    <textarea
                      value={args}
                      onChange={(e) => setArgs(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-background border border-border/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-mono custom-scrollbar"
                      placeholder='["-y", "@modelcontextprotocol/server-github"]'
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-bold mb-2">End-point URL</label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://mcp.example.com/sse"
                    className="w-full px-4 py-2.5 bg-background border border-border/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                  />
                </div>
              )}

              {/* Status */}
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/40">
                <div>
                  <div className="text-sm font-bold">Enabled</div>
                  <div className="text-xs text-muted-foreground">Active for this user</div>
                </div>
                <button
                  type="button"
                  onClick={() => setEnabled(!enabled)}
                  className={cn(
                    "transition-colors duration-200",
                    enabled ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {enabled ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10" />}
                </button>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Credentials Selection */}
              <div>
                <label className="block text-sm font-bold mb-2 flex items-center gap-2">
                  Required Credentials
                  <div className="group relative">
                    <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-border shadow-sm z-50">
                      Credentials required by the AI when interacting with this server
                    </div>
                  </div>
                </label>
                <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                  {credentialTypes.map((ct) => (
                    <button
                      key={ct.slug}
                      type="button"
                      onClick={() => toggleCred(ct.slug)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all",
                        requiredCreds.includes(ct.slug)
                          ? "bg-primary/5 border-primary/30 text-primary shadow-sm ring-1 ring-primary/20"
                          : "border-border/40 hover:bg-muted/50"
                      )}
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        requiredCreds.includes(ct.slug) ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" : "bg-muted-foreground/30"
                      )} />
                      <span className="font-medium">{ct.name}</span>
                    </button>
                  ))}
                  {credentialTypes.length === 0 && (
                    <p className="text-xs text-muted-foreground italic py-2">No credential types defined.</p>
                  )}
                </div>
              </div>

              {/* JSON Configs */}
              <div>
                <label className="block text-sm font-bold mb-2 flex items-center justify-between">
                  Environment Vars
                  <span className="text-[10px] text-muted-foreground uppercase">JSON Object</span>
                </label>
                <textarea
                  value={env}
                  onChange={(e) => setEnv(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-background border border-border/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-mono custom-scrollbar"
                  placeholder='{"DEBUG": "true"}'
                />
              </div>

              {type === 'stdio' ? (
                <div>
                  <label className="block text-sm font-bold mb-2 flex items-center justify-between">
                    Credential Env Map
                    <span className="text-[10px] text-muted-foreground uppercase font-medium">Map env → cred:field</span>
                  </label>
                  <textarea
                    value={credEnvMap}
                    onChange={(e) => setCredEnvMap(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 bg-background border border-border/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-mono custom-scrollbar"
                    placeholder='{"GITHUB_TOKEN": "github:token"}'
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-bold mb-2 flex items-center justify-between">
                    Header Map
                    <span className="text-[10px] text-muted-foreground uppercase">Authorization, etc.</span>
                  </label>
                  <textarea
                    value={credHeaderMap}
                    onChange={(e) => setCredHeaderMap(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 bg-background border border-border/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-mono custom-scrollbar"
                    placeholder='{"Authorization": "Bearer {github:token}"}'
                  />
                </div>
              )}
            </div>
          </div>

          {/* Setup Notes */}
          <div>
            <label className="block text-sm font-bold mb-2">Setup Notes</label>
            <textarea
              value={setupNotes}
              onChange={(e) => setSetupNotes(e.target.value)}
              rows={3}
              placeholder="Internal notes about how this server is configured..."
              className="w-full px-4 py-3 bg-background border border-border/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border/40 flex justify-end gap-3 shrink-0 bg-muted/20 rounded-b-2xl">
          <button 
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 border border-border/60 rounded-xl font-bold text-sm hover:bg-muted transition-all active:scale-95"
            disabled={saving}
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="px-8 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2 active:scale-95 disabled:opacity-70 disabled:active:scale-100"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {initialData ? 'Update Server' : 'Register Server'}
          </button>
        </div>
      </div>
    </div>
  );
}
