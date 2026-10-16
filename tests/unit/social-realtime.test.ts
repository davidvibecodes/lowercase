import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { announceNewFriends, notifySocialChanged } from "@/server/realtime/social";
import { respondToFriendRequest, sendFriendRequest } from "@/server/services/social";
import { db, resetAndSeed, userId } from "./helpers/db";
import { connectAs, nextEvent, startHarness, type Client, type Harness } from "./helpers/realtime";

let h: Harness;
let roy: string, ankit: string;

beforeEach(async () => {
  await resetAndSeed();
  [roy, ankit] = [await userId("roy"), await userId("ankit")];
  await db.friendship.deleteMany({ where: { OR: [{ userId: roy, friendId: ankit }, { userId: ankit, friendId: roy }] } });
  h = await startHarness();
});
afterEach(async () => {
  await h.close();
});

function recordPresence(c: Client) {
  const seen: Array<{ userId: string; online: boolean }> = [];
  c.on("presence:update", (p) => seen.push(p));
  return seen;
}

describe("social realtime (KTD9)", () => {
  it("tells the recipient their Received count, and a pending request reveals no presence", async () => {
    const a = await connectAs(h, roy);
    const b = await connectAs(h, ankit);
    const presenceA = recordPresence(a);
    const presenceB = recordPresence(b);
    const changed = nextEvent(b, "social:changed");
    const r = await sendFriendRequest(db, roy, "ankit");
    await notifySocialChanged(db, [roy, r.otherId]);
    expect(await changed).toEqual({ received: 1 });
    await new Promise((res) => setTimeout(res, 150));
    expect(presenceA.filter((p) => p.userId === ankit)).toEqual([]);
    expect(presenceB.filter((p) => p.userId === roy)).toEqual([]);
  });

  it("accepting shows each new friend online to the other without a reload", async () => {
    const a = await connectAs(h, roy);
    const b = await connectAs(h, ankit);
    const { requestId } = await sendFriendRequest(db, roy, "ankit");
    const royHears = nextEvent(a, "presence:update");
    const ankitHears = nextEvent(b, "presence:update");
    await respondToFriendRequest(db, ankit, requestId, true);
    announceNewFriends(ankit, roy);
    expect(await royHears).toEqual({ userId: ankit, online: true });
    expect(await ankitHears).toEqual({ userId: roy, online: true });
  });
});
