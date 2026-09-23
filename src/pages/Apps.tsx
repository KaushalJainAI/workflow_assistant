/**
 * `/apps` — launcher over server-backed destinations.
 *
 * Tiles open real routes (`/documents`, `/dashboards`, `/pages`); "New with
 * AI" deep-links into chat where the agent drafts and this suite refines.
 * Recents come from the server document stream, never local storage.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppWindow, Loader2, Search, Sparkles } from 'lucide-react';

import { documentsService } from '../api/documents';
import PageHeader from '../components/layout/PageHeader';
import { searchApps } from '../lib/apps';
import { cn } from '../lib/utils';

export default function Apps() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const apps = useMemo(() => searchApps(query), [query]);

  const { data: recent } = useQuery({
    queryKey: ['documents', 'apps-recents'],
    queryFn: () => documentsService.list({ limit: 6, scope: 'personal' }),
    staleTime: 60_000,
  });
  const recents = recent?.my_documents ?? [];

  return (
    <div className="min-h-full bg-background">
      <PageHeader title="Apps" subtitle="Open a workspace app — everything runs in your browser" icon={AppWindow} />
      <div className="px-4 py-6 md:px-8">
        <div className="mb-5 flex max-w-md items-center gap-2 rounded-md border border-border/60 bg-card px-3 py-2">
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

        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {apps.map((app) => {
            const Icon = app.icon;
            return (
              <li key={app.id} className="overflow-hidden rounded-lg border border-border/60 bg-card">
                <Link to={app.path} className="block p-4 no-underline">
                  <span className={cn('mb-3 inline-flex rounded-lg bg-gradient-to-br p-2.5 text-white', app.tint)}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="block text-sm font-semibold text-foreground">{app.title}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted-foreground">
                    {app.description}
                  </span>
                </Link>
                <span className="block border-t border-border/60 px-4 py-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/ai-chat?new=${encodeURIComponent(app.newPrompt)}`)}
                    className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-primary hover:underline"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> New with AI
                  </button>
                </span>
              </li>
            );
          })}
        </ul>

        <h2 className="mb-2 mt-8 text-sm font-semibold">Recent files</h2>
        {!recents.length ? (
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Loader2 className="hidden h-4 w-4 animate-spin" /> Nothing yet — your latest saves will appear here.
          </p>
        ) : (
          <ul className="m-0 list-none space-y-1.5 p-0">
            {recents.slice(0, 6).map((d) => (
              <li key={d.id}>
                <Link to={`/documents?doc=${d.id}`} className="block truncate rounded-md border border-border/60 bg-card px-3 py-2 text-[13px] hover:border-border-strong">
                  {d.filename}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
