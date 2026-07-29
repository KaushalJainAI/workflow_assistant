import { useState } from 'react';
import { 
  Plus, 
  MoreVertical,
  Cpu,
  Terminal,
  Globe,
  Edit,
  Trash2,
  AlertCircle,
  Check,
  ToggleLeft,
  ToggleRight,
  ShieldCheck
} from 'lucide-react';
import { mcpService, type MCPServer } from '../api/mcp';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import MCPServerModal from '../components/mcp/MCPServerModal';
import PageHeader from '../components/layout/PageHeader';
import SearchInput from '../components/ui/SearchInput';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

export default function MCPServers() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['mcpServers'],
    queryFn: () => mcpService.list(),
    staleTime: 5 * 60 * 1000,
  });

  const servers = data?.servers || [];

  const filteredServers = servers.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteServer = async (id: number) => {
    try {
      await mcpService.delete(id);
      setShowDeleteConfirm(null);
      setOpenDropdown(null);
      queryClient.invalidateQueries({ queryKey: ['mcpServers'] });
      toast.success('MCP Server removed');
    } catch (err) {
      console.error('Failed to delete server', err);
      toast.error('Failed to delete server');
    }
  };

  const handleToggleServer = async (server: MCPServer) => {
    try {
      await mcpService.update(server.id, { enabled: !server.enabled });
      queryClient.invalidateQueries({ queryKey: ['mcpServers'] });
      toast.success(`Server ${!server.enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      console.error('Toggle failed', err);
      toast.error('Failed to update server status');
    }
  };

  const renderServerCard = (server: MCPServer) => (
    <div
      key={server.id}
      className={cn(
        "group relative bg-card border rounded-2xl p-6 transition-all cursor-pointer flex flex-col h-full",
        server.enabled ? "border-border/60 hover:border-primary/40 hover:shadow-xl hover:-translate-y-1" : "border-dashed border-border opacity-70 grayscale-[0.5]"
      )}
      onClick={() => {
        setEditingServer(server);
        setShowModal(true);
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className={cn(
            "p-3 rounded-xl transition-colors shrink-0",
            server.enabled ? "bg-primary/10 text-primary group-hover:bg-primary/20" : "bg-muted text-muted-foreground"
          )}>
            {server.type === 'stdio' ? <Terminal className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-lg text-foreground mb-0.5 group-hover:text-primary transition-colors truncate">
              {server.name}
            </h3>
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold  px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                    {server.type}
                </span>
                {server.required_credential_types && server.required_credential_types.length > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-primary/70 font-bold uppercase">
                        <ShieldCheck className="w-3 h-3" />
                        {server.required_credential_types.length} Auth
                    </div>
                )}
            </div>
          </div>
        </div>
        
        <div className="relative flex items-center gap-1">
          <button
            onClick={(e) => {
                e.stopPropagation();
                handleToggleServer(server);
            }}
            className={cn(
                "p-1.5 rounded-lg transition-all",
                server.enabled ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-muted"
            )}
            title={server.enabled ? "Disable Server" : "Enable Server"}
          >
            {server.enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
          </button>
          
          <button 
            className="p-1.5 hover:bg-muted rounded-lg opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              setOpenDropdown(openDropdown === server.id ? null : server.id);
            }}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          
          {openDropdown === server.id && (
            <div className="absolute right-0 top-full mt-1 bg-card border border-border/60 rounded-xl shadow-2xl z-20 py-1 min-w-[140px] animate-in zoom-in-95 duration-100 origin-top-right">
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted font-medium transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingServer(server);
                  setShowModal(true);
                  setOpenDropdown(null);
                }}
              >
                <Edit className="w-4 h-4" />
                Edit Server
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted font-medium text-destructive transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(server.id);
                  setOpenDropdown(null);
                }}
              >
                <Trash2 className="w-4 h-4" />
                Remove
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 text-sm text-muted-foreground line-clamp-2 italic font-light mb-4">
        {server.setup_notes || 'No setup notes provided.'}
      </div>

      <div className="mt-auto pt-4 border-t border-border/60 flex items-center justify-between text-[10px] font-bold  text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className={cn("w-1.5 h-1.5 rounded-full", server.enabled ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-muted-foreground/30")} />
          {server.enabled ? 'Active' : 'Disabled'}
        </div>
        <span>Updated {new Date(server.updated_at).toLocaleDateString()}</span>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-background/50">
      <PageHeader 
        title="MCP Servers"
        subtitle="Configure Model Context Protocol servers to expand your agents' capabilities"
        icon={Cpu}
        actions={
          <button 
            onClick={() => {
                setEditingServer(null);
                setShowModal(true);
            }}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold transition-all shadow-lg shadow-primary/20 active:scale-95 hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            Register Server
          </button>
        }
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 text-sm font-bold text-primary">
                <Check className="w-4 h-4" />
                All Servers ({servers.length})
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                <ShieldCheck className="w-4 h-4" />
                Active ({servers.filter(s => s.enabled).length})
            </div>
          </div>

          <div className="flex items-center justify-end">
            <div className="relative w-full md:w-[350px]">
              <SearchInput 
                placeholder="Search MCP servers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </PageHeader>
      
      {error && (
        <div className="mx-8 mt-4 bg-destructive/10 text-destructive p-4 rounded-xl border border-destructive/20 flex items-center gap-3">
           <AlertCircle className="w-5 h-5 shrink-0" />
           <p className="text-sm font-medium">Failed to load MCP servers. Please try again later.</p>
        </div>
      )}

      {/* Content Grid */}
      <div className="flex-1 overflow-auto p-4 md:p-8 custom-scrollbar">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-[200px] bg-card/40 border border-border/40 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredServers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {filteredServers.map(renderServerCard)}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
            <div className="w-24 h-24 rounded-full bg-muted/30 flex items-center justify-center mb-8 border border-border/40">
                <Cpu className="w-12 h-12 text-muted-foreground/40" />
            </div>
            <h3 className="text-2xl font-bold mb-3 tracking-tight">
              {searchQuery ? "No matching servers" : "No MCP Servers registered"}
            </h3>
            <p className="text-muted-foreground mb-8 max-w-sm font-medium leading-relaxed">
              {searchQuery 
                ? "We couldn't find any MCP servers matching your search criteria." 
                : "Register MCP servers to provide your AI agents with real-world context and tools. Access GitHub, Google, local files, and more."}
            </p>
            {!searchQuery && (
              <button 
                onClick={() => {
                    setEditingServer(null);
                    setShowModal(true);
                }}
                className="flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-xl shadow-primary/25 active:scale-95 font-bold"
              >
                <Plus className="w-5 h-5" />
                Register Your First Server
              </button>
            )}
          </div>
        )}
      </div>

      <MCPServerModal 
        isOpen={showModal}
        onClose={() => {
            setShowModal(false);
            setEditingServer(null);
        }}
        initialData={editingServer}
        onSave={() => queryClient.invalidateQueries({ queryKey: ['mcpServers'] })}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] animate-in fade-in duration-200">
          <div className="bg-card border border-border/60 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-8 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-6 mx-auto">
                <Trash2 className="w-8 h-8 text-destructive" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-center tracking-tight">Remove MCP server?</h3>
            <p className="text-muted-foreground mb-8 text-center text-sm font-medium leading-relaxed">
              Are you sure you want to remove this server? This will immediately disconnect its tools and context from your agents.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-3 border border-border/60 rounded-xl font-bold text-sm hover:bg-muted transition-all active:scale-95"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDeleteServer(showDeleteConfirm)}
                className="flex-1 px-4 py-3 bg-destructive text-destructive-foreground rounded-xl font-bold text-sm hover:bg-destructive/90 transition-all shadow-lg shadow-destructive/20 active:scale-95"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
