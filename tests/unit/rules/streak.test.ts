import { describe, expect, it } from "vitest";
import { computeStreak, weekBolts } from "@/lib/rules/streak";

// 2026-10-14 is a Wednesday.
const wed = new Date(2026, 9, 14, 12);

describe("streak and bolts", () => {
  it("counts Mon, Tue, Wed activity on Wednesday as a 3-day streak with three lit bolts", () => {
    const days = new Set(["2026-10-12", "2026-10-13", "2026-10-14"]);
    expect(computeStreak(days, wed)).toBe(3);
    expect(weekBolts(days, wed)).toEqual([true, true, true, false, false, false, false]);
  });

  it("keeps the streak alive when the last activity was yesterday", () => {
    expect(computeStreak(new Set(["2026-10-12", "2026-10-13"]), wed)).toBe(2);
  });

  it("resets to 0 after a two-day gap", () => {
    expect(computeStreak(new Set(["2026-10-11", "2026-10-12"]), wed)).toBe(0);
  });

  it("does not light bolts for last week's days", () => {
    expect(weekBolts(new Set(["2026-10-10", "2026-10-11"]), wed)).toEqual(Array(7).fill(false));
  });
});
