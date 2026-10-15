import { NextResponse, type NextRequest } from "next/server";
import { authProvider } from "@/lib/auth/dev-provider";
import { createSessionValue, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session-cookie";

/**
 * Peer-tester entry (KTD4): opened on the other hostname, signs in a seeded
 * friend and lands on the home page. Route handlers may set cookies; pages may not.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  // Redirect on the host the browser used: the cookie is scoped to it.
  const origin = `${req.nextUrl.protocol}//${req.headers.get("host") ?? req.nextUrl.host}`;
  const result = await authProvider.signIn({ username });
  if (!result.ok) {
    const url = new URL("/login", origin);
    url.searchParams.set("error", result.error);
    return NextResponse.redirect(url);
  }
  const res = NextResponse.redirect(new URL("/", origin));
  res.cookies.set(SESSION_COOKIE, createSessionValue(result.user.id), sessionCookieOptions);
  return res;
}
