import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { devLoginProvider } from "@/lib/auth/dev-provider";
import { createSessionValue, sessionValueFromCookieHeader, verifySessionValue } from "@/lib/auth/session-cookie";
import { peerTesterUrl } from "@/lib/peer-url";
import { resetAndSeed } from "./helpers/db";

describe("session cookie", () => {
  it("round-trips a user id", () => {
    expect(verifySessionValue(createSessionValue("user_123"))).toBe("user_123");
  });

  it("rejects a value with one changed byte", () => {
    const v = createSessionValue("user_123");
    const tampered = v.slice(0, -1) + (v.endsWith("A") ? "B" : "A");
    expect(verifySessionValue(tampered)).toBeNull();
  });

  it("rejects a value signed with another secret", () => {
    const v = createSessionValue("user_123");
    const prev = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "different-secret";
    try {
      expect(verifySessionValue(v)).toBeNull();
    } finally {
      process.env.AUTH_SECRET = prev;
    }
  });

  it("rejects an expired value", () => {
    const v = createSessionValue("user_123", Date.now() - 31 * 24 * 3600 * 1000);
    expect(verifySessionValue(v)).toBeNull();
  });

  it("reads the cookie from a raw Cookie header", () => {
    const v = createSessionValue("abc");
    expect(sessionValueFromCookieHeader(`foo=1; lc_session=${encodeURIComponent(v)}; bar=2`)).toBe(v);
    expect(sessionValueFromCookieHeader("foo=1")).toBeNull();
  });
});

describe("dev login provider", () => {
  beforeAll(async () => {
    await resetAndSeed();
  });
  afterEach(() => {
    process.env.AUTH_MODE = "dev";
  });

  it("signs in a seeded user by username", async () => {
    const r = await devLoginProvider.signIn({ username: "davidsathyandevice" });
    expect(r.ok && r.user.isAdmin).toBe(true);
  });

  it("fails for an unknown username", async () => {
    expect(await devLoginProvider.signIn({ username: "nobody" })).toEqual({ ok: false, error: "No such test user" });
  });

  it("is refused when AUTH_MODE is not dev", async () => {
    delete process.env.AUTH_MODE;
    const r = await devLoginProvider.signIn({ username: "davidsathyandevice" });
    expect(r.ok).toBe(false);
  });
});

describe("peer tester url", () => {
  it("targets the other loopback hostname on the same port", () => {
    expect(peerTesterUrl("roy", { protocol: "http:", hostname: "localhost", port: "3000" })).toBe("http://127.0.0.1:3000/login/as/roy");
    expect(peerTesterUrl("roy", { protocol: "http:", hostname: "127.0.0.1", port: "3000" })).toBe("http://localhost:3000/login/as/roy");
  });
});
