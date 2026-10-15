import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, resetAndSeed, userId } from "./helpers/db";
import { call, connectAs, nextEvent, sleep, startHarness, type Harness } from "./helpers/realtime";

let h: Harness;
let david: string, roy: string, mihaela: string;

beforeAll(async () => {
  await resetAndSeed();
  [david, roy, mihaela] = await Promise.all([userId("davidsathyandevice"), userId("roy"), userId("mihaela")]);
});
beforeEach(async () => {
  h = await startHarness();
});
afterEach(async () => {
  await h.close();
});

describe("handshake", () => {
  it("refuses a socket without a valid session cookie", async () => {
    await expect(connectAs(h, null)).rejects.toThrow(/unauthorized/);
  });
});

describe("presence", () => {
  it("tells A when friend B comes online, and when B's last socket leaves", async () => {
    const a = await connectAs(h, david);
    const online = nextEvent(a, "presence:update");
    const b = await connectAs(h, roy);
    expect(await online).toEqual({ userId: roy, online: true });

    const offline = nextEvent(a, "presence:update");
    b.disconnect();
    expect(await offline).toEqual({ userId: roy, online: false });
  });

  it("keeps a user online while one of two tabs stays open", async () => {
    const a = await connectAs(h, david);
    const b1 = await connectAs(h, roy);
    await connectAs(h, roy);
    let sawOffline = false;
    a.on("presence:update", (p) => p.online === false && (sawOffline = true));
    b1.disconnect();
    await sleep(300);
    expect(sawOffline).toBe(false);
  });

  it("sends a snapshot of friends already online", async () => {
    await connectAs(h, roy);
    let snapshot: Promise<string[]> = Promise.resolve([]);
    await connectAs(h, david, (c) => {
      snapshot = nextEvent(c, "presence:snapshot");
    });
    const ids = await snapshot;
    expect(ids).toContain(roy);
    expect(ids).not.toContain(mihaela);
  });
});

describe("invites", () => {
  it("refuses an invite to an offline friend and writes no rows", async () => {
    const a = await connectAs(h, david);
    const before = await db.caseSession.count();
    const res = await call(a, "invite:send", { toUserId: mihaela });
    expect(res).toEqual({ ok: false, error: "Friend must be online" });
    expect(await db.caseSession.count()).toBe(before);
  });

  it("refuses an invite to a non-friend", async () => {
    const a = await connectAs(h, david);
    const bot = await userId("aarav.m");
    await connectAs(h, bot);
    const res = await call(a, "invite:send", { toUserId: bot });
    expect(res.ok).toBe(false);
  });

  it("creates a lobby and pending invite that reaches the friend with the sender's name", async () => {
    const a = await connectAs(h, david);
    const b = await connectAs(h, roy);
    const received = nextEvent(b, "invite:received");
    const res = await call(a, "invite:send", { toUserId: roy, caseType: "Pricing", difficulty: 1 });
    expect(res.ok).toBe(true);
    const inv = await received;
    expect(inv.from.firstName).toBe("David");
    expect(inv.caseType).toBe("Pricing");
    const row = await db.sessionInvite.findUniqueOrThrow({ where: { id: res.inviteId } });
    expect(row.status).toBe("PENDING");
  });

  it("accepting sends session:ready with the same id to both users", async () => {
    const a = await connectAs(h, david);
    const b = await connectAs(h, roy);
    const received = nextEvent(b, "invite:received");
    const sent = await call(a, "invite:send", { toUserId: roy });
    await received;
    const readyA = nextEvent(a, "session:ready");
    const readyB = nextEvent(b, "session:ready");
    const acc = await call(b, "invite:accept", { inviteId: sent.inviteId });
    expect(acc).toEqual({ ok: true, sessionId: sent.sessionId });
    expect((await readyA).sessionId).toBe(sent.sessionId);
    expect((await readyB).sessionId).toBe(sent.sessionId);
  });

  it("declining notifies the sender", async () => {
    const a = await connectAs(h, david);
    const b = await connectAs(h, roy);
    const sent = await call(a, "invite:send", { toUserId: roy });
    const closed = nextEvent(a, "invite:closed");
    await call(b, "invite:decline", { inviteId: sent.inviteId });
    expect(await closed).toMatchObject({ inviteId: sent.inviteId, status: "DECLINED" });
  });

  it("an invite from an existing solo lobby joins that same lobby and keeps its preselection", async () => {
    const lobby = await db.caseSession.create({ data: { hostId: david, caseType: "Market Entry", difficulty: 1 } });
    const a = await connectAs(h, david);
    const b = await connectAs(h, roy);
    const received = nextEvent(b, "invite:received");
    const sent = await call(a, "invite:send", { toUserId: roy, sessionId: lobby.id });
    expect(sent.sessionId).toBe(lobby.id);
    expect((await received).caseType).toBe("Market Entry");
    const ready = nextEvent(a, "session:ready");
    await call(b, "invite:accept", { inviteId: sent.inviteId });
    expect((await ready).sessionId).toBe(lobby.id);
    const s = await db.caseSession.findUniqueOrThrow({ where: { id: lobby.id } });
    expect(s).toMatchObject({ guestId: roy, caseType: "Market Entry", difficulty: 1 });
  });

  it("expires an unanswered invite and tells the recipient", async () => {
    process.env.INVITE_TTL_MS = "200";
    try {
      const a = await connectAs(h, david);
      const b = await connectAs(h, roy);
      const sent = await call(a, "invite:send", { toUserId: roy });
      const closed = await nextEvent(b, "invite:closed");
      expect(closed).toMatchObject({ inviteId: sent.inviteId, status: "EXPIRED" });
      expect((await db.sessionInvite.findUniqueOrThrow({ where: { id: sent.inviteId } })).status).toBe("EXPIRED");
    } finally {
      delete process.env.INVITE_TTL_MS;
    }
  });

  it("refuses to accept an expired invite, or someone else's", async () => {
    process.env.INVITE_TTL_MS = "150";
    try {
      const a = await connectAs(h, david);
      const b = await connectAs(h, roy);
      const sent = await call(a, "invite:send", { toUserId: roy });
      await nextEvent(b, "invite:closed");
      expect(await call(b, "invite:accept", { inviteId: sent.inviteId })).toEqual({ ok: false, error: "This invite is no longer open" });
    } finally {
      delete process.env.INVITE_TTL_MS;
    }
    const a = await connectAs(h, david);
    await connectAs(h, roy);
    const m = await connectAs(h, mihaela);
    const sent = await call(a, "invite:send", { toUserId: roy });
    expect(await call(m, "invite:accept", { inviteId: sent.inviteId })).toEqual({ ok: false, error: "Invite not found" });
  });

  it("cancel tells the recipient", async () => {
    const a = await connectAs(h, david);
    const b = await connectAs(h, roy);
    const sent = await call(a, "invite:send", { toUserId: roy });
    const closed = nextEvent(b, "invite:closed");
    await call(a, "invite:cancel", { inviteId: sent.inviteId });
    expect(await closed).toMatchObject({ inviteId: sent.inviteId, status: "CANCELLED" });
  });

  it("a new invite from the same lobby replaces the old one and tells its recipient", async () => {
    const lobby = await db.caseSession.create({ data: { hostId: david } });
    const a = await connectAs(h, david);
    const b = await connectAs(h, roy);
    await connectAs(h, mihaela);
    const first = await call(a, "invite:send", { toUserId: roy, sessionId: lobby.id });
    const closed = nextEvent(b, "invite:closed");
    await call(a, "invite:send", { toUserId: mihaela, sessionId: lobby.id });
    expect(await closed).toMatchObject({ inviteId: first.inviteId, status: "CANCELLED" });
    expect((await db.sessionInvite.findUniqueOrThrow({ where: { id: first.inviteId } })).status).toBe("CANCELLED");
  });

  it("closing a lobby tells the pending invite's recipient", async () => {
    const lobby = await db.caseSession.create({ data: { hostId: david } });
    const a = await connectAs(h, david);
    const b = await connectAs(h, roy);
    const sent = await call(a, "invite:send", { toUserId: roy, sessionId: lobby.id });
    const closed = nextEvent(b, "invite:closed");
    await call(a, "session:close", { sessionId: lobby.id });
    expect(await closed).toMatchObject({ inviteId: sent.inviteId, status: "CANCELLED" });
  });

  it("won't invite into a lobby that already has a partner", async () => {
    const lobby = await db.caseSession.create({ data: { hostId: david, guestId: roy } });
    const a = await connectAs(h, david);
    await connectAs(h, mihaela);
    expect(await call(a, "invite:send", { toUserId: mihaela, sessionId: lobby.id })).toEqual({ ok: false, error: "That lobby can't take an invite" });
  });
});
