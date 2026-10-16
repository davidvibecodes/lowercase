import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { devLoginProvider } from "@/lib/auth/dev-provider";
import { toSessionUser } from "@/lib/auth/provider";
import { createSessionValue, sessionValueFromCookieHeader, sign, verifySessionValue } from "@/lib/auth/session-cookie";
import { peerTesterUrl } from "@/lib/peer-url";
import { db, resetAndSeed } from "./helpers/db";

describe("session cookie", () => {
  it("round-trips a user id and how they signed in", () => {
    expect(verifySessionValue(createSessionValue("user_123", "google"))).toEqual({ userId: "user_123", method: "google" });
    expect(verifySessionValue(createSessionValue("user_123", "dev"))).toEqual({ userId: "user_123", method: "dev" });
  });

  it("rejects a value with one changed byte", () => {
    const v = createSessionValue("user_123", "dev");
    const tampered = v.slice(0, -1) + (v.endsWith("A") ? "B" : "A");
    expect(verifySessionValue(tampered)).toBeNull();
  });

  it("rejects a dev session edited to claim Google", () => {
    const [id, , issued, sig] = createSessionValue("user_123", "dev").split(".");
    expect(verifySessionValue([id, "google", issued, sig].join("."))).toBeNull();
  });

  it("rejects an unknown or missing method even when correctly signed", () => {
    const id = Buffer.from("user_123").toString("base64url");
    const issued = Math.floor(Date.now() / 1000);
    expect(verifySessionValue(`${id}.root.${issued}.${sign(`${id}.root.${issued}`)}`)).toBeNull();
    // The pre-method format (id.issued.sig) is no longer accepted, so old cookies sign in again.
    expect(verifySessionValue(`${id}.${issued}.${sign(`${id}.${issued}`)}`)).toBeNull();
  });

  it("rejects a value signed with another secret", () => {
    const v = createSessionValue("user_123", "google");
    const prev = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "different-secret";
    try {
      expect(verifySessionValue(v)).toBeNull();
    } finally {
      process.env.AUTH_SECRET = prev;
    }
  });

  it("rejects an expired value", () => {
    const v = createSessionValue("user_123", "dev", Date.now() - 31 * 24 * 3600 * 1000);
    expect(verifySessionValue(v)).toBeNull();
  });

  it("reads the cookie from a raw Cookie header", () => {
    const v = createSessionValue("abc", "dev");
    expect(sessionValueFromCookieHeader(`foo=1; lc_session=${encodeURIComponent(v)}; bar=2`)).toBe(v);
    expect(sessionValueFromCookieHeader("foo=1")).toBeNull();
  });
});

describe("admin is decided only from a Google session on the admin email (R11)", () => {
  beforeEach(async () => {
    await resetAndSeed();
  });

  it("covers AE2: the owner is admin through Google, not through the test login", async () => {
    const owner = await db.user.findUniqueOrThrow({ where: { username: "davidsathyandevice" } });
    const roy = await db.user.findUniqueOrThrow({ where: { username: "roy" } });
    expect(toSessionUser(owner, "google").isAdmin).toBe(true);
    expect(toSessionUser(owner, "dev").isAdmin).toBe(false);
    expect(toSessionUser(roy, "google").isAdmin).toBe(false);
  });
});

describe("dev login provider", () => {
  beforeEach(async () => {
    await resetAndSeed();
  });
  afterEach(() => {
    process.env.AUTH_MODE = "dev";
  });

  it("signs in a seeded test account, never as admin", async () => {
    const r = await devLoginProvider.signIn({ username: "davidsathyandevice" });
    expect(r.ok && r.user.isAdmin).toBe(false);
    expect((await devLoginProvider.signIn({ username: " Roy " })).ok).toBe(true);
  });

  it("refuses accounts outside the seeded test list, such as a real friend who signed up with Google", async () => {
    await db.user.create({ data: { username: "realfriend", firstName: "Real", lastName: "Friend", email: "real@gmail.com", googleSub: "g-1" } });
    expect(await devLoginProvider.signIn({ username: "realfriend" })).toEqual({ ok: false, error: "No such test user" });
    expect(await devLoginProvider.signIn({ username: "aarav.m" })).toEqual({ ok: false, error: "No such test user" });
    expect(await devLoginProvider.signIn({ username: "nobody" })).toEqual({ ok: false, error: "No such test user" });
  });

  it("refuses a seeded account once it has signed in with Google", async () => {
    await db.user.update({ where: { username: "davidsathyandevice" }, data: { googleSub: "g-owner" } });
    expect(await devLoginProvider.signIn({ username: "davidsathyandevice" })).toEqual({ ok: false, error: "This account signs in with Google" });
  });

  it("is refused when AUTH_MODE is not dev", async () => {
    delete process.env.AUTH_MODE;
    const r = await devLoginProvider.signIn({ username: "roy" });
    expect(r.ok).toBe(false);
  });
});

describe("peer tester url", () => {
  it("targets the other loopback hostname on the same port", () => {
    expect(peerTesterUrl("roy", { protocol: "http:", hostname: "localhost", port: "3000" })).toBe("http://127.0.0.1:3000/login/as/roy");
    expect(peerTesterUrl("roy", { protocol: "http:", hostname: "127.0.0.1", port: "3000" })).toBe("http://localhost:3000/login/as/roy");
  });
});
