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
  gmail: ['https://www.googleapis.com/auth/gmail.modify'],
  'google-calendar': ['https://www.googleapis.com/auth/calendar'],
  'google-sheets': ['https://www.googleapis.com/auth/spreadsheets'],
  'google-docs': ['https://www.googleapis.com/auth/documents'],
  'google-drive': ['https://www.googleapis.com/auth/drive'],
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
