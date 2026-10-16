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
