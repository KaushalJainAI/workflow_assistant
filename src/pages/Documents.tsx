import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePersistedState } from '../hooks/usePersistedState';
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
  BookOpen,
  FolderPlus,
  FolderInput,
  RotateCcw,
} from 'lucide-react';
import {
  documentsService,
  foldersService,
  type Document,
  type Folder,
} from '../api';

import { toast } from '../lib/toastStore';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '../lib/utils';
import PageHeader from '../components/layout/PageHeader';
import SearchInput from '../components/ui/SearchInput';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Loading';
import { useAssistant } from '../contexts/assistantState';
import { DocumentGridCard } from '../components/documents/DocumentGridCard';
import { DocumentPreviewModal } from '../components/documents/DocumentPreviewModal';
import ExtractionPanel from '../components/extraction/ExtractionPanel';
import Breadcrumbs from '../components/documents/Breadcrumbs';
import FolderPickerModal from '../components/documents/FolderPickerModal';
import FolderTile from '../components/documents/FolderTile';
import { apiErrorMessage } from '../lib/apiError';
import { resolvePath } from '../lib/vfsPath';

type DocumentsTab = 'personal' | 'public' | 'extraction' | 'trash';

/** What is being dragged, so a drop knows what to move. */
type DragPayload =
  | { kind: 'folder'; id: number }
  | { kind: 'document'; id: number }
  | null;

export default function Documents() {
  const [searchQuery, setSearchQuery] = usePersistedState('documents.search', '', { storage: 'session' });
  const [activeTab, setActiveTab] = usePersistedState<DocumentsTab>('documents.tab', 'personal');
  const [showUploadModal, setShowUploadModal] = useState(false);
  /** The document whose preview is open, or null. */
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [viewMode, setViewMode] = usePersistedState<'grid' | 'list'>('documents.view', 'grid');
  const [localUploadingDocs, setLocalUploadingDocs] = useState<Document[]>([]);
  // Where the user is standing in their tree. `null` is the root — the server
  // has no root row, so null is the location rather than "unset". Persisted so
  // a reload puts you back where you were, like the tab and view mode.
  const [folderId, setFolderId] = usePersistedState<number | null>('documents.folder', null);
  const [dragging, setDragging] = useState<DragPayload>(null);
  const [movePicker, setMovePicker] = useState<{ open: boolean; payload: DragPayload }>({
    open: false,
    payload: null,
  });
  const [isMoving, setIsMoving] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const { isAssistantOpen } = useAssistant();
  const queryClient = useQueryClient();

  // `?path=/Chat/evals/a.py` is how a file named in a chat answer lands here
  // (`lib/vfsPath.ts`). Go to its folder and open it; when the walk stops
  // short, stay at the deepest folder it reached so the user is at least
  // standing next to where the file was meant to be.
  //
  // `?doc=<id>` is the same thing for a file card, which already holds the id
  // and so never needs the walk.
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedPath = searchParams.get('path');
  const linkedDoc = Number(searchParams.get('doc')) || null;
  useEffect(() => {
    if (!linkedPath && !linkedDoc) return;
    let cancelled = false;
    const label = linkedPath ?? 'That file';
    const lookup = linkedDoc
      ? documentsService.get(linkedDoc).then((doc) => ({ folderId: doc.folder_id ?? null, doc, found: true }))
      : resolvePath(linkedPath as string);
    lookup
      .then(({ folderId: target, doc, found }) => {
        if (cancelled) return;
        setActiveTab('personal');
        setFolderId(target);
        if (doc) setPreviewDoc(doc);
        else if (!found) toast.error(`${label} is not in your files. It may have been moved or deleted.`);
      })
      .catch((err) => {
        if (!cancelled) toast.error(apiErrorMessage(err, `Could not open ${label.toLowerCase()}`));
      })
      .finally(() => {
        // Drop the parameters so a reload or a folder change is not undone
        // by the link that brought the user here.
        if (!cancelled) setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.delete('path');
          next.delete('doc');
          return next;
        }, { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [linkedPath, linkedDoc, setActiveTab, setFolderId, setSearchParams]);

  // Folders live in their own query: they come back capped rather than
  // cursored (folder rows are tiny), so mixing them into the document
  // infinite query would mean two pagination schemes in one list.
  const inTree = activeTab === 'personal';
  const { data: folderPage } = useQuery({
    queryKey: ['folders', folderId],
    queryFn: () => foldersService.list(folderId),
    enabled: inTree,
    staleTime: 60 * 1000,
  });

  const { data: trashPage, isLoading: trashLoading } = useQuery({
    queryKey: ['trash'],
    queryFn: () => foldersService.trash.list(),
    enabled: activeTab === 'trash',
  });

  const refreshTree = () => {
    queryClient.invalidateQueries({ queryKey: ['documents'] });
    queryClient.invalidateQueries({ queryKey: ['folders'] });
    queryClient.invalidateQueries({ queryKey: ['trash'] });
  };

  const { data: documentsData, isLoading, error: queryError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['documents', activeTab, activeTab === 'personal' ? folderId : null],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => documentsService.list({
      limit: 50,
      cursor: pageParam,
      // The extraction and trash tabs are not the doc stream — keep the
      // personal scope warm so the tab switch never re-fetches a new scope.
      scope: activeTab === 'personal' ? 'personal' : activeTab === 'public' ? 'public' : 'personal',
      // Only the personal tab is a tree. The Public Library is a flat
      // platform-wide list and is never narrowed by folder.
      ...(activeTab === 'personal' ? { folder_id: folderId ?? ('root' as const) } : {}),
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
        await documentsService.upload(file, folderId);
        successCount++;
      } catch (err) {
        console.error('Failed to upload ${file.name}', err);
        toast.error(`Failed to upload ${file.name}`);
      } finally {
        setLocalUploadingDocs(prev => prev.filter(d => d.id !== tempId));
      }
    });

    await Promise.allSettled(uploadPromises);
    if (successCount > 0) {
      toast.success('Upload initiated', `${successCount} files are being processed.`);
      refreshTree();
    }
  };

  const handleDelete = async (id: number) => {
    if (id < 0) {
      setLocalUploadingDocs(prev => prev.filter(d => d.id !== id));
      return;
    }

    if (!window.confirm('Move this document to Trash? You can restore it later.')) return;

    try {
      const result = await documentsService.delete(id);
      refreshTree();
      toast.success(
        'Moved to Trash',
        `You can restore it for ${result.purges_after_days} days.`
      );
    } catch (err) {
      toast.error('Delete failed', err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  // ---- Folder operations ---------------------------------------------------

  const breadcrumbs = folderPage?.breadcrumbs ?? [];
  const currentFolder = folderPage?.folder ?? null;

  // The `inTree` conditional lives inside the memo rather than above it. As a
  // separate `const folders = ...` it minted a fresh array literal on every
  // render, so it was never equal to itself and the memo below recomputed each
  // time — a `useMemo` whose dependency changes every render is just overhead.
  const filteredFolders = useMemo(() => {
    const folders = inTree ? folderPage?.folders ?? [] : [];
    const query = searchQuery.toLowerCase();
    return folders.filter((f) => f.name.toLowerCase().includes(query));
  }, [inTree, folderPage?.folders, searchQuery]);

  const handleCreateFolder = async () => {
    const name = window.prompt('Folder name');
    if (!name?.trim()) return;
    try {
      await foldersService.create(name.trim(), folderId);
      refreshTree();
      toast.success('Folder created');
    } catch (err: unknown) {
      toast.error('Could not create folder', apiErrorMessage(err, 'Please try again.'));
    }
  };

  const handleRenameFolder = async (folder: Folder) => {
    const name = window.prompt('Rename folder', folder.name);
    if (!name?.trim() || name.trim() === folder.name) return;
    try {
      await foldersService.update(folder.id, { name: name.trim() });
      refreshTree();
    } catch (err: unknown) {
      toast.error('Could not rename', apiErrorMessage(err, 'Please try again.'));
    }
  };

  const handleDeleteFolder = async (folder: Folder) => {
    if (!window.confirm(`Move “${folder.name}” and everything in it to Trash?`)) return;
    try {
      const result = await foldersService.remove(folder.id);
      refreshTree();
      toast.success(
        'Moved to Trash',
        `You can restore it for ${result.purges_after_days} days.`
      );
    } catch (err: unknown) {
      toast.error('Could not delete', apiErrorMessage(err, 'Please try again.'));
    }
  };

  /** The one path every move goes through, whether dragged or picked. */
  const performMove = async (payload: DragPayload, targetFolderId: number | null) => {
    if (!payload) return;
    if (payload.kind === 'folder' && payload.id === targetFolderId) return;

    setIsMoving(true);
    try {
      await foldersService.move({
        folder_ids: payload.kind === 'folder' ? [payload.id] : [],
        document_ids: payload.kind === 'document' ? [payload.id] : [],
        target_folder_id: targetFolderId,
      });
      refreshTree();
      toast.success('Moved');
    } catch (err: unknown) {
      // The server refuses cycles and foreign ids; surface its wording rather
      // than inventing our own.
      toast.error('Could not move', apiErrorMessage(err, 'Please try again.'));
    } finally {
      setIsMoving(false);
      setDragging(null);
      setMovePicker({ open: false, payload: null });
    }
  };

  const handleRestore = async (payload: { folder_ids?: number[]; document_ids?: number[] }) => {
    try {
      const result = await foldersService.trash.restore(payload);
      refreshTree();
      const refused = result.refused[0];
      if (refused?.reason === 'parent_still_trashed') {
        toast.error('Restore the folder first', 'This item lives inside a folder that is also in Trash.');
      } else {
        const renamed = result.restored.find((r) => r.renamed_to);
        toast.success(
          'Restored',
          renamed ? `A name was taken, so it came back as “${renamed.renamed_to}”.` : undefined
        );
      }
    } catch (err: unknown) {
      toast.error('Could not restore', apiErrorMessage(err, 'Please try again.'));
    }
  };

  const handleEmptyTrash = async () => {
    if (!window.confirm('Permanently delete everything in Trash? This cannot be undone.')) return;
    try {
      const result = await foldersService.trash.empty();
      refreshTree();
      toast.success(
        'Trash emptied',
        `${result.purged_documents} file(s) and ${result.purged_folders} folder(s) removed.`
      );
    } catch (err: unknown) {
      toast.error('Could not empty Trash', apiErrorMessage(err, 'Please try again.'));
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
            case 'uploading': return { color: 'text-primary', icon: <Loader2 className="w-4 h-4 animate-spin text-primary" />, label: 'Uploading...' };
            case 'pending': return { color: 'text-warning', icon: <Loader2 className="w-4 h-4 animate-spin text-warning" />, label: 'Queued' };
            case 'processing': return { color: 'text-warning', icon: <Loader2 className="w-4 h-4 animate-spin text-warning" />, label: 'Indexing...' };
            case 'stored': return { color: 'text-success', icon: <BookOpen className="w-4 h-4 text-success" />, label: 'Stored' };
            case 'failed': return { color: 'text-destructive', icon: <AlertCircle className="w-4 h-4 text-destructive" />, label: 'Failed' };
            default: return null;
        }
    };

  return (
    // `h-full`, not `h-screen`. The shell is `100dvh`; `h-screen` is `100vh`,
    // which on mobile includes the area behind the collapsing URL bar, so the
    // bottom of this page was pushed out of an `overflow-hidden` parent.
    <div className="flex flex-col h-full bg-background text-foreground animate-in fade-in duration-200">
      {/* Header */}
      <PageHeader 
        title="Documents"
        subtitle={
          activeTab === 'extraction'
            ? "Extraction schemas and the rows they produce"
            : "Manage your knowledge base assets and RAG sources"
        }
        icon={FileText}
        actions={
          activeTab === 'trash' ? (
            <button
              onClick={handleEmptyTrash}
              className="flex items-center gap-2 px-6 py-2.5 bg-destructive/10 text-destructive rounded-lg font-semibold transition-colors hover:bg-destructive/20"
            >
              <Trash2 className="w-4 h-4" />
              Empty Trash
            </button>
          ) : activeTab !== 'extraction' ? (
          <div className="flex items-center gap-2">
            {activeTab === 'personal' && (
              <button
                onClick={handleCreateFolder}
                className="flex items-center gap-2 px-4 py-2.5 border border-border/60 rounded-lg font-semibold transition-colors hover:bg-muted"
              >
                <FolderPlus className="w-4 h-4" />
                New folder
              </button>
            )}
            <Button 
              onClick={() => setShowUploadModal(true)}
            >
              <Upload className="w-4 h-4" />
              Upload files
            </Button>
          </div>
          ) : null
        }
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Scrolls rather than clips: four tabs at gap-8 are wider than a
              phone, and the shell is overflow-hidden, so the last tab used to
              be simply unreachable. `-mx-4 px-4` lets the row bleed to the
              header's own edges so the last tab can scroll fully into view. */}
          <div className="flex items-center gap-5 md:gap-8 overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
            <button
              onClick={() => setActiveTab('personal')}
              className={cn(
                "pb-3 text-sm font-semibold transition-colors relative",
                activeTab === 'personal' ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              My Documents ({myDocuments.length})
              {activeTab === 'personal' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
            <button
              onClick={() => setActiveTab('public')}
              className={cn(
                "pb-3 text-sm font-semibold transition-colors relative",
                activeTab === 'public' ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Public Library ({publicDocuments.length})
              {activeTab === 'public' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
            <button
              onClick={() => setActiveTab('extraction')}
              className={cn(
                "pb-3 text-sm font-semibold transition-colors relative",
                activeTab === 'extraction' ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Extraction
              {activeTab === 'extraction' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
            <button
              onClick={() => setActiveTab('trash')}
              className={cn(
                "pb-3 text-sm font-semibold transition-colors relative flex items-center gap-1.5",
                activeTab === 'trash' ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Trash
              {activeTab === 'trash' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
          </div>

          {activeTab !== 'extraction' && activeTab !== 'trash' && (
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
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors",
                  viewMode === 'grid' ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Grid
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors",
                  viewMode === 'list' ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                List
              </button>
            </div>
          </div>
          )}
        </div>

        {/* Location trail. Personal tab only — the Public Library is a flat
            platform-wide list, not a place in anyone's tree. */}
        {inTree && (
          <div className="pt-1">
            <Breadcrumbs
              trail={breadcrumbs}
              current={currentFolder}
              onNavigate={setFolderId}
              onDropOn={(target) => performMove(dragging, target)}
            />
          </div>
        )}
      </PageHeader>

      <div className={cn(
        "flex-1 overflow-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-white/5 z-10",
        isAssistantOpen && "xl:p-6"
      )}>
        {activeTab === 'extraction' ? (
          <ExtractionPanel mode="manage" />
        ) : activeTab === 'trash' ? (
          <div className="max-w-4xl mx-auto">
            <p className="text-sm text-muted-foreground mb-6">
              Items here are removed permanently after{' '}
              {trashPage?.purges_after_days ?? 30} days.
            </p>

            {trashLoading ? (
              <div className="flex justify-center py-16 text-muted-foreground">
                <Spinner size="lg" />
              </div>
            ) : (trashPage?.folders.length ?? 0) + (trashPage?.documents.length ?? 0) === 0 ? (
              <div className="text-center py-20">
                <Trash2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Trash is empty.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border/60 rounded-lg border border-border/60 overflow-hidden">
                {trashPage?.folders.map((f) => (
                  <li key={`folder-${f.id}`} className="flex items-center gap-3 px-4 py-3 bg-card">
                    <FolderInput className="w-5 h-5 text-amber-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{f.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Folder · deleted {f.deleted_at ? new Date(f.deleted_at).toLocaleDateString() : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRestore({ folder_ids: [f.id] })}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg hover:bg-muted"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Restore
                    </button>
                  </li>
                ))}
                {trashPage?.documents.map((d) => (
                  <li key={`doc-${d.id}`} className="flex items-center gap-3 px-4 py-3 bg-card">
                    <File className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        File · deleted {d.deleted_at ? new Date(d.deleted_at).toLocaleDateString() : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRestore({ document_ids: [d.id] })}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg hover:bg-muted"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Restore
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
        <>
        {/* Folders sit above the files, in whichever layout is active. */}
        {inTree && filteredFolders.length > 0 && (
          <div className={cn(
            'mb-6',
            viewMode === 'grid'
              ? cn('grid gap-4',
                  isAssistantOpen
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6')
              : 'rounded-lg border border-border/60 overflow-hidden bg-card'
          )}>
            {filteredFolders.map((folder) => (
              <FolderTile
                key={folder.id}
                folder={folder}
                viewMode={viewMode}
                onOpen={(f) => setFolderId(f.id)}
                onRename={handleRenameFolder}
                onDelete={handleDeleteFolder}
                onDropInto={(f) => performMove(dragging, f.id)}
                onDragStartFolder={(f) => setDragging({ kind: 'folder', id: f.id })}
              />
            ))}
          </div>
        )}
        {folderPage?.truncated && (
          <p className="text-xs text-muted-foreground mb-4">
            Showing the first {folderPage.count} folders in this location.
          </p>
        )}
        {isLoading && allDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Loading documents...</p>
          </div>
        ) : error && allDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-destructive-subtle rounded-lg border border-border max-w-2xl mx-auto px-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
            <h3 className="text-lg font-bold text-foreground mb-2">Failed to load documents</h3>
            <p className="text-muted-foreground text-sm">{error}</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className={cn(
            "grid gap-4 md:gap-5 stagger-children",
            isAssistantOpen 
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" 
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          )}>
            {filteredDocuments.map((doc) => (
              <DocumentGridCard
                key={doc.id}
                doc={doc}
                onOpen={setPreviewDoc}
                onDownload={handleDownload}
                onShare={handleShare}
                onDelete={handleDelete}
                draggable={inTree && doc.id > 0}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', `document:${doc.id}`);
                  setDragging({ kind: 'document', id: doc.id });
                }}
                onDragEnd={() => setDragging(null)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3 max-w-6xl mx-auto">
            {filteredDocuments.map((doc) => {
                const status = getStatusParams(doc.status);
                return (
              <div
                key={doc.id}
                className={cn(
                    "flex items-center gap-6 p-4 bg-card border border-border rounded-lg card-hover",
                    doc.is_shared && "border-primary/30 bg-primary/5"
                )}
              >
                <div className="p-2 bg-muted rounded-lg border border-border">
                    {getDocIcon(doc.file_type)}
                </div>
                {/* The name column opens the preview, in both views. Grid-only
                    would mean the same file is readable or not depending on a
                    layout toggle. It is deliberately not the whole row: the row
                    ends in Download / Move / Delete buttons. */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setPreviewDoc(doc)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setPreviewDoc(doc);
                    }
                  }}
                  aria-label={`Preview ${doc.title}`}
                  className="flex-1 min-w-0 cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <div className="flex items-center gap-3 mb-0.5">
                    <p className="font-bold text-foreground tracking-tight truncate">{doc.title}</p>
                    {doc.is_shared && activeTab === 'personal' && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-primary/20 text-primary rounded border border-primary/30 ">
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
                  {/* The size/chunks/date columns beside this only render from
                      md up, so phones get the same facts as a second line here
                      rather than not at all. */}
                  <p className="text-[11px] text-muted-foreground/80 truncate md:hidden">
                    {formatSize(doc.file_size)} · {doc.chunk_count} chunks · {formatDate(doc.created_at)}
                  </p>
                </div>
                
                {status ? (
                    <div className={cn(
                        "text-[10px] font-bold  flex items-center gap-2 px-3 py-1.5 bg-background rounded-lg",
                        status.color
                    )}>
                        {status.icon}
                        {status.label}
                    </div>
                ) : (
                    <div className="hidden md:flex items-center gap-8">
                        <div className="text-[11px] text-muted-foreground w-20">
                          {formatSize(doc.file_size)}
                        </div>
                        <div className="text-[11px] text-muted-foreground w-24">
                          {doc.chunk_count} chunks
                        </div>
                        <div className="text-[11px] text-muted-foreground w-24">
                          {formatDate(doc.created_at)}
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-1">
                  <button 
                    className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-primary"
                    onClick={() => handleDownload(doc)}
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  {activeTab === 'personal' && (
                    <>
                      {/* The menu is the contract for moving; dragging the card
                          is the accelerator. Drag-only would be untestable and
                          unusable on touch. */}
                      <button
                        className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-primary"
                        onClick={() => setMovePicker({ open: true, payload: { kind: 'document', id: doc.id } })}
                        title="Move to…"
                        disabled={doc.id < 0}
                      >
                        <FolderInput className="w-4 h-4" />
                      </button>
                      <button 
                        className={cn(
                            "p-2 rounded-lg transition-colors",
                            doc.is_shared ? "text-primary bg-primary/20" : "text-muted-foreground hover:text-primary hover:bg-muted"
                        )}
                        onClick={() => handleShare(doc)}
                        title={doc.is_shared ? "Unshare" : "Share"}
                        disabled={!!status}
                      >
                        <Globe className="w-4 h-4" />
                      </button>
                      <button 
                        className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors"
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
              <Button 
                onClick={() => setShowUploadModal(true)}
              >
                <Upload className="w-4 h-4" />
                Upload your first file
              </Button>
            )}
          </div>
        )}
        {hasNextPage && !searchQuery && (
          <div className="flex justify-center mt-8">
            <Button
              variant="secondary"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              loading={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Loading...' : 'Load more'}
            </Button>
          </div>
        )}
        </>
        )}
      </div>

      <FolderPickerModal
        isOpen={movePicker.open}
        excludeFolderIds={
          movePicker.payload?.kind === 'folder' ? [movePicker.payload.id] : []
        }
        isBusy={isMoving}
        onCancel={() => setMovePicker({ open: false, payload: null })}
        onConfirm={(target) => performMove(movePicker.payload, target)}
      />

      {previewDoc && (
        <DocumentPreviewModal
          // Keyed so opening a second document remounts rather than reusing
          // the first one's loaded text while the new one is still fetching.
          key={previewDoc.id}
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
          onDownload={handleDownload}
        />
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6 entrance-overlay">
          <div className="bg-card border border-border/60 rounded-lg shadow-lg w-full max-w-lg overflow-hidden entrance-modal">
            <div className="p-6 border-b border-border/60 flex items-center justify-between">
              <div>
                  <h2 className="text-xl font-bold text-foreground">Upload documents</h2>
                  <p className="text-xs text-muted-foreground mt-1">Add files to your private registry</p>
              </div>
              <button 
                onClick={() => setShowUploadModal(false)} 
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8">
              {/* The copy has always said "drag files here"; until now this was
                  a bare <label> with no drop handler, so dragging did nothing. */}
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                  setIsDropTarget(true);
                }}
                onDragLeave={() => setIsDropTarget(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDropTarget(false);
                  if (e.dataTransfer.files?.length) handleUpload(e.dataTransfer.files);
                }}
                className={cn(
                  "group border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer block",
                  isDropTarget
                    ? "border-primary bg-primary/10"
                    : "border-border/60 hover:border-primary/50 bg-background/50 hover:bg-primary/5"
                )}
              >
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleUpload(e.target.files)}
                />
               
                <div className="p-4 bg-card rounded-lg border border-border w-fit mx-auto mb-6">
                    <Upload className="w-10 h-10 text-muted-foreground group-hover:text-primary" />
                </div>
                
                <p className="text-base font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                  Click or drag files here
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, JSON, CSV, TXT, or Markdown
                </p>
                {currentFolder && (
                  <p className="text-xs text-primary mt-2">
                    Uploading into “{currentFolder.name}”
                  </p>
                )}
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Share Confirmation Modal */}
      {shareConfirmation.isOpen && shareConfirmation.doc && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-6 animate-in fade-in duration-200"
          onClick={() => setShareConfirmation({ isOpen: false, doc: null })}
        >
          <div 
            className="bg-card border border-border/60 rounded-lg shadow-lg w-full max-w-md overflow-hidden entrance-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-border/60 flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Globe className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Share document</h2>
                <p className="text-xs text-muted-foreground mt-1">Make this file available to everyone</p>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                <p className="text-sm text-foreground/80 leading-relaxed">
                    Sharing <strong>{shareConfirmation.doc.title}</strong> will make it visible to all users in the public library.
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-muted-foreground ">Before you share:</p>
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
                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-bold text-sm transition-colors hover:bg-primary/90 flex items-center gap-2"
              >
                <Globe className="w-4 h-4" />
                Share document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
