import { beforeEach, describe, expect, it } from "vitest";
import type { GoogleClaims } from "@/lib/auth/google";
import { resolveGoogleUser, safeAvatarUrl } from "@/server/services/google-account";
import { db, resetAndSeed, userId } from "./helpers/db";

const claims = (over: Partial<GoogleClaims> = {}): GoogleClaims => ({
  sub: "g-100",
  email: "ana@gmail.com",
  email_verified: true,
  name: "Ana Lima",
  given_name: "Ana",
  family_name: "Lima",
  picture: "https://lh3.googleusercontent.com/a/abc",
  ...over,
});

beforeEach(async () => {
  await resetAndSeed();
});

describe("resolveGoogleUser (KTD4)", () => {
  it("creates a new account with no username yet, the photo and a lowercase email", async () => {
    const r = await resolveGoogleUser(db, claims({ email: "Ana@Gmail.com" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.user).toMatchObject({
      username: null,
      googleSub: "g-100",
      email: "ana@gmail.com",
      firstName: "Ana",
      lastName: "Lima",
      avatarUrl: "https://lh3.googleusercontent.com/a/abc",
    });
  });

  it("links the seeded owner by verified email and keeps his username and history", async () => {
    const owner = await userId("davidsathyandevice");
    const xp = (await db.user.findUniqueOrThrow({ where: { id: owner } })).xp;
    const r = await resolveGoogleUser(db, claims({ sub: "g-owner", email: "DavidSathyanDevice@gmail.com", name: "David Sathyan" }));
    expect(r.ok && r.user.id).toBe(owner);
    expect(await db.user.findUniqueOrThrow({ where: { id: owner } })).toMatchObject({ googleSub: "g-owner", username: "davidsathyandevice", xp });
  });

  it("matches by sub first and follows an email change", async () => {
    const first = await resolveGoogleUser(db, claims());
    const again = await resolveGoogleUser(db, claims({ email: "ana.lima@gmail.com" }));
    expect(first.ok && again.ok && again.user.id === first.user.id).toBe(true);
    expect(again.ok && again.user.email).toBe("ana.lima@gmail.com");
  });

  it("refuses an email already linked to a different Google account and changes nothing", async () => {
    await resolveGoogleUser(db, claims());
    const before = await db.user.count();
    expect(await resolveGoogleUser(db, claims({ sub: "g-other" }))).toEqual({ ok: false, code: "google_conflict" });
    expect(await db.user.count()).toBe(before);
  });

  it("refuses an unverified email and creates nothing", async () => {
    const before = await db.user.count();
    expect(await resolveGoogleUser(db, claims({ email_verified: false }))).toEqual({ ok: false, code: "google_unverified" });
    expect(await db.user.count()).toBe(before);
  });

  it("never links a league bot", async () => {
    const bot = await db.user.findFirstOrThrow({ where: { isLeagueBot: true } });
    expect(await resolveGoogleUser(db, claims({ email: bot.email }))).toEqual({ ok: false, code: "google_conflict" });
    expect((await db.user.findUniqueOrThrow({ where: { id: bot.id } })).googleSub).toBeNull();
  });

  it("produces one account when two first callbacks race", async () => {
    const [a, b] = await Promise.all([resolveGoogleUser(db, claims()), resolveGoogleUser(db, claims())]);
    expect(a.ok && b.ok).toBe(true);
    expect(await db.user.count({ where: { googleSub: "g-100" } })).toBe(1);
  });

  it("maps a mononymous account to an empty last name", async () => {
    const r = await resolveGoogleUser(db, claims({ name: "Madonna", given_name: undefined, family_name: undefined }));
    expect(r.ok && [r.user.firstName, r.user.lastName]).toEqual(["Madonna", ""]);
  });
});

describe("safeAvatarUrl", () => {
  it("keeps only https Google photo URLs", () => {
    expect(safeAvatarUrl("https://lh3.googleusercontent.com/a/x")).toBe("https://lh3.googleusercontent.com/a/x");
    expect(safeAvatarUrl("http://lh3.googleusercontent.com/a/x")).toBeNull();
    expect(safeAvatarUrl("https://evil.example/x.png")).toBeNull();
    expect(safeAvatarUrl("https://googleusercontent.com.evil.example/x")).toBeNull();
    expect(safeAvatarUrl(undefined)).toBeNull();
  });
});
