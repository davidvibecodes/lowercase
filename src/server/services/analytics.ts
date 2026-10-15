import { dayKey, startOfWeek, weekDayKeys } from "@/lib/dates";
import type { Db } from "@/lib/db";
import { gateMap } from "@/lib/rules/gates";
import { CASE_TYPES, DIFFICULTIES } from "@/lib/types";
import { getGateResults } from "./progress";

export const RANGES = ["all", "week", "month", "year"] as const;
export type Range = (typeof RANGES)[number];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function rangeStart(range: Range, now = new Date()): Date {
  if (range === "week") return startOfWeek(now);
  if (range === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (range === "year") return new Date(now.getFullYear(), 0, 1);
  return new Date(0);
}

type Bucket = { label: string; key: (d: Date) => boolean };

function buckets(range: Range, now: Date, firstActivity: Date | null): Bucket[] {
  if (range === "week") {
    const keys = weekDayKeys(now);
    return keys.map((k, i) => ({ label: DAYS[i], key: (d) => dayKey(d) === k }));
  }
  if (range === "month") {
    const y = now.getFullYear();
    const m = now.getMonth();
    const days = new Date(y, m + 1, 0).getDate();
    const weeks = Math.ceil(days / 7);
    return Array.from({ length: weeks }, (_, i) => ({
      label: `Wk ${i + 1}`,
      key: (d) => d.getFullYear() === y && d.getMonth() === m && Math.floor((d.getDate() - 1) / 7) === i,
    }));
  }
  if (range === "year") {
    const y = now.getFullYear();
    return MONTHS.map((label, i) => ({ label, key: (d) => d.getFullYear() === y && d.getMonth() === i }));
  }
  // All time: by month from the first activity (at least the last 6 months).
  const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const from = firstActivity && firstActivity < start ? new Date(firstActivity.getFullYear(), firstActivity.getMonth(), 1) : start;
  const out: Bucket[] = [];
  for (let d = new Date(from); d <= now; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const y = d.getFullYear();
    const m = d.getMonth();
    out.push({ label: `${MONTHS[m]}${y !== now.getFullYear() ? ` ${String(y).slice(2)}` : ""}`, key: (x) => x.getFullYear() === y && x.getMonth() === m });
  }
  return out;
}

/** Everything the You page shows for one range (R26). */
export async function getAnalytics(db: Db, userId: string, range: Range, now = new Date()) {
  const since = rangeStart(range, now);
  const [lessons, answers, asInterviewee, asInterviewer, user, gateResults] = await Promise.all([
    db.lessonCompletion.findMany({ where: { userId, createdAt: { gte: since } }, select: { createdAt: true } }),
    db.answerEvent.findMany({ where: { userId, createdAt: { gte: since } }, select: { createdAt: true, firstAttemptCorrect: true } }),
    db.caseResult.findMany({ where: { intervieweeId: userId, solvedAt: { gte: since } }, select: { solvedAt: true, caseType: true, difficulty: true, avgScore: true } }),
    db.caseResult.count({ where: { interviewerId: userId, solvedAt: { gte: since } } }),
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { gateMode: true } }),
    getGateResults(db, userId),
  ]);

  const firstAnswer = answers.reduce<Date | null>((min, a) => (!min || a.createdAt < min ? a.createdAt : min), null);
  const solvedDates = [...answers.map((a) => a.createdAt), ...asInterviewee.map((c) => c.solvedAt)];
  const chart = buckets(range, now, firstAnswer).map((b) => ({ label: b.label, solved: solvedDates.filter((d) => b.key(d)).length }));

  const gates = gateMap(gateResults, user.gateMode);
  const matrix = CASE_TYPES.map((caseType) => ({
    caseType,
    cells: DIFFICULTIES.map((difficulty) => {
      const rows = asInterviewee.filter((r) => r.caseType === caseType && r.difficulty === difficulty);
      return {
        difficulty,
        count: rows.length,
        avgScore: rows.length ? rows.reduce((a, r) => a + r.avgScore, 0) / rows.length : null,
        unlocked: gates[caseType][difficulty],
      };
    }),
  }));

  return {
    range,
    activities: lessons.length + asInterviewee.length + asInterviewer,
    lessons: lessons.length,
    casesSolved: asInterviewee.length + asInterviewer,
    accuracy: answers.length ? answers.filter((a) => a.firstAttemptCorrect).length / answers.length : null,
    answered: answers.length,
    chart,
    matrix,
  };
}

export type Analytics = Awaited<ReturnType<typeof getAnalytics>>;
