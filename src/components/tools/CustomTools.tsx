/**
 * Custom tools — the user's own API and database connections.
 *
 * A custom tool is a connection row, not code: the generic callers are the
 * runtime, and "New tool" writes a row they read. Rows are private to the
 * caller; sharing freezes a snapshot without secrets, and installing writes
 * a private copy owned by the installer whose auth starts empty.
 *
 * Kept out of `Tools.tsx` so the code-owned catalogue page stays about the
 * catalogue: this file owns the "My tools" section plus the create / edit /
 * share / install-from-link dialogs.
 */
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Database,
  Globe,
  KeyRound,
  Pencil,
  Plus,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { parseToolShareSlug } from '../../lib/toolShare';
import datasourcesService, {
  type ApiConnection,
  type CustomToolKind,
  type DataConnection,
} from '../../api/datasources';
import { credentialsService } from '../../api/credentials';
import type { ShareVisibility } from '../../api/templates';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Modal, ModalBody, ModalFooter } from '../ui/Modal';

const TOOLS_KEY = ['custom-tools'] as const;
const API_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const DB_KINDS = ['postgres', 'mysql', 'bigquery', 'sqlite'] as const;

function apiErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (typeof data === 'string' && data) return data;
  if (data && typeof data === 'object') {
    const first = Object.values(data as Record<string, unknown>)[0];
    if (typeof first === 'string') return first;
    if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
    if (data && typeof (data as { error?: unknown }).error === 'string') {
      return (data as { error: string }).error;
    }
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Credential picker: "credential · field" options resolving to `slug.field`.
// Values never travel — the option value is a reference, exactly what the
// row stores.
// ---------------------------------------------------------------------------

function useSecretRefOptions() {
  const creds = useQuery({
    queryKey: ['credentials', 'list'],
    queryFn: () => credentialsService.list(),
    staleTime: 60 * 1000,
  });
  const types = useQuery({
    queryKey: ['credentials', 'types'],
    queryFn: () => credentialsService.getTypes(),
    staleTime: 5 * 60 * 1000,
  });
  const options = useMemo(() => {
    const slugById = new Map(
      (types.data?.types ?? []).map((t) => [t.id, t.slug]),
    );
    const out: { value: string; label: string }[] = [];
    for (const cred of creds.data?.credentials ?? []) {
      const slug = slugById.get(cred.credential_type);
      if (!slug) continue;
      for (const field of cred.fields ?? []) {
        out.push({
          value: `${slug}.${field.key}`,
          label: `${cred.name} · ${field.label}`,
        });
      }
    }
    return out;
  }, [creds.data, types.data]);
  return { options, loading: creds.isLoading || types.isLoading };
}

// ---------------------------------------------------------------------------
// Shared form bits
// ---------------------------------------------------------------------------

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-semibold text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && (
        <span className="block text-[11px] text-muted-foreground mt-1">{hint}</span>
      )}
    </label>
  );
}

const inputClass =
  'w-full px-3 py-2 bg-background border border-border rounded text-sm';

// ---------------------------------------------------------------------------
// New / edit dialog
// ---------------------------------------------------------------------------

export function NewToolDialog({
  initial,
  onClose,
}: {
  /** Set for edit: `{kind, row}`. Kind tabs lock in edit mode. */
  initial?: { kind: CustomToolKind; row: ApiConnection | DataConnection };
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const editing = Boolean(initial);
  const [kind, setKind] = useState<CustomToolKind>(initial?.kind ?? 'api');
  const [error, setError] = useState<string | null>(null);

  // API fields
  const apiRow = initial?.kind === 'api' ? (initial.row as ApiConnection) : null;
  const [name, setName] = useState(initial?.row.name ?? '');
  const [baseUrl, setBaseUrl] = useState(apiRow?.base_url ?? '');
  const [authType, setAuthType] = useState(apiRow?.auth.type ?? 'none');
  const [secretRef, setSecretRef] = useState(apiRow?.auth.secret_ref ?? '');
  const [headerName, setHeaderName] = useState(apiRow?.auth.header ?? 'X-API-Key');
  const [paramName, setParamName] = useState(apiRow?.auth.param ?? 'api_key');
  const [methods, setMethods] = useState<string[]>(apiRow?.allowed_methods ?? []);
  const [specText, setSpecText] = useState(
    apiRow && Object.keys(apiRow.openapi_spec ?? {}).length > 0
      ? JSON.stringify(apiRow.openapi_spec, null, 2)
      : '',
  );

  // DB fields
  const dbRow = initial?.kind === 'data' ? (initial.row as DataConnection) : null;
  const [dbKind, setDbKind] = useState<string>(dbRow?.kind ?? 'postgres');
  const [host, setHost] = useState(dbRow?.host ?? '');
  const [port, setPort] = useState(dbRow?.port ? String(dbRow.port) : '');
  const [database, setDatabase] = useState(dbRow?.database ?? '');
  const [username, setUsername] = useState(dbRow?.username ?? '');
  const [dbSecretRef, setDbSecretRef] = useState(dbRow?.secret_ref ?? '');
  const [vfsPath, setVfsPath] = useState(dbRow?.vfs_path ?? '');
  const [allowWrite, setAllowWrite] = useState(dbRow?.allow_write ?? false);

  const { options: secretOptions, loading: secretsLoading } = useSecretRefOptions();

  const save = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error('Give the tool a name.');
      if (kind === 'api') {
        const url = baseUrl.trim();
        if (!/^https?:\/\/.+/i.test(url)) {
          throw new Error('Base URL must start with http(s)://.');
        }
        let spec: Record<string, unknown> = {};
        if (specText.trim()) {
          try {
            spec = JSON.parse(specText);
          } catch {
            throw new Error('OpenAPI spec is not valid JSON.');
          }
          if (typeof spec !== 'object' || Array.isArray(spec)) {
            throw new Error('OpenAPI spec must be a JSON object.');
          }
        }
        const auth: Record<string, unknown> = { type: authType };
        if (authType !== 'none') {
          if (!secretRef) throw new Error('Pick the credential this API uses.');
          auth.secret_ref = secretRef;
          if (authType === 'header') auth.header = headerName.trim() || 'X-API-Key';
          if (authType === 'query') auth.param = paramName.trim() || 'api_key';
        }
        const body = {
          name: trimmedName, base_url: url, openapi_spec: spec,
          auth, allowed_methods: methods,
        };
        return editing && apiRow
          ? datasourcesService.updateApi(apiRow.id, body)
          : datasourcesService.createApi(body);
      }
      const body: Record<string, unknown> = {
        name: trimmedName, kind: dbKind, allow_write: allowWrite,
      };
      if (dbKind === 'sqlite') {
        if (!vfsPath.trim().startsWith('/')) {
          throw new Error('SQLite needs a workspace path like /Chat/sales.db.');
        }
        body.vfs_path = vfsPath.trim();
      } else {
        if (!host.trim()) throw new Error('A hostname is required.');
        body.host = host.trim();
        if (port.trim()) {
          const n = Number(port);
          if (!Number.isInteger(n) || n < 1 || n > 65535) {
            throw new Error('Port must be between 1 and 65535.');
          }
          body.port = n;
        }
        if (database.trim()) body.database = database.trim();
        if (username.trim()) body.username = username.trim();
        if (dbSecretRef) body.secret_ref = dbSecretRef;
      }
      return editing && dbRow
        ? datasourcesService.updateData(dbRow.id, body)
        : datasourcesService.createData(body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TOOLS_KEY });
      toast.success(editing ? 'Tool updated.' : 'Tool created.');
      onClose();
    },
    onError: (e: unknown) => {
      const message = e instanceof Error
        ? e.message
        : apiErrorMessage(e, 'Could not save this tool.');
      setError(message);
    },
  });

  const toggleMethod = (method: string) =>
    setMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]);

  return (
    <Modal size="lg" label={editing ? 'Edit tool' : 'New tool'} onClose={onClose}>
      <div className="p-5 border-b border-border flex items-start justify-between gap-4 shrink-0">
        <div>
          <h2 className="font-semibold text-lg">{editing ? 'Edit tool' : 'New tool'}</h2>
          <p className="text-[13px] text-muted-foreground mt-1">
            {editing
              ? 'Yours alone — editing never affects anyone you shared it with.'
              : 'Yours alone until you share it. Credentials stay in your vault.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-secondary text-muted-foreground shrink-0"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <ModalBody>
        <div className="space-y-4">
          {!editing && (
            <div className="flex p-1 bg-muted rounded-lg border border-border">
              {(['api', 'data'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => { setKind(k); setError(null); }}
                  className={cn(
                    'flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
                    kind === k
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {k === 'api' ? 'API' : 'Database'}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="px-3 py-2 rounded bg-destructive-subtle border border-destructive/20 text-[13px] text-destructive">
              {error}
            </div>
          )}

          <Field label="Name">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={kind === 'api' ? 'Acme orders API' : 'Warehouse'}
              className={inputClass}
            />
          </Field>

          {kind === 'api' ? (
            <>
              <Field label="Base URL" hint="Internal hosts are refused — a tool can only reach the public internet your runs allow.">
                <input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.example.com"
                  inputMode="url"
                  className={inputClass}
                />
              </Field>
              <Field label="Authentication">
                <select
                  value={authType}
                  onChange={(e) => setAuthType(e.target.value as typeof authType)}
                  className={inputClass}
                >
                  <option value="none">None — public API</option>
                  <option value="bearer">Bearer token</option>
                  <option value="basic">Basic auth</option>
                  <option value="header">API key in header</option>
                  <option value="query">API key in query</option>
                </select>
              </Field>
              {authType !== 'none' && (
                <Field
                  label="Credential"
                  hint="A reference travels, never the value. The model never sees it either."
                >
                  <select
                    value={secretRef}
                    onChange={(e) => setSecretRef(e.target.value)}
                    className={inputClass}
                    disabled={secretsLoading}
                  >
                    <option value="">Choose…</option>
                    {secretOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {!secretsLoading && secretOptions.length === 0 && (
                    <span className="block text-[11px] text-muted-foreground mt-1">
                      No credentials yet — add one on Credentials first.
                    </span>
                  )}
                </Field>
              )}
              {authType === 'header' && (
                <Field label="Header name">
                  <input
                    value={headerName}
                    onChange={(e) => setHeaderName(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              )}
              {authType === 'query' && (
                <Field label="Query parameter">
                  <input
                    value={paramName}
                    onChange={(e) => setParamName(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              )}
              <Field
                label="Allowed methods"
                hint="Empty means read-only (GET, HEAD). Anything else pauses for a human."
              >
                <div className="flex flex-wrap gap-1.5">
                  {API_METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleMethod(m)}
                      className={cn(
                        'px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors',
                        methods.includes(m)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-border/60 hover:text-foreground',
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="OpenAPI spec (optional)" hint="Paste the JSON — only the operation index is read.">
                <textarea
                  value={specText}
                  onChange={(e) => setSpecText(e.target.value)}
                  rows={3}
                  placeholder='{"paths": {"/orders": {"get": {"summary": "List orders"}}}}'
                  className={cn(inputClass, 'font-mono text-[12px]')}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Kind">
                <select
                  value={dbKind}
                  onChange={(e) => setDbKind(e.target.value)}
                  className={inputClass}
                  disabled={editing}
                >
                  {DB_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k === 'sqlite' ? 'SQLite file in your workspace' : k}
                    </option>
                  ))}
                </select>
              </Field>
              {dbKind === 'sqlite' ? (
                <Field label="Workspace path" hint="A .db file in your own files.">
                  <input
                    value={vfsPath}
                    onChange={(e) => setVfsPath(e.target.value)}
                    placeholder="/Chat/sales.db"
                    className={inputClass}
                  />
                </Field>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Host">
                      <input
                        value={host}
                        onChange={(e) => setHost(e.target.value)}
                        placeholder="db.example.com"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Port (optional)">
                      <input
                        value={port}
                        onChange={(e) => setPort(e.target.value)}
                        placeholder="5432"
                        inputMode="numeric"
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Database (optional)">
                      <input
                        value={database}
                        onChange={(e) => setDatabase(e.target.value)}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Username (optional)">
                      <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  <Field label="Password (optional)" hint="Stored as a vault reference.">
                    <select
                      value={dbSecretRef}
                      onChange={(e) => setDbSecretRef(e.target.value)}
                      className={inputClass}
                      disabled={secretsLoading}
                    >
                      <option value="">None</option>
                      {secretOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </Field>
                  <label className="flex items-start gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      checked={allowWrite}
                      onChange={(e) => setAllowWrite(e.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-medium">Allow writes</span>
                      <span className="block text-[11px] text-muted-foreground">
                        Offers execute_sql for this connection. Reads never need it.
                      </span>
                    </span>
                  </label>
                </>
              )}
            </>
          )}
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          loading={save.isPending}
          onClick={() => { setError(null); save.mutate(); }}
        >
          {!save.isPending && (editing ? 'Save' : 'Create tool')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Share dialog
// ---------------------------------------------------------------------------

const VISIBILITIES: { value: ShareVisibility; label: string; hint: string }[] = [
  { value: 'link', label: 'Link only', hint: 'Reachable by link, listed nowhere.' },
  { value: 'platform', label: 'Platform', hint: 'Listed to signed-in users.' },
  { value: 'public', label: 'Public', hint: 'Listed to everyone.' },
];

export function ShareToolDialog({
  kind,
  id,
  name,
  onClose,
}: {
  kind: CustomToolKind;
  id: number;
  name: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<ShareVisibility>('platform');
  const [error, setError] = useState<string | null>(null);
  const [justShared, setJustShared] = useState<string | null>(null);

  const preview = useQuery({
    queryKey: [...TOOLS_KEY, 'share-preview', kind, id],
    queryFn: () => datasourcesService.sharePreview(kind, id),
  });

  const publish = useMutation({
    mutationFn: () =>
      datasourcesService.publish(kind, id, {
        tagline: tagline.trim(), description: description.trim(), visibility,
      }),
    onSuccess: (share) => {
      queryClient.invalidateQueries({ queryKey: TOOLS_KEY });
      setJustShared(share.slug);
    },
    onError: (e: unknown) => setError(apiErrorMessage(e, 'Could not share this tool.')),
  });

  const withdraw = useMutation({
    mutationFn: () => datasourcesService.withdraw(kind, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TOOLS_KEY });
      onClose();
      toast.success('Withdrawn from the listing. Installs keep working.');
    },
    onError: (e: unknown) => setError(apiErrorMessage(e, 'Could not withdraw.')),
  });

  const published = preview.data?.published;
  const needs = preview.data?.auth_shape?.needs;
  const link = justShared ?? (published ? preview.data?.slug ?? null : null);

  return (
    <Modal size="sm" label={`Share ${name}`} onClose={onClose}>
      <div className="p-5 border-b border-border shrink-0">
        <h2 className="font-semibold text-lg">Share {name}</h2>
        <p className="text-[13px] text-muted-foreground mt-1">
          Installers get a frozen copy. Your credentials never travel —
          {needs
            ? ` they link their own ${needs.slug} credential after installing.`
            : ' this tool needs no credential.'}
        </p>
      </div>
      <ModalBody>
        <div className="space-y-4">
          {error && (
            <div className="px-3 py-2 rounded bg-destructive-subtle border border-destructive/20 text-[13px] text-destructive">
              {error}
            </div>
          )}
          {link ? (
            <div>
              <span className="text-[12px] font-semibold text-muted-foreground">
                Anyone with this slug can install it
              </span>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-background border border-border rounded text-sm font-mono truncate">
                  {link}
                </code>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(link);
                    toast.success('Link copied.');
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Field label="One-line description">
                <input
                  value={tagline || preview.data?.tagline || ''}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="What it reaches, not how"
                  className={inputClass}
                />
              </Field>
              <Field label="Longer pitch (optional)">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className={inputClass}
                />
              </Field>
              <Field label="Visibility">
                <div className="space-y-1.5">
                  {VISIBILITIES.map((v) => (
                    <label key={v.value} className="flex items-start gap-2 text-[13px]">
                      <input
                        type="radio"
                        name="tool-visibility"
                        checked={visibility === v.value}
                        onChange={() => setVisibility(v.value)}
                        className="mt-1"
                      />
                      <span>
                        <span className="font-medium">{v.label}</span>
                        <span className="block text-[11px] text-muted-foreground">{v.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </Field>
            </>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        {published && !link && (
          <Button variant="ghost" size="sm" loading={withdraw.isPending} onClick={() => withdraw.mutate()}>
            Withdraw
          </Button>
        )}
        <div className="flex-1" />
        <Button variant="secondary" size="sm" onClick={onClose}>
          {link ? 'Done' : 'Cancel'}
        </Button>
        {!link && (
          <Button
            variant="primary"
            size="sm"
            loading={publish.isPending || preview.isLoading}
            onClick={() => {
              if (!tagline.trim()) {
                setError('A one-line description is required.');
                return;
              }
              setError(null);
              publish.mutate();
            }}
          >
            Share
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Install from link
// ---------------------------------------------------------------------------

export function InstallFromLinkDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; needs?: { slug: string; field: string } } | null>(null);

  const install = useMutation({
    mutationFn: async () => {
      const slug = parseToolShareSlug(text);
      if (!slug) throw new Error('Paste a share link or slug.');
      const preview = await datasourcesService.getShared(slug);
      const result = await datasourcesService.installShared(slug);
      return { preview, result };
    },
    onSuccess: ({ preview, result }) => {
      queryClient.invalidateQueries({ queryKey: TOOLS_KEY });
      const needs = result.credentials_needed[0];
      setDone({ name: preview.name, needs });
    },
    onError: (e: unknown) => {
      const message = e instanceof Error
        ? e.message
        : apiErrorMessage(e, 'Could not install this tool.');
      setError(message);
    },
  });

  return (
    <Modal size="sm" label="Install a shared tool" onClose={onClose}>
      <div className="p-5 border-b border-border shrink-0">
        <h2 className="font-semibold text-lg">Install a shared tool</h2>
        <p className="text-[13px] text-muted-foreground mt-1">
          You get a private copy. Its auth starts empty — link your own credential after.
        </p>
      </div>
      <ModalBody>
        <div className="space-y-4">
          {error && (
            <div className="px-3 py-2 rounded bg-destructive-subtle border border-destructive/20 text-[13px] text-destructive">
              {error}
            </div>
          )}
          {done ? (
            <div className="px-3 py-2 rounded bg-success-subtle border border-border text-[13px]">
              <span className="font-semibold">{done.name}</span> installed.
              {done.needs && (
                <span className="block text-muted-foreground mt-1">
                  Link your own <span className="font-mono">{done.needs.slug}</span> credential
                  on this page before it can call anything authenticated.
                </span>
              )}
            </div>
          ) : (
            <Field label="Share link or slug">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="acme-orders-api"
                className={cn(inputClass, 'font-mono')}
              />
            </Field>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" size="sm" onClick={onClose}>
          {done ? 'Done' : 'Cancel'}
        </Button>
        {!done && (
          <Button
            variant="primary"
            size="sm"
            loading={install.isPending}
            onClick={() => { setError(null); install.mutate(); }}
          >
            Install
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// "My tools" section
// ---------------------------------------------------------------------------

type Row =
  | { kind: 'api'; row: ApiConnection }
  | { kind: 'data'; row: DataConnection };

export function MyToolsSection({
  onNew,
  onInstallLink,
}: {
  onNew: () => void;
  onInstallLink: () => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Row | null>(null);
  const [sharingRow, setSharingRow] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);

  const apis = useQuery({
    queryKey: [...TOOLS_KEY, 'api'],
    queryFn: () => datasourcesService.listApi(),
    staleTime: 60 * 1000,
  });
  const dbs = useQuery({
    queryKey: [...TOOLS_KEY, 'data'],
    queryFn: () => datasourcesService.listData(),
    staleTime: 60 * 1000,
  });

  const rows: Row[] = useMemo(
    () => [
      ...(apis.data ?? []).map((row): Row => ({ kind: 'api', row })),
      ...(dbs.data ?? []).map((row): Row => ({ kind: 'data', row })),
    ],
    [apis.data, dbs.data],
  );

  const remove = useMutation({
    mutationFn: (row: Row) =>
      row.kind === 'api'
        ? datasourcesService.deleteApi(row.row.id)
        : datasourcesService.deleteData(row.row.id),
    onSuccess: (_, row) => {
      queryClient.invalidateQueries({ queryKey: TOOLS_KEY });
      toast.success(`"${row.row.name}" deleted.`);
      setDeleting(null);
    },
    onError: (e: unknown) =>
      toast.error(apiErrorMessage(e, 'Could not delete this tool.')),
  });

  const subtitle = (row: Row) =>
    row.kind === 'api'
      ? row.row.base_url
      : row.kind === 'data' && row.row.kind === 'sqlite'
        ? row.row.vfs_path
        : `${row.row.kind} · ${row.row.host || 'no host'}`;

  const authState = (row: Row): string => {
    if (row.kind === 'api') {
      return row.row.auth.type === 'none' || !row.row.auth.secret_ref
        ? 'No auth'
        : 'Credential linked';
    }
    return row.row.secret_ref ? 'Credential linked' : 'No auth';
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">My tools</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Connections you created. Private to you until you share them.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onInstallLink}
            className="text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Install from link
          </button>
          <button
            type="button"
            onClick={onNew}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New tool
          </button>
        </div>
      </div>

      {apis.isLoading || dbs.isLoading ? (
        <div className="h-16 rounded-lg bg-card border border-border/60 animate-pulse" />
      ) : rows.length === 0 ? (
        <div className="rounded-lg bg-card border border-border/60 px-4 py-6 text-center">
          <KeyRound className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm font-semibold">No custom tools yet</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            Connect your API or database once — your chats and agents call it from then on.
          </p>
        </div>
      ) : (
        <div className="rounded-lg bg-card border border-border/60 divide-y divide-border/60">
          {rows.map((row) => (
            <div key={`${row.kind}-${row.row.id}`} className="flex items-center gap-3 px-4 py-2.5">
              <span className="p-1.5 bg-primary/10 rounded-md shrink-0">
                {row.kind === 'api'
                  ? <Globe className="w-4 h-4 text-primary" />
                  : <Database className="w-4 h-4 text-primary" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold truncate">{row.row.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {subtitle(row)} · {authState(row)}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditing(row)}
                  title="Edit"
                  aria-label={`Edit ${row.row.name}`}
                  className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setSharingRow(row)}
                  title="Share"
                  aria-label={`Share ${row.row.name}`}
                  className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(row)}
                  title="Delete"
                  aria-label={`Delete ${row.row.name}`}
                  className="p-1.5 rounded hover:bg-destructive-subtle text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <NewToolDialog
          initial={{ kind: editing.kind, row: editing.row }}
          onClose={() => setEditing(null)}
        />
      )}
      {sharingRow && (
        <ShareToolDialog
          kind={sharingRow.kind}
          id={sharingRow.row.id}
          name={sharingRow.row.name}
          onClose={() => setSharingRow(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete "${deleting.row.name}"?`}
          body="Agents using this tool lose access to it. Shared copies other people installed keep working."
          confirmLabel="Delete"
          busy={remove.isPending}
          onConfirm={() => remove.mutate(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </section>
  );
}
