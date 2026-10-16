import { describe, expect, it } from "vitest";
import { normalizeUsername } from "@/lib/username";

describe("normalizeUsername (R8)", () => {
  it("trims, strips a leading @ and lowercases", () => {
    expect(normalizeUsername("  @Alex_99 ")).toEqual({ ok: true, username: "alex_99" });
    expect(normalizeUsername("aarav.m")).toEqual({ ok: true, username: "aarav.m" });
    expect(normalizeUsername("davidsathyandevice")).toEqual({ ok: true, username: "davidsathyandevice" });
  });

  it("enforces length", () => {
    expect(normalizeUsername("ab")).toEqual({ ok: false, reason: "Use 3–20 characters" });
    expect(normalizeUsername("a".repeat(21))).toEqual({ ok: false, reason: "Use 3–20 characters" });
    expect(normalizeUsername("a".repeat(20)).ok).toBe(true);
  });

  it("requires a leading letter", () => {
    expect(normalizeUsername("9lives")).toEqual({ ok: false, reason: "Start with a letter" });
    expect(normalizeUsername("_alex")).toEqual({ ok: false, reason: "Start with a letter" });
  });

  it("allows only a–z, digits, dots and underscores", () => {
    for (const bad of ["al ex", "alé", "alex!", "al-ex"]) {
      expect(normalizeUsername(bad), bad).toEqual({ ok: false, reason: "Use only letters a–z, digits, dots and underscores" });
    }
  });
});

describe("claiming a username (R9, R10)", async () => {
  const { db, resetAndSeed } = await import("./helpers/db");
  const { checkUsername, claimUsername, TAKEN } = await import("@/server/services/username");
  const newcomer = (n: number) => db.user.create({ data: { firstName: "New", lastName: `${n}`, email: `new${n}@gmail.com`, googleSub: `g-new-${n}` } });

  it("reports availability case-insensitively against stored names", async () => {
    await resetAndSeed();
    expect(await checkUsername(db, "Roy")).toEqual({ available: false, reason: "taken" });
    expect(await checkUsername(db, "@fresh_name")).toEqual({ available: true });
    expect(await checkUsername(db, "9lives")).toEqual({ available: false, reason: "Start with a letter" });
  });

  it("covers AE1: two people saving the same name at once, exactly one wins", async () => {
    await resetAndSeed();
    const [ana, ben] = [await newcomer(1), await newcomer(2)];
    const results = await Promise.all([claimUsername(db, ana.id, "alex"), claimUsername(db, ben.id, "Alex")]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, error: TAKEN });
    expect(await db.user.count({ where: { username: "alex" } })).toBe(1);
  });

  it("stores the lowercase form and can't overwrite an existing name", async () => {
    await resetAndSeed();
    const ana = await newcomer(3);
    expect(await claimUsername(db, ana.id, "  @Ana_Lima ")).toEqual({ ok: true, username: "ana_lima" });
    expect(await claimUsername(db, ana.id, "another")).toEqual({ ok: false, error: "You already have a username" });
    expect((await db.user.findUniqueOrThrow({ where: { id: ana.id } })).username).toBe("ana_lima");
  });
});
