/**
 * Google OAuth scopes to request per connection.
 *
 * The backend's default scope set is Sheets + read-only Drive, which is right for
 * nothing in particular: connecting Gmail with it produces a token that cannot
 * read mail, so the connection reports success and then fails on first use.
 * Each connector asks for what it actually needs.
 *
 * Keyed on `icon_slug`, the same stable identifier the icon map uses.
 *
 * Connecting a second Google service re-runs the flow, and the auth URL is built
 * with `include_granted_scopes=true`, so the newer token also carries the scopes
 * already granted. Since credential lookup takes the most recently updated row,
 * connecting Gmail after Calendar keeps both working.
 */
export const GOOGLE_SCOPES: Record<string, string[]> = {
  /* `gmail.modify` alone cannot send: the connector ships `send_message` and
     `create_draft`, and a connection that reports success and then fails on the
     first send is the exact failure this map exists to prevent.
     `settings.basic` covers the vacation/filter/forwarding tools.
     `settings.sharing` (delegates, send-as, S/MIME) is deliberately NOT asked
     for — it is a restricted scope that drags the whole app into a heavier
     Google verification review, and it buys a handful of rarely-used tools. */
  gmail: [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.settings.basic',
  ],
  'google-calendar': ['https://www.googleapis.com/auth/calendar'],
  /* Drive and Sheets are ONE package (`@isaacphi/mcp-gdrive`) exposing four
     tools: gdrive_search, gdrive_read_file, gsheets_read, gsheets_update_cell.
     So both connectors need both scopes — a user who connects only Sheets and
     is then offered gdrive_search would watch it fail on a missing scope, which
     is the "connected, then broken on first use" failure this map exists to
     prevent. Keep these two lists identical while they share a package.
     `drive.readonly` rather than full `drive`: the package never writes to
     Drive, and the narrower scope is a smaller ask on the consent screen. */
  'google-sheets': [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly',
  ],
  'google-drive': [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly',
  ],
  /* Docs has no working connector; kept so the row still resolves if one lands. */
  'google-docs': ['https://www.googleapis.com/auth/documents'],
};

/**
 * Scopes for a connector, or undefined to let the backend choose. Undefined is
 * correct for a connector we have no mapping for: guessing a scope would fail
 * the authorisation outright, while the backend default at least completes.
 */
export function googleScopesFor(iconSlug: string | undefined): string[] | undefined {
  if (!iconSlug) return undefined;
  return GOOGLE_SCOPES[iconSlug];
}
