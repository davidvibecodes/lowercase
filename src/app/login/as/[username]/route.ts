import { NextResponse, type NextRequest } from "next/server";
import { authProvider } from "@/lib/auth/dev-provider";
import { createSessionValue, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session-cookie";

/**
 * Peer-tester entry (KTD4): opened on the other hostname, signs in a seeded
 * friend and lands on the home page. Route handlers may set cookies; pages may not.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const result = await authProvider.signIn({ username });
  const url = req.nextUrl.clone();
  url.search = "";
  if (!result.ok) {
    url.pathname = "/login";
    url.searchParams.set("error", result.error);
    return NextResponse.redirect(url);
  }
  url.pathname = "/";
  const res = NextResponse.redirect(url);
  res.cookies.set(SESSION_COOKIE, createSessionValue(result.user.id), sessionCookieOptions);
  return res;
}
