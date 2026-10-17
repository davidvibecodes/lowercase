import { afterEach, describe, expect, it, vi } from "vitest";
import { cookiesSecure, hostedConfigProblems, isHosted, publicOrigin } from "@/lib/hosting";
import { devLoginEnabled } from "@/lib/auth/dev-provider";
import { oauthCookieOptions } from "@/lib/auth/google";
import { sessionCookieOptions } from "@/lib/auth/session-cookie";
import { allowedHosts, allowedOrigins, isAllowedHost, isAllowedOrigin } from "@/server/loopback";
import { caseSeeds, publicCaseSeeds } from "../../prisma/seed/cases";
import { dbFilePath, hostedBackupDir } from "@/server/db-file";
import { seedContent } from "@/server/seed-runner";
import { readBundledCasebank, seedBundledCasebank } from "@/server/seed-casebank";
import { db } from "./helpers/db";

const HOSTED = {
  PUBLIC_ORIGIN: "https://trylowercase.app",
  AUTH_SECRET: "a".repeat(64),
  DATABASE_URL: "file:/data/lowercase.db",
  GOOGLE_CLIENT_ID: "id.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "secret",
  GOOGLE_REDIRECT_URI: "https://trylowercase.app/login/google/callback",
};

afterEach(() => vi.unstubAllEnvs());

describe("publicOrigin", () => {
  it("is null locally and normalises a trailing slash when hosted", () => {
    expect(publicOrigin({})).toBeNull();
    expect(publicOrigin({ PUBLIC_ORIGIN: "  " })).toBeNull();
    expect(publicOrigin({ PUBLIC_ORIGIN: "https://trylowercase.app/" })).toBe("https://trylowercase.app");
  });

  it("refuses plain http except on loopback, and anything with a path", () => {
    expect(() => publicOrigin({ PUBLIC_ORIGIN: "http://trylowercase.app" })).toThrow(/https/);
    expect(publicOrigin({ PUBLIC_ORIGIN: "http://localhost:3100" })).toBe("http://localhost:3100");
    expect(() => publicOrigin({ PUBLIC_ORIGIN: "https://trylowercase.app/app" })).toThrow(/no path/);
    expect(() => publicOrigin({ PUBLIC_ORIGIN: "https://u:p@trylowercase.app" })).toThrow(/no path/);
    expect(() => publicOrigin({ PUBLIC_ORIGIN: "not a url" })).toThrow(/valid URL/);
  });
});

describe("hostedConfigProblems", () => {
  it("has nothing to say about a local run", () => {
    expect(hostedConfigProblems({})).toEqual([]);
  });

  it("accepts a fully configured hosted environment", () => {
    expect(hostedConfigProblems(HOSTED)).toEqual([]);
  });

  it("names each missing or placeholder setting", () => {
    const p = hostedConfigProblems({ PUBLIC_ORIGIN: "https://trylowercase.app", AUTH_SECRET: "replace-with-a-long-random-string", GOOGLE_CLIENT_ID: "your-client-id" });
    expect(p.join("\n")).toMatch(/AUTH_SECRET/);
    expect(p.join("\n")).toMatch(/DATABASE_URL/);
    expect(p.join("\n")).toMatch(/GOOGLE_CLIENT_ID/);
    expect(p.join("\n")).toMatch(/GOOGLE_REDIRECT_URI must be exactly https:\/\/trylowercase\.app\/login\/google\/callback/);
  });

  it("rejects a short secret and a redirect for another host", () => {
    expect(hostedConfigProblems({ ...HOSTED, AUTH_SECRET: "short" }).join()).toMatch(/AUTH_SECRET/);
    expect(hostedConfigProblems({ ...HOSTED, GOOGLE_REDIRECT_URI: "http://localhost:3000/login/google/callback" }).join()).toMatch(/GOOGLE_REDIRECT_URI/);
  });
});

describe("host and origin checks when hosted", () => {
  it("pin to the public address and stop answering loopback names", () => {
    vi.stubEnv("PUBLIC_ORIGIN", "https://trylowercase.app");
    expect(allowedHosts(3000)).toEqual(["trylowercase.app"]);
    expect(allowedOrigins(3000)).toEqual(["https://trylowercase.app"]);
    expect(isAllowedHost("trylowercase.app", 3000)).toBe(true);
    expect(isAllowedHost("TryLowercase.app", 3000)).toBe(true);
    expect(isAllowedHost("localhost:3000", 3000)).toBe(false);
    expect(isAllowedHost("evil.example", 3000)).toBe(false);
    expect(isAllowedHost("trylowercase.app.evil.example", 3000)).toBe(false);
    expect(isAllowedOrigin(undefined, 3000)).toBe(true);
    expect(isAllowedOrigin("https://trylowercase.app", 3000)).toBe(true);
    expect(isAllowedOrigin("http://trylowercase.app", 3000)).toBe(false);
    expect(isAllowedOrigin("http://localhost:3000", 3000)).toBe(false);
  });

  it("keep the loopback behaviour when PUBLIC_ORIGIN is unset", () => {
    expect(isHosted()).toBe(false);
    expect(isAllowedHost("localhost:3000", 3000)).toBe(true);
    expect(isAllowedHost("trylowercase.app", 3000)).toBe(false);
  });
});

describe("hosted mode switches", () => {
  it("turns the test login off even when AUTH_MODE is dev", () => {
    vi.stubEnv("AUTH_MODE", "dev");
    expect(devLoginEnabled()).toBe(true);
    vi.stubEnv("PUBLIC_ORIGIN", "https://trylowercase.app");
    expect(devLoginEnabled()).toBe(false);
  });

  it("makes session and sign-in cookies Secure over https only", () => {
    expect(cookiesSecure()).toBe(false);
    expect(sessionCookieOptions.secure).toBe(false);
    vi.stubEnv("PUBLIC_ORIGIN", "https://trylowercase.app");
    expect(sessionCookieOptions.secure).toBe(true);
    expect(oauthCookieOptions.secure).toBe(true);
    expect({ ...oauthCookieOptions }.secure).toBe(true);
    expect(sessionCookieOptions.httpOnly).toBe(true);
    expect(oauthCookieOptions.path).toBe("/login/google");
    vi.stubEnv("PUBLIC_ORIGIN", "http://localhost:3100");
    expect(sessionCookieOptions.secure).toBe(false);
  });
});

describe("database file helpers", () => {
  it("resolves relative paths from prisma/ and keeps absolute ones", () => {
    expect(dbFilePath("file:/data/lowercase.db", "/app/prisma")).toBe("/data/lowercase.db");
    expect(dbFilePath("file:./dev.db?connection_limit=1", "/app/prisma")?.replace(/\\/g, "/")).toMatch(/\/app\/prisma\/dev\.db$|prisma\/dev\.db$/);
    expect(dbFilePath("postgres://x", "/app/prisma")).toBeNull();
    expect(dbFilePath(undefined, "/app/prisma")).toBeNull();
  });

  it("keeps hosted backups beside the database file", () => {
    expect(hostedBackupDir("file:/data/lowercase.db", "/app/prisma")?.replace(/\\/g, "/")).toMatch(/\/data\/backups$/);
  });
});

describe("the public seed", () => {
  it("leaves out the licensed Mumbai case and every person", async () => {
    expect(publicCaseSeeds.some((c) => c.title.includes("Mumbai"))).toBe(false);
    expect(caseSeeds.length).toBe(publicCaseSeeds.length + 1);
    const tables = await db.$queryRawUnsafe<Array<{ name: string }>>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_prisma%' AND name NOT LIKE 'sqlite_%'",
    );
    await db.$executeRawUnsafe("PRAGMA foreign_keys = OFF;");
    for (const t of tables) await db.$executeRawUnsafe(`DELETE FROM "${t.name}";`);
    await db.$executeRawUnsafe("PRAGMA foreign_keys = ON;");
    await db.$transaction((tx) => seedContent(tx));
    expect(await db.user.count()).toBe(0);
    expect(await db.friendship.count()).toBe(0);
    const titles = (await db.case.findMany({ select: { title: true } })).map((c) => c.title);
    expect(titles).toHaveLength(publicCaseSeeds.length);
    expect(titles.some((t) => t.includes("Mumbai"))).toBe(false);
    expect(await db.concept.count()).toBeGreaterThan(0);
  });

  it("then brings in the bundled casebank once, as the importer would", async () => {
    const doc = readBundledCasebank() as { cases: Array<{ case_id: string }> };
    expect(doc.cases.map((c) => c.case_id)).toEqual(["CASE_001", "CASE_002", "CASE_003", "CASE_004"]);
    const first = await seedBundledCasebank(db);
    expect(first.ok && first.outcomes.map((o) => o.status)).toEqual(["applied", "applied", "applied", "applied"]);
    const imported = await db.case.findMany({ where: { externalId: { not: null } }, orderBy: { externalId: "asc" } });
    expect(imported.map((c) => c.title)).toEqual(["Delhi Metro Network", "Five Star Hotel", "Car Insurance Company", "Tractor Insurance Provider"]);
    expect(imported.every((c) => c.published)).toBe(true);
    // Running it again converges: nothing is duplicated.
    await seedBundledCasebank(db);
    expect(await db.case.count({ where: { externalId: { not: null } } })).toBe(4);
    expect(await db.user.count()).toBe(0);
  });
});
