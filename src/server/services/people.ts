import type { Db } from "@/lib/db";
import type { PersonRef } from "@/lib/realtime/events";

export const personSelect = { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } as const;

/** Only people who finished onboarding are listed or found (KTD7). */
export const onboarded = { username: { not: null } } as const;

type PersonRow = { id: string; firstName: string; lastName: string; username: string | null; avatarUrl?: string | null };

/**
 * Narrows a person row for display. Every person reachable from a session, an
 * invite or a list has a username: the guards and the socket handshake refuse
 * anyone who hasn't chosen one, and lists filter with `onboarded`.
 */
export function toPerson(u: PersonRow): PersonRef {
  return { id: u.id, firstName: u.firstName, lastName: u.lastName, username: u.username ?? "", avatarUrl: u.avatarUrl ?? null };
}

export async function areFriends(db: Db, a: string, b: string) {
  return (await db.friendship.count({ where: { userId: a, friendId: b } })) > 0;
}

export async function person(db: Db, id: string): Promise<PersonRef | null> {
  const u = await db.user.findUnique({ where: { id }, select: personSelect });
  return u ? toPerson(u) : null;
}
