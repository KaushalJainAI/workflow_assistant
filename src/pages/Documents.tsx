import { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Upload, 
  Search, 
  File,
  Image,
  FileJson,
  FileCode,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  Globe,
  Download
} from 'lucide-react';
import { documentsService, type Document } from '../api';
import { toast } from '../components/ui/Toast';

export default function Documents() {
  const [searchQuery, setSearchQuery] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch documents
  const fetchDocuments = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const data = await documentsService.list();
      setDocuments(prev => {
        // Merge with existing "uploading" items if any (though usually we'd rely on the list to be authoritative)
        // But here we want to replace the optimistic/server items.
        // Strategy: Only replace items that are NOT currently in 'uploading' state locally if we were tracking them distinctively.
        // Simpler: Just replace. If we have optimistic "uploading" items that aren't in the server list yet, we might lose them if we blindly setDocuments.
        // However, we only fetchDocuments on mount or poll.
        // Optimistic items are added to `documents` state.
        
        // Let's just return the server data, but if we are "uploading" locally, those might be provisional.
        // Actually best approach: Server is truth. 
        // But for "Uploading..." optimistic UI, we assign temporary IDs (e.g. negative numbers).
        const serverDocs = data?.documents || [];
        
        // Keep any local optimistic "uploading" docs
        const uploadingDocs = prev.filter(d => d.status === 'uploading');
        
        // Deduplicate?
        return [...uploadingDocs, ...serverDocs];
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load documents';
      if (!silent) {
        setError(message);
        toast.error('Error loading documents', message);
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Polling for pending/processing documents
  useEffect(() => {
    const hasPending = documents.some(d => d.status === 'pending' || d.status === 'processing');
    if (!hasPending) return;

    const interval = setInterval(() => {
      fetchDocuments(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [documents, fetchDocuments]);

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleUpload = async (files: FileList) => {
    setShowUploadModal(false); // Close modal immediately
    
    const newFiles = Array.from(files);
    let successCount = 0;

    // Create optimistic items
    const optimisticDocs: Document[] = newFiles.map((file, i) => ({
      id: -Date.now() - i, // Temp ID
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

    setDocuments(prev => [...optimisticDocs, ...prev]);

    // Process uploads in parallel
    // We don't await all of them to block the UI, but we track them.
    // Actually, we want to know when ALL are done only for the final toast?
    // Or just let them finish independently.
    
    // Using Promise.allSettled to handle individual failures
    const uploadPromises = newFiles.map(async (file, index) => {
      const tempId = optimisticDocs[index].id;
      try {
        const uploadedDoc = await documentsService.upload(file);
        
        // Replace optimistic doc with real doc
        setDocuments(prev => prev.map(d => d.id === tempId ? uploadedDoc : d));
        successCount++;
      } catch (err) {
        // Mark as failed
        setDocuments(prev => prev.map(d => d.id === tempId ? {
          ...d,
          status: 'failed',
          error_message: err instanceof Error ? err.message : 'Upload failed'
        } : d));
        toast.error(`Failed to upload ${file.name}`);
      }
    });

    await Promise.allSettled(uploadPromises);
    if (successCount > 0) {
      toast.success('Upload initiated', `${successCount} files are being processed.`);
      fetchDocuments(true); // Fetch authoritative state
    }
  };

  const handleDelete = async (id: number) => {
    if (id < 0) {
      // Delete local optimistic doc (e.g. failed one)
      setDocuments(prev => prev.filter(d => d.id !== id));
      return;
    }

    if (!window.confirm('Are you sure you want to delete this document?')) return;
    
    try {
      await documentsService.delete(id);
      setDocuments(prev => prev.filter(d => d.id !== id));
      toast.success('Document deleted');
    } catch (err) {
      toast.error('Delete failed', err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  // ... (handleShare and helpers remain mostly same, simplified for brevity)
  const handleShare = async (id: number) => {
      try {
        const result = await documentsService.toggleSharing(id);
        setDocuments(prev => prev.map(d => 
          d.id === id ? { ...d, is_shared: result.is_shared, shared_at: result.shared_at } : d
        ));
        
        const action = result.is_shared ? 'shared with' : 'unshared from';
        toast.success('Sharing updated', `Document ${action} platform knowledge base`);
      } catch (err) {
        toast.error('Update failed', err instanceof Error ? err.message : 'Failed to update sharing settings');
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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Documents</h1>
              <p className="text-sm text-muted-foreground">
                Manage files for RAG and workflows
              </p>
            </div>
          </div>
          <button 
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-2 bg-muted rounded-md p-1">
            <button 
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 rounded text-sm ${viewMode === 'grid' ? 'bg-background shadow' : ''}`}
            >
              Grid
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded text-sm ${viewMode === 'list' ? 'bg-background shadow' : ''}`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading && documents.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error && documents.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Failed to load documents</h3>
            <p className="text-muted-foreground">{error}</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredDocuments.map((doc) => {
                const status = getStatusParams(doc.status);
                return (
              <div
                key={doc.id}
                className={`p-4 bg-card border rounded-lg hover:border-primary/50 cursor-pointer transition-all group relative ${doc.is_shared ? 'border-blue-500/30 bg-blue-500/5' : 'border-border'}`}
              >
                {/* Share Badge */}
                {doc.is_shared && (
                  <div className="absolute top-2 left-2 text-blue-500" title="Shared with platform">
                    <Globe className="w-4 h-4" />
                  </div>
                )}
                
                <div className="flex flex-col items-center text-center mt-2">
                  <div className="mb-3 relative">
                    {getDocIcon(doc.file_type)}
                    {status && (
                        <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 shadow-sm">
                            {status.icon}
                        </div>
                    )}
                  </div>
                  <p className="font-medium text-sm truncate w-full" title={doc.title}>{doc.title}</p>
                  
                  {status ? (
                      <p className={`text-xs mt-1 ${status.color}`}>
                          {status.label}
                      </p>
                  ) : (
                    <>
                        <p className="text-xs text-muted-foreground mt-1">
                            {formatSize(doc.file_size)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {doc.chunk_count} chunks
                        </p>
                    </>
                  )}
                </div>
                
                <div className="absolute top-2 right-2 flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button 
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                    onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button 
                    className={`p-1.5 rounded hover:bg-muted ${doc.is_shared ? 'text-blue-500' : 'text-muted-foreground'}`}
                    onClick={(e) => { e.stopPropagation(); handleShare(doc.id); }}
                    title={doc.is_shared ? "Stop sharing" : "Share with platform"}
                    disabled={!!status}
                  >
                    <Globe className="w-4 h-4" />
                  </button>
                  <button 
                    className="p-1.5 hover:bg-destructive/10 text-destructive rounded"
                    onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )})}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredDocuments.map((doc) => {
                const status = getStatusParams(doc.status);
                return (
              <div
                key={doc.id}
                className={`flex items-center gap-4 p-4 bg-card border rounded-lg hover:border-primary/50 transition-all ${doc.is_shared ? 'border-blue-500/30 bg-blue-500/5' : 'border-border'}`}
              >
                {getDocIcon(doc.file_type)}
                <div className="flex-1">
                  <p className="font-medium flex items-center gap-2">
                    {doc.title}
                    {doc.is_shared && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-500 rounded-full border border-blue-500/20">
                        Shared
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">{doc.filename}</p>
                </div>
                
                {status ? (
                    <div className={`text-sm flex items-center gap-2 ${status.color}`}>
                        {status.icon}
                        {status.label}
                    </div>
                ) : (
                    <>
                        <div className="text-sm text-muted-foreground">
                        {formatSize(doc.file_size)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                        {doc.chunk_count} chunks
                        </div>
                    </>
                )}

                <div className="text-sm text-muted-foreground">
                  {formatDate(doc.created_at)}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground"
                    onClick={() => handleDownload(doc)}
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button 
                    className={`p-2 rounded-md hover:bg-muted transition-colors ${doc.is_shared ? 'text-blue-500 bg-blue-500/10' : 'text-muted-foreground'}`}
                    onClick={() => handleShare(doc.id)}
                    title={doc.is_shared ? "Stop sharing with platform" : "Share with platform"}
                    disabled={!!status}
                  >
                    <Globe className="w-4 h-4" />
                  </button>
                  <button 
                    className="p-2 hover:bg-destructive/10 text-destructive rounded-md"
                    onClick={() => handleDelete(doc.id)}
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )})}
          </div>
        )}

        {!isLoading && !error && filteredDocuments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No documents found</h3>
            <p className="text-muted-foreground mb-4">
              Upload documents to use in your workflows
            </p>
            <button 
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              <Upload className="w-4 h-4" />
              Upload Document
            </button>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-semibold">Upload Documents</h2>
              <button onClick={() => setShowUploadModal(false)} className="p-1 hover:bg-muted rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <label className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer block">
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleUpload(e.target.files)}
                  // disabled={uploading} // Removed global disabled to allow parallel requests if logic permitted, but here we close modal anyway
                />
               
                  <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                
                <p className="font-medium mb-2">
                  Drop files here or click to upload
                </p>
                <p className="text-sm text-muted-foreground">
                  Supports PDF, JSON, CSV, TXT, and more
                </p>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
