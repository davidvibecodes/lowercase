import { NextResponse, type NextRequest } from "next/server";
import { finishGoogleSignIn, googleEnv, OAUTH_COOKIE, oauthCookieOptions, type GoogleErrorCode } from "@/lib/auth/google";
import { createSessionValue, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session-cookie";
import { db } from "@/lib/db";
import { resolveGoogleUser } from "@/server/services/google-account";

export const dynamic = "force-dynamic";

/** Google redirects here (KTD2). Every outcome clears the one-time sign-in cookie. */
export async function GET(req: NextRequest) {
  const env = googleEnv();
  const origin = env ? new URL(env.redirectUri).origin : `${req.nextUrl.protocol}//${req.headers.get("host") ?? req.nextUrl.host}`;
  const done = (path: string) => {
    const res = NextResponse.redirect(new URL(path, origin));
    res.cookies.set(OAUTH_COOKIE, "", { ...oauthCookieOptions, maxAge: 0 });
    return res;
  };
  const fail = (code: GoogleErrorCode) => done(`/login?error=${code}`);

  if (!env) return fail("google_unconfigured");
  const result = await finishGoogleSignIn(env, req.nextUrl.searchParams, req.cookies.get(OAUTH_COOKIE)?.value);
  if (!result.ok) return fail(result.code);
  const resolved = await resolveGoogleUser(db, result.claims);
  if (!resolved.ok) return fail(resolved.code);

  // A user without a username lands on the onboarding step via requireUser (R7).
  const res = done("/");
  res.cookies.set(SESSION_COOKIE, createSessionValue(resolved.user.id, "google"), sessionCookieOptions);
  return res;
}
