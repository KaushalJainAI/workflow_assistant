/**
 * `/apps/:appId` — one productivity app with the user's files beside it.
 *
 * The left pane lists every file the app can open, from anywhere in the
 * user's tree — an agent's report under `/Agents/…` and a chat export under
 * `/Chat/` included — narrowed on the server by `file_type` and in the
 * browser by extension (`lib/apps.ts::acceptsDoc`). `?file=<id>` is the open
 * file, so a link from the file browser or a chat card lands in the right app
 * with the right file, and Back works.
 *
 * Leaving a file with unsaved changes asks first, the one rule every editor
 * shares; each editor reports its dirty state up through `onDirtyChange`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ChevronDown, FolderOpen, Loader2, Plus, Search, Sparkles, Upload,
} from 'lucide-react';

import { documentsService, type Document } from '../api/documents';
import AppEditor from '../components/apps/AppEditor';
import { Whiteboard } from '../components/apps/MediaEditors';
import NameDialog from '../components/apps/NameDialog';
import SidebarMenuButton from '../components/layout/SidebarMenuButton';
import { acceptsDoc, getApp, type AppMeta, type NewFileOption } from '../lib/apps';
import { apiErrorMessage } from '../lib/apiError';
import { fileIcon, formatDate, formatSize, locationOf } from '../lib/fileDisplay';
import { toast } from '../lib/toastStore';
import { cn } from '../lib/utils';

const PAGE = 100;
const PRIMARY_BTN =
  'inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary/90';

export default function AppWorkspace() {
  const { appId } = useParams();
  const app = getApp(appId);
  if (!app) return <Navigate to="/apps" replace />;
  if (app.kind === 'route') return <Navigate to={app.path} replace />;
  return <Workspace key={app.id} app={app} />;
}

function Workspace({ app }: { app: AppMeta }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const fileParam = params.get('file');
  const blankBoard = app.editor === 'whiteboard' && fileParam === 'new';
  const selectedId = fileParam && !blankBoard ? Number(fileParam) || null : null;

  const [query, setQuery] = useState('');
  const [newMenu, setNewMenu] = useState(false);
  const [naming, setNaming] = useState<NewFileOption | null>(null);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const dirty = useRef(false);
  const uploadInput = useRef<HTMLInputElement>(null);
  const Icon = app.icon;

  const files = useInfiniteQuery({
    queryKey: ['app-files', app.id],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      documentsService.list({ scope: 'personal', limit: PAGE, cursor: pageParam, types: app.accepts!.types.join(',') }),
    getNextPageParam: (last) => (last.has_more ? last.next_cursor : undefined),
    staleTime: 30_000,
  });

  const all = useMemo(() => {
    const seen = new Set<number>();
    return (files.data?.pages.flatMap((p) => p.my_documents) ?? [])
      .filter((d) => acceptsDoc(app, d) && !seen.has(d.id) && seen.add(d.id))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [files.data, app]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? all.filter((d) => d.filename.toLowerCase().includes(needle) || (d.folder_path ?? '').toLowerCase().includes(needle)) : all;
  }, [all, query]);

  // The open file: from the list when it is there, fetched when it is not
  // (a deep link to a file past the first page, or one just created).
  const listed = all.find((d) => d.id === selectedId) ?? null;
  const { data: fetched, isError: missing } = useQuery({
    queryKey: ['documents', 'detail', selectedId],
    queryFn: () => documentsService.get(selectedId!),
    enabled: selectedId !== null && !listed,
    retry: false,
  });
  const selected = listed ?? (fetched && fetched.id === selectedId ? fetched : null);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const onDirtyChange = useCallback((d: boolean) => {
    dirty.current = d;
  }, []);

  const open = useCallback(
    (doc: Document | 'new' | null) => {
      if (dirty.current && !window.confirm('You have unsaved changes. Leave this file without saving?')) return;
      dirty.current = false;
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (doc === null) next.delete('file');
        else next.set('file', doc === 'new' ? 'new' : String(doc.id));
        return next;
      });
    },
    [setParams],
  );

  const create = async (opt: NewFileOption, name: string) => {
    const withExt = name.toLowerCase().endsWith(`.${opt.ext}`) ? name : `${name}.${opt.ext}`;
    setCreating(true);
    try {
      const doc = await documentsService.create(withExt, null, opt.content);
      qc.invalidateQueries({ queryKey: ['app-files'] });
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['folders'] });
      setNaming(null);
      open(doc);
    } catch (err) {
      toast.error('Could not create the file', apiErrorMessage(err, 'Please try again.'));
    } finally {
      setCreating(false);
    }
  };

  const upload = async (list: FileList) => {
    setUploading(true);
    let last: Document | null = null;
    for (const f of Array.from(list)) {
      try {
        last = await documentsService.upload(f, null);
      } catch (err) {
        toast.error(`Could not upload ${f.name}`, apiErrorMessage(err, 'Please try again.'));
      }
    }
    setUploading(false);
    qc.invalidateQueries({ queryKey: ['app-files'] });
    qc.invalidateQueries({ queryKey: ['documents'] });
    if (last) {
      if (acceptsDoc(app, last)) open(last);
      else toast.error(`${app.title} cannot open ${last.filename}`, 'It was saved to your files.');
    }
  };

  const newOptions = app.newFiles ?? [];
  const canCreate = newOptions.length > 0 || app.editor === 'whiteboard';
  const hasOpen = !!selected || blankBoard;

  const newButton = canCreate && (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          if (app.editor === 'whiteboard') open('new');
          else if (newOptions.length === 1) setNaming(newOptions[0]);
          else setNewMenu((o) => !o);
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
      >
        <Plus className="h-4 w-4" /> {app.editor === 'whiteboard' ? 'New board' : 'New'}
        {newOptions.length > 1 && <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {newMenu && (
        <div className="absolute left-0 top-full z-30 mt-1 w-52 rounded-md border border-border/60 bg-popover p-1 shadow-lg">
          {newOptions.map((o) => (
            <button
              key={o.ext}
              type="button"
              onClick={() => {
                setNewMenu(false);
                setNaming(o);
              }}
              className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[13px] hover:bg-muted"
            >
              {o.label} <span className="text-[11px] text-muted-foreground">.{o.ext}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Title bar */}
      <header className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-2 md:px-4">
        <SidebarMenuButton />
        {hasOpen ? (
          <button type="button" onClick={() => open(null)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted md:hidden" aria-label="Back to files">
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          <Link to="/apps" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="All apps" title="All apps">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        )}
        <span className={cn('inline-flex rounded-md bg-gradient-to-br p-1.5 text-white', app.tint)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold leading-tight">
            {selected ? selected.filename : blankBoard ? 'New board' : app.title}
          </h1>
          <p className="truncate text-[11.5px] text-muted-foreground">
            {selected ? `${app.title} · ${locationOf(selected)}` : app.description}
          </p>
        </div>
        {selected && (
          <Link
            to={`/documents?doc=${selected.id}`}
            className="hidden items-center gap-1 rounded-md px-2 py-1.5 text-[12.5px] text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex"
            title="Show in Files"
          >
            <FolderOpen className="h-4 w-4" /> Show in Files
          </Link>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        {/* File pane */}
        <aside
          className={cn(
            'min-h-0 w-full shrink-0 flex-col border-r border-border/60 bg-card md:flex md:w-72',
            hasOpen ? 'hidden' : 'flex',
          )}
          aria-label={`${app.title} files`}
        >
          <div className="flex shrink-0 items-center gap-2 p-3">
            {newButton}
            {app.uploadAccept && (
              <>
                <button
                  type="button"
                  onClick={() => uploadInput.current?.click()}
                  disabled={uploading}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border/60 px-3 text-[13px] hover:bg-muted disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload
                </button>
                <input
                  ref={uploadInput}
                  type="file"
                  multiple
                  accept={app.uploadAccept}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) void upload(e.target.files);
                    e.target.value = '';
                  }}
                />
              </>
            )}
          </div>
          <div className="mx-3 mb-2 flex shrink-0 items-center gap-2 rounded-md border border-border/60 bg-background px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${app.title.toLowerCase()} files…`}
              aria-label="Search files"
              className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-1.5 pb-3">
            {files.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading your files…
              </div>
            ) : files.isError ? (
              <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">
                {apiErrorMessage(files.error, 'Could not load your files.')}
              </p>
            ) : all.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-[13px] font-medium">No {app.title} files yet</p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {canCreate ? 'Create one or upload from your computer.' : 'Upload one from your computer.'} Files your agents make show up here too.
                </p>
              </div>
            ) : shown.length === 0 ? (
              <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">Nothing matches “{query}”.</p>
            ) : (
              <ul className="m-0 list-none space-y-0.5 p-0">
                {shown.map((d) => {
                  const FIcon = fileIcon(d);
                  const active = d.id === selectedId;
                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => open(d)}
                        aria-current={active}
                        className={cn(
                          'flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left',
                          active ? 'bg-primary/10' : 'hover:bg-muted',
                        )}
                      >
                        <FIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className={cn('block truncate text-[13px]', active && 'font-medium')}>{d.filename}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {locationOf(d)} · {formatDate(d.updated_at)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {files.hasNextPage && (
              <button
                type="button"
                onClick={() => void files.fetchNextPage()}
                disabled={files.isFetchingNextPage}
                className="mx-auto mt-2 block rounded-md px-3 py-1.5 text-[12.5px] text-primary hover:bg-muted"
              >
                {files.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        </aside>

        {/* Editor */}
        <main className={cn('min-h-0 min-w-0 flex-1 flex-col', hasOpen ? 'flex' : 'hidden md:flex')}>
          {blankBoard ? (
            <Whiteboard doc={null} onCreated={(d) => open(d)} />
          ) : selected ? (
            <AppEditor
              key={selected.id}
              app={app}
              doc={selected}
              siblings={shown}
              onDirtyChange={onDirtyChange}
              onOpenDoc={(d) => open(d)}
            />
          ) : selectedId !== null && !missing ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Opening…
            </div>
          ) : (
            <Welcome
              app={app}
              missing={missing}
              recent={all.slice(0, 6)}
              onOpen={open}
              actions={
                app.editor === 'whiteboard' ? (
                  <button type="button" onClick={() => open('new')} className={PRIMARY_BTN}>
                    <Plus className="h-4 w-4" /> New board
                  </button>
                ) : (
                  newOptions.map((o) => (
                    <button key={o.ext} type="button" onClick={() => setNaming(o)} className={PRIMARY_BTN}>
                      <Plus className="h-4 w-4" /> New {o.label.toLowerCase()}
                    </button>
                  ))
                )
              }
              onAskAi={() => navigate(`/ai-chat?new=${encodeURIComponent(app.newPrompt)}`)}
            />
          )}
        </main>
      </div>

      {naming && (
        <NameDialog
          title={`New ${naming.label.toLowerCase()}`}
          initial={`Untitled.${naming.ext}`}
          busy={creating}
          onSubmit={(name) => void create(naming, name)}
          onCancel={() => setNaming(null)}
        />
      )}
    </div>
  );
}

function Welcome({
  app, missing, recent, onOpen, actions, onAskAi,
}: {
  app: AppMeta;
  missing: boolean;
  recent: Document[];
  onOpen: (d: Document) => void;
  actions: React.ReactNode;
  onAskAi: () => void;
}) {
  const Icon = app.icon;
  return (
    <div className="flex flex-1 flex-col items-center justify-center overflow-auto px-6 py-10 text-center">
      <span className={cn('mb-4 inline-flex rounded-2xl bg-gradient-to-br p-4 text-white shadow-md', app.tint)}>
        <Icon className="h-8 w-8" />
      </span>
      <h2 className="text-lg font-semibold">{app.title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {missing ? 'That file is no longer available — it may have been moved to Trash.' : app.description}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {actions}
        <button
          type="button"
          onClick={onAskAi}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border/60 px-3 text-[13px] hover:bg-muted"
        >
          <Sparkles className="h-4 w-4 text-primary" /> Ask AI to make one
        </button>
      </div>
      {recent.length > 0 && (
        <div className="mt-8 w-full max-w-xl text-left">
          <p className="mb-2 text-[12px] font-medium text-muted-foreground">Recent</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {recent.map((d) => {
              const FIcon = fileIcon(d);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onOpen(d)}
                  className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card px-3 py-2.5 text-left hover:border-primary/40"
                >
                  <FIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px]">{d.filename}</span>
                    <span className="block text-[11px] text-muted-foreground">{formatDate(d.updated_at)} · {formatSize(d.file_size)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
