import { addDays, dayKey, weekDayKeys } from "@/lib/dates";

/** Consecutive active days ending today, or yesterday if today has no activity yet. */
export function computeStreak(activeDays: Set<string>, today: Date = new Date()): number {
  let cursor = activeDays.has(dayKey(today)) ? today : addDays(today, -1);
  let streak = 0;
  while (activeDays.has(dayKey(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Mon..Sun of the current week: did the user do anything that day? */
export function weekBolts(activeDays: Set<string>, today: Date = new Date()): boolean[] {
  return weekDayKeys(today).map((k) => activeDays.has(k));
}
