/** Fixed copy for /login?error=<code>; unknown codes get the generic line, never the raw value (KTD2). */
const MESSAGES: Record<string, string> = {
  google_cancelled: "Google sign-in was cancelled.",
  google_expired: "Your sign-in took too long or was interrupted. Try again.",
  google_failed: "Google sign-in didn't complete. Try again.",
  google_unverified: "That Google account's email address isn't verified.",
  google_conflict: "That email is already linked to a different Google account.",
  google_unconfigured: "Google sign-in isn't set up yet. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI to .env (see README).",
};

export function loginErrorMessage(code: string | undefined): string | undefined {
  if (!code) return undefined;
  return MESSAGES[code] ?? "Something went wrong signing in. Try again.";
}
