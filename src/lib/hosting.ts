/**
 * Hosted mode: lowercase is built to run on one machine's loopback, and it
 * becomes a public website only when PUBLIC_ORIGIN names its address. Unset,
 * everything keeps the local behaviour (loopback hosts, test login, http cookies).
 * Set, the Host/Origin checks pin to that address, cookies are Secure over
 * https, and the passwordless test login is off whatever AUTH_MODE says.
 */

const LOOPBACK_NAMES = ["localhost", "127.0.0.1"];

/** The public origin ("https://example.com", no path), or null when running locally. Throws on a malformed value. */
export function publicOrigin(env: Record<string, string | undefined> = process.env): string | null {
  const raw = env.PUBLIC_ORIGIN?.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`PUBLIC_ORIGIN "${raw}" is not a valid URL. Use something like https://trylowercase.app`);
  }
  const loopback = LOOPBACK_NAMES.includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error("PUBLIC_ORIGIN must start with https:// (plain http is allowed only for localhost).");
  }
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    throw new Error("PUBLIC_ORIGIN must be just the origin, with no path, query or credentials.");
  }
  return url.origin;
}

export const isHosted = (): boolean => publicOrigin() !== null;

/** Session and sign-in cookies are Secure exactly when the public address is https. */
export const cookiesSecure = (): boolean => publicOrigin()?.startsWith("https:") ?? false;

const placeholder = (v: string | undefined) => !v || !v.trim() || /^(your-|replace-with)/i.test(v.trim());

/**
 * What a hosted server must have before it starts. Returns one line per
 * problem; empty means ready. Not hosted means nothing to check.
 */
export function hostedConfigProblems(env: Record<string, string | undefined> = process.env): string[] {
  let origin: string | null;
  try {
    origin = publicOrigin(env);
  } catch (e) {
    return [(e as Error).message];
  }
  if (!origin) return [];
  const problems: string[] = [];
  const secret = env.AUTH_SECRET?.trim();
  if (placeholder(secret) || secret!.length < 32) problems.push("AUTH_SECRET must be set to a random string of at least 32 characters (for example: openssl rand -hex 32).");
  if (placeholder(env.DATABASE_URL)) problems.push("DATABASE_URL must point at the persistent disk, for example file:/data/lowercase.db.");
  if (placeholder(env.GOOGLE_CLIENT_ID) || placeholder(env.GOOGLE_CLIENT_SECRET)) {
    problems.push("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set; the public site signs in only with Google.");
  }
  const expected = `${origin}/login/google/callback`;
  const redirect = env.GOOGLE_REDIRECT_URI?.trim();
  if (redirect !== expected) problems.push(`GOOGLE_REDIRECT_URI must be exactly ${expected}`);
  return problems;
}
