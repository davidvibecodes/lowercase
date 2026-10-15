import { beforeEach, describe, expect, it } from "vitest";
import { getGroupStandings } from "@/server/services/home";
import { addFriend, createGroup, search } from "@/server/services/social";
import { db, resetAndSeed, userId } from "./helpers/db";

describe("social", () => {
  beforeEach(async () => {
    await resetAndSeed();
  });

  it("finds people by partial name and groups by name, case-insensitively", async () => {
    const david = await userId("davidsathyandevice");
    const r = await search(db, david, "mih");
    expect(r.people.map((p) => p.firstName)).toEqual(["Mihaela"]);
    expect(r.people[0].isFriend).toBe(true);
    const g = await search(db, david, "CASE CLUB");
    expect(g.groups.map((x) => x.name)).toEqual(["Case Club Squad"]);
  });

  it("creates a group with the creator plus chosen friends and ranks it by weekly XP", async () => {
    const [david, roy, ankit] = [await userId("davidsathyandevice"), await userId("roy"), await userId("ankit")];
    const g = await createGroup(db, david, "Weekend Prep", [roy, ankit]);
    const standings = (await getGroupStandings(db, david)).find((x) => x.id === g.id)!;
    expect(standings.standings).toHaveLength(3);
    const xp = standings.standings.map((s) => s.weeklyXp);
    expect([...xp].sort((a, b) => b - a)).toEqual(xp);
  });

  it("rejects an empty group name", async () => {
    await expect(createGroup(db, await userId("davidsathyandevice"), "   ", [])).rejects.toThrow("Give your group a name");
  });

  it("ignores non-friends when creating a group", async () => {
    const david = await userId("davidsathyandevice");
    const bot = await userId("aarav.m");
    const g = await createGroup(db, david, "Solo", [bot]);
    expect(await db.groupMember.count({ where: { groupId: g.id } })).toBe(1);
  });

  it("adds a friend in both directions", async () => {
    const [david, bot] = [await userId("davidsathyandevice"), await userId("aarav.m")];
    await addFriend(db, david, bot);
    expect(await db.friendship.count({ where: { OR: [{ userId: david, friendId: bot }, { userId: bot, friendId: david }] } })).toBe(2);
  });
});
