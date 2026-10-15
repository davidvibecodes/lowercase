import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { toSessionUser, type SessionUser } from "./provider";
import { SESSION_COOKIE, verifySessionValue } from "./session-cookie";

/** The signed-in user for this request, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const userId = verifySessionValue(jar.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  const user = await db.user.findUnique({ where: { id: userId } });
  return user ? toSessionUser(user) : null;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Admin-only pages and actions; non-admins get a 404, not a hint the page exists. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isAdmin) notFound();
  return user;
}

/** For server actions: throws instead of redirecting. */
export async function assertAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) throw new Error("Not authorized");
  return user;
}
