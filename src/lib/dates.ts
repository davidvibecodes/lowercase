/** Server-local calendar day key, YYYY-MM-DD (KTD11). */
export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

/** Monday-first weekday index: Mon=0 … Sun=6. */
export function weekdayIndex(date: Date = new Date()): number {
  return (date.getDay() + 6) % 7;
}

/** Monday 00:00 of the week containing `date`. */
export function startOfWeek(date: Date = new Date()): Date {
  const out = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  out.setDate(out.getDate() - weekdayIndex(out));
  return out;
}

/** Day keys Mon..Sun for the week containing `date`. */
export function weekDayKeys(date: Date = new Date()): string[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => dayKey(addDays(start, i)));
}
