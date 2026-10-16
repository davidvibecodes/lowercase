import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { cache } from "react";
import { db } from "@/lib/db";
import { ServiceError } from "@/server/services/invites";
import { toSessionUser, type SessionUser } from "./provider";
import { SESSION_COOKIE, verifySessionValue, type AuthMethod } from "./session-cookie";

/** A signed-in user who has chosen a username (R7). */
export type OnboardedUser = SessionUser & { username: string };

export type CurrentSession = { user: SessionUser; method: AuthMethod };

/** The signed-in session for this request, or null. Cached per request. */
export const getSession = cache(async (): Promise<CurrentSession | null> => {
  const jar = await cookies();
  const verified = verifySessionValue(jar.get(SESSION_COOKIE)?.value);
  if (!verified) return null;
  const user = await db.user.findUnique({ where: { id: verified.userId } });
  return user ? { user: toSessionUser(user, verified.method), method: verified.method } : null;
});

export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await getSession())?.user ?? null;
}

/** Signed in, username optional: only the onboarding step and its check/save endpoints use this. */
export async function requireSignedIn(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Every app page, action and route handler: signed in and onboarded (KTD6). */
export async function requireUser(): Promise<OnboardedUser> {
  const user = await requireSignedIn();
  if (!user.username) redirect("/onboarding/username");
  return user as OnboardedUser;
}

/** Admin-only pages: everyone else lands on home (R12). */
export async function requireAdmin(): Promise<OnboardedUser> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/");
  return user;
}

/** For server actions: throws a ServiceError so action wrappers return { ok: false, error: "Not authorized" } (R13). */
export async function assertAdmin(): Promise<OnboardedUser> {
  const user = await getCurrentUser();
  if (!user?.isAdmin || !user.username) throw new ServiceError("Not authorized");
  return user as OnboardedUser;
}

/** The origin route handlers accept non-GET requests from (KTD6). */
function allowedOrigins(): string[] {
  const port = process.env.PORT ?? "3000";
  return [`http://localhost:${port}`, `http://127.0.0.1:${port}`];
}

/**
 * Wraps an admin route handler. Authorizes before the body is read (403 for
 * anyone else) and, for non-GET requests, requires a JSON body from our own
 * origin: route handlers get none of the Origin checks Next gives server actions.
 */
export function adminRoute(handler: (req: NextRequest, admin: OnboardedUser) => Promise<Response>) {
  return async (req: NextRequest): Promise<Response> => {
    const admin = await getCurrentUser();
    if (!admin?.isAdmin || !admin.username) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (req.method !== "GET") {
      const origin = req.headers.get("origin");
      const type = req.headers.get("content-type") ?? "";
      if (!origin || !allowedOrigins().includes(origin) || !type.startsWith("application/json")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    return handler(req, admin as OnboardedUser);
  };
}
