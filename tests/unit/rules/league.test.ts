import { describe, expect, it } from "vitest";
import { ADVANCE_CUTOFF, leagueDaysLeft, leagueStandings, standingsWindow } from "@/lib/rules/league";

const m = (id: string, name: string, weeklyXp: number) => ({ id, name, weeklyXp });

describe("league", () => {
  it("ranks by weekly XP, breaking ties by name", () => {
    const s = leagueStandings([m("1", "zed", 100), m("2", "amy", 100), m("3", "bob", 300)]);
    expect(s.map((x) => [x.name, x.rank])).toEqual([["bob", 1], ["amy", 2], ["zed", 3]]);
  });

  it("marks the top 15 as advancing", () => {
    const s = leagueStandings(Array.from({ length: 20 }, (_, i) => m(String(i), `u${String(i).padStart(2, "0")}`, 1000 - i)));
    expect(s.filter((x) => x.advancing)).toHaveLength(ADVANCE_CUTOFF);
    expect(s[14].advancing).toBe(true);
    expect(s[15].advancing).toBe(false);
  });

  it("counts days left until Sunday", () => {
    expect(leagueDaysLeft(new Date(2026, 9, 14))).toBe(4); // Wednesday
    expect(leagueDaysLeft(new Date(2026, 9, 18))).toBe(0); // Sunday
  });

  it("returns a three-row window centred on the user", () => {
    const s = leagueStandings(Array.from({ length: 10 }, (_, i) => m(String(i), `u${i}`, 100 - i)));
    expect(standingsWindow(s, "5").map((x) => x.id)).toEqual(["4", "5", "6"]);
    expect(standingsWindow(s, "0").map((x) => x.id)).toEqual(["0", "1", "2"]);
    expect(standingsWindow(s, "9").map((x) => x.id)).toEqual(["7", "8", "9"]);
  });
});
