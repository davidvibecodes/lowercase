import type { Db } from "@/lib/db";
import type { PersonRef } from "@/lib/realtime/events";
import { CASE_TYPES } from "@/lib/types";

export class ServiceError extends Error {}

export const personSelect = { id: true, firstName: true, lastName: true, username: true } as const;

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
  if (input.sessionId) {
    const s = await db.caseSession.findUnique({ where: { id: input.sessionId } });
    if (!s || s.status !== "LOBBY" || s.hostId !== fromId || s.guestId) throw new ServiceError("That lobby can't take an invite");
    sessionId = s.id;
    // One open invite per lobby: a new invite replaces an older pending one.
    await db.sessionInvite.updateMany({ where: { sessionId, status: "PENDING" }, data: { status: "CANCELLED" } });
  } else {
    const caseType = CASE_TYPES.includes(input.caseType as never) ? input.caseType! : null;
    const difficulty = input.difficulty && [1, 2, 3].includes(input.difficulty) ? input.difficulty : null;
    const s = await db.caseSession.create({ data: { hostId: fromId, caseType, difficulty } });
    sessionId = s.id;
  }
  const invite = await db.sessionInvite.create({
    data: { sessionId, fromId, toId: input.toUserId },
    include: { from: { select: personSelect }, session: true },
  });
  return invite;
}

export async function acceptInvite(db: Db, inviteId: string, userId: string) {
  const invite = await db.sessionInvite.findUnique({ where: { id: inviteId }, include: { session: true } });
  if (!invite || invite.toId !== userId) throw new ServiceError("Invite not found");
  if (invite.status !== "PENDING") throw new ServiceError("This invite is no longer open");
  const s = invite.session;
  if (s.status !== "LOBBY" || (s.guestId && s.guestId !== userId)) throw new ServiceError("This session is no longer open");
  await db.$transaction([
    db.caseSession.update({ where: { id: s.id }, data: { guestId: userId } }),
    db.sessionInvite.update({ where: { id: inviteId }, data: { status: "ACCEPTED" } }),
  ]);
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
  return db.user.findUnique({ where: { id }, select: personSelect });
}
