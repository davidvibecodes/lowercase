import type { Prisma } from "@prisma/client";
import { dayKey, weekDayKeys } from "@/lib/dates";
import type { Db } from "@/lib/db";
import type { GateResult } from "@/lib/rules/gates";
import { computeStreak, weekBolts } from "@/lib/rules/streak";
import { XP_FIRST_TRY_CORRECT, XP_INTERVIEWEE_SOLVE, XP_INTERVIEWER_SOLVE } from "@/lib/rules/xp";

type Tx = Prisma.TransactionClient;

/** Adds one activity (and its XP) to today's row and the user's total. */
async function bumpActivity(tx: Tx, userId: string, xp: number, now: Date) {
  const day = dayKey(now);
  await tx.dailyActivity.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, activities: 1, xp },
    update: { activities: { increment: 1 }, xp: { increment: xp } },
  });
  if (xp) await tx.user.update({ where: { id: userId }, data: { xp: { increment: xp } } });
}

export type LessonAnswerInput = {
  questionId: string;
  /** Option ids in the order the learner checked them. */
  attempts: string[];
  /** True when the learner pressed See Answer. */
  revealed: boolean;
};

/**
 * Commits a finished lesson (Key Decisions: a lesson commits only at completion).
 * Correctness is recomputed from stored options; the client payload is not trusted.
 */
export async function recordLessonCompletion(db: Db, userId: string, conceptId: string, answers: LessonAnswerInput[], now = new Date()) {
  const ids = [...new Set(answers.map((a) => a.questionId))];
  if (ids.length !== answers.length) throw new Error("Duplicate question in lesson");
  const questions = await db.question.findMany({ where: { id: { in: ids }, conceptId }, include: { options: true } });
  if (questions.length !== ids.length) throw new Error("Lesson contains questions from another concept");
  const byId = new Map(questions.map((q) => [q.id, q]));

  let firstTryCorrect = 0;
  const mastered: string[] = [];
  const events: Array<{ questionId: string; firstAttemptCorrect: boolean }> = [];
  for (const a of answers) {
    const q = byId.get(a.questionId)!;
    const correct = q.options.find((o) => o.isCorrect)?.id;
    const first = a.attempts[0] === correct;
    const eventually = a.attempts.includes(correct ?? "");
    if (first) firstTryCorrect++;
    if (eventually) mastered.push(q.id);
    events.push({ questionId: q.id, firstAttemptCorrect: first });
  }
  const xp = firstTryCorrect * XP_FIRST_TRY_CORRECT;

  await db.$transaction(async (tx) => {
    await tx.answerEvent.createMany({ data: events.map((e) => ({ ...e, userId, conceptId, createdAt: now })) });
    for (const questionId of mastered) {
      await tx.questionMastery.upsert({ where: { userId_questionId: { userId, questionId } }, create: { userId, questionId }, update: {} });
    }
    await tx.lessonCompletion.create({ data: { userId, conceptId, questions: answers.length, firstTryCorrect, xp, createdAt: now } });
    await bumpActivity(tx, userId, xp, now);
  });
  return { xp, firstTryCorrect, total: answers.length, mastered: mastered.length };
}

export type CaseSolvedInput = {
  sessionId: string;
  round: number;
  caseId: string | null;
  caseType: string;
  difficulty: number;
  interviewerId: string;
  intervieweeId: string;
  avgScore: number;
};

/** Records a solved case: result for gates/analytics, XP for both roles. */
export async function recordCaseSolved(db: Db | Tx, input: CaseSolvedInput, now = new Date()) {
  const run = async (tx: Tx) => {
    await tx.caseResult.create({ data: { ...input, solvedAt: now } });
    await bumpActivity(tx, input.intervieweeId, XP_INTERVIEWEE_SOLVE, now);
    await bumpActivity(tx, input.interviewerId, XP_INTERVIEWER_SOLVE, now);
  };
  if ("$transaction" in db) await db.$transaction(run);
  else await run(db);
  return { avgScore: input.avgScore, xp: { [input.intervieweeId]: XP_INTERVIEWEE_SOLVE, [input.interviewerId]: XP_INTERVIEWER_SOLVE } };
}

export async function getActiveDays(db: Db, userId: string): Promise<Set<string>> {
  const rows = await db.dailyActivity.findMany({ where: { userId, activities: { gt: 0 } }, select: { day: true } });
  return new Set(rows.map((r) => r.day));
}

export async function getUserProgress(db: Db, userId: string, now = new Date()) {
  const [user, days, week] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { xp: true, gateMode: true } }),
    getActiveDays(db, userId),
    db.dailyActivity.findMany({ where: { userId, day: { in: weekDayKeys(now) } }, select: { xp: true } }),
  ]);
  return {
    xp: user.xp,
    gateMode: user.gateMode,
    streak: computeStreak(days, now),
    bolts: weekBolts(days, now),
    weeklyXp: week.reduce((a, r) => a + r.xp, 0),
  };
}

export async function getGateResults(db: Db, userId: string): Promise<GateResult[]> {
  return db.caseResult.findMany({ where: { intervieweeId: userId }, select: { caseType: true, difficulty: true, avgScore: true } });
}

/** First-attempt history on a concept, oldest first (KTD10 input). */
export async function getConceptHistory(db: Db, userId: string, conceptId: string): Promise<boolean[]> {
  const rows = await db.answerEvent.findMany({ where: { userId, conceptId }, orderBy: { createdAt: "asc" }, select: { firstAttemptCorrect: true } });
  return rows.map((r) => r.firstAttemptCorrect);
}
