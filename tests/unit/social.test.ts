import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  NO_LONGER_OPEN,
  cancelFriendRequest,
  cancelGroupInvite,
  createGroup,
  joinGroup,
  leaveGroup,
  listFriends,
  listSocial,
  receivedCount,
  respondToFriendRequest,
  respondToGroupInvite,
  searchGroups,
  searchPeople,
  sendFriendRequest,
} from "@/server/services/social";
import { getGroupStandings, getHomeData, getLeague } from "@/server/services/home";
import { db, resetAndSeed, userId } from "./helpers/db";

let david: string, roy: string, mihaela: string, ankit: string;

/** The seed makes the four humans mutual friends; request scenarios start by removing one pair's friendship. */
async function unfriend(a: string, b: string) {
  await db.friendship.deleteMany({ where: { OR: [{ userId: a, friendId: b }, { userId: b, friendId: a }] } });
}

/** Invariants every social change must keep (KTD8). */
async function assertInvariants() {
  const requests = await db.friendRequest.findMany();
  for (const r of requests) expect(r.openPairKey !== null, `request ${r.id}`).toBe(r.status === "PENDING");
  const invites = await db.groupInvite.findMany();
  for (const i of invites) expect(i.openKey !== null, `invite ${i.id}`).toBe(i.status === "PENDING");
  for (const r of requests.filter((x) => x.status === "PENDING")) {
    expect(await db.friendship.count({ where: { userId: r.fromId, friendId: r.toId } }), "pending between friends").toBe(0);
  }
  for (const i of invites.filter((x) => x.status === "PENDING")) {
    expect(await db.groupMember.count({ where: { groupId: i.groupId, userId: i.toId } }), "pending invite to a member").toBe(0);
  }
  for (const f of await db.friendship.findMany()) {
    expect(await db.friendship.count({ where: { userId: f.friendId, friendId: f.userId } }), "friendship has its reverse").toBe(1);
  }
}

beforeEach(async () => {
  await resetAndSeed();
  [david, roy, mihaela, ankit] = await Promise.all(["davidsathyandevice", "roy", "mihaela", "ankit"].map(userId));
});
afterEach(assertInvariants);

describe("searchPeople (R17)", () => {
  it("matches only an exact handle, case-insensitively, with the relationship", async () => {
    expect(await searchPeople(db, david, "@Roy")).toMatchObject({ person: { id: roy, username: "roy" }, relationship: "friends" });
    expect(await searchPeople(db, david, "ro")).toBeNull();
    expect(await searchPeople(db, david, "Roy C")).toBeNull();
  });

  it("never finds league bots or yourself", async () => {
    const bot = await db.user.findFirstOrThrow({ where: { isLeagueBot: true } });
    expect(await searchPeople(db, david, bot.username!)).toBeNull();
    expect(await searchPeople(db, david, "davidsathyandevice")).toBeNull();
  });
});

describe("people without a username (R7, KTD10)", () => {
  it("stay out of the league, friend lists and group standings until they choose one", async () => {
    // A Google newcomer gets the default league, so only the onboarded filters keep their name off other people's screens.
    const { leagueName } = await db.user.findUniqueOrThrow({ where: { id: david }, select: { leagueName: true } });
    const ghost = await db.user.create({ data: { firstName: "No", lastName: "Name", email: "nn@gmail.com", leagueName } });
    await db.friendship.createMany({ data: [{ userId: david, friendId: ghost.id }, { userId: ghost.id, friendId: david }] });
    const group = await db.studyGroup.findFirstOrThrow({ where: { members: { some: { userId: david } } } });
    await db.groupMember.create({ data: { groupId: group.id, userId: ghost.id } });

    const visible = async () => {
      const [league, friends, social, home, groups] = await Promise.all([
        getLeague(db, david),
        listFriends(db, david),
        listSocial(db, david),
        getHomeData(db, david),
        getGroupStandings(db, david),
      ]);
      return {
        league: league.standings.some((s) => s.id === ghost.id),
        friends: friends.some((f) => f.id === ghost.id),
        socialFriends: social.friends.some((f) => f.id === ghost.id),
        homeFriends: home.friends.some((f) => f.id === ghost.id),
        group: groups.find((g) => g.id === group.id)!.standings.some((s) => s.id === ghost.id),
      };
    };
    const everywhere = (on: boolean) => ({ league: on, friends: on, socialFriends: on, homeFriends: on, group: on });

    expect(await visible()).toEqual(everywhere(false));
    await db.user.update({ where: { id: ghost.id }, data: { username: "no.name" } });
    expect(await visible()).toEqual(everywhere(true));
  });
});

describe("friend requests (R19, KTD8)", () => {
  it("sends one pending request that shows on both sides and counts as received", async () => {
    await unfriend(mihaela, ankit);
    expect(await sendFriendRequest(db, mihaela, "ankit")).toMatchObject({ status: "sent", otherId: ankit });
    expect(await sendFriendRequest(db, mihaela, "Ankit")).toMatchObject({ status: "sent" }); // idempotent
    expect(await db.friendRequest.count({ where: { status: "PENDING" } })).toBe(1);
    expect((await listSocial(db, mihaela)).sent.friendRequests.map((r) => r.person.id)).toEqual([ankit]);
    expect((await listSocial(db, ankit)).received.friendRequests.map((r) => r.person.id)).toEqual([mihaela]);
    expect(await receivedCount(db, ankit)).toBe(1);
    expect(await searchPeople(db, ankit, "mihaela")).toMatchObject({ relationship: "incoming" });
  });

  it("covers AE3: a reverse send accepts the pending request", async () => {
    await unfriend(roy, mihaela);
    await sendFriendRequest(db, roy, "mihaela");
    expect(await sendFriendRequest(db, mihaela, "roy")).toMatchObject({ status: "accepted", otherId: roy });
    expect(await db.friendship.count({ where: { userId: roy, friendId: mihaela } })).toBe(1);
    expect(await db.friendship.count({ where: { userId: mihaela, friendId: roy } })).toBe(1);
    expect((await listSocial(db, roy)).sent.friendRequests).toEqual([]);
  });

  it("ends two simultaneous opposite requests as friends with nothing pending", async () => {
    await unfriend(roy, ankit);
    await Promise.all([sendFriendRequest(db, roy, "ankit"), sendFriendRequest(db, ankit, "roy")]);
    expect(await db.friendship.count({ where: { userId: roy, friendId: ankit } })).toBe(1);
    expect(await db.friendRequest.count({ where: { status: "PENDING" } })).toBe(0);
  });

  it("refuses yourself, existing friends and unknown handles", async () => {
    await expect(sendFriendRequest(db, david, "davidsathyandevice")).rejects.toThrow("You can't add yourself");
    await expect(sendFriendRequest(db, david, "roy")).rejects.toThrow("You're already friends");
    await expect(sendFriendRequest(db, david, "nobody.here")).rejects.toThrow("No one has that username");
  });

  it("covers AE4: acting on a cancelled request says it's no longer open", async () => {
    await unfriend(ankit, david);
    const { requestId } = await sendFriendRequest(db, ankit, "davidsathyandevice");
    await cancelFriendRequest(db, ankit, requestId);
    await expect(respondToFriendRequest(db, david, requestId, true)).rejects.toThrow(NO_LONGER_OPEN);
    expect(await db.friendship.count({ where: { userId: david, friendId: ankit } })).toBe(0);
  });

  it("declining is silent and the sender can ask again later", async () => {
    await unfriend(roy, ankit);
    const first = await sendFriendRequest(db, roy, "ankit");
    await respondToFriendRequest(db, ankit, first.requestId, false);
    const again = await sendFriendRequest(db, roy, "ankit");
    expect(again.requestId).not.toBe(first.requestId);
    expect(await db.friendRequest.count({ where: { status: "PENDING" } })).toBe(1);
  });

  it("only the recipient can respond and only the sender can cancel", async () => {
    await unfriend(roy, ankit);
    const { requestId } = await sendFriendRequest(db, roy, "ankit");
    await expect(respondToFriendRequest(db, roy, requestId, true)).rejects.toThrow(NO_LONGER_OPEN);
    await expect(respondToFriendRequest(db, mihaela, requestId, false)).rejects.toThrow(NO_LONGER_OPEN);
    await expect(cancelFriendRequest(db, ankit, requestId)).rejects.toThrow(NO_LONGER_OPEN);
    await expect(cancelFriendRequest(db, mihaela, requestId)).rejects.toThrow(NO_LONGER_OPEN);
    expect(await db.friendRequest.findUniqueOrThrow({ where: { id: requestId } })).toMatchObject({ status: "PENDING" });
  });
});

describe("groups (R20, R21)", () => {
  it("creating a group invites chosen friends instead of adding them, and skips non-friends", async () => {
    const bot = await db.user.findFirstOrThrow({ where: { isLeagueBot: true } });
    const { group, invitedIds } = await createGroup(db, david, "  Pricing Pals ", [roy, mihaela, bot.id]);
    expect(group.name).toBe("Pricing Pals");
    expect(invitedIds.sort()).toEqual([mihaela, roy].sort());
    expect(await db.groupMember.findMany({ where: { groupId: group.id }, select: { userId: true } })).toEqual([{ userId: david }]);
    expect((await listSocial(db, roy)).received.groupInvites.map((i) => i.group.name)).toEqual(["Pricing Pals"]);
  });

  it("accepting an invite joins; joining directly resolves a pending invite", async () => {
    const { group } = await createGroup(db, david, "Squad Two", [roy, mihaela]);
    const royInvite = await db.groupInvite.findFirstOrThrow({ where: { groupId: group.id, toId: roy } });
    await respondToGroupInvite(db, roy, royInvite.id, true);
    expect(await db.groupMember.count({ where: { groupId: group.id, userId: roy } })).toBe(1);
    expect(await joinGroup(db, mihaela, group.id)).toEqual([david]);
    expect((await db.groupInvite.findFirstOrThrow({ where: { groupId: group.id, toId: mihaela } })).status).toBe("ACCEPTED");
  });

  it("a group owner can't accept an invite for the invitee", async () => {
    const { group } = await createGroup(db, david, "Squad Three", [roy]);
    const inv = await db.groupInvite.findFirstOrThrow({ where: { groupId: group.id } });
    await expect(respondToGroupInvite(db, david, inv.id, true)).rejects.toThrow(NO_LONGER_OPEN);
    await expect(cancelGroupInvite(db, roy, inv.id)).rejects.toThrow(NO_LONGER_OPEN);
  });

  it("joining an unknown group fails clearly, the owner can't leave, a member can and can be invited again", async () => {
    await expect(joinGroup(db, roy, "missing")).rejects.toThrow("Group not found");
    const { group } = await createGroup(db, david, "Squad Four", [roy]);
    await expect(leaveGroup(db, david, group.id)).rejects.toThrow("You own this group");
    const inv = await db.groupInvite.findFirstOrThrow({ where: { groupId: group.id } });
    await respondToGroupInvite(db, roy, inv.id, true);
    await leaveGroup(db, roy, group.id);
    expect((await getGroupStandings(db, david)).find((g) => g.id === group.id)?.standings.map((s) => s.id)).toEqual([david]);
    await db.groupInvite.create({ data: { groupId: group.id, fromId: david, toId: roy, openKey: `${group.id}:${roy}` } });
    expect(await db.groupInvite.count({ where: { groupId: group.id, toId: roy, status: "PENDING" } })).toBe(1);
  });

  it("group search shows names, owner display name and size, never members or handles", async () => {
    const results = await searchGroups(db, ankit, "case club");
    expect(results).toHaveLength(1);
    expect(Object.keys(results[0]).sort()).toEqual(["id", "isMember", "memberCount", "name", "ownerName"]);
    expect(results[0].ownerName).toBe("David Sathyan");
    expect(await searchGroups(db, ankit, "c")).toEqual([]);
  });
});
