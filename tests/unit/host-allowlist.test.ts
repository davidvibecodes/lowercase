import { request } from "node:http";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createSessionValue } from "@/lib/auth/session-cookie";
import { isAllowedHost, isAllowedOrigin } from "@/server/loopback";
import { db, resetAndSeed, userId } from "./helpers/db";
import { connectAs, startHarness, type Harness } from "./helpers/realtime";

describe("loopback allowlist (KTD16)", () => {
  it("serves only localhost and 127.0.0.1 on our port", () => {
    expect(isAllowedHost("localhost:3000", 3000)).toBe(true);
    expect(isAllowedHost("127.0.0.1:3000", 3000)).toBe(true);
    expect(isAllowedHost("LOCALHOST:3000", 3000)).toBe(true);
    expect(isAllowedHost("evil.example", 3000)).toBe(false);
    expect(isAllowedHost("evil.example:3000", 3000)).toBe(false);
    expect(isAllowedHost("192.168.1.20:3000", 3000)).toBe(false);
    expect(isAllowedHost("localhost:4000", 3000)).toBe(false);
    expect(isAllowedHost(undefined, 3000)).toBe(false);
  });

  it("accepts a missing Origin but refuses a foreign one", () => {
    expect(isAllowedOrigin(undefined, 3000)).toBe(true);
    expect(isAllowedOrigin("http://localhost:3000", 3000)).toBe(true);
    expect(isAllowedOrigin("http://evil.example", 3000)).toBe(false);
    expect(isAllowedOrigin("http://localhost:3001", 3000)).toBe(false);
  });
});

describe("socket handshake", () => {
  let h: Harness;
  let roy: string;
  beforeAll(async () => {
    await resetAndSeed();
    roy = await userId("roy");
  });
  beforeEach(async () => {
    h = await startHarness();
  });
  afterEach(async () => {
    await h.close();
  });

  it("refuses a socket from a foreign Origin", async () => {
    await expect(connectAs(h, roy, undefined, { origin: "http://evil.example" })).rejects.toThrow();
  });

  it("refuses a handshake whose Host isn't ours (DNS rebinding)", async () => {
    const port = Number(new URL(h.url).port);
    const handshake = (host: string) =>
      new Promise<number>((resolve, reject) => {
        const req = request({ host: "127.0.0.1", port, path: "/socket.io/?EIO=4&transport=polling", headers: { host } }, (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        });
        req.on("error", reject);
        req.end();
      });
    expect(await handshake(`evil.example:${port}`)).toBe(403);
    expect(await handshake(`127.0.0.1:${port}`)).toBe(200);
  });

  it("refuses a test-login socket once that account has linked Google (KTD5)", async () => {
    const mihaela = await userId("mihaela");
    await db.user.update({ where: { id: mihaela }, data: { googleSub: "g-mihaela" } });
    try {
      await expect(connectAs(h, mihaela)).rejects.toThrow(/unauthorized/);
    } finally {
      await db.user.update({ where: { id: mihaela }, data: { googleSub: null } });
    }
  });

  it("refuses a user who hasn't chosen a username (R7)", async () => {
    const newcomer = await db.user.create({ data: { firstName: "New", lastName: "Comer", email: "nc@gmail.com", googleSub: "g-nc" } });
    // A newcomer only ever has a Google session; a test-login cookie for this account is refused outright (KTD5).
    const cookie = `lc_session=${encodeURIComponent(createSessionValue(newcomer.id, "google"))}`;
    await expect(connectAs(h, null, undefined, { cookie })).rejects.toThrow(/onboarding_required/);
  });

  it("still accepts our own origin", async () => {
    const c = await connectAs(h, roy, undefined, { origin: h.url });
    expect(c.connected).toBe(true);
  });
});
