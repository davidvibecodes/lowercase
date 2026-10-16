/**
 * "Continue with Google" (KTD1, KTD2): OpenID Connect authorization code flow
 * with PKCE, state and nonce through openid-client, behind this seam so the
 * library can be swapped without touching routes or UI. The id_token arrives
 * straight from Google's token endpoint over TLS, so its signature isn't
 * checked; openid-client still checks iss, aud, exp, nonce and state.
 */
import * as oidc from "openid-client";
import { z } from "zod";
import { sign, signatureMatches } from "./session-cookie";

const GOOGLE = {
  issuer: "https://accounts.google.com",
  authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  token_endpoint: "https://oauth2.googleapis.com/token",
  jwks_uri: "https://www.googleapis.com/oauth2/v3/certs",
};

export type GoogleEnv = { clientId: string; clientSecret: string; redirectUri: string };

/** The configured client, or null when sign-in isn't set up yet (R6). */
export function googleEnv(): GoogleEnv | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = (process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/login/google/callback").trim();
  if (!clientId || !clientSecret || clientId.startsWith("your-") || clientSecret.startsWith("your-")) return null;
  return { clientId, clientSecret, redirectUri };
}

/**
 * The test suites' fake IdP (KTD3). Honoured only when the test harness opts
 * in and the URL is loopback: the id_token signature isn't verified, so
 * whatever answers here could claim any email.
 */
function fakeIdpBase(): string | null {
  const base = process.env.GOOGLE_OIDC_BASE_URL;
  if (process.env.LC_FAKE_GOOGLE !== "1" || !base) return null;
  try {
    const { protocol, hostname } = new URL(base);
    return protocol === "http:" && (hostname === "127.0.0.1" || hostname === "localhost") ? base.replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}

let cached: { key: string; config: oidc.Configuration } | null = null;

function configFor(env: GoogleEnv): oidc.Configuration {
  const fake = fakeIdpBase();
  const key = `${env.clientId}|${fake ?? "google"}`;
  if (cached?.key === key) return cached.config;
  const meta = fake
    ? { issuer: fake, authorization_endpoint: `${fake}/authorize`, token_endpoint: `${fake}/token`, jwks_uri: `${fake}/certs` }
    : GOOGLE;
  const config = new oidc.Configuration(meta, env.clientId, {}, oidc.ClientSecretPost(env.clientSecret));
  if (fake) oidc.allowInsecureRequests(config);
  cached = { key, config };
  return config;
}

/** The provider this run talks to; tests use it to prove the fake is or isn't honoured. */
export function googleIssuer(env: GoogleEnv): string {
  return configFor(env).serverMetadata().issuer;
}

export const googleClaims = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  email_verified: z.boolean(),
  name: z.string().optional(),
  given_name: z.string().optional(),
  family_name: z.string().optional(),
  picture: z.string().optional(),
});
export type GoogleClaims = z.infer<typeof googleClaims>;

/** Short codes shown on /login as fixed text, never raw query values (KTD2). */
export const GOOGLE_ERROR_CODES = ["google_cancelled", "google_expired", "google_failed", "google_unverified", "google_conflict", "google_unconfigured"] as const;
export type GoogleErrorCode = (typeof GOOGLE_ERROR_CODES)[number];

/** State, nonce and PKCE verifier for one sign-in attempt, HMAC-signed so another localhost port can't plant one. */
export const OAUTH_COOKIE = "lc_oauth";
export const oauthCookieOptions = { httpOnly: true, sameSite: "lax" as const, path: "/login/google", maxAge: 600, secure: false };

type Pending = { state: string; nonce: string; verifier: string };

function encodePending(p: Pending): string {
  const payload = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `${payload}.${sign(`oauth.${payload}`)}`;
}

function decodePending(raw: string | undefined): Pending | null {
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig || !signatureMatches(`oauth.${payload}`, sig)) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof p.state === "string" && typeof p.nonce === "string" && typeof p.verifier === "string" ? p : null;
  } catch {
    return null;
  }
}

/** Builds the Google authorization URL plus the cookie that must accompany the callback. */
export async function startGoogleSignIn(env: GoogleEnv): Promise<{ url: URL; cookie: string }> {
  const pending: Pending = { state: oidc.randomState(), nonce: oidc.randomNonce(), verifier: oidc.randomPKCECodeVerifier() };
  const url = oidc.buildAuthorizationUrl(configFor(env), {
    redirect_uri: env.redirectUri,
    scope: "openid email profile",
    state: pending.state,
    nonce: pending.nonce,
    code_challenge: await oidc.calculatePKCECodeChallenge(pending.verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return { url, cookie: encodePending(pending) };
}

export type FinishResult = { ok: true; claims: GoogleClaims } | { ok: false; code: GoogleErrorCode };

/** Validates the callback and exchanges the code; never throws. */
export async function finishGoogleSignIn(env: GoogleEnv, search: URLSearchParams, cookie: string | undefined): Promise<FinishResult> {
  if (search.get("error")) return { ok: false, code: search.get("error") === "access_denied" ? "google_cancelled" : "google_failed" };
  const pending = decodePending(cookie);
  if (!pending) return { ok: false, code: "google_expired" };
  // Rebuild the callback URL from the pinned redirect URI, never the Host header.
  const current = new URL(env.redirectUri);
  current.search = search.toString();
  try {
    const tokens = await oidc.authorizationCodeGrant(configFor(env), current, {
      pkceCodeVerifier: pending.verifier,
      expectedState: pending.state,
      expectedNonce: pending.nonce,
      idTokenExpected: true,
    });
    const claims = googleClaims.safeParse(tokens.claims());
    if (!claims.success) return { ok: false, code: "google_failed" };
    // openid-client doesn't check this; an unverified email must never sign in or link (KTD4).
    if (claims.data.email_verified !== true) return { ok: false, code: "google_unverified" };
    return { ok: true, claims: claims.data };
  } catch {
    return { ok: false, code: "google_failed" };
  }
}
