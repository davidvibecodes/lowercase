import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { cache } from "react";
import { db } from "@/lib/db";
import { allowedOrigins } from "@/server/loopback";
import { ServiceError } from "@/server/services/invites";
import { devSessionAllowed } from "./dev-provider";
import { toSessionUser, type SessionUser } from "./provider";
import { SESSION_COOKIE, verifySessionValue } from "./session-cookie";

/** A signed-in user who has chosen a username (R7). */
export type OnboardedUser = SessionUser & { username: string };

const isOnboarded = (u: SessionUser): u is OnboardedUser => Boolean(u.username);

/** The signed-in user for this request, or null. Cached per request; admin follows the sign-in method (KTD5). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const verified = verifySessionValue(jar.get(SESSION_COOKIE)?.value);
  if (!verified) return null;
  const user = await db.user.findUnique({ where: { id: verified.userId } });
  if (!user || (verified.method === "dev" && !devSessionAllowed(user))) return null;
  return toSessionUser(user, verified.method);
});

/** Signed in, username optional: only the onboarding step and its check/save endpoints use this. */
export async function requireSignedIn(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Every app page, action and route handler: signed in and onboarded (KTD6). */
export async function requireUser(): Promise<OnboardedUser> {
  const user = await requireSignedIn();
  if (!isOnboarded(user)) redirect("/onboarding/username");
  return user;
}

/** Admin-only pages: everyone else lands on home (R12). */
export async function requireAdmin(): Promise<OnboardedUser> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/");
  return user;
}

const asAdmin = (u: SessionUser | null): OnboardedUser | null => (u?.isAdmin && isOnboarded(u) ? u : null);

/** For server actions: throws a ServiceError so action wrappers return { ok: false, error: "Not authorized" } (R13). */
export async function assertAdmin(): Promise<OnboardedUser> {
  const admin = asAdmin(await getCurrentUser());
  if (!admin) throw new ServiceError("Not authorized");
  return admin;
}

/**
 * Wraps an admin route handler. Authorizes before the body is read (403 for
 * anyone else) and, for non-GET requests, requires a JSON body from our own
 * origin: route handlers get none of the Origin checks Next gives server actions.
 */
export function adminRoute(handler: (req: NextRequest, admin: OnboardedUser) => Promise<Response>) {
  return async (req: NextRequest): Promise<Response> => {
    const admin = asAdmin(await getCurrentUser());
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (req.method !== "GET") {
      // Exact match: unlike Socket.IO's check, a missing or differently-cased Origin is refused here.
      const origin = req.headers.get("origin");
      const type = req.headers.get("content-type") ?? "";
      if (!origin || !allowedOrigins(process.env.PORT ?? "3000").includes(origin) || !type.startsWith("application/json")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    return handler(req, admin);
  };
}
