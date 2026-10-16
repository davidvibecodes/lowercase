import type { Db } from "@/lib/db";
import { ServiceError, onboarded, personSelect, toPerson } from "./invites";

export async function listFriends(db: Db, userId: string) {
  const rows = await db.friendship.findMany({ where: { userId, friend: onboarded }, select: { friend: { select: personSelect } } });
  return rows.map((r) => toPerson(r.friend)).sort((a, b) => a.firstName.localeCompare(b.firstName));
}

/** Case-insensitive search over people (name or username) and groups (name). */
export async function search(db: Db, userId: string, rawQuery: string) {
  const q = rawQuery.trim().toLowerCase();
  if (q.length < 2) return { people: [], groups: [] };
  const [users, friendIds, groups] = await Promise.all([
    db.user.findMany({ where: { id: { not: userId }, ...onboarded }, select: personSelect }),
    db.friendship.findMany({ where: { userId }, select: { friendId: true } }),
    db.studyGroup.findMany({ include: { members: { select: { userId: true } } } }),
  ]);
  const friends = new Set(friendIds.map((f) => f.friendId));
  const people = users
    .map(toPerson)
    .filter((u) => `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) || u.username.toLowerCase().includes(q))
    .slice(0, 20)
    .map((u) => ({ ...u, isFriend: friends.has(u.id) }));
  const matchedGroups = groups
    .filter((g) => g.name.toLowerCase().includes(q))
    .slice(0, 10)
    .map((g) => ({ id: g.id, name: g.name, memberCount: g.members.length, isMember: g.members.some((m) => m.userId === userId) }));
  return { people, groups: matchedGroups };
}

/** Instant, mutual friendship (Scope Boundaries: no request flow in this phase). */
export async function addFriend(db: Db, userId: string, friendId: string) {
  if (userId === friendId) throw new ServiceError("You can't add yourself");
  const exists = await db.user.count({ where: { id: friendId } });
  if (!exists) throw new ServiceError("User not found");
  for (const [a, b] of [
    [userId, friendId],
    [friendId, userId],
  ]) {
    await db.friendship.upsert({ where: { userId_friendId: { userId: a, friendId: b } }, create: { userId: a, friendId: b }, update: {} });
  }
}

export async function createGroup(db: Db, ownerId: string, name: string, memberIds: string[]) {
  const clean = name.trim();
  if (!clean) throw new ServiceError("Give your group a name");
  if (clean.length > 60) throw new ServiceError("Keep the name under 60 characters");
  const friendRows = await db.friendship.findMany({ where: { userId: ownerId, friendId: { in: memberIds } }, select: { friendId: true } });
  const members = new Set([ownerId, ...friendRows.map((f) => f.friendId)]);
  return db.studyGroup.create({ data: { name: clean, ownerId, members: { create: [...members].map((userId) => ({ userId })) } } });
}

export async function joinGroup(db: Db, userId: string, groupId: string) {
  await db.groupMember.upsert({ where: { groupId_userId: { groupId, userId } }, create: { groupId, userId }, update: {} });
}
