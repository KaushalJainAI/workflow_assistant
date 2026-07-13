import { useState } from 'react';
import {
  FileText,
  Upload,
  File,
  Image,
  FileJson,
  FileCode,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  Globe,
  Download,
  Database,
  Plus,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { documentsService, kbService, type Document, type KnowledgeBase } from '../api';
import { toast } from '../components/ui/Toast';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '../lib/utils';
import PageHeader from '../components/layout/PageHeader';
import SearchInput from '../components/ui/SearchInput';
import { useAssistant } from '../contexts/AssistantContext';
import { MediaPreview } from '../components/chat/MediaPreview';

export default function Documents() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'personal' | 'public'>('personal');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [localUploadingDocs, setLocalUploadingDocs] = useState<Document[]>([]);
  const [showCreateKb, setShowCreateKb] = useState(false);
  const [newKbName, setNewKbName] = useState('');
  const [newKbDesc, setNewKbDesc] = useState('');
  const [kbCreating, setKbCreating] = useState(false);
  const [deletingKbId, setDeletingKbId] = useState<number | null>(null);
  const { isAssistantOpen } = useAssistant();
  const queryClient = useQueryClient();

  const { data: kbsData, isLoading: kbsLoading } = useQuery({
    queryKey: ['knowledge-bases'],
    queryFn: () => kbService.list(),
    staleTime: 30_000,
  });
  const kbs: KnowledgeBase[] = kbsData ?? [];

  const handleCreateKb = async () => {
    if (!newKbName.trim()) return;
    setKbCreating(true);
    try {
      await kbService.create(newKbName.trim(), newKbDesc.trim());
      queryClient.invalidateQueries({ queryKey: ['knowledge-bases'] });
      toast.success('Knowledge base created');
      setNewKbName('');
      setNewKbDesc('');
      setShowCreateKb(false);
    } catch (err) {
      toast.error('Failed to create KB', err instanceof Error ? err.message : '');
    } finally {
      setKbCreating(false);
    }
  };

  const handleDeleteKb = async (kb: KnowledgeBase) => {
    if (!window.confirm(`Delete knowledge base "${kb.name}"? This removes all indexed vectors but keeps your documents.`)) return;
    setDeletingKbId(kb.id);
    try {
      await kbService.delete(kb.id);
      queryClient.invalidateQueries({ queryKey: ['knowledge-bases'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success(`KB "${kb.name}" deleted`);
    } catch (err) {
      toast.error('Failed to delete KB', err instanceof Error ? err.message : '');
    } finally {
      setDeletingKbId(null);
    }
  };

  const { data: documentsData, isLoading, error: queryError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['documents', activeTab],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => documentsService.list({
      limit: 50,
      cursor: pageParam,
      scope: activeTab,
    }),
    getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.next_cursor : undefined,
    // Poll every 5 seconds if any doc is pending or processing
    refetchInterval: (query) => {
      const myDocs = query.state.data?.pages.flatMap(page => page.my_documents) || [];
      const hasPending = myDocs.some(d => d.status === 'pending' || d.status === 'processing');
      return hasPending ? 5000 : false;
    },
    staleTime: 5 * 60 * 1000,
  });

  const myDocuments = [
    // Keep locally tracked uploading documents first
    ...localUploadingDocs,
    ...(documentsData?.pages.flatMap(page => page.my_documents) || [])
  ];
  const publicDocuments = documentsData?.pages.flatMap(page => page.public_documents) || [];
  const error = queryError ? (queryError instanceof Error ? queryError.message : 'Failed to load documents') : null;

  const allDocuments = activeTab === 'personal' ? myDocuments : publicDocuments;

  const filteredDocuments = allDocuments.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleUpload = async (files: FileList) => {
    setShowUploadModal(false);
    
    const newFiles = Array.from(files);
    let successCount = 0;

    const optimisticDocs: Document[] = newFiles.map((file, i) => ({
      id: -Date.now() - i,
      title: file.name,
      filename: file.name,
      file_type: file.name.split('.').pop() || 'unknown',
      file_size: file.size,
      chunk_count: 0,
      is_shared: false,
      shared_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'uploading'
    }));

    setLocalUploadingDocs(prev => [...optimisticDocs, ...prev]);

    const uploadPromises = newFiles.map(async (file, index) => {
      const tempId = optimisticDocs[index].id;
      try {
        await documentsService.upload(file);
        successCount++;
      } catch (err) {
        toast.error(`Failed to upload ${file.name}`);
      } finally {
        setLocalUploadingDocs(prev => prev.filter(d => d.id !== tempId));
      }
    });

    await Promise.allSettled(uploadPromises);
    if (successCount > 0) {
      toast.success('Upload initiated', `${successCount} files are being processed.`);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    }
  };

  const handleDelete = async (id: number) => {
    if (id < 0) {
      setLocalUploadingDocs(prev => prev.filter(d => d.id !== id));
      return;
    }

    if (!window.confirm('Are you sure you want to delete this document?')) return;
    
    try {
      await documentsService.delete(id);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document deleted');
    } catch (err) {
      toast.error('Delete failed', err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  // ... (handleShare and helpers remain mostly same, simplified for brevity)
  const [shareConfirmation, setShareConfirmation] = useState<{ isOpen: boolean; doc: Document | null }>({ isOpen: false, doc: null });

  const confirmShare = async () => {
    const doc = shareConfirmation.doc;
    if (!doc) return;

    try {
      const result = await documentsService.toggleSharing(doc.id);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      
      const action = result.is_shared ? 'shared with' : 'unshared from';
      toast.success('Sharing updated', `Document ${action} platform knowledge base`);
    } catch (err) {
      toast.error('Update failed', err instanceof Error ? err.message : 'Failed to update sharing settings');
    } finally {
      setShareConfirmation({ isOpen: false, doc: null });
    }
  };

  const handleShare = async (doc: Document) => {
      // If already shared, we can unshare immediately (or add a simple confirm if desired)
      if (doc.is_shared) {
          try {
            await documentsService.toggleSharing(doc.id);
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            toast.success('Sharing updated', 'Document unshared from platform knowledge base');
          } catch (err) {
            toast.error('Update failed', err instanceof Error ? err.message : 'Failed to update sharing settings');
          }
      } else {
          // Open confirmation modal for making it global
          setShareConfirmation({ isOpen: true, doc });
      }
    };

    const handleDownload = async (doc: Document) => {
      try {
        const blob = await documentsService.download(doc.id);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', doc.filename || doc.title);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
      } catch (err) {
        toast.error('Download failed', err instanceof Error ? err.message : 'Failed to download document');
      }
    };
  
    const getDocIcon = (fileType: string) => {
      const iconClass = "w-8 h-8";
      if (fileType.includes('pdf')) return <FileText className={`${iconClass} text-red-500`} />;
      if (fileType.includes('json')) return <FileJson className={`${iconClass} text-green-500`} />;
      if (fileType.includes('image')) return <Image className={`${iconClass} text-pink-500`} />;
      if (fileType.includes('python') || fileType.includes('javascript')) 
        return <FileCode className={`${iconClass} text-purple-500`} />;
      return <File className={`${iconClass} text-gray-500`} />;
    };
  
    const formatSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };
  
    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString();
    };

    const getStatusParams = (status: Document['status']) => {
        switch(status) {
            case 'uploading': return { color: 'text-blue-500', icon: <Loader2 className="w-4 h-4 animate-spin text-blue-500" />, label: 'Uploading...' };
            case 'pending': return { color: 'text-yellow-500', icon: <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />, label: 'Queued' };
            case 'processing': return { color: 'text-orange-500', icon: <Loader2 className="w-4 h-4 animate-spin text-orange-500" />, label: 'Indexing...' };
            case 'failed': return { color: 'text-destructive', icon: <AlertCircle className="w-4 h-4 text-destructive" />, label: 'Failed' };
            default: return null;
        }
    };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground animate-in fade-in duration-500">
      {/* Header */}
      <PageHeader 
        title="Documents"
        subtitle="Manage your knowledge base assets and RAG sources"
        icon={FileText}
        actions={
          <button 
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold transition-all shadow-lg shadow-primary/20 active:scale-95 hover:bg-primary/90"
          >
            <Upload className="w-4 h-4" />
            Upload Files
          </button>
        }
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <button
              onClick={() => setActiveTab('personal')}
              className={cn(
                "pb-3 text-sm font-semibold transition-all relative",
                activeTab === 'personal' ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              My Documents ({myDocuments.length})
              {activeTab === 'personal' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
            <button
              onClick={() => setActiveTab('public')}
              className={cn(
                "pb-3 text-sm font-semibold transition-all relative",
                activeTab === 'public' ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Public Library ({publicDocuments.length})
              {activeTab === 'public' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-[400px] group">
              <SearchInput
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1 bg-background/50 border border-border/60 rounded-lg p-1">
              <button 
                onClick={() => setViewMode('grid')}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                  viewMode === 'grid' ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Grid
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                  viewMode === 'list' ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                List
              </button>
            </div>
          </div>
        </div>
      </PageHeader>

      <div className={cn(
        "flex-1 overflow-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-white/5 z-10",
        isAssistantOpen && "xl:p-6"
      )}>

        {/* ---- Knowledge Bases section ---- */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Knowledge Bases</h2>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{kbs.length}</span>
            </div>
            <button
              onClick={() => setShowCreateKb(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New KB
            </button>
          </div>

          {kbsLoading ? (
            <div className="flex gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex-1 h-24 bg-card/50 border border-border/40 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : kbs.length === 0 ? (
            <div className="flex items-center gap-3 p-4 bg-card/40 border border-dashed border-border/60 rounded-xl text-sm text-muted-foreground">
              <Database className="w-5 h-5 shrink-0 opacity-50" />
              No knowledge bases yet — one will be created automatically when you upload a file, or click <strong className="text-foreground mx-1">New KB</strong> to create one.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {kbs.map(kb => (
                <div
                  key={kb.id}
                  className={cn(
                    "group relative bg-card border border-border/60 rounded-xl p-4 hover:border-primary/40 hover:shadow-lg transition-all flex flex-col gap-3",
                    kb.is_default && "ring-1 ring-primary/20"
                  )}
                >
                  {kb.is_default && (
                    <span className="absolute top-2 right-2 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Default</span>
                  )}
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                      <Database className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{kb.name}</p>
                      {kb.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{kb.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-background/60 rounded-lg p-2">
                      <p className="text-base font-bold text-foreground">{kb.doc_count}</p>
                      <p className="text-[10px] text-muted-foreground">docs</p>
                    </div>
                    <div className="bg-background/60 rounded-lg p-2">
                      <p className="text-base font-bold text-foreground">{kb.vector_count.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">vectors</p>
                    </div>
                    <div className="bg-background/60 rounded-lg p-2">
                      <p className="text-base font-bold text-foreground">{kb.size_human}</p>
                      <p className="text-[10px] text-muted-foreground">index</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-border/40">
                    <span className="text-[10px] text-muted-foreground">{kb.embedding_model}</span>
                    {!kb.is_default && (
                      <button
                        onClick={() => handleDeleteKb(kb)}
                        disabled={deletingKbId === kb.id}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                      >
                        {deletingKbId === kb.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---- Create KB modal ---- */}
        {showCreateKb && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-card border border-border/60 rounded-2xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between p-6 border-b border-border/40">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Database className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-lg font-bold">New Knowledge Base</h2>
                </div>
                <button onClick={() => setShowCreateKb(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Name *</label>
                  <input
                    type="text"
                    value={newKbName}
                    onChange={e => setNewKbName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreateKb()}
                    placeholder="e.g. Research Papers"
                    autoFocus
                    className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Description</label>
                  <input
                    type="text"
                    value={newKbDesc}
                    onChange={e => setNewKbDesc(e.target.value)}
                    placeholder="Optional description"
                    className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <ChevronRight className="w-3 h-3" />
                  Uses <strong className="text-foreground">clip-ViT-B-32</strong> (512-dim, text + image embeddings)
                </p>
              </div>
              <div className="p-6 border-t border-border/40 flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateKb(false)}
                  className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateKb}
                  disabled={kbCreating || !newKbName.trim()}
                  className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                  {kbCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoading && allDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
            <p className="text-muted-foreground text-sm font-medium animate-pulse">Loading documents...</p>
          </div>
        ) : error && allDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-destructive/5 rounded-2xl border border-destructive/10 max-w-2xl mx-auto">
            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
            <h3 className="text-lg font-bold text-foreground mb-2">Failed to load documents</h3>
            <p className="text-muted-foreground text-sm">{error}</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className={cn(
            "grid gap-4 md:gap-6 stagger-children",
            isAssistantOpen 
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6"
          )}>
            {filteredDocuments.map((doc) => {
                const status = getStatusParams(doc.status);
                const isFailed = doc.status === 'failed';
                
                return (
              <div
                key={doc.id}
                className={cn(
                  "group relative bg-card border border-border/60 rounded-2xl p-6 transition-all hover:border-primary/40 hover:shadow-xl hover:-translate-y-1 cursor-pointer flex flex-col h-full",
                  doc.is_shared && "ring-1 ring-primary/20 shadow-sm bg-primary/5",
                  isFailed && "border-destructive/50 bg-destructive/5"
                )}
              >
                <div className="flex flex-col items-center text-center mt-2">
                <div className="mb-5 relative w-full aspect-video">
                  <MediaPreview 
                    url={`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/inference/documents/${doc.id}/download/`}
                    type={doc.file_type.includes('image') ? 'image' : doc.file_type.includes('pdf') ? 'pdf' : 'link'}
                    title={doc.title}
                    source={doc.filename}
                    className="w-full h-full shadow-none border-none bg-transparent"
                  />
                  {status && (
                      <div className="absolute -bottom-1 -right-1 bg-card rounded-full p-1 border border-border/60 shadow-sm z-10">
                          {status.icon}
                      </div>
                  )}
                </div>
                  
                  <h4 className="font-bold text-foreground text-sm truncate w-full mb-1 px-2" title={doc.title}>
                      {doc.title}
                  </h4>
                  
                  {status ? (
                      <div className={cn(
                          "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted",
                          status.color
                      )}>
                          {status.label}
                      </div>
                  ) : (
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 justify-center">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">{formatSize(doc.file_size)}</span>
                            <span className="w-1 h-1 rounded-full bg-border" />
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">{doc.chunk_count} chunks</span>
                        </div>
                        {activeTab === 'public' && doc.author_name && (
                           <div className="text-[9px] font-bold text-primary uppercase tracking-tight">
                             By {doc.author_name}
                           </div>
                        )}
                    </div>
                  )}
                </div>
                
                {/* Actions Overlay */}
                <div className="mt-6 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 duration-200">
                  <button 
                    className="p-2 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
                    onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  {activeTab === 'personal' && (
                    <>
                      <button 
                        className={cn(
                            "p-2 rounded-lg border transition-all",
                            doc.is_shared ? "bg-primary/20 border-primary/40 text-primary" : "bg-card border-border/60 text-muted-foreground hover:text-primary"
                        )}
                        onClick={(e) => { e.stopPropagation(); handleShare(doc); }}
                        title={doc.is_shared ? "Unshare" : "Share"}
                        disabled={!!status}
                      >
                        <Globe className="w-4 h-4" />
                      </button>
                      <button 
                        className="p-2 bg-destructive/10 hover:bg-destructive/20 rounded-lg border border-destructive/20 text-destructive hover:text-destructive transition-all"
                        onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )})}
          </div>
        ) : (
          <div className="space-y-3 max-w-6xl mx-auto">
            {filteredDocuments.map((doc) => {
                const status = getStatusParams(doc.status);
                return (
              <div
                key={doc.id}
                className={cn(
                    "flex items-center gap-6 p-4 bg-card border border-border/60 rounded-xl hover:border-primary/40 hover:shadow-md transition-all group animate-slide-up",
                    doc.is_shared && "border-primary/30 bg-primary/5"
                )}
              >
                <div className="p-2 bg-background rounded-lg border border-border/60 group-hover:bg-primary/10 transition-colors">
                    {getDocIcon(doc.file_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-0.5">
                    <p className="font-bold text-foreground tracking-tight truncate">{doc.title}</p>
                    {doc.is_shared && activeTab === 'personal' && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-primary/20 text-primary rounded border border-primary/30 uppercase tracking-wider">
                        Shared
                      </span>
                    )}
                    {activeTab === 'public' && doc.author_name && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-muted text-muted-foreground rounded border border-border/60 uppercase">
                        By {doc.author_name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-muted-foreground truncate">{doc.filename}</p>
                </div>
                
                {status ? (
                    <div className={cn(
                        "text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 px-3 py-1.5 bg-background rounded-lg",
                        status.color
                    )}>
                        {status.icon}
                        {status.label}
                    </div>
                ) : (
                    <div className="hidden md:flex items-center gap-8">
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase w-20">
                          {formatSize(doc.file_size)}
                        </div>
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase w-24">
                          {doc.chunk_count} chunks
                        </div>
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase w-24">
                          {formatDate(doc.created_at)}
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-1">
                  <button 
                    className="p-2 rounded-lg hover:bg-muted transition-all text-muted-foreground hover:text-primary"
                    onClick={() => handleDownload(doc)}
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  {activeTab === 'personal' && (
                    <>
                      <button 
                        className={cn(
                            "p-2 rounded-lg transition-all",
                            doc.is_shared ? "text-primary bg-primary/20" : "text-muted-foreground hover:text-primary hover:bg-muted"
                        )}
                        onClick={() => handleShare(doc)}
                        title={doc.is_shared ? "Unshare" : "Share"}
                        disabled={!!status}
                      >
                        <Globe className="w-4 h-4" />
                      </button>
                      <button 
                        className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-all"
                        onClick={() => handleDelete(doc.id)}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )})}
          </div>
        )}

        {!isLoading && !error && filteredDocuments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center max-w-sm mx-auto">
            <div className="p-6 bg-muted rounded-full mb-6">
              <FileText className="w-12 h-12 text-muted-foreground/40" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No documents found</h3>
            <p className="text-muted-foreground text-sm mb-8">
              {activeTab === 'personal' 
                ? "You haven't uploaded any documents yet. Start by uploading files to build your knowledge base."
                : "The public library is currently empty."}
            </p>
            {activeTab === 'personal' && (
              <button 
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 transition-all active:scale-95"
              >
                <Upload className="w-4 h-4" />
                Upload Your First File
              </button>
            )}
          </div>
        )}
        {hasNextPage && !searchQuery && (
          <div className="flex justify-center mt-8">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-semibold hover:bg-muted disabled:opacity-60"
            >
              {isFetchingNextPage && <Loader2 className="w-4 h-4 animate-spin" />}
              {isFetchingNextPage ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-6 animate-in fade-in duration-300">
          <div className="bg-card border border-border/60 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-border/60 flex items-center justify-between">
              <div>
                  <h2 className="text-xl font-bold text-foreground">Upload Documents</h2>
                  <p className="text-xs text-muted-foreground mt-1">Add files to your private registry</p>
              </div>
              <button 
                onClick={() => setShowUploadModal(false)} 
                className="p-2 hover:bg-muted rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8">
              <label className="group border-2 border-dashed border-border/60 hover:border-primary/50 bg-background/50 hover:bg-primary/5 rounded-2xl p-12 text-center transition-all cursor-pointer block">
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleUpload(e.target.files)}
                />
               
                <div className="p-4 bg-card rounded-xl border border-border/60 w-fit mx-auto mb-6 group-hover:scale-110 group-hover:border-primary/40 transition-all">
                    <Upload className="w-10 h-10 text-muted-foreground group-hover:text-primary" />
                </div>
                
                <p className="text-base font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                  Click or drag files here
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, JSON, CSV, TXT, or Markdown
                </p>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Share Confirmation Modal */}
      {shareConfirmation.isOpen && shareConfirmation.doc && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-6 animate-in fade-in duration-300"
          onClick={() => setShareConfirmation({ isOpen: false, doc: null })}
        >
          <div 
            className="bg-card border border-border/60 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-border/60 flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Globe className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Share Document</h2>
                <p className="text-xs text-muted-foreground mt-1">Make this file available to everyone</p>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                <p className="text-sm text-foreground/80 leading-relaxed">
                    Sharing <strong>{shareConfirmation.doc.title}</strong> will make it visible to all users in the public library.
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Before you share:</p>
                <ul className="space-y-2">
                  {[
                      "Ensure the file contains no sensitive data",
                      "Confirm you have rights to share this content",
                      "Verify file content is correct"
                  ].map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="w-1 h-1 rounded-full bg-primary" />
                          {item}
                      </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="p-6 border-t border-border/60 flex justify-end gap-3 bg-background/50">
              <button 
                onClick={() => setShareConfirmation({ isOpen: false, doc: null })}
                className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmShare}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-xl font-bold text-sm transition-all hover:bg-primary/90 active:scale-95 flex items-center gap-2"
              >
                <Globe className="w-4 h-4" />
                Share Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
