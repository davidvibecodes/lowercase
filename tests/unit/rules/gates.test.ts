import { describe, expect, it } from "vitest";
import { gateMap, isLevelUnlocked, type GateResult } from "@/lib/rules/gates";

const r = (caseType: string, difficulty: number, avgScore: number): GateResult => ({ caseType, difficulty, avgScore });

describe("progress gates (R25)", () => {
  it("opens only Level 1 with no results", () => {
    expect(isLevelUnlocked([], "Profitability", 1, "auto")).toBe(true);
    expect(isLevelUnlocked([], "Profitability", 2, "auto")).toBe(false);
    expect(isLevelUnlocked([], "Profitability", 3, "auto")).toBe(false);
  });

  it("unlocks Level 2 after a Level 1 solve averaging exactly 4.0, but not Level 3", () => {
    const res = [r("Profitability", 1, 4.0)];
    expect(isLevelUnlocked(res, "Profitability", 2, "auto")).toBe(true);
    expect(isLevelUnlocked(res, "Profitability", 3, "auto")).toBe(false);
  });

  it("keeps Level 2 locked after a 3.9 average", () => {
    expect(isLevelUnlocked([r("Profitability", 1, 3.9)], "Profitability", 2, "auto")).toBe(false);
  });

  it("does not let another case type's result unlock this type", () => {
    expect(isLevelUnlocked([r("Pricing", 1, 5)], "Profitability", 2, "auto")).toBe(false);
  });

  it("honours the admin testing modes", () => {
    expect(isLevelUnlocked([], "M&A", 3, "forceUnlocked")).toBe(true);
    expect(isLevelUnlocked([r("M&A", 1, 5), r("M&A", 2, 5)], "M&A", 2, "forceLocked")).toBe(false);
    expect(isLevelUnlocked([], "M&A", 1, "forceLocked")).toBe(true);
  });

  it("builds a full type × level map", () => {
    const m = gateMap([r("Profitability", 1, 4.5)], "auto");
    expect(m.Profitability).toEqual({ 1: true, 2: true, 3: false });
    expect(m.Pricing).toEqual({ 1: true, 2: false, 3: false });
  });
});
