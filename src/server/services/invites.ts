import { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";
import type { PersonRef } from "@/lib/realtime/events";
import type { z } from "zod";
import { isCaseType, isDifficulty } from "@/lib/types";

export class ServiceError extends Error {}

/** A unique-index violation: the database decided a race (P2002). */
export function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/** Validates input with a zod schema, surfacing the first issue as a ServiceError. */
export function parseInput<T>(schema: z.ZodType<T>, v: unknown): T {
  const r = schema.safeParse(v);
  if (!r.success) throw new ServiceError(r.error.issues[0]?.message ?? "Invalid input");
  return r.data;
}

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

export type SendInviteInput = { toUserId: string; sessionId?: string; caseType?: string; difficulty?: number };

/**
 * Creates (or reuses) a lobby and a PENDING invite (U4). With `sessionId`, the
 * invite attaches to the sender's own partnerless lobby and keeps its preselection.
 */
export async function sendInvite(db: Db, fromId: string, input: SendInviteInput, isOnline: (userId: string) => boolean) {
  if (input.toUserId === fromId) throw new ServiceError("You can't invite yourself");
  if (!(await areFriends(db, fromId, input.toUserId))) throw new ServiceError("You can only invite friends");
  if (!isOnline(input.toUserId)) throw new ServiceError("Friend must be online");

  let sessionId: string;
  let replaced: Array<{ id: string; toId: string }> = [];
  if (input.sessionId) {
    const s = await db.caseSession.findUnique({ where: { id: input.sessionId } });
    if (!s || s.status !== "LOBBY" || s.hostId !== fromId || s.guestId) throw new ServiceError("That lobby can't take an invite");
    sessionId = s.id;
    // One open invite per lobby: a new invite replaces an older pending one.
    replaced = await db.sessionInvite.findMany({ where: { sessionId, status: "PENDING" }, select: { id: true, toId: true } });
    await db.sessionInvite.updateMany({ where: { id: { in: replaced.map((r) => r.id) } }, data: { status: "CANCELLED" } });
  } else {
    const caseType = isCaseType(input.caseType) ? input.caseType : null;
    const difficulty = isDifficulty(input.difficulty) ? input.difficulty : null;
    const s = await db.caseSession.create({ data: { hostId: fromId, caseType, difficulty } });
    sessionId = s.id;
  }
  const invite = await db.sessionInvite.create({
    data: { sessionId, fromId, toId: input.toUserId },
    include: { from: { select: personSelect }, session: true },
  });
  return { ...invite, from: toPerson(invite.from), replaced };
}

export async function acceptInvite(db: Db, inviteId: string, userId: string) {
  const invite = await db.sessionInvite.findUnique({ where: { id: inviteId }, include: { session: true } });
  if (!invite || invite.toId !== userId) throw new ServiceError("Invite not found");
  if (invite.status !== "PENDING") throw new ServiceError("This invite is no longer open");
  const s = invite.session;
  if (s.status !== "LOBBY" || (s.guestId && s.guestId !== userId)) throw new ServiceError("This session is no longer open");
  // Conditional writes: a cancel, expiry or close that lands meanwhile wins.
  await db.$transaction(async (tx) => {
    const inv = await tx.sessionInvite.updateMany({ where: { id: inviteId, status: "PENDING" }, data: { status: "ACCEPTED" } });
    if (inv.count === 0) throw new ServiceError("This invite is no longer open");
    const ses = await tx.caseSession.updateMany({
      where: { id: s.id, status: "LOBBY", OR: [{ guestId: null }, { guestId: userId }] },
      data: { guestId: userId },
    });
    if (ses.count === 0) throw new ServiceError("This session is no longer open");
  });
  return { sessionId: s.id, fromId: invite.fromId };
}

/** Recipient declines. Returns the sender id to notify. */
export async function declineInvite(db: Db, inviteId: string, userId: string) {
  const invite = await db.sessionInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.toId !== userId) throw new ServiceError("Invite not found");
  if (invite.status !== "PENDING") return null;
  await db.sessionInvite.update({ where: { id: inviteId }, data: { status: "DECLINED" } });
  return invite.fromId;
}

/** Sender cancels. Returns the recipient id to notify. */
export async function cancelInvite(db: Db, inviteId: string, userId: string) {
  const invite = await db.sessionInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.fromId !== userId) throw new ServiceError("Invite not found");
  if (invite.status !== "PENDING") return null;
  await db.sessionInvite.update({ where: { id: inviteId }, data: { status: "CANCELLED" } });
  return invite.toId;
}

/** Marks a still-pending invite expired. Returns it when it changed, else null. */
export async function expireInvite(db: Db, inviteId: string) {
  const changed = await db.sessionInvite.updateMany({ where: { id: inviteId, status: "PENDING" }, data: { status: "EXPIRED" } });
  if (changed.count === 0) return null;
  return db.sessionInvite.findUnique({ where: { id: inviteId } });
}

export async function person(db: Db, id: string): Promise<PersonRef | null> {
  const u = await db.user.findUnique({ where: { id }, select: personSelect });
  return u ? toPerson(u) : null;
}
