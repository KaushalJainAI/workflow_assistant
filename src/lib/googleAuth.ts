/**
 * Google OAuth is only usable on the origin registered with Google.
 *
 * VITE_GOOGLE_REDIRECT_URI is baked in at build time and points at one host.
 * Served from anywhere else — testing.kaushaljain.com, a preview build, a LAN
 * IP — Google rejects the redirect_uri and the user gets a Google error page
 * with no way back. Offering a button that cannot work is worse than not
 * offering one, so the sign-in pages hide it unless the origins match.
 */
export function googleAuthAvailable(): boolean {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) return false;
  try {
    return new URL(redirectUri).origin === window.location.origin;
  } catch {
    return false;
  }
}
