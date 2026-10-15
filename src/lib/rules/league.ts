import { weekdayIndex } from "@/lib/dates";

export const ADVANCE_CUTOFF = 15;

export type LeagueMember = { id: string; username: string; name: string; weeklyXp: number };
export type Standing = LeagueMember & { rank: number; advancing: boolean };

export function leagueStandings(members: LeagueMember[]): Standing[] {
  return [...members]
    .sort((a, b) => b.weeklyXp - a.weeklyXp || a.username.localeCompare(b.username))
    .map((m, i) => ({ ...m, rank: i + 1, advancing: i < ADVANCE_CUTOFF }));
}

/** Full days left after today until the week ends on Sunday. */
export function leagueDaysLeft(today: Date = new Date()): number {
  return 6 - weekdayIndex(today);
}

/** Three rows centred on the user (clamped at the ends). */
export function standingsWindow(standings: Standing[], userId: string, size = 3): Standing[] {
  const i = standings.findIndex((s) => s.id === userId);
  if (i < 0) return standings.slice(0, size);
  const start = Math.max(0, Math.min(i - Math.floor(size / 2), standings.length - size));
  return standings.slice(start, start + size);
}
