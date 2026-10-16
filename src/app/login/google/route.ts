import { NextResponse, type NextRequest } from "next/server";
import { googleEnv, OAUTH_COOKIE, oauthCookieOptions, startGoogleSignIn } from "@/lib/auth/google";

export const dynamic = "force-dynamic";

/** Starts "Continue with Google" (KTD2). Lives under /login so middleware lets cookie-less visitors through. */
export async function GET(req: NextRequest) {
  const env = googleEnv();
  const host = req.headers.get("host") ?? req.nextUrl.host;
  if (!env) return NextResponse.redirect(new URL(`/login?error=google_unconfigured`, `${req.nextUrl.protocol}//${host}`));
  // Cookies are per host: start on the host Google will redirect back to.
  const pinned = new URL(env.redirectUri);
  if (host !== pinned.host) return NextResponse.redirect(new URL("/login/google", pinned.origin));
  const { url, cookie } = await startGoogleSignIn(env);
  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_COOKIE, cookie, oauthCookieOptions);
  return res;
}
