import type { Db } from "@/lib/db";
import type { PersonRef } from "@/lib/realtime/events";
import { normalizeUsername } from "@/lib/username";
import { getGroupStandings } from "./home";
import { ServiceError, areFriends, isUniqueViolation, onboarded, personSelect, toPerson } from "./invites";

/**
 * Friends & Groups (R17–R22, KTD8). Friendships and memberships change only
 * through requests and invites. Each request carries an open key that is set
 * only while PENDING, so the unique index allows one open request per pair;
 * every terminal transition is one conditional update scoped to the user
 * allowed to make it, and clears the key in the same write.
 */

export const NO_LONGER_OPEN = "This request is no longer open";

const pairKey = (a: string, b: string) => [a, b].sort().join(":");
const inviteKey = (groupId: string, toId: string) => `${groupId}:${toId}`;

export async function listFriends(db: Db, userId: string) {
  const rows = await db.friendship.findMany({ where: { userId, friend: onboarded }, select: { friend: { select: personSelect } } });
  return rows.map((r) => toPerson(r.friend)).sort((a, b) => a.firstName.localeCompare(b.firstName));
}

/** Someone findable by handle: onboarded and not a league bot (R17). Callers decide what finding yourself means. */
async function findByHandle(db: Db, raw: string) {
  const n = normalizeUsername(raw);
  if (!n.ok) return null;
  const u = await db.user.findFirst({ where: { username: n.username, isLeagueBot: false }, select: personSelect });
  return u ? toPerson(u) : null;
}

export type Relationship = "none" | "outgoing" | "incoming" | "friends";
export type PersonResult = { person: PersonRef; relationship: Relationship; requestId: string | null };

/** Exact, case-insensitive username match only, so the search can't be used as a directory (R17). */
export async function searchPeople(db: Db, me: string, raw: string): Promise<PersonResult | null> {
  const person = await findByHandle(db, raw);
  if (!person || person.id === me) return null;
  const [friends, open] = await Promise.all([areFriends(db, me, person.id), db.friendRequest.findUnique({ where: { openPairKey: pairKey(me, person.id) } })]);
  if (friends) return { person, relationship: "friends", requestId: null };
  if (!open) return { person, relationship: "none", requestId: null };
  return { person, relationship: open.fromId === me ? "outgoing" : "incoming", requestId: open.id };
}

export type GroupResult = { id: string; name: string; ownerName: string; memberCount: number; isMember: boolean };

/** Name search over groups. Non-members see the owner's display name and a count, never members (KTD10). */
export async function searchGroups(db: Db, me: string, raw: string): Promise<GroupResult[]> {
  const q = raw.trim().toLowerCase();
  if (q.length < 2) return [];
  // Names are matched in JS so case folding stays exactly as before; members are counted, not loaded.
  const groups = await db.studyGroup.findMany({
    select: {
      id: true,
      name: true,
      owner: { select: { firstName: true, lastName: true } },
      _count: { select: { members: true } },
      members: { where: { userId: me }, select: { userId: true }, take: 1 },
    },
    orderBy: { name: "asc" },
  });
  return groups
    .filter((g) => g.name.toLowerCase().includes(q))
    .slice(0, 20)
    .map((g) => ({
      id: g.id,
      name: g.name,
      ownerName: `${g.owner.firstName} ${g.owner.lastName}`.trim(),
      memberCount: g._count.members,
      isMember: g.members.length > 0,
    }));
}

export type SendResult = { status: "sent" | "accepted"; otherId: string; requestId: string };

/** R19: send by username; a reverse pending request is accepted instead (AE3). */
export async function sendFriendRequest(db: Db, me: string, username: string): Promise<SendResult> {
  const target = await findByHandle(db, username);
  if (target?.id === me) throw new ServiceError("You can't add yourself");
  if (!target) throw new ServiceError("No one has that username");
  if (await areFriends(db, me, target.id)) throw new ServiceError("You're already friends");

  const key = pairKey(me, target.id);
  for (let attempt = 0; attempt < 2; attempt++) {
    const open = await db.friendRequest.findUnique({ where: { openPairKey: key } });
    if (open?.fromId === me) return { status: "sent", otherId: target.id, requestId: open.id };
    if (open) {
      await respondToFriendRequest(db, me, open.id, true);
      return { status: "accepted", otherId: target.id, requestId: open.id };
    }
    try {
      const created = await db.friendRequest.create({ data: { fromId: me, toId: target.id, openPairKey: key } });
      return { status: "sent", otherId: target.id, requestId: created.id };
    } catch (e) {
      // The other person sent theirs at the same moment: loop once and take the accept path.
      if (!isUniqueViolation(e)) throw e;
    }
  }
  throw new ServiceError(NO_LONGER_OPEN);
}

/** Accept or decline a request sent to me. Returns the sender's id. */
export async function respondToFriendRequest(db: Db, me: string, requestId: string, accept: boolean): Promise<string> {
  return db.$transaction(async (tx) => {
    const closed = await tx.friendRequest.updateMany({
      where: { id: requestId, toId: me, status: "PENDING" },
      data: { status: accept ? "ACCEPTED" : "DECLINED", openPairKey: null, respondedAt: new Date() },
    });
    if (closed.count === 0) throw new ServiceError(NO_LONGER_OPEN);
    const req = await tx.friendRequest.findUniqueOrThrow({ where: { id: requestId }, select: { fromId: true } });
    if (accept) {
      for (const [userId, friendId] of [
        [me, req.fromId],
        [req.fromId, me],
      ]) {
        await tx.friendship.upsert({ where: { userId_friendId: { userId, friendId } }, create: { userId, friendId }, update: {} });
      }
    }
    return req.fromId;
  });
}

/** Withdraw a request I sent. Returns the recipient's id. */
export async function cancelFriendRequest(db: Db, me: string, requestId: string): Promise<string> {
  const req = await db.friendRequest.findFirst({ where: { id: requestId, fromId: me }, select: { toId: true } });
  const closed = await db.friendRequest.updateMany({
    where: { id: requestId, fromId: me, status: "PENDING" },
    data: { status: "CANCELLED", openPairKey: null, respondedAt: new Date() },
  });
  if (closed.count === 0 || !req) throw new ServiceError(NO_LONGER_OPEN);
  return req.toId;
}

/** R21: the group starts with only its owner; chosen friends get invites. */
export async function createGroup(db: Db, ownerId: string, name: string, friendIds: string[]) {
  const clean = name.trim();
  if (!clean) throw new ServiceError("Give your group a name");
  if (clean.length > 60) throw new ServiceError("Keep the name under 60 characters");
  const friendRows = await db.friendship.findMany({ where: { userId: ownerId, friendId: { in: friendIds } }, select: { friendId: true } });
  const invitees = [...new Set(friendRows.map((f) => f.friendId))];
  const group = await db.$transaction(async (tx) => {
    const g = await tx.studyGroup.create({ data: { name: clean, ownerId, members: { create: [{ userId: ownerId }] } } });
    if (invitees.length) {
      await tx.groupInvite.createMany({ data: invitees.map((toId) => ({ groupId: g.id, fromId: ownerId, toId, openKey: inviteKey(g.id, toId) })) });
    }
    return g;
  });
  return { group, invitedIds: invitees };
}

/** Accept or decline a group invite sent to me. Returns the inviter's id. */
export async function respondToGroupInvite(db: Db, me: string, inviteId: string, accept: boolean): Promise<string> {
  return db.$transaction(async (tx) => {
    const closed = await tx.groupInvite.updateMany({
      where: { id: inviteId, toId: me, status: "PENDING" },
      data: { status: accept ? "ACCEPTED" : "DECLINED", openKey: null, respondedAt: new Date() },
    });
    if (closed.count === 0) throw new ServiceError(NO_LONGER_OPEN);
    const inv = await tx.groupInvite.findUniqueOrThrow({ where: { id: inviteId }, select: { groupId: true, fromId: true } });
    if (accept) await tx.groupMember.upsert({ where: { groupId_userId: { groupId: inv.groupId, userId: me } }, create: { groupId: inv.groupId, userId: me }, update: {} });
    return inv.fromId;
  });
}

/** Withdraw a group invite I sent. Returns the invitee's id. */
export async function cancelGroupInvite(db: Db, me: string, inviteId: string): Promise<string> {
  const inv = await db.groupInvite.findFirst({ where: { id: inviteId, fromId: me }, select: { toId: true } });
  const closed = await db.groupInvite.updateMany({
    where: { id: inviteId, fromId: me, status: "PENDING" },
    data: { status: "CANCELLED", openKey: null, respondedAt: new Date() },
  });
  if (closed.count === 0 || !inv) throw new ServiceError(NO_LONGER_OPEN);
  return inv.toId;
}

/** Join directly by name (R20); a pending invite for this group resolves too. Returns inviters to notify. */
export async function joinGroup(db: Db, me: string, groupId: string): Promise<string[]> {
  const group = await db.studyGroup.findUnique({ where: { id: groupId }, select: { id: true } });
  if (!group) throw new ServiceError("Group not found");
  return db.$transaction(async (tx) => {
    await tx.groupMember.upsert({ where: { groupId_userId: { groupId, userId: me } }, create: { groupId, userId: me }, update: {} });
    const pending = await tx.groupInvite.findMany({ where: { groupId, toId: me, status: "PENDING" }, select: { fromId: true } });
    await tx.groupInvite.updateMany({ where: { groupId, toId: me, status: "PENDING" }, data: { status: "ACCEPTED", openKey: null, respondedAt: new Date() } });
    return pending.map((p) => p.fromId);
  });
}

/** A member who isn't the owner can leave. */
export async function leaveGroup(db: Db, me: string, groupId: string) {
  const group = await db.studyGroup.findUnique({ where: { id: groupId }, select: { ownerId: true } });
  if (!group) throw new ServiceError("Group not found");
  if (group.ownerId === me) throw new ServiceError("You own this group, so you can't leave it");
  await db.groupMember.deleteMany({ where: { groupId, userId: me } });
}

/** Pending items addressed to me: the Received badge (R18). */
export async function receivedCount(db: Db, me: string) {
  const [requests, invites] = await Promise.all([
    db.friendRequest.count({ where: { toId: me, status: "PENDING" } }),
    db.groupInvite.count({ where: { toId: me, status: "PENDING" } }),
  ]);
  return requests + invites;
}

/** Everything the Friends & Groups page shows. */
export async function listSocial(db: Db, me: string) {
  const person = { select: personSelect };
  const [friends, groups, sentRequests, receivedRequests, sentInvites, receivedInvites, owned] = await Promise.all([
    listFriends(db, me),
    getGroupStandings(db, me),
    db.friendRequest.findMany({ where: { fromId: me, status: "PENDING" }, include: { to: person }, orderBy: { createdAt: "desc" } }),
    db.friendRequest.findMany({ where: { toId: me, status: "PENDING" }, include: { from: person }, orderBy: { createdAt: "desc" } }),
    db.groupInvite.findMany({ where: { fromId: me, status: "PENDING" }, include: { to: person, group: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } }),
    db.groupInvite.findMany({ where: { toId: me, status: "PENDING" }, include: { from: person, group: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } }),
    db.studyGroup.findMany({ where: { ownerId: me }, select: { id: true } }),
  ]);
  const ownedGroupIds = new Set(owned.map((g) => g.id));
  return {
    friends,
    groups: groups.map((g) => ({ ...g, owned: ownedGroupIds.has(g.id) })),
    sent: {
      friendRequests: sentRequests.map((r) => ({ id: r.id, person: toPerson(r.to) })),
      groupInvites: sentInvites.map((i) => ({ id: i.id, group: i.group, person: toPerson(i.to) })),
    },
    received: {
      friendRequests: receivedRequests.map((r) => ({ id: r.id, person: toPerson(r.from) })),
      groupInvites: receivedInvites.map((i) => ({ id: i.id, group: i.group, person: toPerson(i.from) })),
    },
    receivedCount: receivedRequests.length + receivedInvites.length,
  };
}
export type SocialData = Awaited<ReturnType<typeof listSocial>>;
