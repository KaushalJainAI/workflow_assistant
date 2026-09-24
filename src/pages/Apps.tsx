/**
 * `/apps` — the launcher for the browser productivity apps.
 *
 * Every tile opens a real route: the workspace apps at `/apps/<id>` (the
 * user's matching files beside an editor) and the pages that already exist
 * (Files, Dashboards, Pages, Imagine). Recent files come from the server's
 * document stream and open straight into the app that suits them — agent
 * output included, because an agent's file is the user's file.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppWindow, Search, Sparkles } from 'lucide-react';

import { documentsService } from '../api/documents';
import PageHeader from '../components/layout/PageHeader';
import { acceptsDoc, defaultAppFor, openInAppPath, searchApps, type AppMeta } from '../lib/apps';
import { fileIcon, fileTint, formatDate, locationOf } from '../lib/fileDisplay';
import { cn } from '../lib/utils';

export default function Apps() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const apps = useMemo(() => searchApps(query), [query]);
  const workspace = apps.filter((a) => a.kind === 'workspace');
  const more = apps.filter((a) => a.kind === 'route');

  // One page of the user's latest files feeds both the counts on the tiles
  // and the Recent list, so the launcher costs one request.
  const { data } = useQuery({
    queryKey: ['documents', 'apps-launcher'],
    queryFn: () => documentsService.list({ limit: 100, scope: 'personal' }),
    staleTime: 60_000,
  });
  const files = useMemo(() => data?.my_documents ?? [], [data]);
  const recents = useMemo(
    () => [...files].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).filter((d) => defaultAppFor(d)).slice(0, 8),
    [files],
  );
  const countFor = (app: AppMeta) => files.filter((d) => acceptsDoc(app, d)).length;
  const capped = !!data?.my_has_more;

  return (
    <div className="h-full overflow-auto bg-background">
      <PageHeader title="Apps" subtitle="Productivity apps that open your files — everything runs in your browser" icon={AppWindow} />
      <div className="px-4 py-6 md:px-8">
        <div className="mb-6 flex max-w-md items-center gap-2 rounded-md border border-border/60 bg-card px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search apps…"
            aria-label="Search apps"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {apps.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No apps match that search.</p>
        )}

        {workspace.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold">Productivity</h2>
            <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
              {workspace.map((app) => {
                const n = countFor(app);
                return (
                  <AppTile
                    key={app.id}
                    app={app}
                    meta={n ? `${n}${capped ? '+' : ''} ${n === 1 ? 'file' : 'files'}` : 'No files yet'}
                    onAi={() => navigate(`/ai-chat?new=${encodeURIComponent(app.newPrompt)}`)}
                  />
                );
              })}
            </ul>
          </section>
        )}

        {more.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold">More</h2>
            <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
              {more.map((app) => (
                <AppTile key={app.id} app={app} meta={app.description} />
              ))}
            </ul>
          </section>
        )}

        {!query && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent files</h2>
              <Link to="/documents" className="text-[12.5px] text-primary hover:underline">Open Files</Link>
            </div>
            {recents.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                Nothing yet — files you create, upload, or ask an agent to make will appear here.
              </p>
            ) : (
              <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 xl:grid-cols-4">
                {recents.map((d) => {
                  const app = defaultAppFor(d)!;
                  const Icon = fileIcon(d);
                  return (
                    <li key={d.id}>
                      <Link
                        to={openInAppPath(d, app)!}
                        className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5 no-underline hover:border-primary/40"
                      >
                        <Icon className={cn('h-5 w-5 shrink-0', fileTint(d))} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] text-foreground">{d.filename}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {app.title} · {locationOf(d)} · {formatDate(d.updated_at)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function AppTile({ app, meta, onAi }: { app: AppMeta; meta: string; onAi?: () => void }) {
  const Icon = app.icon;
  return (
    <li className="group relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card transition-colors hover:border-primary/40">
      <Link to={app.path} className="flex flex-1 flex-col items-start gap-2 p-4 no-underline">
        <span className={cn('inline-flex rounded-xl bg-gradient-to-br p-2.5 text-white shadow-sm', app.tint)}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="block text-sm font-semibold text-foreground">{app.title}</span>
        <span className="line-clamp-2 block text-[12px] leading-snug text-muted-foreground">
          {app.kind === 'workspace' ? app.description : meta}
        </span>
        {app.kind === 'workspace' && <span className="mt-auto pt-1 text-[11px] text-muted-foreground/80">{meta}</span>}
      </Link>
      {onAi && (
        <button
          type="button"
          onClick={onAi}
          title={app.newPrompt}
          aria-label={`New ${app.title} file with AI`}
          className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground opacity-70 hover:bg-muted hover:text-primary sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Sparkles className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}
